import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import {
  DB_SCHEMA_OUT_OF_SYNC_MESSAGE,
  isPrismaMissingColumnError,
  isPrismaMissingRelationOrTable,
} from "../lib/prismaErrors.js";
import {
  STREAK_LOOKBACK_DAYS,
  STREAK_MIN_MINUTES,
  type DailyRow as StreakDailyRow,
  buildStudentStreakCopy,
  computeCurrentStreakClassDays,
} from "../lib/streak.js";
import { getRoomParticipantIdentities, identityInRoom } from "../lib/livekitRoomAdmin.js";

const TICK_SECONDS = 30;
const MIN_MS_BETWEEN_TICKS = 25000;

function utcDayStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function recordJoin(req: Request, res: Response): Promise<void> {
  try {
    const { classId, email } = req.body as { classId?: string; email?: string };

    if (!classId?.trim() || !email?.trim()) {
      res.status(400).json({ error: "classId and email are required" });
      return;
    }

    const cls = await prisma.class.findUnique({ where: { id: classId } });
    if (!cls) {
      res.status(404).json({ error: "Class not found" });
      return;
    }

    const record = await prisma.attendance.create({
      data: {
        classId: classId.trim(),
        email: email.trim().toLowerCase(),
      },
    });

    res.status(201).json({
      id: record.id,
      classId: record.classId,
      email: record.email,
      joinTime: record.joinTime,
    });
  } catch (err) {
    console.error("Attendance join error:", err);
    res.status(500).json({ error: "Failed to record join" });
  }
}

export async function recordLeave(req: Request, res: Response): Promise<void> {
  try {
    const { classId, email } = req.body as { classId?: string; email?: string };

    if (!classId?.trim() || !email?.trim()) {
      res.status(400).json({ error: "classId and email are required" });
      return;
    }

    const latest = await prisma.attendance.findFirst({
      where: {
        classId: classId.trim(),
        email: email.trim().toLowerCase(),
        leaveTime: null,
      },
      orderBy: { joinTime: "desc" },
    });

    if (!latest) {
      res.status(404).json({ error: "No active attendance record found" });
      return;
    }

    const leaveTime = new Date();
    const duration = Math.floor(
      (leaveTime.getTime() - latest.joinTime.getTime()) / 1000
    );

    const updated = await prisma.attendance.update({
      where: { id: latest.id },
      data: { leaveTime, duration },
    });

    res.json({
      id: updated.id,
      email: updated.email,
      joinTime: updated.joinTime,
      leaveTime: updated.leaveTime,
      duration: updated.duration,
    });
  } catch (err) {
    console.error("Attendance leave error:", err);
    res.status(500).json({ error: "Failed to record leave" });
  }
}

/**
 * Student-only: credits TICK_SECONDS toward today's total only if both host and student
 * are currently connected to the class LiveKit room (verified server-side).
 */
export async function recordAttendanceTick(req: Request, res: Response): Promise<void> {
  try {
    if (req.user!.role === "TEACHER") {
      res.status(403).json({ error: "Attendance ticks are for students only" });
      return;
    }

    const { classId } = req.body as { classId?: string };
    if (!classId?.trim()) {
      res.status(400).json({ error: "classId is required" });
      return;
    }

    const email = req.user!.email.trim().toLowerCase();
    const cls = await prisma.class.findUnique({
      where: { id: classId.trim() },
      include: { teacher: { select: { email: true } } },
    });

    if (!cls) {
      res.status(404).json({ error: "Class not found" });
      return;
    }

    const invited = await prisma.classInvite.findFirst({
      where: { classId: cls.id, email },
    });
    if (!invited) {
      res.status(403).json({ error: "You are not invited to this class" });
      return;
    }

    const identities = await getRoomParticipantIdentities(cls.roomName);
    const teacherEmail = cls.teacher.email.trim().toLowerCase();

    if (!identityInRoom(identities, teacherEmail) || !identityInRoom(identities, email)) {
      res.json({
        credited: false,
        seconds: 0,
        reason: "host_or_student_not_in_room",
      });
      return;
    }

    const now = new Date();
    const day = utcDayStart(now);

    const existing = await prisma.classAttendanceDaily.findUnique({
      where: {
        classId_email_day: {
          classId: cls.id,
          email,
          day,
        },
      },
    });

    if (existing && now.getTime() - existing.updatedAt.getTime() < MIN_MS_BETWEEN_TICKS) {
      res.json({
        credited: false,
        seconds: existing.seconds,
        reason: "rate_limited",
      });
      return;
    }

    const updated = await prisma.classAttendanceDaily.upsert({
      where: {
        classId_email_day: {
          classId: cls.id,
          email,
          day,
        },
      },
      create: {
        classId: cls.id,
        email,
        day,
        seconds: TICK_SECONDS,
      },
      update: {
        seconds: { increment: TICK_SECONDS },
      },
    });

    res.json({
      credited: true,
      seconds: updated.seconds,
      day: day.toISOString().slice(0, 10),
    });
  } catch (err) {
    console.error("Attendance tick error:", err);
    if (isPrismaMissingRelationOrTable(err)) {
      res.status(503).json({ error: DB_SCHEMA_OUT_OF_SYNC_MESSAGE });
      return;
    }
    res.status(500).json({ error: "Failed to record attendance tick" });
  }
}

