import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

interface RosterStudent {
  email: string;
  classes: { id: string; name: string }[];
}

interface TeacherStudentAttendanceResponse {
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
  streakSummaries?: Array<{
    classId: string;
    className: string;
    targetDays: number;
    currentStreakClassDays: number;
    daysRemaining: number;
    goalMet: boolean;
  }>;
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
  const n = new Date();
  return n.toISOString().slice(0, 10);
}

export default function TeacherStudentAttendance() {
  const { user, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [roster, setRoster] = useState<RosterStudent[] | null>(null);
  const [rosterError, setRosterError] = useState("");
  const [detail, setDetail] = useState<TeacherStudentAttendanceResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const selectedEmail = (searchParams.get("email") ?? "").trim().toLowerCase();
  const classScope = searchParams.get("classId") ?? "all";
  const month = searchParams.get("month") ?? currentMonthUtc();

  const updateQuery = useCallback(
    (next: { email?: string; classId?: string; month?: string }) => {
      const p = new URLSearchParams(searchParams);
      if (next.email !== undefined) {
        if (next.email) p.set("email", next.email);
        else p.delete("email");
      }
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
      .get<{ students: RosterStudent[] }>("/attendance/teacher/roster")
      .then((res) => {
        if (!cancelled) {
          setRoster(res.students ?? []);
          setRosterError("");
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setRoster(null);
          setRosterError(e instanceof Error ? e.message : "Failed to load roster");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedStudentMeta = useMemo(() => {
    if (!selectedEmail || !roster) return undefined;
    return roster.find((s) => s.email === selectedEmail);
  }, [roster, selectedEmail]);

  useEffect(() => {
    if (!selectedEmail) {
      setDetail(null);
      setDetailError("");
      return;
    }

    if (roster === null) {
      return;
    }

    const student = roster.find((s) => s.email === selectedEmail);
    if (classScope !== "all" && classScope) {
      const ok = student?.classes.some((c) => c.id === classScope);
      if (!ok) {
        updateQuery({ classId: "all" });
        return;
      }
    }

    let cancelled = false;
    setDetailLoading(true);
    setDetailError("");
    const q = new URLSearchParams();
    q.set("email", selectedEmail);
    if (classScope && classScope !== "all") q.set("classId", classScope);
    q.set("month", month);

    api
      .get<TeacherStudentAttendanceResponse>(`/attendance/teacher/student?${q.toString()}`)
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
  }, [selectedEmail, classScope, month, roster, updateQuery]);

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (user.role !== "TEACHER") {
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
            <h1 className="text-xl font-semibold text-stone-800">Student attendance</h1>
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
        {rosterError && (
          <div className="p-4 rounded-xl bg-red-50 text-red-700 text-sm">{rosterError}</div>
        )}

        <section className="p-6 rounded-2xl bg-white border border-stone-100 shadow-sm space-y-4">
          <p className="text-sm text-stone-600">
            Pick an invited student and optionally one of your classes. Credited time is host-present
            time (UTC days), same as in meetings.
          </p>
          <div className="flex flex-col lg:flex-row gap-4 flex-wrap">
            <label className="flex flex-col gap-1.5 min-w-[220px] flex-1">
              <span className="text-xs font-medium text-stone-600">Student</span>
              <select
                value={selectedEmail}
                onChange={(e) => {
                  const v = e.target.value;
                  updateQuery({ email: v, classId: "all" });
                }}
                className="px-3 py-2.5 rounded-lg border border-stone-200 bg-white text-stone-800 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
              >
                <option value="">Select a student…</option>
                {(roster ?? []).map((s) => (
                  <option key={s.email} value={s.email}>
                    {s.email}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 min-w-[200px] flex-1">
              <span className="text-xs font-medium text-stone-600">Class scope</span>
              <select
                value={classScope === "all" || !selectedStudentMeta ? "all" : classScope}
                onChange={(e) => {
                  const v = e.target.value;
                  updateQuery({ classId: v === "all" ? "all" : v });
                }}
                disabled={!selectedStudentMeta}
                className="px-3 py-2.5 rounded-lg border border-stone-200 bg-white text-stone-800 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none disabled:opacity-50"
              >
                <option value="all">All shared classes</option>
                {(selectedStudentMeta?.classes ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
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

        {roster && roster.length === 0 && (
          <p className="text-stone-600 text-sm">
            No invited students yet. Invite emails from a class on the dashboard, then return here.
          </p>
        )}

        {selectedEmail && (
          <>
            {detailError && (
              <div className="p-4 rounded-xl bg-red-50 text-red-700 text-sm">{detailError}</div>
            )}

            {detailLoading && !detail && (
              <p className="text-stone-500 text-sm">Loading attendance…</p>
            )}
            {detailLoading && detail && (
              <p className="text-stone-400 text-xs">Refreshing…</p>
            )}

            {detail && (
              <>
                <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-5 rounded-2xl bg-white border border-stone-100 shadow-sm">
                    <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">
                      Student
                    </p>
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
                    <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">
                      Scope
                    </p>
                    <p className="mt-1 text-sm font-medium text-stone-900">
                      {detail.classScope === "all"
                        ? "All shared classes"
                        : detail.byClass.find((c) => c.classId === detail.classScope)?.className ??
                          "One class"}
                    </p>
                    {detail.streakSummaries && detail.streakSummaries.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-stone-100 space-y-2">
                        <p className="text-xs font-medium text-stone-600 uppercase tracking-wide">
                          Streak (live class days)
                        </p>
                        {detail.streakSummaries.map((s) => (
                          <p key={s.classId} className="text-xs text-stone-600 leading-relaxed">
                            <span className="font-medium text-stone-800">{s.className}:</span>{" "}
                            <span className="tabular-nums font-semibold text-stone-900">
                              {s.currentStreakClassDays}
                            </span>
                            <span className="text-stone-500">
                              {" "}
                              / {s.targetDays} day{s.targetDays === 1 ? "" : "s"} built
                            </span>
                            {s.goalMet ? (
                              <span className="text-emerald-700 font-medium"> — goal complete</span>
                            ) : (
                              <span className="text-stone-500">
                                {" "}
                                ({s.daysRemaining} more class day
                                {s.daysRemaining === 1 ? "" : "s"} to goal)
                              </span>
                            )}
                          </p>
                        ))}
                      </div>
                    )}
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
                    <p className="text-sm text-stone-500">No credited rows in this scope.</p>
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
          </>
        )}
      </main>
    </div>
  );
}
