import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
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
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [editRedirectClassId, setEditRedirectClassId] = useState<string | null>(null);
  const [editRedirectUrl, setEditRedirectUrl] = useState("");
  const [savingRedirect, setSavingRedirect] = useState(false);

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

  async function toggleAttendanceHistory(classId: string) {
    if (attendanceClassId === classId) {
      setAttendanceClassId(null);
      setAttendance([]);
    } else {
      setAttendanceClassId(classId);
      setAttendanceLoading(true);
      try {
        const res = await api.get<{ attendance: AttendanceRecord[] }>(
          `/classes/${classId}/attendance`
        );
        setAttendance(res?.attendance ?? []);
      } catch {
        setAttendance([]);
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

  function openEditRedirect(c: { id: string; redirectUrl?: string | null }) {
    setEditRedirectClassId(c.id);
    setEditRedirectUrl(c.redirectUrl ?? "");
  }

  async function saveRedirectUrl(classId: string) {
    setSavingRedirect(true);
    setError("");
    try {
      await api.patch(`/classes/${classId}`, { redirectUrl: editRedirectUrl.trim() || null });
      setEditRedirectClassId(null);
      setEditRedirectUrl("");
      const data = await api.get<ClassesList>("/classes");
      setClasses(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update redirect URL");
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
      });
      setCreateName("");
      setCreateDescription("");
      setCreateRedirectUrl("");
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
          <h1 className="text-xl font-semibold text-stone-800">Yoga Class</h1>
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
                          onClick={() => openEditRedirect(c)}
                          className="ml-2 text-emerald-600 hover:underline"
                        >
                          Edit
                        </button>
                      )}
                    </p>
                    {editRedirectClassId === c.id && (
                      <div className="mt-3 flex flex-wrap gap-2 items-center">
                        <input
                          type="text"
                          placeholder="e.g. /dashboard or https://example.com/thanks"
                          value={editRedirectUrl}
                          onChange={(e) => setEditRedirectUrl(e.target.value)}
                          className="flex-1 min-w-[200px] px-3 py-1.5 text-sm rounded-lg border border-stone-200"
                        />
                        <button
                          type="button"
                          onClick={() => saveRedirectUrl(c.id)}
                          disabled={savingRedirect}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {savingRedirect ? "Saving…" : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setEditRedirectClassId(null); setEditRedirectUrl(""); }}
                          className="px-3 py-1.5 text-sm text-stone-500 hover:text-stone-700"
                        >
                          Cancel
                        </button>
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
                      onClick={() => goToMeeting(c.id)}
                      className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
                    >
                      Start / Join meeting
                    </button>
                  </div>
                  {attendanceClassId === c.id && (
                    <div className="w-full mt-4 pt-4 border-t border-stone-100">
                      <h4 className="text-sm font-medium text-stone-700 mb-2">
                        Meeting history / Attendance
                      </h4>
                      {attendanceLoading ? (
                        <p className="text-sm text-stone-500">Loading…</p>
                      ) : attendance.length === 0 ? (
                        <p className="text-sm text-stone-500">No attendance records yet</p>
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
              {classes?.invited?.map((c) => (
                <div
                  key={c.id}
                  className="p-5 rounded-2xl bg-white border border-stone-100 shadow-sm flex flex-wrap items-center justify-between gap-4"
                >
                  <div>
                    <h3 className="font-medium text-stone-800">{c.name}</h3>
                    {c.description && (
                      <p className="text-sm text-stone-500 mt-0.5">{c.description}</p>
                    )}
                    <p className="text-xs text-stone-400 mt-1">
                      Teacher: {c.teacher?.email}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => goToMeeting(c.id)}
                    className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
                  >
                    Join meeting
                  </button>
                </div>
              ))}
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