/** Student: credited time per class and per day (host-present time only). */
export async function listMyAttendanceSummary(req: Request, res: Response): Promise<void> {
  try {
    const email = req.user!.email.trim().toLowerCase();

    const invites = await prisma.classInvite.findMany({
      where: { email },
      include: { class: { select: { id: true, name: true } } },
    });

    const classIds = invites.map((i) => i.classId);
    if (classIds.length === 0) {
      res.json({ classes: [] });
      return;
    }

    let dailyRows: Array<{ classId: string; day: Date; seconds: number }> = [];
    try {
      dailyRows = await prisma.classAttendanceDaily.findMany({
        where: { email, classId: { in: classIds } },
        orderBy: [{ classId: "asc" }, { day: "desc" }],
      });
    } catch (e) {
      console.warn(
        "listMyAttendanceSummary: ClassAttendanceDaily unavailable — run `npx prisma db push` in backend:",
        e,
      );
    }

    const byClass = new Map<
      string,
      { classId: string; className: string; daily: { day: string; minutes: number; seconds: number }[] }
    >();

    for (const inv of invites) {
      byClass.set(inv.classId, {
        classId: inv.classId,
        className: inv.class.name,
        daily: [],
      });
    }

    for (const r of dailyRows) {
      const entry = byClass.get(r.classId);
      if (!entry) continue;
      entry.daily.push({
        day: r.day.toISOString().slice(0, 10),
        minutes: Math.round(r.seconds / 60),
        seconds: r.seconds,
      });
    }

    const classes = [...byClass.values()].map((c) => {
      const totalSeconds = c.daily.reduce((s, d) => s + d.seconds, 0);
      const distinctDays = new Set(c.daily.map((d) => d.day)).size;
      return {
        classId: c.classId,
        className: c.className,
        daily: c.daily,
        totalMinutes: Math.round(totalSeconds / 60),
        totalSeconds,
        daysAttended: distinctDays,
      };
    });

    res.json({ classes });
  } catch (err) {
    console.error("My attendance error:", err);
    res.status(500).json({ error: "Failed to load attendance summary" });
  }
}

