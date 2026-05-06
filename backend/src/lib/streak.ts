/** Minimum credited seconds in a UTC day to count toward streak (host-present time). */
export const STREAK_MIN_SECONDS = 600; // 10 minutes

export const STREAK_MIN_MINUTES = STREAK_MIN_SECONDS / 60;

/** How far back we load daily rows (calendar days). */
export const STREAK_LOOKBACK_DAYS = 400;

export type DailyRow = { email: string; day: Date; seconds: number };

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDaysToKey(key: string, delta: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return dt.toISOString().slice(0, 10);
}

function todayUtcKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** A "class day" = at least one person earned host-present credit that UTC day (session ran). */
function buildSessionDays(rows: DailyRow[]): Set<string> {
  const sumByDay = new Map<string, number>();
  for (const r of rows) {
    const k = dayKey(r.day);
    sumByDay.set(k, (sumByDay.get(k) ?? 0) + r.seconds);
  }
  const sessionDays = new Set<string>();
  for (const [k, sec] of sumByDay) {
    if (sec > 0) sessionDays.add(k);
  }
  return sessionDays;
}

function buildStudentSecondsByDay(rows: DailyRow[], studentEmail: string): Map<string, number> {
  const email = studentEmail.trim().toLowerCase();
  const m = new Map<string, number>();
  for (const r of rows) {
    if (r.email !== email) continue;
    const k = dayKey(r.day);
    m.set(k, (m.get(k) ?? 0) + r.seconds);
  }
  return m;
}

/**
 * Current streak: walk backward from today (UTC). Class days without a live session are skipped.
 * On a class day, student must have >= STREAK_MIN_SECONDS or the streak ends.
 */
export function computeCurrentStreakClassDays(
  rows: DailyRow[],
  studentEmail: string,
  targetDays: number,
): {
  currentRun: number;
  goalMet: boolean;
  daysRemaining: number;
} {
  const sessionDays = buildSessionDays(rows);
  const studentByDay = buildStudentSecondsByDay(rows, studentEmail);

  let run = 0;
  let dayKey = todayUtcKey();
  for (let i = 0; i < STREAK_LOOKBACK_DAYS; i++) {
    if (!sessionDays.has(dayKey)) {
      dayKey = addDaysToKey(dayKey, -1);
      continue;
    }
    const sec = studentByDay.get(dayKey) ?? 0;
    if (sec >= STREAK_MIN_SECONDS) {
      run++;
      dayKey = addDaysToKey(dayKey, -1);
    } else {
      break;
    }
  }

  const goalMet = run >= targetDays;
  const daysRemaining = goalMet ? 0 : Math.max(0, targetDays - run);

  return { currentRun: run, goalMet, daysRemaining };
}

export function buildStudentStreakCopy(
  targetDays: number,
  currentRun: number,
  goalMet: boolean,
  daysRemaining: number,
): { headline: string; detail: string } {
  if (goalMet) {
    return {
      headline: "Streak goal complete",
      detail: `You have completed your ${targetDays}-class-day streak: ${targetDays} live class days in a row with at least ${STREAK_MIN_MINUTES} minutes credited each day (while your teacher was in the meeting). Your current run is ${currentRun} class days. Days without a session do not reset your streak.`,
    };
  }
  if (currentRun === 0) {
    return {
      headline: "Start your streak",
      detail: `Earn at least ${STREAK_MIN_MINUTES} minutes of credited time on the next class day to begin. You need ${targetDays} qualifying class days in a row to finish. If the teacher does not run a session on a given day, that day is skipped and does not break your progress.`,
    };
  }
  const dr = daysRemaining;
  return {
    headline: `${currentRun}-class-day streak`,
    detail: `You have ${dr} qualifying class ${dr === 1 ? "day" : "days"} left to complete your ${targetDays}-day streak. Each class day needs at least ${STREAK_MIN_MINUTES} minutes with your teacher present. Days with no live session are not counted.`,
  };
}
