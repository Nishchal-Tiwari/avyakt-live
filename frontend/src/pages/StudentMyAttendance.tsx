import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/[0.06] dark:to-primary/10">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="text-sm font-medium text-primary hover:text-primary/80">
              ← Dashboard
            </Link>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">My attendance</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{user.email}</span>
            <ModeToggle />
            <Button variant="ghost" size="sm" onClick={logout} className="text-muted-foreground">
              Log out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
        {classesError && (
          <Alert variant="destructive">
            <AlertDescription>{classesError}</AlertDescription>
          </Alert>
        )}

        <Card className="border-border/80 shadow-sm">
          <CardContent className="space-y-4 p-6">
            <p className="text-sm text-muted-foreground">
              Credited time only counts when you and the host are both in the live meeting (UTC calendar).
              Choose one class or all classes you&apos;re invited to.
            </p>
            <div className="flex flex-col flex-wrap gap-4 lg:flex-row">
              <div className="flex min-w-[220px] flex-1 flex-col gap-2">
                <Label className="text-xs text-muted-foreground">Class</Label>
                <Select
                  value={
                    classScope === "all" || !invitedClasses?.some((c) => c.classId === classScope)
                      ? "all"
                      : classScope
                  }
                  onValueChange={(v) => updateQuery({ classId: v === "all" ? "all" : v })}
                  disabled={invitedClasses === null}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Class" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All my classes</SelectItem>
                    {(invitedClasses ?? []).map((c) => (
                      <SelectItem key={c.classId} value={c.classId}>
                        {c.className}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex min-w-[240px] flex-col gap-2">
                <Label className="text-xs text-muted-foreground">Month (UTC)</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => updateQuery({ month: shiftMonth(month, -1) })}
                  >
                    ←
                  </Button>
                  <span className="flex-1 text-center text-sm font-medium tabular-nums text-foreground">
                    {month}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => updateQuery({ month: shiftMonth(month, 1) })}
                  >
                    →
                  </Button>
                  <Button type="button" variant="secondary" size="sm" onClick={() => updateQuery({ month: currentMonthUtc() })}>
                    Today
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {myStreaks && myStreaks.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Attendance streaks</h2>
            <p className="text-xs text-muted-foreground">
              Streaks count <strong className="font-medium text-foreground">class days</strong> (UTC) when
              a live session ran and you earned at least the shown minutes with your teacher present. Days
              with no session do not break your streak.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {myStreaks.map((s) => (
                <Card
                  key={s.classId}
                  className={cn(
                    "border shadow-sm transition-colors",
                    classScope === s.classId || classScope === "all"
                      ? "border-primary/40 bg-primary/5"
                      : "border-border/80",
                  )}
                >
                  <CardContent className="space-y-2 p-4">
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <h3 className="text-sm font-medium text-foreground">{s.className}</h3>
                      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold tabular-nums text-primary">
                        {s.currentStreakClassDays}/{s.targetDays}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-foreground">{s.headline}</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">{s.detail}</p>
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto p-0 text-xs"
                      onClick={() => updateQuery({ classId: s.classId })}
                    >
                      View attendance for this class →
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {invitedClasses && invitedClasses.length === 0 && (
          <p className="text-sm text-muted-foreground">
            You&apos;re not invited to any classes yet. Ask your teacher to invite your email, then open
            this page again.
          </p>
        )}

        {detailError && (
          <Alert variant="destructive">
            <AlertDescription>{detailError}</AlertDescription>
          </Alert>
        )}

        {detailLoading && !detail && (
          <p className="text-sm text-muted-foreground">Loading attendance…</p>
        )}
        {detailLoading && detail && <p className="text-xs text-muted-foreground">Refreshing…</p>}

        {detail && (
          <>
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="border-border/80 shadow-sm">
                <CardContent className="p-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">You</p>
                  <p className="mt-1 break-all font-medium text-foreground">{detail.email}</p>
                  {detail.studentName && (
                    <p className="mt-0.5 text-sm text-muted-foreground">{detail.studentName}</p>
                  )}
                </CardContent>
              </Card>
              <Card className="border-border/80 shadow-sm">
                <CardContent className="p-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    This month (UTC)
                  </p>
                  <p className="mt-1 text-lg font-semibold text-foreground">
                    {formatCreditedSeconds(detail.monthTotals.seconds)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {detail.monthTotals.daysWithActivity} active day
                    {detail.monthTotals.daysWithActivity === 1 ? "" : "s"}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border/80 shadow-sm">
                <CardContent className="p-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    All time (scope)
                  </p>
                  <p className="mt-1 text-lg font-semibold text-foreground">
                    {formatCreditedSeconds(detail.overallTotals.totalSeconds)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {detail.overallTotals.distinctDays} distinct day
                    {detail.overallTotals.distinctDays === 1 ? "" : "s"}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border/80 shadow-sm">
                <CardContent className="p-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Scope</p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {detail.classScope === "all"
                      ? "All my classes"
                      : detail.byClass.find((c) => c.classId === detail.classScope)?.className ??
                        "One class"}
                  </p>
                  {detail.overallTotals.firstDay && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      First record {detail.overallTotals.firstDay}
                      {detail.overallTotals.lastDay &&
                        detail.overallTotals.lastDay !== detail.overallTotals.firstDay &&
                        ` → ${detail.overallTotals.lastDay}`}
                    </p>
                  )}
                </CardContent>
              </Card>
            </section>

            <Card className="border-border/80 shadow-sm">
              <CardContent className="space-y-4 p-6">
                <h2 className="text-sm font-semibold text-foreground">Per class</h2>
                {detail.byClass.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No credited time in this scope yet.</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-muted/50 text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-medium">Class</th>
                          <th className="px-3 py-2 font-medium">This month</th>
                          <th className="px-3 py-2 font-medium">Days (month)</th>
                          <th className="px-3 py-2 font-medium">All time</th>
                          <th className="px-3 py-2 font-medium">Days (all)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {detail.byClass.map((c) => (
                          <tr key={c.classId} className="bg-card">
                            <td className="px-3 py-2 text-foreground">{c.className}</td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {formatCreditedSeconds(c.secondsInMonth)}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">{c.daysInMonth}</td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {formatCreditedSeconds(c.secondsAllTime)}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">{c.daysAllTime}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/80 shadow-sm">
              <CardContent className="space-y-4 p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-sm font-semibold text-foreground">
                    Calendar — {detail.month} (UTC)
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Darker = more credited time that day. Hover a day for split by class.
                  </p>
                </div>
                <div className="mb-2 grid grid-cols-7 gap-1.5 text-center text-xs text-muted-foreground">
                  {WEEKDAYS.map((d) => (
                    <div key={d} className="py-1 font-medium">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {Array.from({ length: leadingBlanks }).map((_, i) => (
                    <div key={`pad-${i}`} className="aspect-square rounded-lg bg-muted/40" />
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
                        className={cn(
                          "flex aspect-square flex-col items-center justify-center rounded-lg border text-[11px] transition sm:text-xs",
                          isToday
                            ? "border-primary ring-2 ring-primary ring-offset-1 ring-offset-background"
                            : "border-border",
                          cell.seconds === 0
                            ? "bg-muted/30 text-muted-foreground"
                            : "font-medium text-foreground",
                        )}
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
                          <span className="mt-0.5 hidden text-[10px] leading-tight text-muted-foreground sm:block">
                            {Math.round(cell.seconds / 60)}m
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