/** Invited students across all classes this teacher owns (for attendance UI). */
export async function listTeacherAttendanceRoster(req: Request, res: Response): Promise<void> {
  try {
    if (req.user!.role !== "TEACHER") {
      res.status(403).json({ error: "Teachers only" });
      return;
    }

    const teacherId = req.user!.id;
    const invites = await prisma.classInvite.findMany({
      where: { class: { teacherId } },
      include: { class: { select: { id: true, name: true } } },
    });

    const byEmail = new Map<string, { id: string; name: string }[]>();
    for (const inv of invites) {
      const list = byEmail.get(inv.email) ?? [];
      if (!list.some((c) => c.id === inv.class.id)) {
        list.push({ id: inv.class.id, name: inv.class.name });
      }
      byEmail.set(inv.email, list);
    }

    const students = [...byEmail.entries()]
      .map(([email, classes]) => ({
        email,
        classes: classes.sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.email.localeCompare(b.email));

    res.json({ students });
  } catch (err) {
    console.error("Teacher attendance roster error:", err);
    res.status(500).json({ error: "Failed to load roster" });
  }
}

function parseYearMonthUtc(s: string | undefined): { year: number; monthIndex: number } {
  const now = new Date();
  const y0 = now.getUTCFullYear();
  const m0 = now.getUTCMonth();
  if (!s || !/^\d{4}-\d{2}$/.test(s)) {
    return { year: y0, monthIndex: m0 };
  }
  const [ys, ms] = s.split("-");
  const year = Number(ys);
  const monthNum = Number(ms);
  if (!Number.isFinite(year) || monthNum < 1 || monthNum > 12) {
    return { year: y0, monthIndex: m0 };
  }
  return { year, monthIndex: monthNum - 1 };
}

function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dayInUtcMonth(d: Date, year: number, monthIndex: number): boolean {
  return d.getUTCFullYear() === year && d.getUTCMonth() === monthIndex;
}

function streakSinceUtc(): Date {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - STREAK_LOOKBACK_DAYS);
  since.setUTCHours(0, 0, 0, 0);
  return since;
}

type DailyRow = { classId: string; day: Date; seconds: number };

function buildAttendanceDetailPayload(
  emailRaw: string,
  studentName: string | null,
  classScope: string,
  year: number,
  monthIndex: number,
  allowedClassIds: string[],
  classNameById: Map<string, string>,
  rows: DailyRow[],
) {
  const monthRows = rows.filter((r) => dayInUtcMonth(r.day, year, monthIndex));

  type DayAgg = { seconds: number; byClass: { classId: string; className: string; seconds: number }[] };
  const byDayMonth = new Map<string, DayAgg>();

  for (const r of monthRows) {
    const key = utcDayKey(r.day);
    let agg = byDayMonth.get(key);
    if (!agg) {
      agg = { seconds: 0, byClass: [] };
      byDayMonth.set(key, agg);
    }
    agg.seconds += r.seconds;
    const cname = classNameById.get(r.classId) ?? r.classId;
    const existing = agg.byClass.find((x) => x.classId === r.classId);
    if (existing) existing.seconds += r.seconds;
    else agg.byClass.push({ classId: r.classId, className: cname, seconds: r.seconds });
  }

  for (const agg of byDayMonth.values()) {
    agg.byClass.sort((a, b) => a.className.localeCompare(b.className));
  }

  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const calendarDays: {
    day: string;
    seconds: number;
    byClass: { classId: string; className: string; seconds: number }[];
  }[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(Date.UTC(year, monthIndex, d));
    const key = utcDayKey(dt);
    const agg = byDayMonth.get(key);
    calendarDays.push({
      day: key,
      seconds: agg?.seconds ?? 0,
      byClass: agg?.byClass ?? [],
    });
  }

  const monthTotalSeconds = monthRows.reduce((s, r) => s + r.seconds, 0);
  const monthDaysWithActivity = new Set(monthRows.map((r) => utcDayKey(r.day))).size;

  type ClassAgg = { seconds: number; days: Set<string> };
  const byClassMonth = new Map<string, ClassAgg>();
  for (const r of monthRows) {
    const k = r.classId;
    let a = byClassMonth.get(k);
    if (!a) {
      a = { seconds: 0, days: new Set() };
      byClassMonth.set(k, a);
    }
    a.seconds += r.seconds;
    a.days.add(utcDayKey(r.day));
  }

  const byClassAll = new Map<string, ClassAgg>();
  for (const r of rows) {
    const k = r.classId;
    let a = byClassAll.get(k);
    if (!a) {
      a = { seconds: 0, days: new Set() };
      byClassAll.set(k, a);
    }
    a.seconds += r.seconds;
    a.days.add(utcDayKey(r.day));
  }

  const byClass = allowedClassIds.map((id) => {
    const m = byClassMonth.get(id);
    const a = byClassAll.get(id);
    return {
      classId: id,
      className: classNameById.get(id) ?? id,
      secondsInMonth: m?.seconds ?? 0,
      daysInMonth: m?.days.size ?? 0,
      secondsAllTime: a?.seconds ?? 0,
      daysAllTime: a?.days.size ?? 0,
    };
  });
  byClass.sort((x, y) => x.className.localeCompare(y.className));

  const overallDistinctDays = new Set(rows.map((r) => utcDayKey(r.day))).size;
  const overallTotalSeconds = rows.reduce((s, r) => s + r.seconds, 0);
  let firstDay: string | null = null;
  let lastDay: string | null = null;
  if (rows.length > 0) {
    firstDay = utcDayKey(rows[0]!.day);
    lastDay = utcDayKey(rows[rows.length - 1]!.day);
  }

  const monthLabel = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;

  return {
    email: emailRaw,
    studentName,
    classScope,
    month: monthLabel,
    monthTotals: {
      seconds: monthTotalSeconds,
      daysWithActivity: monthDaysWithActivity,
    },
    overallTotals: {
      totalSeconds: overallTotalSeconds,
      distinctDays: overallDistinctDays,
      firstDay,
      lastDay,
    },
    byClass,
    calendarDays,
  };
}

/** Student: same calendar / per-class detail as teacher view, scoped to own invites only. */
export async function getStudentMyAttendanceDetail(req: Request, res: Response): Promise<void> {
  try {
    if (req.user!.role !== "STUDENT") {
      res.status(403).json({ error: "Students only" });
      return;
    }

    const emailRaw = req.user!.email.trim().toLowerCase();
    const classIdRaw =
      typeof req.query.classId === "string" ? req.query.classId.trim() : "";
    const classIdFilter =
      !classIdRaw || classIdRaw.toLowerCase() === "all" ? null : classIdRaw;

    const { year, monthIndex } = parseYearMonthUtc(
      typeof req.query.month === "string" ? req.query.month : undefined,
    );

    const invites = await prisma.classInvite.findMany({
      where: { email: emailRaw },
      include: { class: { select: { id: true, name: true } } },
    });
    const classNameById = new Map(
      invites.map((i) => [i.class.id, i.class.name] as const),
    );
    const invitedIds = [...new Set(invites.map((i) => i.classId))];

    let allowedClassIds: string[];
    if (classIdFilter) {
      if (!invitedIds.includes(classIdFilter)) {
        res.status(403).json({ error: "You are not invited to this class" });
        return;
      }
      allowedClassIds = [classIdFilter];
    } else {
      allowedClassIds = invitedIds;
    }

    const studentUser = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { name: true },
    });
    const monthLabel = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;

    if (allowedClassIds.length === 0) {
      const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
      const calendarDays = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const dt = new Date(Date.UTC(year, monthIndex, d));
        calendarDays.push({
          day: utcDayKey(dt),
          seconds: 0,
          byClass: [] as { classId: string; className: string; seconds: number }[],
        });
      }
      res.json({
        email: emailRaw,
        studentName: studentUser?.name ?? null,
        classScope: classIdFilter ?? "all",
        month: monthLabel,
        monthTotals: { seconds: 0, daysWithActivity: 0 },
        overallTotals: {
          totalSeconds: 0,
          distinctDays: 0,
          firstDay: null,
          lastDay: null,
        },
        byClass: [],
        calendarDays,
      });
      return;
    }

    let rows: DailyRow[] = [];
    try {
      rows = await prisma.classAttendanceDaily.findMany({
        where: { email: emailRaw, classId: { in: allowedClassIds } },
        select: { classId: true, day: true, seconds: true },
        orderBy: [{ day: "asc" }, { classId: "asc" }],
      });
    } catch (e) {
      if (isPrismaMissingRelationOrTable(e)) {
        res.status(503).json({ error: DB_SCHEMA_OUT_OF_SYNC_MESSAGE });
        return;
      }
      throw e;
    }

    res.json(
      buildAttendanceDetailPayload(
        emailRaw,
        studentUser?.name ?? null,
        classIdFilter ?? "all",
        year,
        monthIndex,
        allowedClassIds,
        classNameById,
        rows,
      ),
    );
  } catch (err) {
    console.error("Student attendance detail error:", err);
    res.status(500).json({ error: "Failed to load attendance" });
  }
}

