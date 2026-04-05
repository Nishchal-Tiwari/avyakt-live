import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  LiveKitRoom,
  VideoConference,
  useParticipants,
  useLocalParticipant,
  TrackToggle,
  DisconnectButton,
  useRoomContext,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { useAuth } from "@/contexts/AuthContext";
import { api, type JoinMeetingResponse } from "@/lib/api";
import "@livekit/components-styles";

import Chat from "@/components/Chat";

/* ── Native <select> device picker — immune to CSS z-index/overflow issues ── */
function NativeDeviceSelect({ kind }: { kind: MediaDeviceKind }) {
  const room = useRoomContext();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [activeId, setActiveId] = useState("");

  useEffect(() => {
    async function load() {
      const devs = await navigator.mediaDevices.enumerateDevices();
      setDevices(devs.filter((d) => d.kind === kind));
    }
    load();
    navigator.mediaDevices.addEventListener("devicechange", load);
    return () => navigator.mediaDevices.removeEventListener("devicechange", load);
  }, [kind]);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const deviceId = e.target.value;
    setActiveId(deviceId);
    try {
      await room.switchActiveDevice(kind, deviceId);
    } catch (err) {
      console.error("Failed to switch device:", err);
    }
  }

  if (devices.length <= 1) return null;

  return (
    <select
      value={activeId}
      onChange={handleChange}
      className="py-2 px-2 rounded-r-lg bg-stone-600 text-white text-xs hover:bg-stone-500 border-l border-stone-500 cursor-pointer outline-none max-w-[120px]"
      title={kind === "audioinput" ? "Choose Microphone" : "Choose Camera"}
    >
      {!activeId && <option value="">Select…</option>}
      {devices.map((d) => (
        <option key={d.deviceId} value={d.deviceId}>
          {d.label || `Device ${d.deviceId.slice(0, 8)}`}
        </option>
      ))}
    </select>
  );
}

function MeetingBar({
  classId,
  isTeacher,
  onToggleChat,
}: {
  classId: string;
  isTeacher: boolean;
  onToggleChat: () => void;
}) {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const [kicking, setKicking] = useState(false);
  const [ending, setEnding] = useState(false);

  async function handleKick(identity: string) {
    setKicking(true);
    try {
      await api.post(`/classes/${classId}/kick`, { identity });
    } catch (e) {
      console.error("Kick failed", e);
    } finally {
      setKicking(false);
    }
  }

  async function handleEndMeeting() {
    setEnding(true);
    try {
      await api.post(`/classes/${classId}/end`, {});
    } catch (e) {
      console.error("End meeting failed", e);
    } finally {
      setEnding(false);
    }
  }

  const others = participants.filter((p) => p.identity !== localParticipant?.identity);

  return (
    <div className="flex items-center justify-center gap-2 flex-wrap bg-stone-900/90 backdrop-blur px-4 py-3 border-b border-stone-700">
      {isTeacher && (
        <>
          {others.length > 0 && (
            <div className="relative group">
              <button
                type="button"
                disabled={kicking}
                className="px-4 py-2 rounded-lg bg-stone-600 text-white text-sm font-medium hover:bg-stone-500 disabled:opacity-50"
              >
                Kick participant
              </button>
              <div className="absolute top-full left-0 mt-1 w-48 py-1 bg-stone-800 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20">
                {others.map((p) => (
                  <button
                    key={p.identity}
                    type="button"
                    onClick={() => handleKick(p.identity)}
                    className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-stone-700"
                  >
                    {p.name || p.identity}
                  </button>
                ))}
              </div>
            </div>
          )}
          <span className="w-px h-6 bg-stone-600" aria-hidden />
        </>
      )}

      {/* Mic toggle + device selector */}
      <div className="flex items-stretch">
        <TrackToggle
          source={Track.Source.Microphone}
          className="lk-button px-4 py-2 rounded-l-lg rounded-r-none bg-stone-700 text-white text-sm font-medium hover:bg-stone-600 disabled:opacity-50 [&.lk-enabled]:bg-emerald-600 [&.lk-enabled]:hover:bg-emerald-700"
        >
          Mic
        </TrackToggle>
        <NativeDeviceSelect kind="audioinput" />
      </div>

      {/* Camera toggle + device selector */}
      <div className="flex items-stretch">
        <TrackToggle
          source={Track.Source.Camera}
          className="lk-button px-4 py-2 rounded-l-lg rounded-r-none bg-stone-700 text-white text-sm font-medium hover:bg-stone-600 disabled:opacity-50 [&.lk-enabled]:bg-emerald-600 [&.lk-enabled]:hover:bg-emerald-700"
        >
          Camera
        </TrackToggle>
        <NativeDeviceSelect kind="videoinput" />
      </div>

      <TrackToggle
        source={Track.Source.ScreenShare}
        className="lk-button px-4 py-2 rounded-lg bg-stone-700 text-white text-sm font-medium hover:bg-stone-600 disabled:opacity-50 [&.lk-enabled]:bg-amber-600 [&.lk-enabled]:hover:bg-amber-700"
      >
        Share screen
      </TrackToggle>

      <button
        type="button"
        onClick={onToggleChat}
        className="px-4 py-2 rounded-lg bg-stone-700 text-white text-sm font-medium hover:bg-stone-600"
      >
        Chat
      </button>

      {isTeacher ? (
        <button
          type="button"
          onClick={handleEndMeeting}
          disabled={ending}
          className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
        >
          {ending ? "Ending…" : "End meeting"}
        </button>
      ) : (
        <DisconnectButton
          className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700"
        >
          Leave
        </DisconnectButton>
      )}
    </div>
  );
}

