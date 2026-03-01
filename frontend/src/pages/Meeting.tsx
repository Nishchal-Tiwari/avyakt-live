import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  LiveKitRoom,
  VideoConference,
  useParticipants,
  useLocalParticipant,
  TrackToggle,
  DisconnectButton,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { useAuth } from "@/contexts/AuthContext";
import { api, type JoinMeetingResponse } from "@/lib/api";
import "@livekit/components-styles";

function MeetingBar({
  classId,
  isTeacher,
}: {
  classId: string;
  isTeacher: boolean;
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
    <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-center gap-2 flex-wrap bg-stone-900/90 backdrop-blur px-4 py-3 border-b border-stone-700">
      {isTeacher && (
        <>
          <button
            type="button"
            onClick={handleEndMeeting}
            disabled={ending}
            className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
          >
            {ending ? "Ending…" : "End meeting"}
          </button>
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
      <TrackToggle
        source={Track.Source.Microphone}
        className="lk-button px-4 py-2 rounded-lg bg-stone-700 text-white text-sm font-medium hover:bg-stone-600 disabled:opacity-50 [&.lk-enabled]:bg-emerald-600 [&.lk-enabled]:hover:bg-emerald-700"
      >
        Mic
      </TrackToggle>
      <TrackToggle
        source={Track.Source.Camera}
        className="lk-button px-4 py-2 rounded-lg bg-stone-700 text-white text-sm font-medium hover:bg-stone-600 disabled:opacity-50 [&.lk-enabled]:bg-emerald-600 [&.lk-enabled]:hover:bg-emerald-700"
      >
        Camera
      </TrackToggle>
      <DisconnectButton
        className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700"
      >
        Leave
      </DisconnectButton>
    </div>
  );
}

function MeetingInner({
  classId,
  isTeacher,
}: {
  classId: string;
  isTeacher: boolean;
}) {
  return (
    <>
      <MeetingBar classId={classId} isTeacher={isTeacher} />
      <div className="pt-14 h-full">
        <VideoConference />
      </div>
    </>
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
        <MeetingInner classId={classId!} isTeacher={user!.role === "TEACHER"} />
      </LiveKitRoom>
    </div>
  );
}