/**
 * Teacher: credited attendance for one invited student, optional class filter and calendar month (UTC).
 * Query: email (required), classId (omit or "all"), month (YYYY-MM, default current UTC month).
 */
export async function getTeacherStudentAttendanceView(req: Request, res: Response): Promise<void> {
  try {
    if (req.user!.role !== "TEACHER") {
      res.status(403).json({ error: "Teachers only" });
      return;
    }

    const emailRaw = typeof req.query.email === "string" ? req.query.email.trim().toLowerCase() : "";
    if (!emailRaw) {
      res.status(400).json({ error: "email query parameter is required" });
      return;
    }

    const classIdRaw =
      typeof req.query.classId === "string" ? req.query.classId.trim() : "";
    const classIdFilter =
      !classIdRaw || classIdRaw.toLowerCase() === "all" ? null : classIdRaw;

    const { year, monthIndex } = parseYearMonthUtc(
      typeof req.query.month === "string" ? req.query.month : undefined,
    );

    const teacherId = req.user!.id;
    const myClasses = await prisma.class.findMany({
      where: { teacherId },
      select: { id: true, name: true },
    });
    const myClassIds = new Set(myClasses.map((c) => c.id));
    const classNameById = new Map(myClasses.map((c) => [c.id, c.name] as const));

    let allowedClassIds: string[];

    if (classIdFilter) {
      if (!myClassIds.has(classIdFilter)) {
        res.status(403).json({ error: "Class not found or not yours" });
        return;
      }
      const inv = await prisma.classInvite.findUnique({
        where: { classId_email: { classId: classIdFilter, email: emailRaw } },
      });
      if (!inv) {
        res.status(404).json({ error: "Student not invited to this class" });
        return;
      }
      allowedClassIds = [classIdFilter];
    } else {
      const studentInvites = await prisma.classInvite.findMany({
        where: { email: emailRaw, classId: { in: [...myClassIds] } },
        select: { classId: true },
      });
      allowedClassIds = [...new Set(studentInvites.map((i) => i.classId))];
    }

    if (allowedClassIds.length === 0) {
      res.status(404).json({ error: "No shared classes with this student" });
      return;
    }

    let rows: DailyRow[] = [];

    try {
      rows = await prisma.classAttendanceDaily.findMany({
        where: { email: emailRaw, classId: { in: allowedClassIds } },
        select: { classId: true, day: true, seconds: true },
        orderBy: [{ day: "asc" }, { classId: "asc" }],
      });
    } catch (e) {
      if (isPrismaMissingRelationOrTable(e)) {
        res.status(503).json({ error: DB_SCHEMA_OUT_OF_SYNC_MESSAGE });
        return;
      }
      throw e;
    }

    const studentUser = await prisma.user.findUnique({
      where: { email: emailRaw },
      select: { name: true },
    });

    const payload = buildAttendanceDetailPayload(
      emailRaw,
      studentUser?.name ?? null,
      classIdFilter ?? "all",
      year,
      monthIndex,
      allowedClassIds,
      classNameById,
      rows,
    );

    let streakSummaries: Array<{
      classId: string;
      className: string;
      targetDays: number;
      currentStreakClassDays: number;
      daysRemaining: number;
      goalMet: boolean;
    }> = [];

    try {
      const streakClasses = await prisma.class.findMany({
        where: { id: { in: allowedClassIds }, streakEnabled: true },
        select: { id: true, name: true, streakTargetDays: true },
        orderBy: { name: "asc" },
      });
      if (streakClasses.length > 0) {
        const streakIds = streakClasses.map((c) => c.id);
        const streakAgg = await prisma.classAttendanceDaily.findMany({
          where: { classId: { in: streakIds }, day: { gte: streakSinceUtc() } },
          select: { classId: true, email: true, day: true, seconds: true },
        });
        for (const c of streakClasses) {
          const classRows: StreakDailyRow[] = streakAgg
            .filter((r) => r.classId === c.id)
            .map((r) => ({ email: r.email, day: r.day, seconds: r.seconds }));
          const { currentRun, goalMet, daysRemaining } = computeCurrentStreakClassDays(
            classRows,
            emailRaw,
            c.streakTargetDays,
          );
          streakSummaries.push({
            classId: c.id,
            className: c.name,
            targetDays: c.streakTargetDays,
            currentStreakClassDays: currentRun,
            daysRemaining,
            goalMet,
          });
        }
      }
    } catch (e) {
      if (isPrismaMissingColumnError(e) || isPrismaMissingRelationOrTable(e)) {
        console.warn("Teacher student attendance: streak summaries omitted:", e);
        streakSummaries = [];
      } else {
        throw e;
      }
    }

    res.json({ ...payload, streakSummaries });
  } catch (err) {
    console.error("Teacher student attendance view error:", err);
    res.status(500).json({ error: "Failed to load student attendance" });
  }
}

