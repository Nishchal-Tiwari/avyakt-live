import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { api, type ClassResponse } from "@/lib/api";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

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
  const [createAdvancedOpen, setCreateAdvancedOpen] = useState(false);
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

  useEffect(() => {
    if (!editRedirectClassId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !savingRedirect) closeClassSettings();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [editRedirectClassId, savingRedirect]);

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
      setCreateAdvancedOpen(false);
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
  const editingClass = classes?.asTeacher?.find((c) => c.id === editRedirectClassId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/[0.06] dark:to-primary/10">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Live Meditation</h1>
            {isTeacher && (
              <>
                <Link
                  to="/teacher/attendance"
                  className="text-sm font-medium text-primary hover:text-primary/80"
                >
                  Student attendance
                </Link>
                <Link
                  to="/teacher/streaks"
                  className="text-sm font-medium text-primary hover:text-primary/80"
                >
                  Streak board
                </Link>
              </>
            )}
            {!isTeacher && (
              <Link
                to="/student/attendance"
                className="text-sm font-medium text-primary hover:text-primary/80"
              >
                My attendance
              </Link>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{user?.email}</span>
            <Badge variant="secondary" className="font-normal">
              {user?.role}
            </Badge>
            <ModeToggle />
            <Button variant="ghost" size="sm" onClick={logout} className="text-muted-foreground">
              Log out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isTeacher && (
          <section className="mb-12">
            <form
              onSubmit={handleCreateClass}
              className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/80 px-5 py-6 shadow-sm sm:px-7 sm:py-7"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-primary/[0.07] to-transparent dark:from-primary/10"
              />

              <div className="relative space-y-5">
                <div className="max-w-xl">
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                    New class
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Name it, create it, invite students when you’re ready.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="create-name" className="text-muted-foreground">
                      Class name
                    </Label>
                    <Input
                      id="create-name"
                      placeholder="e.g. Morning meditation"
                      value={createName}
                      onChange={(e) => setCreateName(e.target.value)}
                      autoComplete="off"
                      className="h-12 border-border/80 bg-background/80 text-base shadow-none focus-visible:ring-primary/40"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="create-desc" className="text-muted-foreground">
                      Description <span className="font-normal opacity-70">(optional)</span>
                    </Label>
                    <Input
                      id="create-desc"
                      placeholder="A short note for your students"
                      value={createDescription}
                      onChange={(e) => setCreateDescription(e.target.value)}
                      className="h-11 border-border/80 bg-background/60 shadow-none"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Button
                    type="submit"
                    size="lg"
                    disabled={creating || !createName.trim()}
                    className="h-11 min-w-[9.5rem] px-6"
                  >
                    {creating ? "Creating…" : "Create class"}
                  </Button>

                  <button
                    type="button"
                    onClick={() => setCreateAdvancedOpen((open) => !open)}
                    className="inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground transition-colors hover:text-foreground sm:self-auto"
                    aria-expanded={createAdvancedOpen}
                  >
                    More options
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform duration-200",
                        createAdvancedOpen && "rotate-180",
                      )}
                    />
                  </button>
                </div>

                {createAdvancedOpen && (
                  <div className="space-y-5 border-t border-border/60 pt-5">
                    <div className="space-y-2">
                      <Label htmlFor="create-redirect" className="text-muted-foreground">
                        End-of-meeting redirect{" "}
                        <span className="font-normal opacity-70">(optional)</span>
                      </Label>
                      <Input
                        id="create-redirect"
                        placeholder="/dashboard or https://…"
                        value={createRedirectUrl}
                        onChange={(e) => setCreateRedirectUrl(e.target.value)}
                        className="border-border/80 bg-background/60 shadow-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">During the meeting</p>
                      <p className="text-xs text-muted-foreground">
                        Optional. You can change these anytime after creating.
                      </p>
                      <div className="mt-3 divide-y divide-border/60 rounded-xl border border-border/60 bg-background/40">
                        <div className="flex items-center justify-between gap-4 px-4 py-3">
                          <Label
                            htmlFor="create-req-cam"
                            className="cursor-pointer text-sm font-normal leading-snug"
                          >
                            Require student camera
                          </Label>
                          <Switch
                            id="create-req-cam"
                            checked={createRequireCamera}
                            onCheckedChange={setCreateRequireCamera}
                          />
                        </div>
                        <div className="flex items-center justify-between gap-4 px-4 py-3">
                          <Label
                            htmlFor="create-req-mic"
                            className="cursor-pointer text-sm font-normal leading-snug"
                          >
                            Require student microphone
                          </Label>
                          <Switch
                            id="create-req-mic"
                            checked={createRequireMic}
                            onCheckedChange={setCreateRequireMic}
                          />
                        </div>
                        <div className="flex items-center justify-between gap-4 px-4 py-3">
                          <div className="min-w-0">
                            <Label
                              htmlFor="create-streak"
                              className="cursor-pointer text-sm font-normal leading-snug"
                            >
                              Track attendance streaks
                            </Label>
                            {createStreakEnabled && (
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                Counts days with 10+ credited minutes.
                              </p>
                            )}
                          </div>
                          <Switch
                            id="create-streak"
                            checked={createStreakEnabled}
                            onCheckedChange={setCreateStreakEnabled}
                          />
                        </div>
                      </div>
                    </div>

                    {createStreakEnabled && (
                      <div className="max-w-[12rem] space-y-2">
                        <Label htmlFor="create-streak-days" className="text-muted-foreground">
                          Goal (days in a row)
                        </Label>
                        <Input
                          id="create-streak-days"
                          type="number"
                          min={1}
                          max={365}
                          value={createStreakTargetDays}
                          onChange={(e) =>
                            setCreateStreakTargetDays(
                              Math.min(365, Math.max(1, Number(e.target.value) || 21)),
                            )
                          }
                          className="border-border/80 bg-background/60 shadow-none"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </form>
          </section>
        )}

        <section>
          <h2 className="mb-4 text-lg font-semibold tracking-tight text-foreground">
            {isTeacher ? "My classes" : "Classes"}
          </h2>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-32 w-full rounded-xl" />
              <Skeleton className="h-32 w-full rounded-xl" />
            </div>
          ) : (
            <div className="space-y-4">
              {classes?.asTeacher?.map((c) => (
                <Card
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-4 border-border/80 p-5 shadow-sm"
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-foreground">{c.name}</h3>
                    {c.description && (
                      <p className="mt-0.5 text-sm text-muted-foreground">{c.description}</p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">You are the teacher</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Redirect URL:{" "}
                      {c.redirectUrl ? (
                        <span className="break-all text-foreground">{c.redirectUrl}</span>
                      ) : (
                        <span className="italic">not set</span>
                      )}
                      <Button
                        type="button"
                        variant="link"
                        className="ml-1 h-auto p-0 text-primary"
                        onClick={() => openClassSettings(c)}
                      >
                        Edit settings
                      </Button>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Students: camera{" "}
                      <span className="font-medium text-foreground">
                        {c.requireCamera ? "required" : "optional"}
                      </span>
                      {" · "}
                      mic{" "}
                      <span className="font-medium text-foreground">
                        {c.requireMic ? "required" : "optional"}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Streak:{" "}
                      {c.streakEnabled ? (
                        <span className="font-medium text-foreground">
                          {c.streakTargetDays ?? 21}-class-day goal
                        </span>
                      ) : (
                        <span className="italic text-muted-foreground/80">off</span>
                      )}
                    </p>
                    {inviteClassId === c.id && (
                      <form
                        onSubmit={(e) => handleInvite(e, c.id)}
                        className="mt-3 flex flex-wrap items-center gap-2"
                      >
                        <Input
                          type="text"
                          placeholder="Emails (comma or space separated)"
                          value={inviteEmails}
                          onChange={(e) => setInviteEmails(e.target.value)}
                          className="min-w-[200px] flex-1 text-sm"
                        />
                        <Button type="submit" disabled={inviting} size="sm" variant="secondary">
                          {inviting ? "Inviting…" : "Invite"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setInviteClassId(null);
                            setInviteEmails("");
                          }}
                        >
                          Cancel
                        </Button>
                      </form>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant={liveOverviewClassId === c.id ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => toggleLiveOverview(c.id)}
                      className={cn(
                        liveOverviewClassId === c.id &&
                          "border-amber-300/80 bg-amber-500/15 text-amber-950 hover:bg-amber-500/20 dark:text-amber-100",
                      )}
                    >
                      {liveOverviewClassId === c.id ? "Hide live overview" : "Live overview"}
                    </Button>
                    {inviteClassId !== c.id && (
                      <Button type="button" variant="outline" size="sm" onClick={() => setInviteClassId(c.id)}>
                        Invite
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant={attendanceClassId === c.id ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => toggleAttendanceHistory(c.id)}
                      className={cn(
                        attendanceClassId === c.id &&
                          "border-sky-300/80 bg-sky-500/15 text-sky-950 hover:bg-sky-500/20 dark:text-sky-100",
                      )}
                    >
                      {attendanceClassId === c.id ? "Hide attendance" : "Attendance history"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => copyMeetingLink(c.id)}
                      title="Anyone with this link must sign in; only invited members can enter the room."
                    >
                      {copiedLinkClassId === c.id ? "Copied link" : "Copy invite link"}
                    </Button>
                    <Button type="button" size="sm" onClick={() => goToMeeting(c.id)}>
                      Start / Join meeting
                    </Button>
                  </div>
                  {attendanceClassId === c.id && (
                    <div className="mt-4 w-full space-y-6 border-t border-border pt-4">
                      <div>
                        <h4 className="mb-1 text-sm font-medium text-foreground">
                          Attendance (host + student in meeting)
                        </h4>
                        <p className="mb-3 text-xs text-muted-foreground">
                          Credited time is added in 30-second slices only when both you and the student are
                          connected to the LiveKit room. Days are UTC calendar dates.
                        </p>
                        {attendanceLoading ? (
                          <p className="text-sm text-muted-foreground">Loading…</p>
                        ) : creditedTotals.length === 0 && creditedDaily.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No credited attendance yet.</p>
                        ) : (
                          <>
                            {creditedTotals.length > 0 && (
                              <div className="mb-4">
                                <h5 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  Totals per student
                                </h5>
                                <div className="overflow-x-auto rounded-lg border border-border">
                                  <table className="w-full text-left text-sm">
                                    <thead className="bg-muted/50 text-muted-foreground">
                                      <tr>
                                        <th className="px-3 py-2 font-medium">Student</th>
                                        <th className="px-3 py-2 font-medium">Total time</th>
                                        <th className="px-3 py-2 font-medium">Days</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                      {creditedTotals.map((r) => (
                                        <tr key={r.email} className="bg-card">
                                          <td className="px-3 py-2 text-foreground">{r.email}</td>
                                          <td className="px-3 py-2 text-muted-foreground">
                                            {formatCreditedSeconds(r.totalSeconds)}
                                          </td>
                                          <td className="px-3 py-2 text-muted-foreground">{r.daysAttended}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                            {creditedDaily.length > 0 && (
                              <div>
                                <h5 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  By day
                                </h5>
                                <div className="overflow-x-auto rounded-lg border border-border">
                                  <table className="w-full text-left text-sm">
                                    <thead className="bg-muted/50 text-muted-foreground">
                                      <tr>
                                        <th className="px-3 py-2 font-medium">Student</th>
                                        <th className="px-3 py-2 font-medium">Date (UTC)</th>
                                        <th className="px-3 py-2 font-medium">Time that day</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                      {creditedDaily.map((r) => (
                                        <tr
                                          key={`${r.email}-${r.day}`}
                                          className="bg-card"
                                        >
                                          <td className="px-3 py-2 text-foreground">{r.email}</td>
                                          <td className="px-3 py-2 text-muted-foreground">{r.day}</td>
                                          <td className="px-3 py-2 text-muted-foreground">
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
                        <h4 className="mb-2 text-sm font-medium text-foreground">
                          Session log (join / leave)
                        </h4>
                        <p className="mb-2 text-xs text-muted-foreground">
                          Raw connect/disconnect events; not gated on host presence.
                        </p>
                        {attendanceLoading ? null : attendance.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No session rows yet.</p>
                        ) : (
                          <div className="overflow-x-auto rounded-lg border border-border">
                            <table className="w-full text-left text-sm">
                              <thead className="bg-muted/50 text-muted-foreground">
                                <tr>
                                  <th className="px-3 py-2 font-medium">Email</th>
                                  <th className="px-3 py-2 font-medium">Joined</th>
                                  <th className="px-3 py-2 font-medium">Left</th>
                                  <th className="px-3 py-2 font-medium">Duration</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {attendance.map((r) => (
                                  <tr key={r.id} className="bg-card">
                                    <td className="px-3 py-2 text-foreground">{r.email}</td>
                                    <td className="px-3 py-2 text-muted-foreground">
                                      {formatTime(r.joinTime)}
                                    </td>
                                    <td className="px-3 py-2 text-muted-foreground">
                                      {formatTime(r.leaveTime)}
                                    </td>
                                    <td className="px-3 py-2 text-muted-foreground">
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
                    <div className="mt-4 w-full border-t border-border pt-4">
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-sm font-medium text-foreground">Currently in meeting</h4>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => fetchParticipants(c.id)}
                          disabled={participantsLoading}
                        >
                          Refresh
                        </Button>
                      </div>
                      {participantsLoading ? (
                        <p className="text-sm text-muted-foreground">Loading…</p>
                      ) : participants.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No participants</p>
                      ) : (
                        <ul className="space-y-2">
                          {participants.map((p) => (
                            <li
                              key={p.identity}
                              className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2"
                            >
                              <span className="text-sm text-foreground">{p.name || p.identity}</span>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="h-8 bg-destructive/15 text-destructive hover:bg-destructive/25"
                                onClick={() => handleKick(c.id, p.identity)}
                                disabled={kicking === p.identity}
                              >
                                {kicking === p.identity ? "Kicking…" : "Kick"}
                              </Button>
                            </li>
                          ))}
                        </ul>
                      )}
                      <h4 className="mb-2 mt-4 text-sm font-medium text-foreground">Invited</h4>
                      {invited.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No one invited yet</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {invited.map((i) => (
                            <li
                              key={i.email}
                              className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-1.5 text-sm text-foreground"
                            >
                              <span>{i.email}</span>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                className="h-8 border border-amber-300/50 bg-amber-500/10 text-amber-950 hover:bg-amber-500/20 dark:text-amber-100"
                                onClick={() => handleDisinvite(c.id, i.email)}
                                disabled={disinviting === i.email}
                              >
                                {disinviting === i.email ? "Removing…" : "Disinvite"}
                              </Button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </Card>
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
                  <Card key={c.id} className="overflow-hidden border-border/80 shadow-sm">
                    <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-foreground">{c.name}</h3>
                        {c.description && (
                          <p className="mt-0.5 text-sm text-muted-foreground">{c.description}</p>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground">Teacher: {c.teacher?.email}</p>
                        {!isTeacher && summaryLine && studentAttendanceClassId !== c.id && (
                          <p className="mt-1.5 text-xs text-muted-foreground">{summaryLine}</p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {!isTeacher && (
                          <Button
                            type="button"
                            variant={studentAttendanceClassId === c.id ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => toggleStudentAttendance(c.id)}
                            className={cn(
                              studentAttendanceClassId === c.id &&
                                "border-sky-300/80 bg-sky-500/15 text-sky-950 hover:bg-sky-500/20 dark:text-sky-100",
                            )}
                          >
                            {studentAttendanceClassId === c.id ? "Hide my attendance" : "My attendance"}
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => copyMeetingLink(c.id)}
                          title="Sign in required. Only invited members can join."
                        >
                          {copiedLinkClassId === c.id ? "Copied link" : "Copy link"}
                        </Button>
                        <Button type="button" size="sm" onClick={() => goToMeeting(c.id)}>
                          Join meeting
                        </Button>
                      </div>
                    </CardContent>
                    {!isTeacher && studentAttendanceClassId === c.id && (
                      <div className="border-t border-border px-5 pb-5 pt-0">
                        <p className="mb-3 mt-4 text-xs text-muted-foreground">
                          Time counts only when you and the host are both in the live meeting (checked every
                          30 seconds). Days are UTC.
                        </p>
                        {myAttendanceLoading ? (
                          <p className="text-sm text-muted-foreground">Loading…</p>
                        ) : !row ? (
                          <p className="text-sm text-muted-foreground">
                            No credited time yet for this class. Join while your teacher is in the meeting
                            to build your history.
                          </p>
                        ) : (
                          <>
                            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                              <p className="text-sm text-muted-foreground">
                                <span className="font-medium text-foreground">
                                  {formatCreditedSeconds(row.totalSeconds)}
                                </span>
                                <span className="text-muted-foreground/70"> · </span>
                                {row.daysAttended} day{row.daysAttended === 1 ? "" : "s"} with host present
                              </p>
                            </div>
                            {row.daily.length === 0 ? (
                              <p className="text-sm text-muted-foreground">No daily breakdown yet.</p>
                            ) : (
                              <div className="overflow-x-auto rounded-lg border border-border">
                                <table className="w-full text-left text-sm">
                                  <thead className="bg-muted/50 text-muted-foreground">
                                    <tr>
                                      <th className="px-3 py-2 font-medium">Date (UTC)</th>
                                      <th className="px-3 py-2 font-medium">Time credited</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-border">
                                    {row.daily.map((d) => (
                                      <tr key={d.day} className="bg-card">
                                        <td className="px-3 py-2 text-foreground">{d.day}</td>
                                        <td className="px-3 py-2 text-muted-foreground">
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
                  </Card>
                );
              })}
              {!classes?.asTeacher?.length && !classes?.invited?.length && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {isTeacher
                    ? "Create a class or wait for invites."
                    : "You have no classes yet. Ask a teacher to invite your email."}
                </p>
              )}
            </div>
          )}
        </section>
      </main>

      {editRedirectClassId && editingClass && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            aria-label="Close settings"
            disabled={savingRedirect}
            onClick={closeClassSettings}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="class-settings-title"
            className="relative z-10 flex max-h-[min(90vh,640px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-border/70 px-5 py-4">
              <div className="min-w-0">
                <h2
                  id="class-settings-title"
                  className="truncate text-lg font-semibold tracking-tight text-foreground"
                >
                  Class settings
                </h2>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">{editingClass.name}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 rounded-full"
                disabled={savingRedirect}
                onClick={closeClassSettings}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-5 overflow-y-auto px-5 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-redirect" className="text-muted-foreground">
                  Redirect when meeting ends{" "}
                  <span className="font-normal opacity-70">(optional)</span>
                </Label>
                <Input
                  id="edit-redirect"
                  placeholder="/dashboard or https://…"
                  value={editRedirectUrl}
                  onChange={(e) => setEditRedirectUrl(e.target.value)}
                  className="border-border/80 bg-background/60 shadow-none"
                />
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">During the meeting</p>
                <div className="mt-2 divide-y divide-border/60 rounded-xl border border-border/60 bg-background/40">
                  <div className="flex items-center justify-between gap-4 px-4 py-3">
                    <Label htmlFor="edit-cam" className="cursor-pointer text-sm font-normal">
                      Require student camera
                    </Label>
                    <Switch
                      id="edit-cam"
                      checked={editRequireCamera}
                      onCheckedChange={setEditRequireCamera}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4 px-4 py-3">
                    <Label htmlFor="edit-mic" className="cursor-pointer text-sm font-normal">
                      Require student microphone
                    </Label>
                    <Switch
                      id="edit-mic"
                      checked={editRequireMic}
                      onCheckedChange={setEditRequireMic}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4 px-4 py-3">
                    <Label htmlFor="edit-streak" className="cursor-pointer text-sm font-normal">
                      Track attendance streaks
                    </Label>
                    <Switch
                      id="edit-streak"
                      checked={editStreakEnabled}
                      onCheckedChange={setEditStreakEnabled}
                    />
                  </div>
                </div>
              </div>

              {editStreakEnabled && (
                <div className="max-w-[12rem] space-y-2">
                  <Label htmlFor="edit-streak-days" className="text-muted-foreground">
                    Goal (days in a row)
                  </Label>
                  <Input
                    id="edit-streak-days"
                    type="number"
                    min={1}
                    max={365}
                    value={editStreakTargetDays}
                    onChange={(e) =>
                      setEditStreakTargetDays(
                        Math.min(365, Math.max(1, Number(e.target.value) || 21)),
                      )
                    }
                    className="border-border/80 bg-background/60 shadow-none"
                  />
                </div>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-border/70 px-5 py-4">
              <Button
                type="button"
                variant="ghost"
                disabled={savingRedirect}
                onClick={closeClassSettings}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={savingRedirect}
                onClick={() => saveClassSettings(editRedirectClassId)}
              >
                {savingRedirect ? "Saving…" : "Save settings"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
