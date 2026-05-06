import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { api, type ClassResponse } from "@/lib/api";

interface Participant {
  identity: string;
  name: string;
}

interface InvitedUser {
  email: string;
  invitedAt: string;
}

interface AttendanceRecord {
  id: string;
  email: string;
  joinTime: string;
  leaveTime: string | null;
  duration: number | null;
}

interface CreditedDailyRow {
  email: string;
  day: string;
  minutes: number;
  seconds: number;
}

interface CreditedTotalRow {
  email: string;
  totalMinutes: number;
  totalSeconds: number;
  daysAttended: number;
}

interface MyAttendanceClassRow {
  classId: string;
  className: string;
  daily: { day: string; minutes: number; seconds: number }[];
  totalMinutes: number;
  totalSeconds: number;
  daysAttended: number;
}

interface ClassesList {
  asTeacher: (ClassResponse & { teacher?: { email: string; name: string | null } })[];
  invited: (ClassResponse & { invitedAt?: string })[];
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [classes, setClasses] = useState<ClassesList | null>(null);
  const [loading, setLoading] = useState(true);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createRedirectUrl, setCreateRedirectUrl] = useState("");
  const [createRequireCamera, setCreateRequireCamera] = useState(false);
  const [createRequireMic, setCreateRequireMic] = useState(false);
  const [createStreakEnabled, setCreateStreakEnabled] = useState(false);
  const [createStreakTargetDays, setCreateStreakTargetDays] = useState(21);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [inviteClassId, setInviteClassId] = useState<string | null>(null);
  const [inviteEmails, setInviteEmails] = useState("");
  const [inviting, setInviting] = useState(false);
  const [liveOverviewClassId, setLiveOverviewClassId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [invited, setInvited] = useState<InvitedUser[]>([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [kicking, setKicking] = useState<string | null>(null);
  const [disinviting, setDisinviting] = useState<string | null>(null);
  const [attendanceClassId, setAttendanceClassId] = useState<string | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [creditedDaily, setCreditedDaily] = useState<CreditedDailyRow[]>([]);
  const [creditedTotals, setCreditedTotals] = useState<CreditedTotalRow[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [myAttendance, setMyAttendance] = useState<MyAttendanceClassRow[]>([]);
  const [myAttendanceLoading, setMyAttendanceLoading] = useState(false);
  const [editRedirectClassId, setEditRedirectClassId] = useState<string | null>(null);
  const [editRedirectUrl, setEditRedirectUrl] = useState("");
  const [editRequireCamera, setEditRequireCamera] = useState(false);
  const [editRequireMic, setEditRequireMic] = useState(false);
  const [editStreakEnabled, setEditStreakEnabled] = useState(false);
  const [editStreakTargetDays, setEditStreakTargetDays] = useState(21);
  const [savingRedirect, setSavingRedirect] = useState(false);
  const [copiedLinkClassId, setCopiedLinkClassId] = useState<string | null>(null);
  const [studentAttendanceClassId, setStudentAttendanceClassId] = useState<string | null>(null);

  const fetchParticipants = useCallback(async (classId: string) => {
    setParticipantsLoading(true);
    try {
      const res = await api.get<{
        participants: Participant[];
        invited: InvitedUser[];
      }>(`/classes/${classId}/participants`);
      setParticipants(res?.participants ?? []);
      setInvited(res?.invited ?? []);
    } catch {
      setParticipants([]);
      setInvited([]);
    } finally {
      setParticipantsLoading(false);
    }
  }, []);

  useEffect(() => {
    api
      .get<ClassesList>("/classes")
      .then(setClasses)
      .catch(() => setError("Failed to load classes"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (user?.role === "TEACHER") return;
    setMyAttendanceLoading(true);
    api
      .get<{ classes: MyAttendanceClassRow[] }>("/attendance/my")
      .then((res) => setMyAttendance(res?.classes ?? []))
      .catch(() => setMyAttendance([]))
      .finally(() => setMyAttendanceLoading(false));
  }, [user?.role]);

  useEffect(() => {
    if (!liveOverviewClassId) return;
    fetchParticipants(liveOverviewClassId);
    const interval = setInterval(() => fetchParticipants(liveOverviewClassId), 5000);
    return () => clearInterval(interval);
  }, [liveOverviewClassId, fetchParticipants]);

  async function handleKick(classId: string, identity: string) {
    setKicking(identity);
    try {
      await api.post(`/classes/${classId}/kick`, { identity });
      fetchParticipants(classId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to kick");
    } finally {
      setKicking(null);
    }
  }

  async function handleDisinvite(classId: string, email: string) {
    setDisinviting(email);
    try {
      await api.post(`/classes/${classId}/disinvite`, { email });
      fetchParticipants(classId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disinvite");
    } finally {
      setDisinviting(null);
    }
  }

  function toggleLiveOverview(classId: string) {
    if (liveOverviewClassId === classId) {
      setLiveOverviewClassId(null);
      setParticipants([]);
      setInvited([]);
    } else {
      setLiveOverviewClassId(classId);
    }
  }

  function toggleStudentAttendance(classId: string) {
    setStudentAttendanceClassId((id) => (id === classId ? null : classId));
  }

  async function toggleAttendanceHistory(classId: string) {
    if (attendanceClassId === classId) {
      setAttendanceClassId(null);
      setAttendance([]);
      setCreditedDaily([]);
      setCreditedTotals([]);
    } else {
      setAttendanceClassId(classId);
      setAttendanceLoading(true);
      try {
        const res = await api.get<{
          attendance: AttendanceRecord[];
          creditedDaily?: CreditedDailyRow[];
          creditedTotals?: CreditedTotalRow[];
        }>(`/classes/${classId}/attendance`);
        setAttendance(res?.attendance ?? []);
        setCreditedDaily(res?.creditedDaily ?? []);
        setCreditedTotals(res?.creditedTotals ?? []);
      } catch {
        setAttendance([]);
        setCreditedDaily([]);
        setCreditedTotals([]);
      } finally {
        setAttendanceLoading(false);
      }
    }
  }

  function formatTime(iso: string | null): string {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      dateStyle: "short",
      timeStyle: "short",
    });
  }

  function formatDuration(sec: number | null): string {
    if (sec == null) return "—";
    if (sec < 60) return `${sec}s`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return s ? `${m}m ${s}s` : `${m}m`;
  }

  function myAttendanceRowForClass(classId: string): MyAttendanceClassRow | undefined {
    return myAttendance.find((r) => r.classId === classId);
  }

  function formatCreditedSeconds(totalSeconds: number): string {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    if (m === 0) return `${s}s`;
    if (s === 0) return `${m} min`;
    return `${m} min ${s}s`;
  }

  function openClassSettings(c: ClassResponse) {
    setEditRedirectClassId(c.id);
    setEditRedirectUrl(c.redirectUrl ?? "");
    setEditRequireCamera(Boolean(c.requireCamera));
    setEditRequireMic(Boolean(c.requireMic));
    setEditStreakEnabled(Boolean(c.streakEnabled));
    setEditStreakTargetDays(
      typeof c.streakTargetDays === "number" && c.streakTargetDays > 0 ? c.streakTargetDays : 21,
    );
  }

  function closeClassSettings() {
    setEditRedirectClassId(null);
    setEditRedirectUrl("");
  }

  async function saveClassSettings(classId: string) {
    setSavingRedirect(true);
    setError("");
    try {
      await api.patch(`/classes/${classId}`, {
        redirectUrl: editRedirectUrl.trim() || null,
        requireCamera: editRequireCamera,
        requireMic: editRequireMic,
        streakEnabled: editStreakEnabled,
        streakTargetDays: editStreakTargetDays,
      });
      closeClassSettings();
      const data = await api.get<ClassesList>("/classes");
      setClasses(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update class settings");
    } finally {
      setSavingRedirect(false);
    }
  }

  async function handleCreateClass(e: React.FormEvent) {
    e.preventDefault();
    if (!createName.trim()) return;
    setCreating(true);
    setError("");
    try {
      await api.post<ClassResponse>("/classes", {
        name: createName.trim(),
        description: createDescription.trim() || undefined,
        redirectUrl: createRedirectUrl.trim() || undefined,
        requireCamera: createRequireCamera,
        requireMic: createRequireMic,
        streakEnabled: createStreakEnabled,
        streakTargetDays: createStreakTargetDays,
      });
      setCreateName("");
      setCreateDescription("");
      setCreateRedirectUrl("");
      setCreateRequireCamera(false);
      setCreateRequireMic(false);
      setCreateStreakEnabled(false);
      setCreateStreakTargetDays(21);
      const data = await api.get<ClassesList>("/classes");
      setClasses(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create class");
    } finally {
      setCreating(false);
    }
  }

  function goToMeeting(classId: string) {
    navigate(`/meeting/${classId}`);
  }

  function meetingJoinUrl(classId: string) {
    return `${window.location.origin}/meeting/${classId}`;
  }

  async function copyMeetingLink(classId: string) {
    const url = meetingJoinUrl(classId);
    setError("");
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLinkClassId(classId);
      window.setTimeout(() => {
        setCopiedLinkClassId((id) => (id === classId ? null : id));
      }, 2500);
    } catch {
      setError(`Could not copy automatically. Link: ${url}`);
    }
  }

  async function handleInvite(e: React.FormEvent, classId: string) {
    e.preventDefault();
    const emails = inviteEmails
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!emails.length) return;
    setInviting(true);
    setError("");
    try {
      await api.post(`/classes/${classId}/invite`, { emails });
      setInviteClassId(null);
      setInviteEmails("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to invite");
    } finally {
      setInviting(false);
    }
  }

  const isTeacher = user?.role === "TEACHER";

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-emerald-50/30">
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-semibold text-stone-800">Live Meditation</h1>
            {isTeacher && (
              <>
                <Link
                  to="/teacher/attendance"
                  className="text-sm font-medium text-emerald-700 hover:text-emerald-900"
                >
                  Student attendance
                </Link>
                <Link
                  to="/teacher/streaks"
                  className="text-sm font-medium text-emerald-700 hover:text-emerald-900"
                >
                  Streak board
                </Link>
              </>
            )}
            {!isTeacher && (
              <Link
                to="/student/attendance"
                className="text-sm font-medium text-emerald-700 hover:text-emerald-900"
              >
                My attendance
              </Link>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-stone-500">{user?.email}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-stone-200 text-stone-700">
              {user?.role}
            </span>
            <button
              type="button"
              onClick={logout}
              className="text-sm text-stone-500 hover:text-stone-700"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-700 text-sm">
            {error}
          </div>
        )}

        {isTeacher && (
          <form
            onSubmit={handleCreateClass}
            className="mb-10 p-6 rounded-2xl bg-white border border-stone-100 shadow-sm"
          >
            <h2 className="text-lg font-semibold text-stone-800 mb-4">Create class</h2>
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <input
                  type="text"
                  placeholder="Class name"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-stone-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                />
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-stone-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                />
              </div>
              <input
                type="text"
                placeholder="Redirect URL when meeting ends (optional, e.g. /dashboard or https://example.com/thanks)"
                value={createRedirectUrl}
                onChange={(e) => setCreateRedirectUrl(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-stone-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm"
              />
              <div className="rounded-xl border border-stone-100 bg-stone-50/90 p-4 space-y-3">
                <div>
                  <p className="text-sm font-medium text-stone-800">Student requirements</p>
                  <p className="text-xs text-stone-500 mt-0.5">
                    When enabled, invited students must keep camera or microphone on to use the meeting.
                    You can change this later in class settings or during a live meeting.
                  </p>
                </div>
                <label className="flex items-center gap-2.5 text-sm text-stone-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createRequireCamera}
                    onChange={(e) => setCreateRequireCamera(e.target.checked)}
                    className="rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  Require camera for students
                </label>
                <label className="flex items-center gap-2.5 text-sm text-stone-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createRequireMic}
                    onChange={(e) => setCreateRequireMic(e.target.checked)}
                    className="rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  Require microphone for students
                </label>
              </div>
              <div className="rounded-xl border border-stone-100 bg-stone-50/90 p-4 space-y-3">
                <div>
                  <p className="text-sm font-medium text-stone-800">Attendance streak (optional)</p>
                  <p className="text-xs text-stone-500 mt-0.5">
                    When enabled, students see progress toward consecutive live class days with at least 10
                    minutes credited (teacher present). Days without a session do not break the streak.
                  </p>
                </div>
                <label className="flex items-center gap-2.5 text-sm text-stone-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createStreakEnabled}
                    onChange={(e) => setCreateStreakEnabled(e.target.checked)}
                    className="rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  Enable streak for this class
                </label>
                {createStreakEnabled && (
                  <label className="flex flex-col gap-1 max-w-[200px]">
                    <span className="text-xs font-medium text-stone-600">Class days in a row</span>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={createStreakTargetDays}
                      onChange={(e) =>
                        setCreateStreakTargetDays(
                          Math.min(365, Math.max(1, Number(e.target.value) || 21)),
                        )
                      }
                      className="px-3 py-2 text-sm rounded-lg border border-stone-200 bg-white"
                    />
                  </label>
                )}
              </div>
              <button
                type="submit"
                disabled={creating || !createName.trim()}
                className="px-6 py-2.5 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </form>
        )}

        <section>
          <h2 className="text-lg font-semibold text-stone-800 mb-4">
            {isTeacher ? "My classes" : "Classes"}
          </h2>
          {loading ? (
            <p className="text-stone-500">Loading...</p>
          ) : (
            <div className="space-y-4">
              {classes?.asTeacher?.map((c) => (
                <div
                  key={c.id}
                  className="p-5 rounded-2xl bg-white border border-stone-100 shadow-sm flex flex-wrap items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-stone-800">{c.name}</h3>
                    {c.description && (
                      <p className="text-sm text-stone-500 mt-0.5">{c.description}</p>
                    )}
                    <p className="text-xs text-stone-400 mt-1">You are the teacher</p>
                    <p className="text-xs text-stone-500 mt-1">
                      Redirect URL:{" "}
                      {c.redirectUrl ? (
                        <span className="text-stone-700 break-all">{c.redirectUrl}</span>
                      ) : (
                        <span className="italic">not set</span>
                      )}
                      {editRedirectClassId !== c.id && (
                        <button
                          type="button"
                          onClick={() => openClassSettings(c)}
                          className="ml-2 text-emerald-600 hover:underline"
                        >
                          Edit settings
                        </button>
                      )}
                    </p>
                    <p className="text-xs text-stone-500 mt-1">
                      Students: camera{" "}
                      <span className="text-stone-700 font-medium">
                        {c.requireCamera ? "required" : "optional"}
                      </span>
                      {" · "}
                      mic{" "}
                      <span className="text-stone-700 font-medium">
                        {c.requireMic ? "required" : "optional"}
                      </span>
                    </p>
                    <p className="text-xs text-stone-500 mt-1">
                      Streak:{" "}
                      {c.streakEnabled ? (
                        <span className="text-stone-700 font-medium">
                          {c.streakTargetDays ?? 21}-class-day goal
                        </span>
                      ) : (
                        <span className="italic text-stone-400">off</span>
                      )}
                    </p>
                    {editRedirectClassId === c.id && (
                      <div className="mt-3 rounded-xl border border-stone-200 bg-stone-50/80 p-4 space-y-3 w-full max-w-xl">
                        <div>
                          <label className="block text-xs font-medium text-stone-600 mb-1">
                            Redirect when meeting ends
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. /dashboard or https://example.com/thanks"
                            value={editRedirectUrl}
                            onChange={(e) => setEditRedirectUrl(e.target.value)}
                            className="w-full px-3 py-2 text-sm rounded-lg border border-stone-200 bg-white"
                          />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-stone-600 mb-2">Student requirements</p>
                          <label className="flex items-center gap-2.5 text-sm text-stone-700 cursor-pointer mb-2">
                            <input
                              type="checkbox"
                              checked={editRequireCamera}
                              onChange={(e) => setEditRequireCamera(e.target.checked)}
                              className="rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            Require camera for students
                          </label>
                          <label className="flex items-center gap-2.5 text-sm text-stone-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editRequireMic}
                              onChange={(e) => setEditRequireMic(e.target.checked)}
                              className="rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            Require microphone for students
                          </label>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-stone-600 mb-2">Attendance streak</p>
                          <label className="flex items-center gap-2.5 text-sm text-stone-700 cursor-pointer mb-2">
                            <input
                              type="checkbox"
                              checked={editStreakEnabled}
                              onChange={(e) => setEditStreakEnabled(e.target.checked)}
                              className="rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            Enable streak for this class
                          </label>
                          {editStreakEnabled && (
                            <label className="flex flex-col gap-1 max-w-[200px]">
                              <span className="text-xs text-stone-600">Class days in a row</span>
                              <input
                                type="number"
                                min={1}
                                max={365}
                                value={editStreakTargetDays}
                                onChange={(e) =>
                                  setEditStreakTargetDays(
                                    Math.min(365, Math.max(1, Number(e.target.value) || 21)),
                                  )
                                }
                                className="w-full px-3 py-2 text-sm rounded-lg border border-stone-200 bg-white"
                              />
                            </label>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => saveClassSettings(c.id)}
                            disabled={savingRedirect}
                            className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {savingRedirect ? "Saving…" : "Save settings"}
                          </button>
                          <button
                            type="button"
                            onClick={closeClassSettings}
                            className="px-4 py-2 text-sm text-stone-600 hover:text-stone-800"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                    {inviteClassId === c.id && (
                      <form
                        onSubmit={(e) => handleInvite(e, c.id)}
                        className="mt-3 flex flex-wrap gap-2"
                      >
                        <input
                          type="text"
                          placeholder="Emails (comma or space separated)"
                          value={inviteEmails}
                          onChange={(e) => setInviteEmails(e.target.value)}
                          className="flex-1 min-w-[200px] px-3 py-1.5 text-sm rounded-lg border border-stone-200"
                        />
                        <button
                          type="submit"
                          disabled={inviting}
                          className="px-3 py-1.5 rounded-lg bg-stone-700 text-white text-sm hover:bg-stone-600 disabled:opacity-50"
                        >
                          {inviting ? "Inviting…" : "Invite"}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setInviteClassId(null); setInviteEmails(""); }}
                          className="px-3 py-1.5 text-sm text-stone-500 hover:text-stone-700"
                        >
                          Cancel
                        </button>
                      </form>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <button
                      type="button"
                      onClick={() => toggleLiveOverview(c.id)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                        liveOverviewClassId === c.id
                          ? "bg-amber-100 text-amber-800 border border-amber-300"
                          : "border border-stone-200 text-stone-700 hover:bg-stone-50"
                      }`}
                    >
                      {liveOverviewClassId === c.id ? "Hide live overview" : "Live overview"}
                    </button>
                    {inviteClassId !== c.id && (
                      <button
                        type="button"
                        onClick={() => setInviteClassId(c.id)}
                        className="px-4 py-2 rounded-lg border border-stone-200 text-stone-700 text-sm font-medium hover:bg-stone-50"
                      >
                        Invite
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleAttendanceHistory(c.id)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                        attendanceClassId === c.id
                          ? "bg-sky-100 text-sky-800 border border-sky-300"
                          : "border border-stone-200 text-stone-700 hover:bg-stone-50"
                      }`}
                    >
                      {attendanceClassId === c.id ? "Hide attendance" : "Attendance history"}
                    </button>
                    <button
                      type="button"
                      onClick={() => copyMeetingLink(c.id)}
                      title="Anyone with this link must sign in; only invited members can enter the room."
                      className="px-4 py-2 rounded-lg border border-stone-200 text-stone-700 text-sm font-medium hover:bg-stone-50"
                    >
                      {copiedLinkClassId === c.id ? "Copied link" : "Copy invite link"}
                    </button>
                    <button
                      type="button"
                      onClick={() => goToMeeting(c.id)}
                      className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
                    >
                      Start / Join meeting
                    </button>
                  </div>
                  {attendanceClassId === c.id && (
                    <div className="w-full mt-4 pt-4 border-t border-stone-100 space-y-6">
                      <div>
                        <h4 className="text-sm font-medium text-stone-800 mb-1">
                          Attendance (host + student in meeting)
                        </h4>
                        <p className="text-xs text-stone-500 mb-3">
                          Credited time is added in 30-second slices only when both you and the student are
                          connected to the LiveKit room. Days are UTC calendar dates.
                        </p>
                        {attendanceLoading ? (
                          <p className="text-sm text-stone-500">Loading…</p>
                        ) : creditedTotals.length === 0 && creditedDaily.length === 0 ? (
                          <p className="text-sm text-stone-500">No credited attendance yet.</p>
                        ) : (
                          <>
                            {creditedTotals.length > 0 && (
                              <div className="mb-4">
                                <h5 className="text-xs font-semibold text-stone-600 uppercase tracking-wide mb-2">
                                  Totals per student
                                </h5>
                                <div className="overflow-x-auto rounded-lg border border-stone-200">
                                  <table className="w-full text-sm text-left">
                                    <thead className="bg-stone-100 text-stone-600">
                                      <tr>
                                        <th className="px-3 py-2 font-medium">Student</th>
                                        <th className="px-3 py-2 font-medium">Total time</th>
                                        <th className="px-3 py-2 font-medium">Days</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-100">
                                      {creditedTotals.map((r) => (
                                        <tr key={r.email} className="bg-white">
                                          <td className="px-3 py-2 text-stone-800">{r.email}</td>
                                          <td className="px-3 py-2 text-stone-600">
                                            {formatCreditedSeconds(r.totalSeconds)}
                                          </td>
                                          <td className="px-3 py-2 text-stone-600">{r.daysAttended}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                            {creditedDaily.length > 0 && (
                              <div>
                                <h5 className="text-xs font-semibold text-stone-600 uppercase tracking-wide mb-2">
                                  By day
                                </h5>
                                <div className="overflow-x-auto rounded-lg border border-stone-200">
                                  <table className="w-full text-sm text-left">
                                    <thead className="bg-stone-100 text-stone-600">
                                      <tr>
                                        <th className="px-3 py-2 font-medium">Student</th>
                                        <th className="px-3 py-2 font-medium">Date (UTC)</th>
                                        <th className="px-3 py-2 font-medium">Time that day</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-100">
                                      {creditedDaily.map((r) => (
                                        <tr
                                          key={`${r.email}-${r.day}`}
                                          className="bg-white"
                                        >
                                          <td className="px-3 py-2 text-stone-800">{r.email}</td>
                                          <td className="px-3 py-2 text-stone-600">{r.day}</td>
                                          <td className="px-3 py-2 text-stone-600">
                                            {formatCreditedSeconds(r.seconds)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      <div>
                        <h4 className="text-sm font-medium text-stone-700 mb-2">
                          Session log (join / leave)
                        </h4>
                        <p className="text-xs text-stone-500 mb-2">
                          Raw connect/disconnect events; not gated on host presence.
                        </p>
                        {attendanceLoading ? null : attendance.length === 0 ? (
                          <p className="text-sm text-stone-500">No session rows yet.</p>
                        ) : (
                          <div className="overflow-x-auto rounded-lg border border-stone-200">
                            <table className="w-full text-sm text-left">
                              <thead className="bg-stone-100 text-stone-600">
                                <tr>
                                  <th className="px-3 py-2 font-medium">Email</th>
                                  <th className="px-3 py-2 font-medium">Joined</th>
                                  <th className="px-3 py-2 font-medium">Left</th>
                                  <th className="px-3 py-2 font-medium">Duration</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-stone-100">
                                {attendance.map((r) => (
                                  <tr key={r.id} className="bg-white">
                                    <td className="px-3 py-2 text-stone-800">{r.email}</td>
                                    <td className="px-3 py-2 text-stone-600">
                                      {formatTime(r.joinTime)}
                                    </td>
                                    <td className="px-3 py-2 text-stone-600">
                                      {formatTime(r.leaveTime)}
                                    </td>
                                    <td className="px-3 py-2 text-stone-600">
                                      {formatDuration(r.duration)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {liveOverviewClassId === c.id && (
                    <div className="w-full mt-4 pt-4 border-t border-stone-100">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-stone-700">
                          Currently in meeting
                        </h4>
                        <button
                          type="button"
                          onClick={() => fetchParticipants(c.id)}
                          disabled={participantsLoading}
                          className="text-xs text-stone-500 hover:text-stone-700 disabled:opacity-50"
                        >
                          Refresh
                        </button>
                      </div>
                      {participantsLoading ? (
                        <p className="text-sm text-stone-500">Loading…</p>
                      ) : participants.length === 0 ? (
                        <p className="text-sm text-stone-500">No participants</p>
                      ) : (
                        <ul className="space-y-2">
                          {participants.map((p) => (
                            <li
                              key={p.identity}
                              className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg bg-stone-50"
                            >
                              <span className="text-sm text-stone-800">
                                {p.name || p.identity}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleKick(c.id, p.identity)}
                                disabled={kicking === p.identity}
                                className="px-3 py-1 rounded text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
                              >
                                {kicking === p.identity ? "Kicking…" : "Kick"}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      <h4 className="text-sm font-medium text-stone-700 mt-4 mb-2">
                        Invited
                      </h4>
                      {invited.length === 0 ? (
                        <p className="text-sm text-stone-500">No one invited yet</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {invited.map((i) => (
                            <li
                              key={i.email}
                              className="flex items-center justify-between gap-3 py-1.5 px-3 rounded-lg bg-stone-50 text-sm text-stone-700"
                            >
                              <span>{i.email}</span>
                              <button
                                type="button"
                                onClick={() => handleDisinvite(c.id, i.email)}
                                disabled={disinviting === i.email}
                                className="px-3 py-1 rounded text-sm font-medium bg-amber-100 text-amber-800 hover:bg-amber-200 disabled:opacity-50"
                              >
                                {disinviting === i.email ? "Removing…" : "Disinvite"}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {classes?.invited?.map((c) => {
                const row = myAttendanceRowForClass(c.id);
                const summaryLine =
                  row && !myAttendanceLoading
                    ? `${formatCreditedSeconds(row.totalSeconds)} · ${row.daysAttended} day${
                        row.daysAttended === 1 ? "" : "s"
                      } with host`
                    : null;
                return (
                  <div
                    key={c.id}
                    className="rounded-2xl bg-white border border-stone-100 shadow-sm overflow-hidden"
                  >
                    <div className="p-5 flex flex-wrap items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-stone-800">{c.name}</h3>
                        {c.description && (
                          <p className="text-sm text-stone-500 mt-0.5">{c.description}</p>
                        )}
                        <p className="text-xs text-stone-400 mt-1">
                          Teacher: {c.teacher?.email}
                        </p>
                        {!isTeacher && summaryLine && studentAttendanceClassId !== c.id && (
                          <p className="text-xs text-stone-500 mt-1.5">{summaryLine}</p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 items-center">
                        {!isTeacher && (
                          <button
                            type="button"
                            onClick={() => toggleStudentAttendance(c.id)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                              studentAttendanceClassId === c.id
                                ? "bg-sky-100 text-sky-800 border border-sky-300"
                                : "border border-stone-200 text-stone-700 hover:bg-stone-50"
                            }`}
                          >
                            {studentAttendanceClassId === c.id ? "Hide my attendance" : "My attendance"}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => copyMeetingLink(c.id)}
                          title="Sign in required. Only invited members can join."
                          className="px-4 py-2 rounded-lg border border-stone-200 text-stone-700 text-sm font-medium hover:bg-stone-50"
                        >
                          {copiedLinkClassId === c.id ? "Copied link" : "Copy link"}
                        </button>
                        <button
                          type="button"
                          onClick={() => goToMeeting(c.id)}
                          className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
                        >
                          Join meeting
                        </button>
                      </div>
                    </div>
                    {!isTeacher && studentAttendanceClassId === c.id && (
                      <div className="px-5 pb-5 pt-0 border-t border-stone-100">
                        <p className="text-xs text-stone-500 mt-4 mb-3">
                          Time counts only when you and the host are both in the live meeting (checked every
                          30 seconds). Days are UTC.
                        </p>
                        {myAttendanceLoading ? (
                          <p className="text-sm text-stone-500">Loading…</p>
                        ) : !row ? (
                          <p className="text-sm text-stone-500">
                            No credited time yet for this class. Join while your teacher is in the meeting
                            to build your history.
                          </p>
                        ) : (
                          <>
                            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                              <p className="text-sm text-stone-600">
                                <span className="font-medium text-stone-800">
                                  {formatCreditedSeconds(row.totalSeconds)}
                                </span>
                                <span className="text-stone-400"> · </span>
                                {row.daysAttended} day{row.daysAttended === 1 ? "" : "s"} with host present
                              </p>
                            </div>
                            {row.daily.length === 0 ? (
                              <p className="text-sm text-stone-500">No daily breakdown yet.</p>
                            ) : (
                              <div className="overflow-x-auto rounded-lg border border-stone-200">
                                <table className="w-full text-sm text-left">
                                  <thead className="bg-stone-100 text-stone-600">
                                    <tr>
                                      <th className="px-3 py-2 font-medium">Date (UTC)</th>
                                      <th className="px-3 py-2 font-medium">Time credited</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-stone-100">
                                    {row.daily.map((d) => (
                                      <tr key={d.day} className="bg-white">
                                        <td className="px-3 py-2 text-stone-800">{d.day}</td>
                                        <td className="px-3 py-2 text-stone-600">
                                          {formatCreditedSeconds(d.seconds)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {!classes?.asTeacher?.length && !classes?.invited?.length && (
                <p className="text-stone-500 py-8">
                  {isTeacher
                    ? "Create a class or wait for invites."
                    : "You have no classes yet. Ask a teacher to invite your email."}
                </p>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