/** Student: streak status for one class (must be invited). */
export async function getStudentClassStreak(req: Request, res: Response): Promise<void> {
  try {
    if (req.user!.role !== "STUDENT") {
      res.status(403).json({ error: "Students only" });
      return;
    }
    const classId = typeof req.query.classId === "string" ? req.query.classId.trim() : "";
    if (!classId) {
      res.status(400).json({ error: "classId is required" });
      return;
    }
    const email = req.user!.email.trim().toLowerCase();
    const inv = await prisma.classInvite.findFirst({ where: { classId, email } });
    if (!inv) {
      res.status(403).json({ error: "Not invited to this class" });
      return;
    }

    let cls: { name: string; streakEnabled: boolean; streakTargetDays: number } | null;
    try {
      cls = await prisma.class.findUnique({
        where: { id: classId },
        select: { name: true, streakEnabled: true, streakTargetDays: true },
      });
    } catch (e) {
      if (isPrismaMissingColumnError(e)) {
        res.status(503).json({ error: DB_SCHEMA_OUT_OF_SYNC_MESSAGE });
        return;
      }
      throw e;
    }

    if (!cls) {
      res.status(404).json({ error: "Class not found" });
      return;
    }
    if (!cls.streakEnabled) {
      res.json({
        streakEnabled: false,
        classId,
        className: cls.name,
      });
      return;
    }

    const targetDays = cls.streakTargetDays;
    let rows: StreakDailyRow[] = [];
    try {
      rows = await prisma.classAttendanceDaily.findMany({
        where: { classId, day: { gte: streakSinceUtc() } },
        select: { email: true, day: true, seconds: true },
      });
    } catch (e) {
      if (isPrismaMissingRelationOrTable(e)) {
        res.status(503).json({ error: DB_SCHEMA_OUT_OF_SYNC_MESSAGE });
        return;
      }
      throw e;
    }

    const { currentRun, goalMet, daysRemaining } = computeCurrentStreakClassDays(
      rows,
      email,
      targetDays,
    );
    const { headline, detail } = buildStudentStreakCopy(
      targetDays,
      currentRun,
      goalMet,
      daysRemaining,
    );

    res.json({
      streakEnabled: true,
      classId,
      className: cls.name,
      targetDays,
      minMinutesRequired: STREAK_MIN_MINUTES,
      currentStreakClassDays: currentRun,
      daysRemaining,
      goalMet,
      headline,
      detail,
    });
  } catch (err) {
    console.error("Student class streak error:", err);
    if (isPrismaMissingColumnError(err)) {
      res.status(503).json({ error: DB_SCHEMA_OUT_OF_SYNC_MESSAGE });
      return;
    }
    res.status(500).json({ error: "Failed to load streak" });
  }
}

