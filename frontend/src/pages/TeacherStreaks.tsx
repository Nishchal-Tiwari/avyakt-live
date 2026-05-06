import { useEffect, useState, useCallback, useMemo } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface StreakBoardStudent {
  email: string;
  currentStreakClassDays: number;
  daysRemaining: number;
  goalMet: boolean;
  headline: string;
}

interface StreakBoardClass {
  classId: string;
  className: string;
  targetDays: number;
  students: StreakBoardStudent[];
}

export default function TeacherStreaks() {
  const { user, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const classFilter = searchParams.get("classId") ?? "";

  const [allData, setAllData] = useState<{ classes: StreakBoardClass[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const setClassFilter = useCallback(
    (id: string) => {
      const p = new URLSearchParams(searchParams);
      if (id) p.set("classId", id);
      else p.delete("classId");
      setSearchParams(p, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    api
      .get<{ classes: StreakBoardClass[] }>("/attendance/teacher/streak-board")
      .then((res) => {
        if (!cancelled) {
          setAllData(res);
          setError("");
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setAllData(null);
          setError(e instanceof Error ? e.message : "Failed to load streak board");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const boardClasses = useMemo(() => {
    const list = allData?.classes ?? [];
    if (!classFilter) return list;
    return list.filter((c) => c.classId === classFilter);
  }, [allData, classFilter]);

  const allBoardClasses = allData?.classes ?? [];

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (user.role !== "TEACHER") {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/[0.06] dark:to-primary/10">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="text-sm font-medium text-primary hover:text-primary/80">
              ← Dashboard
            </Link>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Streak board</h1>
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

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <Card className="border-border/80 bg-muted/20 shadow-none">
          <CardContent className="p-4 text-sm text-muted-foreground">
            Only classes with streaks enabled appear here. Progress uses host-present credited time: at
            least 10 minutes per <strong className="font-medium text-foreground">class day</strong> (UTC).
            Calendar days without a live session are skipped and do not reset a student&apos;s streak.
          </CardContent>
        </Card>

        {allBoardClasses.length > 1 && (
          <div className="flex max-w-md flex-col gap-2">
            <Label className="text-xs text-muted-foreground">Filter by class</Label>
            <Select value={classFilter || "all"} onValueChange={(v) => setClassFilter(v === "all" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="All streak classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All streak classes</SelectItem>
                {allBoardClasses.map((c) => (
                  <SelectItem key={c.classId} value={c.classId}>
                    {c.className}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

        {!loading && !error && allBoardClasses.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No classes with streaks enabled. Turn on &quot;Attendance streak&quot; in class settings on
            the dashboard, then invite students.
          </p>
        )}

        {!loading &&
          classFilter &&
          boardClasses.length === 0 &&
          allBoardClasses.length > 0 && (
            <Alert>
              <AlertDescription>No matching class in this board.</AlertDescription>
            </Alert>
          )}

        {!loading &&
          boardClasses.map((cls) => (
            <Card key={cls.classId} className="overflow-hidden border-border/80 shadow-sm">
              <CardHeader className="flex flex-row flex-wrap items-baseline justify-between gap-2 border-b border-border py-4">
                <CardTitle className="text-base font-semibold">{cls.className}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Goal: <span className="font-medium text-foreground">{cls.targetDays}</span> class days in
                  a row
                </p>
              </CardHeader>
              <CardContent className="p-0">
                {cls.students.length === 0 ? (
                  <p className="px-5 py-6 text-sm text-muted-foreground">No invited students yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-muted/50 text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 font-medium">Student</th>
                          <th className="px-4 py-3 font-medium">Streak built</th>
                          <th className="px-4 py-3 font-medium">To goal</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {cls.students.map((s) => (
                          <tr key={s.email} className="bg-card">
                            <td className="break-all px-4 py-3 text-foreground">{s.email}</td>
                            <td className="px-4 py-3 font-medium tabular-nums text-foreground">
                              {s.currentStreakClassDays} / {cls.targetDays}{" "}
                              <span className="font-normal text-muted-foreground">class days</span>
                            </td>
                            <td className="px-4 py-3 tabular-nums text-muted-foreground">
                              {s.goalMet ? "—" : `${s.daysRemaining} left`}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {s.goalMet ? (
                                <Badge variant="secondary" className="bg-primary/15 text-primary">
                                  Goal met
                                </Badge>
                              ) : (
                                s.headline
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
      </main>
    </div>
  );
}
