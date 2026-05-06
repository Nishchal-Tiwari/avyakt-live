import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

interface InvitedClassRow {
  classId: string;
  className: string;
}

interface MyAttendanceSummaryResponse {
  classes: InvitedClassRow[];
}

interface AttendanceDetailResponse {
  email: string;
  studentName: string | null;
  classScope: string;
  month: string;
  monthTotals: { seconds: number; daysWithActivity: number };
  overallTotals: {
    totalSeconds: number;
    distinctDays: number;
    firstDay: string | null;
    lastDay: string | null;
  };
  byClass: {
    classId: string;
    className: string;
    secondsInMonth: number;
    daysInMonth: number;
    secondsAllTime: number;
    daysAllTime: number;
  }[];
  calendarDays: {
    day: string;
    seconds: number;
    byClass: { classId: string; className: string; seconds: number }[];
  }[];
}

interface MyStreakRow {
  classId: string;
  className: string;
  targetDays: number;
  minMinutesRequired: number;
  currentStreakClassDays: number;
  daysRemaining: number;
  goalMet: boolean;
  headline: string;
  detail: string;
}

function currentMonthUtc(): string {
  const n = new Date();
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(monthStr: string, delta: number): string {
  const [y, m] = monthStr.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatCreditedSeconds(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m} min`;
  return `${m} min ${s}s`;
}

function utcTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function StudentMyAttendance() {
  const { user, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [invitedClasses, setInvitedClasses] = useState<InvitedClassRow[] | null>(null);
  const [classesError, setClassesError] = useState("");
  const [detail, setDetail] = useState<AttendanceDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [myStreaks, setMyStreaks] = useState<MyStreakRow[] | null>(null);

  const classScope = searchParams.get("classId") ?? "all";
  const month = searchParams.get("month") ?? currentMonthUtc();

  const updateQuery = useCallback(
    (next: { classId?: string; month?: string }) => {
      const p = new URLSearchParams(searchParams);
      if (next.classId !== undefined) {
        if (next.classId && next.classId !== "all") p.set("classId", next.classId);
        else p.delete("classId");
      }
      if (next.month !== undefined) {
        p.set("month", next.month);
      }
      setSearchParams(p, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  useEffect(() => {
    let cancelled = false;
    api
      .get<MyAttendanceSummaryResponse>("/attendance/my")
      .then((res) => {
        if (!cancelled) {
          const list = (res.classes ?? []).map((c) => ({
            classId: c.classId,
            className: c.className,
          }));
          setInvitedClasses(list);
          setClassesError("");
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setInvitedClasses(null);
          setClassesError(e instanceof Error ? e.message : "Failed to load your classes");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ streaks: MyStreakRow[] }>("/attendance/my/streaks")
      .then((res) => {
        if (!cancelled) setMyStreaks(res.streaks ?? []);
      })
      .catch(() => {
        if (!cancelled) setMyStreaks([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (invitedClasses === null) {
      return;
    }

    if (classScope !== "all" && classScope && !invitedClasses.some((c) => c.classId === classScope)) {
      updateQuery({ classId: "all" });
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    setDetailError("");
    const q = new URLSearchParams();
    if (classScope && classScope !== "all") q.set("classId", classScope);
    q.set("month", month);

    api
      .get<AttendanceDetailResponse>(`/attendance/my/detail?${q.toString()}`)
      .then((data) => {
        if (!cancelled) {
          setDetail(data);
          setDetailError("");
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setDetail(null);
          setDetailError(e instanceof Error ? e.message : "Failed to load attendance");
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [classScope, month, invitedClasses, updateQuery]);

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (user.role !== "STUDENT") {
    return <Navigate to="/dashboard" replace />;
  }

  const maxSecondsInMonth =
    detail?.calendarDays.reduce((m, d) => Math.max(m, d.seconds), 0) ?? 0;

  const [calYear, calMonth0] = month.split("-").map(Number);
  const firstWeekday = new Date(Date.UTC(calYear, calMonth0 - 1, 1)).getUTCDay();
  const leadingBlanks = firstWeekday;
  const todayKey = utcTodayKey();

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-emerald-50/30">
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <Link
              to="/dashboard"
              className="text-sm font-medium text-emerald-700 hover:text-emerald-900"
            >
              ← Dashboard
            </Link>
            <h1 className="text-xl font-semibold text-stone-800">My attendance</h1>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-stone-500">{user.email}</span>
            <button
              type="button"
              onClick={logout}
              className="text-stone-500 hover:text-stone-700"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {classesError && (
          <div className="p-4 rounded-xl bg-red-50 text-red-700 text-sm">{classesError}</div>
        )}

        <section className="p-6 rounded-2xl bg-white border border-stone-100 shadow-sm space-y-4">
          <p className="text-sm text-stone-600">
            Credited time only counts when you and the host are both in the live meeting (UTC calendar).
            Choose one class or all classes you&apos;re invited to.
          </p>
          <div className="flex flex-col lg:flex-row gap-4 flex-wrap">
            <label className="flex flex-col gap-1.5 min-w-[220px] flex-1">
              <span className="text-xs font-medium text-stone-600">Class</span>
              <select
                value={
                  classScope === "all" || !invitedClasses?.some((c) => c.classId === classScope)
                    ? "all"
                    : classScope
                }
                onChange={(e) => {
                  const v = e.target.value;
                  updateQuery({ classId: v === "all" ? "all" : v });
                }}
                disabled={invitedClasses === null}
                className="px-3 py-2.5 rounded-lg border border-stone-200 bg-white text-stone-800 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none disabled:opacity-50"
              >
                <option value="all">All my classes</option>
                {(invitedClasses ?? []).map((c) => (
                  <option key={c.classId} value={c.classId}>
                    {c.className}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-col gap-1.5 min-w-[240px]">
              <span className="text-xs font-medium text-stone-600">Month (UTC)</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateQuery({ month: shiftMonth(month, -1) })}
                  className="px-3 py-2 rounded-lg border border-stone-200 text-stone-700 text-sm hover:bg-stone-50"
                >
                  ←
                </button>
                <span className="flex-1 text-center text-sm font-medium text-stone-800 tabular-nums">
                  {month}
                </span>
                <button
                  type="button"
                  onClick={() => updateQuery({ month: shiftMonth(month, 1) })}
                  className="px-3 py-2 rounded-lg border border-stone-200 text-stone-700 text-sm hover:bg-stone-50"
                >
                  →
                </button>
                <button
                  type="button"
                  onClick={() => updateQuery({ month: currentMonthUtc() })}
                  className="px-3 py-2 rounded-lg border border-emerald-200 text-emerald-800 text-sm hover:bg-emerald-50"
                >
                  Today
                </button>
              </div>
            </div>
          </div>
        </section>

        {myStreaks && myStreaks.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-stone-800">Attendance streaks</h2>
            <p className="text-xs text-stone-500">
              Streaks count <strong className="font-medium text-stone-600">class days</strong> (UTC) when
              a live session ran and you earned at least the shown minutes with your teacher present. Days
              with no session do not break your streak.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {myStreaks.map((s) => (
                <div
                  key={s.classId}
                  className={`p-4 rounded-xl border shadow-sm ${
                    classScope === s.classId || classScope === "all"
                      ? "border-emerald-200 bg-emerald-50/40"
                      : "border-stone-100 bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-medium text-stone-800 text-sm">{s.className}</h3>
                    <span className="text-xs font-semibold tabular-nums text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                      {s.currentStreakClassDays}/{s.targetDays}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-stone-800">{s.headline}</p>
                  <p className="text-xs text-stone-600 mt-1.5 leading-relaxed">{s.detail}</p>
                  <button
                    type="button"
                    onClick={() => updateQuery({ classId: s.classId })}
                    className="mt-3 text-xs font-medium text-emerald-700 hover:text-emerald-900"
                  >
                    View attendance for this class →
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {invitedClasses && invitedClasses.length === 0 && (
          <p className="text-stone-600 text-sm">
            You&apos;re not invited to any classes yet. Ask your teacher to invite your email, then open
            this page again.
          </p>
        )}

        {detailError && (
          <div className="p-4 rounded-xl bg-red-50 text-red-700 text-sm">{detailError}</div>
        )}

        {detailLoading && !detail && (
          <p className="text-stone-500 text-sm">Loading attendance…</p>
        )}
        {detailLoading && detail && <p className="text-stone-400 text-xs">Refreshing…</p>}

        {detail && (
          <>
            <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-white border border-stone-100 shadow-sm">
                <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">You</p>
                <p className="mt-1 font-medium text-stone-900 break-all">{detail.email}</p>
                {detail.studentName && (
                  <p className="text-sm text-stone-600 mt-0.5">{detail.studentName}</p>
                )}
              </div>
              <div className="p-5 rounded-2xl bg-white border border-stone-100 shadow-sm">
                <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">
                  This month (UTC)
                </p>
                <p className="mt-1 text-lg font-semibold text-stone-900">
                  {formatCreditedSeconds(detail.monthTotals.seconds)}
                </p>
                <p className="text-sm text-stone-600">
                  {detail.monthTotals.daysWithActivity} active day
                  {detail.monthTotals.daysWithActivity === 1 ? "" : "s"}
                </p>
              </div>
              <div className="p-5 rounded-2xl bg-white border border-stone-100 shadow-sm">
                <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">
                  All time (scope)
                </p>
                <p className="mt-1 text-lg font-semibold text-stone-900">
                  {formatCreditedSeconds(detail.overallTotals.totalSeconds)}
                </p>
                <p className="text-sm text-stone-600">
                  {detail.overallTotals.distinctDays} distinct day
                  {detail.overallTotals.distinctDays === 1 ? "" : "s"}
                </p>
              </div>
              <div className="p-5 rounded-2xl bg-white border border-stone-100 shadow-sm">
                <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Scope</p>
                <p className="mt-1 text-sm font-medium text-stone-900">
                  {detail.classScope === "all"
                    ? "All my classes"
                    : detail.byClass.find((c) => c.classId === detail.classScope)?.className ??
                      "One class"}
                </p>
                {detail.overallTotals.firstDay && (
                  <p className="text-xs text-stone-500 mt-1">
                    First record {detail.overallTotals.firstDay}
                    {detail.overallTotals.lastDay &&
                      detail.overallTotals.lastDay !== detail.overallTotals.firstDay &&
                      ` → ${detail.overallTotals.lastDay}`}
                  </p>
                )}
              </div>
            </section>

            <section className="p-6 rounded-2xl bg-white border border-stone-100 shadow-sm">
              <h2 className="text-sm font-semibold text-stone-800 mb-4">Per class</h2>
              {detail.byClass.length === 0 ? (
                <p className="text-sm text-stone-500">No credited time in this scope yet.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-stone-200">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-stone-100 text-stone-600">
                      <tr>
                        <th className="px-3 py-2 font-medium">Class</th>
                        <th className="px-3 py-2 font-medium">This month</th>
                        <th className="px-3 py-2 font-medium">Days (month)</th>
                        <th className="px-3 py-2 font-medium">All time</th>
                        <th className="px-3 py-2 font-medium">Days (all)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {detail.byClass.map((c) => (
                        <tr key={c.classId} className="bg-white">
                          <td className="px-3 py-2 text-stone-800">{c.className}</td>
                          <td className="px-3 py-2 text-stone-600">
                            {formatCreditedSeconds(c.secondsInMonth)}
                          </td>
                          <td className="px-3 py-2 text-stone-600">{c.daysInMonth}</td>
                          <td className="px-3 py-2 text-stone-600">
                            {formatCreditedSeconds(c.secondsAllTime)}
                          </td>
                          <td className="px-3 py-2 text-stone-600">{c.daysAllTime}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="p-6 rounded-2xl bg-white border border-stone-100 shadow-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
                <h2 className="text-sm font-semibold text-stone-800">
                  Calendar — {detail.month} (UTC)
                </h2>
                <p className="text-xs text-stone-500">
                  Darker = more credited time that day. Hover a day for split by class.
                </p>
              </div>
              <div className="grid grid-cols-7 gap-1.5 text-center text-xs text-stone-500 mb-2">
                {WEEKDAYS.map((d) => (
                  <div key={d} className="font-medium py-1">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: leadingBlanks }).map((_, i) => (
                  <div key={`pad-${i}`} className="aspect-square rounded-lg bg-stone-50/80" />
                ))}
                {detail.calendarDays.map((cell) => {
                  const intensity =
                    maxSecondsInMonth > 0 && cell.seconds > 0
                      ? Math.max(0.2, cell.seconds / maxSecondsInMonth)
                      : 0;
                  const dayNum = Number(cell.day.slice(8, 10));
                  const isToday = cell.day === todayKey;
                  const title =
                    cell.seconds === 0
                      ? `${cell.day}: no credit`
                      : `${cell.day}: ${formatCreditedSeconds(cell.seconds)}` +
                        (cell.byClass.length
                          ? `\n${cell.byClass.map((b) => `${b.className}: ${formatCreditedSeconds(b.seconds)}`).join("\n")}`
                          : "");
                  return (
                    <div
                      key={cell.day}
                      title={title}
                      className={`aspect-square rounded-lg border flex flex-col items-center justify-center text-[11px] sm:text-xs transition ${
                        isToday
                          ? "ring-2 ring-emerald-500 ring-offset-1 border-emerald-200"
                          : "border-stone-100"
                      } ${
                        cell.seconds === 0
                          ? "bg-stone-50 text-stone-400"
                          : "text-stone-900 font-medium"
                      }`}
                      style={
                        cell.seconds > 0
                          ? {
                              backgroundColor: `rgba(16, 185, 129, ${0.12 + intensity * 0.55})`,
                            }
                          : undefined
                      }
                    >
                      <span>{dayNum}</span>
                      {cell.seconds > 0 && (
                        <span className="text-[10px] text-stone-600 leading-tight mt-0.5 hidden sm:block">
                          {Math.round(cell.seconds / 60)}m
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