/** Student: streak summary for every invited class that has streaks enabled. */
export async function getStudentMyStreaks(req: Request, res: Response): Promise<void> {
  try {
    if (req.user!.role !== "STUDENT") {
      res.status(403).json({ error: "Students only" });
      return;
    }
    const email = req.user!.email.trim().toLowerCase();

    let invites: Array<{
      classId: string;
      class: { name: string; streakEnabled: boolean; streakTargetDays: number };
    }> = [];
    try {
      invites = await prisma.classInvite.findMany({
        where: { email },
        include: {
          class: {
            select: { name: true, streakEnabled: true, streakTargetDays: true },
          },
        },
      });
    } catch (e) {
      if (isPrismaMissingColumnError(e)) {
        res.status(503).json({ error: DB_SCHEMA_OUT_OF_SYNC_MESSAGE });
        return;
      }
      throw e;
    }

    const enabled = invites.filter((i) => i.class.streakEnabled);
    const classIds = [...new Set(enabled.map((i) => i.classId))];

    let allRows: Array<{ classId: string; email: string; day: Date; seconds: number }> = [];
    if (classIds.length > 0) {
      try {
        allRows = await prisma.classAttendanceDaily.findMany({
          where: { classId: { in: classIds }, day: { gte: streakSinceUtc() } },
          select: { classId: true, email: true, day: true, seconds: true },
        });
      } catch (e) {
        if (isPrismaMissingRelationOrTable(e)) {
          res.status(503).json({ error: DB_SCHEMA_OUT_OF_SYNC_MESSAGE });
          return;
        }
        throw e;
      }
    }

    const rowsByClass = new Map<string, StreakDailyRow[]>();
    for (const r of allRows) {
      const list = rowsByClass.get(r.classId) ?? [];
      list.push({ email: r.email, day: r.day, seconds: r.seconds });
      rowsByClass.set(r.classId, list);
    }

    const streaks = enabled.map((inv) => {
      const targetDays = inv.class.streakTargetDays;
      const rowsForClass = rowsByClass.get(inv.classId) ?? [];
      const { currentRun, goalMet, daysRemaining } = computeCurrentStreakClassDays(
        rowsForClass,
        email,
        targetDays,
      );
      const { headline, detail } = buildStudentStreakCopy(
        targetDays,
        currentRun,
        goalMet,
        daysRemaining,
      );
      return {
        classId: inv.classId,
        className: inv.class.name,
        targetDays,
        minMinutesRequired: STREAK_MIN_MINUTES,
        currentStreakClassDays: currentRun,
        daysRemaining,
        goalMet,
        headline,
        detail,
      };
    });

    res.json({ streaks });
  } catch (err) {
    console.error("Student my streaks error:", err);
    if (isPrismaMissingColumnError(err)) {
      res.status(503).json({ error: DB_SCHEMA_OUT_OF_SYNC_MESSAGE });
      return;
    }
    res.status(500).json({ error: "Failed to load streaks" });
  }
}

