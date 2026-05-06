import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import {
  DB_SCHEMA_OUT_OF_SYNC_MESSAGE,
  isPrismaMissingColumnError,
} from "../lib/prismaErrors.js";
import { createLiveKitToken } from "../services/livekit.js";
import { roomService } from "../lib/livekitRoomAdmin.js";
import { env } from "../config/env.js";

function classIdParam(req: Request): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] ?? "" : id ?? "";
}

function optionalBoolField(body: Record<string, unknown>, key: string): boolean | undefined {
  const v = body[key];
  if (typeof v === "boolean") return v;
  if (v === "true" || v === 1) return true;
  if (v === "false" || v === 0) return false;
  return undefined;
}

function optionalIntField(body: Record<string, unknown>, key: string): number | undefined {
  const v = body[key];
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return Math.round(n);
  }
  return undefined;
}

function clampStreakTargetDays(n: number): number {
  return Math.min(365, Math.max(1, n));
}

export async function listClasses(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const asTeacher = await prisma.class.findMany({
      where: { teacherId: userId },
      include: { teacher: { select: { email: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
    const invited = await prisma.classInvite.findMany({
      where: { email: req.user!.email },
      include: {
        class: {
          include: { teacher: { select: { email: true, name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    type InviteWithClass = (typeof invited)[number];
    const invitedClasses = invited.map((i: InviteWithClass) => ({
      ...i.class,
      invitedAt: i.createdAt,
    }));
    res.json({
      asTeacher,
      invited: invitedClasses,
    });
  } catch (err) {
    console.error("List classes error:", err);
    if (isPrismaMissingColumnError(err)) {
      res.status(503).json({ error: DB_SCHEMA_OUT_OF_SYNC_MESSAGE });
      return;
    }
    res.status(500).json({ error: "Failed to list classes" });
  }
}

export async function createClass(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const raw = req.body as Record<string, unknown>;
    const { name, description, redirectUrl } = raw as {
      name?: string;
      description?: string;
      redirectUrl?: string;
    };
    const requireCamera = optionalBoolField(raw, "requireCamera") ?? false;
    const requireMic = optionalBoolField(raw, "requireMic") ?? false;
    const streakEnabled = optionalBoolField(raw, "streakEnabled") ?? false;
    const streakTargetDays = clampStreakTargetDays(
      optionalIntField(raw, "streakTargetDays") ?? 21,
    );

    if (!name?.trim()) {
      res.status(400).json({ error: "Class name is required" });
      return;
    }

    const roomName = `yoga-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const redirect = redirectUrl?.trim() || null;

    const cls = await prisma.class.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        teacherId: userId,
        roomName,
        redirectUrl: redirect,
        requireCamera,
        requireMic,
        streakEnabled,
        streakTargetDays,
      },
      include: { teacher: { select: { email: true, name: true } } },
    });

    res.status(201).json({
      id: cls.id,
      name: cls.name,
      description: cls.description,
      roomName: cls.roomName,
      redirectUrl: cls.redirectUrl,
      requireCamera: cls.requireCamera,
      requireMic: cls.requireMic,
      streakEnabled: cls.streakEnabled,
      streakTargetDays: cls.streakTargetDays,
      teacher: cls.teacher,
      createdAt: cls.createdAt,
    });
  } catch (err) {
    console.error("Create class error:", err);
    if (isPrismaMissingColumnError(err)) {
      res.status(503).json({ error: DB_SCHEMA_OUT_OF_SYNC_MESSAGE });
      return;
    }
    res.status(500).json({ error: "Failed to create class" });
  }
}

export async function getClass(req: Request, res: Response): Promise<void> {
  try {
    const id = classIdParam(req);
    const cls = await prisma.class.findUnique({
      where: { id },
      include: {
        teacher: { select: { id: true, email: true, name: true } },
        invites: { select: { email: true, createdAt: true } },
      },
    });

    if (!cls) {
      res.status(404).json({ error: "Class not found" });
      return;
    }

    const isTeacher = req.user!.id === cls.teacherId;
    if (!isTeacher) {
      const invited = await prisma.classInvite.findFirst({
        where: { classId: id, email: req.user!.email },
      });
      if (!invited) {
        res.status(403).json({ error: "You are not invited to this class" });
        return;
      }
    }

    res.json({
      id: cls.id,
      name: cls.name,
      description: cls.description,
      roomName: cls.roomName,
      redirectUrl: cls.redirectUrl ?? undefined,
      requireCamera: cls.requireCamera,
      requireMic: cls.requireMic,
      streakEnabled: cls.streakEnabled,
      streakTargetDays: cls.streakTargetDays,
      teacher: cls.teacher,
      invites: cls.invites,
      createdAt: cls.createdAt,
    });
  } catch (err) {
    console.error("Get class error:", err);
    if (isPrismaMissingColumnError(err)) {
      res.status(503).json({ error: DB_SCHEMA_OUT_OF_SYNC_MESSAGE });
      return;
    }
    res.status(500).json({ error: "Failed to fetch class" });
  }
}

export async function updateClass(req: Request, res: Response): Promise<void> {
  try {
    const id = classIdParam(req);
    const raw = req.body as Record<string, unknown>;
    const { redirectUrl } = raw as { redirectUrl?: string | null };
    const requireCamera = optionalBoolField(raw, "requireCamera");
    const requireMic = optionalBoolField(raw, "requireMic");
    const streakEnabled = optionalBoolField(raw, "streakEnabled");
    const streakTargetDaysRaw = optionalIntField(raw, "streakTargetDays");

    const cls = await prisma.class.findUnique({ where: { id } });

    if (!cls) {
      res.status(404).json({ error: "Class not found" });
      return;
    }
    if (cls.teacherId !== req.user!.id) {
      res.status(403).json({ error: "Only the teacher can update the class" });
      return;
    }

    const data: {
      redirectUrl?: string | null;
      requireCamera?: boolean;
      requireMic?: boolean;
      streakEnabled?: boolean;
      streakTargetDays?: number;
    } = {};
    if (redirectUrl !== undefined) {
      data.redirectUrl = typeof redirectUrl === "string" ? redirectUrl.trim() || null : null;
    }
    if (typeof requireCamera === "boolean") data.requireCamera = requireCamera;
    if (typeof requireMic === "boolean") data.requireMic = requireMic;
    if (typeof streakEnabled === "boolean") data.streakEnabled = streakEnabled;
    if (streakTargetDaysRaw !== undefined) {
      data.streakTargetDays = clampStreakTargetDays(streakTargetDaysRaw);
    }

    if (Object.keys(data).length === 0) {
      res.status(400).json({ error: "No updatable fields provided" });
      return;
    }

    const updated = await prisma.class.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        redirectUrl: true,
        requireCamera: true,
        requireMic: true,
        streakEnabled: true,
        streakTargetDays: true,
      },
    });

    res.json({
      id: updated.id,
      name: updated.name,
      redirectUrl: updated.redirectUrl ?? undefined,
      requireCamera: updated.requireCamera,
      requireMic: updated.requireMic,
      streakEnabled: updated.streakEnabled,
      streakTargetDays: updated.streakTargetDays,
    });
  } catch (err) {
    console.error("Update class error:", err);
    if (isPrismaMissingColumnError(err)) {
      res.status(503).json({ error: DB_SCHEMA_OUT_OF_SYNC_MESSAGE });
      return;
    }
    res.status(500).json({ error: "Failed to update class" });
  }
}

export async function inviteToClass(req: Request, res: Response): Promise<void> {
  try {
    const id = classIdParam(req);
    const { emails } = req.body as { emails?: string[] };

    if (!Array.isArray(emails) || emails.length === 0) {
      res.status(400).json({ error: "Emails array is required" });
      return;
    }

    const cls = await prisma.class.findUnique({
      where: { id },
    });

    if (!cls) {
      res.status(404).json({ error: "Class not found" });
      return;
    }
    if (cls.teacherId !== req.user!.id) {
      res.status(403).json({ error: "Only the teacher can invite" });
      return;
    }

    const normalizedEmails = emails
      .map((e) => (typeof e === "string" ? e.trim().toLowerCase() : ""))
      .filter(Boolean);

    await prisma.classInvite.createMany({
      data: normalizedEmails.map((email) => ({
        classId: id,
        email,
        invitedBy: req.user!.id,
      })),
      skipDuplicates: true,
    });

    const invites = await prisma.classInvite.findMany({
      where: { classId: id },
      select: { email: true, createdAt: true },
    });

    res.status(201).json({ invites });
  } catch (err) {
    console.error("Invite error:", err);
    res.status(500).json({ error: "Failed to invite" });
  }
}

export async function disinviteFromClass(req: Request, res: Response): Promise<void> {
  try {
    const id = classIdParam(req);
    const { email } = req.body as { email?: string };

    if (!email?.trim()) {
      res.status(400).json({ error: "Email is required" });
      return;
    }

    const cls = await prisma.class.findUnique({ where: { id } });

    if (!cls) {
      res.status(404).json({ error: "Class not found" });
      return;
    }
    if (cls.teacherId !== req.user!.id) {
      res.status(403).json({ error: "Only the teacher can disinvite" });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    await prisma.classInvite.deleteMany({
      where: { classId: id, email: normalizedEmail },
    });

    res.json({ success: true, message: "Participant disinvited" });
  } catch (err) {
    console.error("Disinvite error:", err);
    res.status(500).json({ error: "Failed to disinvite" });
  }
}

export async function joinMeeting(req: Request, res: Response): Promise<void> {
  try {
    const id = classIdParam(req);
    const cls = await prisma.class.findUnique({ 
      where: { id },
      include: { teacher: { select: { email: true, name: true } } }
    });

    if (!cls) {
      res.status(404).json({ error: "Class not found" });
      return;
    }

    const isTeacher = cls.teacherId === req.user!.id;
    if (!isTeacher) {
      const invited = await prisma.classInvite.findFirst({
        where: { classId: id, email: req.user!.email },
      });
      if (!invited) {
        res.status(403).json({ error: "You are not invited to this class" });
        return;
      }
    }

    if (!env.LIVEKIT_URL?.trim()) {
      res.status(503).json({
        error: "LiveKit is not configured. Set LIVEKIT_URL in backend .env (e.g. ws://localhost:7880).",
      });
      return;
    }

    const participantName = req.user!.email;
    const token = await createLiveKitToken(
      cls.roomName,
      req.user!.email,
      participantName,
      isTeacher
    );

    res.json({
      token,
      url: env.LIVEKIT_URL.trim(),
      roomName: cls.roomName,
      redirectUrl: cls.redirectUrl ?? undefined,
      teacherName: cls.teacher.name || cls.teacher.email,
      teacherEmail: cls.teacher.email,
      requireCamera: cls.requireCamera,
      requireMic: cls.requireMic,
      streakEnabled: cls.streakEnabled,
      streakTargetDays: cls.streakTargetDays,
    });
  } catch (err) {
    console.error("Join meeting error:", err);
    if (isPrismaMissingColumnError(err)) {
      res.status(503).json({ error: DB_SCHEMA_OUT_OF_SYNC_MESSAGE });
      return;
    }
    res.status(500).json({ error: "Failed to get meeting token" });
  }
}

export async function endMeeting(req: Request, res: Response): Promise<void> {
  try {
    const id = classIdParam(req);
    const cls = await prisma.class.findUnique({ where: { id } });

    if (!cls) {
      res.status(404).json({ error: "Class not found" });
      return;
    }
    if (cls.teacherId !== req.user!.id) {
      res.status(403).json({ error: "Only the teacher can end the meeting" });
      return;
    }

    await roomService.deleteRoom(cls.roomName);

    res.json({ success: true, message: "Meeting ended" });
  } catch (err) {
    console.error("End meeting error:", err);
    res.status(500).json({ error: "Failed to end meeting" });
  }
}

export async function listAttendance(req: Request, res: Response): Promise<void> {
  try {
    const id = classIdParam(req);
    const cls = await prisma.class.findUnique({ where: { id } });

    if (!cls) {
      res.status(404).json({ error: "Class not found" });
      return;
    }
    if (cls.teacherId !== req.user!.id) {
      res.status(403).json({ error: "Only the teacher can view attendance" });
      return;
    }

    const records = await prisma.attendance.findMany({
      where: { classId: id },
      orderBy: { joinTime: "desc" },
      take: 200,
      select: { id: true, email: true, joinTime: true, leaveTime: true, duration: true },
    });

    let dailyRows: Array<{ email: string; day: Date; seconds: number }> = [];
    try {
      dailyRows = await prisma.classAttendanceDaily.findMany({
        where: { classId: id },
        orderBy: [{ email: "asc" }, { day: "asc" }],
      });
    } catch (e) {
      console.warn(
        "listAttendance: ClassAttendanceDaily unavailable — run `npx prisma db push` in backend:",
        e,
      );
    }

    const creditedDaily = dailyRows.map((r) => ({
      email: r.email,
      day: r.day.toISOString().slice(0, 10),
      minutes: Math.round(r.seconds / 60),
      seconds: r.seconds,
    }));

    const totalsMap = new Map<string, { totalSeconds: number; days: Set<string> }>();
    for (const r of dailyRows) {
      const t = totalsMap.get(r.email) ?? { totalSeconds: 0, days: new Set<string>() };
      t.totalSeconds += r.seconds;
      t.days.add(r.day.toISOString().slice(0, 10));
      totalsMap.set(r.email, t);
    }
    const creditedTotals = [...totalsMap.entries()]
      .map(([email, t]) => ({
        email,
        totalSeconds: t.totalSeconds,
        totalMinutes: Math.round(t.totalSeconds / 60),
        daysAttended: t.days.size,
      }))
      .sort((a, b) => a.email.localeCompare(b.email));

    res.json({
      attendance: records.map((r) => ({
        id: r.id,
        email: r.email,
        joinTime: r.joinTime,
        leaveTime: r.leaveTime,
        duration: r.duration,
      })),
      creditedDaily,
      creditedTotals,
    });
  } catch (err) {
    console.error("List attendance error:", err);
    res.status(500).json({ error: "Failed to list attendance" });
  }
}

export async function listParticipants(req: Request, res: Response): Promise<void> {
  try {
    const id = classIdParam(req);
    const cls = await prisma.class.findUnique({ where: { id } });

    if (!cls) {
      res.status(404).json({ error: "Class not found" });
      return;
    }
    if (cls.teacherId !== req.user!.id) {
      res.status(403).json({ error: "Only the teacher can view participants" });
      return;
    }

    let participants: Array<{ identity: string; name: string }> = [];
    try {
      const list = await roomService.listParticipants(cls.roomName);
      participants = list.map((p) => ({
        identity: p.identity,
        name: p.name || p.identity,
      }));
    } catch {
      // Room may not exist yet (no one joined) - return empty
    }

    const invites = await prisma.classInvite.findMany({
      where: { classId: id },
      select: { email: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    res.json({
      participants,
      invited: invites.map((i) => ({ email: i.email, invitedAt: i.createdAt })),
    });
  } catch (err) {
    console.error("List participants error:", err);
    res.status(500).json({ error: "Failed to list participants" });
  }
}

export async function kickParticipant(req: Request, res: Response): Promise<void> {
  try {
    const id = classIdParam(req);
    const { identity } = req.body as { identity?: string };

    if (!identity?.trim()) {
      res.status(400).json({ error: "Participant identity (email) is required" });
      return;
    }

    const cls = await prisma.class.findUnique({ where: { id } });

    if (!cls) {
      res.status(404).json({ error: "Class not found" });
      return;
    }
    if (cls.teacherId !== req.user!.id) {
      res.status(403).json({ error: "Only the teacher can kick participants" });
      return;
    }

    await roomService.removeParticipant(cls.roomName, identity.trim());

    res.json({ success: true, message: "Participant removed" });
  } catch (err) {
    console.error("Kick error:", err);
    res.status(500).json({ error: "Failed to kick participant" });
  }
}
