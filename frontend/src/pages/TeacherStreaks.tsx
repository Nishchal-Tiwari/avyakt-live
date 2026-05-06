import { useEffect, useState, useCallback, useMemo } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

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
            <h1 className="text-xl font-semibold text-stone-800">Streak board</h1>
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

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <p className="text-sm text-stone-600">
          Only classes with streaks enabled appear here. Progress uses host-present credited time: at
          least 10 minutes per <strong className="font-medium text-stone-700">class day</strong> (UTC).
          Calendar days without a live session are skipped and do not reset a student&apos;s streak.
        </p>

        {allBoardClasses.length > 1 && (
          <label className="flex flex-col gap-1.5 max-w-md">
            <span className="text-xs font-medium text-stone-600">Filter by class</span>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="px-3 py-2.5 rounded-lg border border-stone-200 bg-white text-sm"
            >
              <option value="">All streak classes</option>
              {allBoardClasses.map((c) => (
                <option key={c.classId} value={c.classId}>
                  {c.className}
                </option>
              ))}
            </select>
          </label>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>
        )}

        {loading && <p className="text-stone-500 text-sm">Loading…</p>}

        {!loading && !error && allBoardClasses.length === 0 && (
          <p className="text-stone-600 text-sm">
            No classes with streaks enabled. Turn on &quot;Attendance streak&quot; in class settings on
            the dashboard, then invite students.
          </p>
        )}

        {!loading &&
          classFilter &&
          boardClasses.length === 0 &&
          allBoardClasses.length > 0 && (
            <p className="text-amber-800 text-sm">No matching class in this board.</p>
          )}

        {!loading &&
          boardClasses.map((cls) => (
            <section
              key={cls.classId}
              className="rounded-2xl bg-white border border-stone-100 shadow-sm overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-stone-100 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-semibold text-stone-800">{cls.className}</h2>
                <p className="text-sm text-stone-500">
                  Goal: <span className="font-medium text-stone-700">{cls.targetDays}</span> class days in
                  a row
                </p>
              </div>
              {cls.students.length === 0 ? (
                <p className="px-5 py-6 text-sm text-stone-500">No invited students yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-stone-50 text-stone-600">
                      <tr>
                        <th className="px-4 py-3 font-medium">Student</th>
                        <th className="px-4 py-3 font-medium">Streak built</th>
                        <th className="px-4 py-3 font-medium">To goal</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {cls.students.map((s) => (
                        <tr key={s.email} className="bg-white">
                          <td className="px-4 py-3 text-stone-800 break-all">{s.email}</td>
                          <td className="px-4 py-3 text-stone-800 tabular-nums font-medium">
                            {s.currentStreakClassDays} / {cls.targetDays}{" "}
                            <span className="text-stone-500 font-normal">class days</span>
                          </td>
                          <td className="px-4 py-3 text-stone-600 tabular-nums">
                            {s.goalMet ? "—" : `${s.daysRemaining} left`}
                          </td>
                          <td className="px-4 py-3 text-stone-600">
                            {s.goalMet ? (
                              <span className="text-emerald-700 font-medium">Goal met</span>
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
            </section>
          ))}
      </main>
    </div>
  );
}