/** Teacher: all streak-enabled classes with per-student progress. */
export async function getTeacherStreakBoard(req: Request, res: Response): Promise<void> {
  try {
    if (req.user!.role !== "TEACHER") {
      res.status(403).json({ error: "Teachers only" });
      return;
    }
    const teacherId = req.user!.id;
    const classIdFilter =
      typeof req.query.classId === "string" ? req.query.classId.trim() : "";

    let streakClasses: Array<{ id: string; name: string; streakTargetDays: number }> = [];
    try {
      streakClasses = await prisma.class.findMany({
        where: {
          teacherId,
          streakEnabled: true,
          ...(classIdFilter ? { id: classIdFilter } : {}),
        },
        select: { id: true, name: true, streakTargetDays: true },
        orderBy: { name: "asc" },
      });
    } catch (e) {
      if (isPrismaMissingColumnError(e)) {
        res.status(503).json({ error: DB_SCHEMA_OUT_OF_SYNC_MESSAGE });
        return;
      }
      throw e;
    }

    if (classIdFilter && streakClasses.length === 0) {
      res.status(404).json({ error: "Class not found, not yours, or streaks not enabled" });
      return;
    }

    const classIds = streakClasses.map((c) => c.id);
    let allRows: Array<{ classId: string; email: string; day: Date; seconds: number }> = [];
    if (classIds.length > 0) {
      try {
        allRows = await prisma.classAttendanceDaily.findMany({
          where: { classId: { in: classIds }, day: { gte: streakSinceUtc() } },
          select: { classId: true, email: true, day: true, seconds: true },
        });
      } catch (e) {
        if (isPrismaMissingRelationOrTable(e)) {
          res.status(503).json({ error: DB_SCHEMA_OUT_OF_SYNC_MESSAGE });
          return;
        }
        throw e;
      }
    }

    const rowsByClass = new Map<string, StreakDailyRow[]>();
    for (const r of allRows) {
      const list = rowsByClass.get(r.classId) ?? [];
      list.push({ email: r.email, day: r.day, seconds: r.seconds });
      rowsByClass.set(r.classId, list);
    }

    const classesOut: Array<{
      classId: string;
      className: string;
      targetDays: number;
      students: Array<{
        email: string;
        currentStreakClassDays: number;
        daysRemaining: number;
        goalMet: boolean;
        headline: string;
      }>;
    }> = [];

    for (const c of streakClasses) {
      const invites = await prisma.classInvite.findMany({
        where: { classId: c.id },
        select: { email: true },
        orderBy: { email: "asc" },
      });
      const rows = rowsByClass.get(c.id) ?? [];
      const students = invites.map((inv) => {
        const { currentRun, goalMet, daysRemaining } = computeCurrentStreakClassDays(
          rows,
          inv.email,
          c.streakTargetDays,
        );
        const { headline } = buildStudentStreakCopy(
          c.streakTargetDays,
          currentRun,
          goalMet,
          daysRemaining,
        );
        return {
          email: inv.email,
          currentStreakClassDays: currentRun,
          daysRemaining,
          goalMet,
          headline,
        };
      });
      classesOut.push({
        classId: c.id,
        className: c.name,
        targetDays: c.streakTargetDays,
        students,
      });
    }

    res.json({ classes: classesOut });
  } catch (err) {
    console.error("Teacher streak board error:", err);
    if (isPrismaMissingColumnError(err)) {
      res.status(503).json({ error: DB_SCHEMA_OUT_OF_SYNC_MESSAGE });
      return;
    }
    res.status(500).json({ error: "Failed to load streak board" });
  }
}