function MeetingInner({
  classId,
  isTeacher,
  teacherName,
  teacherEmail,
}: {
  classId: string;
  isTeacher: boolean;
  teacherName: string;
  teacherEmail: string;
}) {
  const participants = useParticipants();
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  // If we're not the teacher, we wait until the teacher is in the room.
  const isTeacherPresent = isTeacher || participants.some((p) => p.identity === teacherEmail);

  return (
    <div className="flex flex-col h-full bg-stone-900">
      <MeetingBar 
        classId={classId} 
        isTeacher={isTeacher} 
        onToggleChat={() => setIsChatOpen(!isChatOpen)}
      />
      <div className="flex-1 min-h-0 flex flex-row overflow-hidden relative">
        <div className="flex-1 min-w-0 relative h-full">
          {!isTeacherPresent ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-stone-900/95 backdrop-blur-sm">
              <div className="text-center p-8 bg-stone-800 rounded-xl shadow-2xl border border-stone-700 max-w-md w-full mx-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-white mb-2">Waiting for Host</h2>
                <p className="text-stone-400">
                  Please wait until <span className="font-medium text-stone-200">{teacherName}</span> starts the meeting.
                </p>
              </div>
            </div>
          ) : null}
          {isTeacherPresent || isTeacher ? <VideoConference /> : null}
        </div>
        
        {isChatOpen && (
          <Chat onClose={() => setIsChatOpen(false)} />
        )}
      </div>
    </div>
  );
}

export default function Meeting() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tokenData, setTokenData] = useState<JoinMeetingResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const leaveRecorded = useRef(false);

  useEffect(() => {
    if (!classId || !user) return;
    api
      .post<JoinMeetingResponse>(`/classes/${classId}/join`, {})
      .then((data) => setTokenData(data))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to join"))
      .finally(() => setLoading(false));
  }, [classId, user]);

  const recordLeave = useCallback(() => {
    if (leaveRecorded.current || !classId || !user?.email) return;
    leaveRecorded.current = true;
    api.post("/attendance/leave", { classId, email: user.email }).catch(() => {});
  }, [classId, user?.email]);

  const redirectUrlRef = useRef<string | undefined>(undefined);

  const handleDisconnected = useCallback(() => {
    recordLeave();
    const url = redirectUrlRef.current?.trim();
    if (url) {
      if (url.startsWith("http://") || url.startsWith("https://")) {
        window.location.href = url;
      } else {
        navigate(url.startsWith("/") ? url : `/${url}`, { replace: true });
      }
    } else {
      navigate("/dashboard", { replace: true });
    }
  }, [recordLeave, navigate]);

  useEffect(() => {
    if (tokenData?.redirectUrl != null) redirectUrlRef.current = tokenData.redirectUrl;
  }, [tokenData?.redirectUrl]);

  useEffect(() => {
    if (!tokenData || !user?.email || !classId) return;
    api.post("/attendance/join", { classId, email: user.email }).catch(() => {});
  }, [tokenData, classId, user?.email]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-900">
        <p className="text-white">Connecting to meeting…</p>
      </div>
    );
  }

  const hasValidUrl = (tokenData?.url?.trim() ?? "").length > 0;

  if (error || !tokenData || !hasValidUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-900">
        <div className="text-center text-white max-w-md px-4">
          <p className="mb-4">
            {error || !hasValidUrl
              ? "LiveKit server URL is not configured. Add LIVEKIT_URL to backend/.env (e.g. ws://localhost:7880) and ensure the LiveKit server is running."
              : "Could not join meeting"}
          </p>
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-stone-900">
      <LiveKitRoom
        serverUrl={tokenData.url}
        token={tokenData.token}
        connect={true}
        audio={true}
        video={true}
        onDisconnected={handleDisconnected}
        onError={(e) => {
          console.error("LiveKit error", e);
          recordLeave();
          const url = redirectUrlRef.current?.trim();
          if (url) {
            if (url.startsWith("http://") || url.startsWith("https://")) {
              window.location.href = url;
            } else {
              navigate(url.startsWith("/") ? url : `/${url}`, { replace: true });
            }
          } else {
            navigate("/dashboard", { replace: true });
          }
        }}
        style={{ height: "100%" }}
      >
        <MeetingInner 
          classId={classId!} 
          isTeacher={user!.role === "TEACHER"} 
          teacherName={tokenData.teacherName || "the Host"}
          teacherEmail={tokenData.teacherEmail || ""}
        />
      </LiveKitRoom>
    </div>
  );
}
