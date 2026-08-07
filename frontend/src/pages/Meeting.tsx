import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  LiveKitRoom,
  LayoutContextProvider,
  useParticipants,
  useLocalParticipant,
  TrackToggle,
  useRoomContext,
  useTracks,
  VideoTrack,
  RoomAudioRenderer,
  StartMediaButton,
  useIsSpeaking,
  isTrackReference,
  useLayoutContext,
  usePinnedTracks,
  useConnectionState,
} from "@livekit/components-react";
import type { TrackReferenceOrPlaceholder } from "@livekit/components-react";
import { isTrackReferencePinned } from "@livekit/components-core";
import {
  Track,
  RoomEvent,
  ConnectionState,
  DisconnectReason,
  type ScreenShareCaptureOptions,
  type Participant,
} from "livekit-client";
import { useAuth } from "@/contexts/AuthContext";
import { api, type JoinMeetingResponse } from "@/lib/api";
import "@livekit/components-styles";
import Chat from "@/components/Chat";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const MEDIA_POLICY_MSG = "mediaPolicy";

/* ═══════════════════════════════════════════════════════════
   Hooks & Utilities
   ═══════════════════════════════════════════════════════════ */

function useIsMobile(breakpoint = 768) {
  const [mobile, setMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < breakpoint : false,
  );
  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return mobile;
}

function useMeetingTimer() {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const AVATAR_COLORS = [
  "#EA4335", "#4285F4", "#34A853", "#FBBC04",
  "#FF6D01", "#46BDC6", "#7B1FA2", "#C2185B",
  "#00897B", "#6D4C41", "#546E7A", "#E91E63",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/**
 * Calculates grid columns/rows based on participant count.
 * Mirrors Google Meet's adaptive grid strategy.
 */
function getGridLayout(count: number, isMobile: boolean) {
  if (isMobile) {
    if (count <= 1) return { cols: 1, rows: 1, max: 1 };
    if (count <= 2) return { cols: 1, rows: 2, max: 2 };
    if (count <= 4) return { cols: 2, rows: 2, max: 4 };
    return { cols: 2, rows: 3, max: 6 };
  }
  if (count <= 1) return { cols: 1, rows: 1, max: 1 };
  if (count <= 2) return { cols: 2, rows: 1, max: 2 };
  if (count <= 4) return { cols: 2, rows: 2, max: 4 };
  if (count <= 6) return { cols: 3, rows: 2, max: 6 };
  if (count <= 9) return { cols: 3, rows: 3, max: 9 };
  if (count <= 12) return { cols: 4, rows: 3, max: 12 };
  if (count <= 16) return { cols: 4, rows: 4, max: 16 };
  return { cols: 5, rows: 5, max: 25 };
}

/* ═══════════════════════════════════════════════════════════
   SVG Icons
   ═══════════════════════════════════════════════════════════ */

function MicOffIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
    </svg>
  );
}

function ChevronLeft() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function ScreenShareIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M2 5.75A2.75 2.75 0 0 1 4.75 3h14.5A2.75 2.75 0 0 1 22 5.75v10.5A2.75 2.75 0 0 1 19.25 19H4.75A2.75 2.75 0 0 1 2 16.25V5.75ZM4.75 4.5c-.69 0-1.25.56-1.25 1.25v10.5c0 .69.56 1.25 1.25 1.25h14.5c.69 0 1.25-.56 1.25-1.25V5.75c0-.69-.56-1.25-1.25-1.25H4.75Z"
        clipRule="evenodd"
      />
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M11.47 7.22a.75.75 0 0 1 1.06 0l2.25 2.25a.75.75 0 0 1-1.06 1.06l-.97-.97v4.69a.75.75 0 0 1-1.5 0V9.56l-.97.97a.75.75 0 1 1-1.06-1.06l2.25-2.25Z"
        clipRule="evenodd"
      />
      <path
        fill="currentColor"
        d="M8 20.25a.75.75 0 0 1 .75-.75h6.5a.75.75 0 0 1 0 1.5h-6.5a.75.75 0 0 1-.75-.75Z"
      />
    </svg>
  );
}

function ScreenShareStopIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        fill="currentColor"
        d="M9.28 7.22a.75.75 0 0 0-1.06 1.06L10.94 11l-2.72 2.72a.75.75 0 1 0 1.06 1.06L12 12.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L13.06 11l2.72-2.72a.75.75 0 0 0-1.06-1.06L12 9.94 9.28 7.22Z"
      />
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M4.75 3A2.75 2.75 0 0 0 2 5.75v10.5A2.75 2.75 0 0 0 4.75 19h14.5A2.75 2.75 0 0 0 22 16.25V5.75A2.75 2.75 0 0 0 19.25 3H4.75ZM3.5 5.75c0-.69.56-1.25 1.25-1.25h14.5c.69 0 1.25.56 1.25 1.25v10.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25V5.75Z"
        clipRule="evenodd"
      />
      <path
        fill="currentColor"
        d="M8 20.25a.75.75 0 0 1 .75-.75h6.5a.75.75 0 0 1 0 1.5h-6.5a.75.75 0 0 1-.75-.75Z"
      />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

/* Chat is always mounted in MeetingInner (hidden when closed) — do not use a separate
   useChat() bootstrap; two useChat scanners don't share message history. */

/* ═══════════════════════════════════════════════════════════
   Device Picker (native <select> under icon — Meet-style caret)
   ═══════════════════════════════════════════════════════════ */

function DeviceSelectChevron() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M14.77 12.79a.75.75 0 01-1.06-.02L10 8.83l-3.71 3.94a.75.75 0 11-1.08-1.04l4.25-4.5a.75.75 0 011.08 0l4.25 4.5a.75.75 0 01-.02 1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function NativeDeviceSelect({ kind }: { kind: MediaDeviceKind }) {
  const room = useRoomContext();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [activeId, setActiveId] = useState("");

  useEffect(() => {
    async function load() {
      const devs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === kind);
      setDevices(devs);
      setActiveId((prev) => {
        if (prev && devs.some((d) => d.deviceId === prev)) return prev;
        return devs[0]?.deviceId ?? "";
      });
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

  const label = kind === "audioinput" ? "Choose microphone" : "Choose camera";

  return (
    <div className="meet-device-select-wrap" title={label}>
      <span className="meet-device-select-icon" aria-hidden>
        <DeviceSelectChevron />
      </span>
      <select
        value={activeId}
        onChange={handleChange}
        className="meet-device-select"
        aria-label={label}
      >
        {devices.map((d) => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label || `Device ${d.deviceId.slice(0, 8)}`}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Participant Tile
   ═══════════════════════════════════════════════════════════ */

function ParticipantTile({
  trackRef,
  pinInteractive = true,
  layout = "grid",
}: {
  trackRef: TrackReferenceOrPlaceholder;
  pinInteractive?: boolean;
  layout?: "grid" | "focus-main" | "strip";
}) {
  const participant = trackRef.participant;
  const layoutCtx = useLayoutContext();
  const isSpeaking = useIsSpeaking(participant);
  const isMicMuted = !participant.isMicrophoneEnabled;
  const name = participant.name || participant.identity;
  const isLocal = participant.isLocal;
  const hasVideo = isTrackReference(trackRef) && trackRef.publication?.track != null;
  const isPinned = isTrackReferencePinned(trackRef, layoutCtx.pin.state);

  function handleTileActivate() {
    const dispatch = layoutCtx.pin.dispatch;
    if (!pinInteractive || !dispatch) return;
    if (isPinned) dispatch({ msg: "clear_pin" });
    else dispatch({ msg: "set_pin", trackReference: trackRef });
  }

  const layoutClass =
    layout === "focus-main" ? " meet-tile--focus-main" : layout === "strip" ? " meet-tile--strip" : "";

  return (
    <div
      className={`meet-tile${isSpeaking ? " meet-tile--speaking" : ""}${pinInteractive ? " meet-tile--clickable" : ""}${layoutClass}`}
      role={pinInteractive ? "button" : undefined}
      tabIndex={pinInteractive ? 0 : undefined}
      title={pinInteractive ? (isPinned ? "Back to gallery" : "Focus this participant") : undefined}
      onClick={pinInteractive ? handleTileActivate : undefined}
      onKeyDown={
        pinInteractive
          ? (ev) => {
              if (ev.key === "Enter" || ev.key === " ") {
                ev.preventDefault();
                handleTileActivate();
              }
            }
          : undefined
      }
    >
      {hasVideo ? (
        <VideoTrack trackRef={trackRef} className="meet-tile__video" />
      ) : (
        <div className="meet-tile__avatar">
          <Avatar size="tile" className="border-2 border-white/10 shadow-md">
            <AvatarFallback
              className="text-[clamp(1.125rem,3vw,2.25rem)] font-semibold text-white"
              style={{ backgroundColor: getAvatarColor(name) }}
            >
              {getInitials(name)}
            </AvatarFallback>
          </Avatar>
        </div>
      )}
      {pinInteractive && isPinned && (
        <span className="meet-tile__pin-badge" title="Focused">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z" />
          </svg>
        </span>
      )}
      <div className="meet-tile__overlay">
        <div className="meet-tile__info">
          {isMicMuted && (
            <span className="meet-tile__mic-off">
              <MicOffIcon />
            </span>
          )}
          <span className="meet-tile__name">
            {name}
            {isLocal ? " (You)" : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Screen Share Tile
   ═══════════════════════════════════════════════════════════ */

function ScreenShareTile({ trackRef }: { trackRef: TrackReferenceOrPlaceholder }) {
  const name = trackRef.participant.name || trackRef.participant.identity;
  if (!isTrackReference(trackRef)) return null;
  return (
    <div className="meet-tile meet-tile--screen">
      <VideoTrack trackRef={trackRef} className="meet-tile__video meet-tile__video--contain" />
      <div className="meet-tile__overlay">
        <div className="meet-tile__info">
          <span className="meet-tile__name">{name}&apos;s screen</span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Video Grid with Pagination
   ═══════════════════════════════════════════════════════════ */

function VideoGrid() {
  const isMobile = useIsMobile();
  const [page, setPage] = useState(0);
  const layoutCtx = useLayoutContext();
  const pinnedTracks = usePinnedTracks();
  const pinState = layoutCtx.pin.state;
  const wasScreenShareRef = useRef(false);

  const cameraTracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true }],
    { onlySubscribed: false },
  );

  const screenShareTracks = useTracks(
    [Track.Source.ScreenShare],
    { onlySubscribed: false },
  );

  const activeScreenShare = screenShareTracks.length > 0 ? screenShareTracks[0] : null;
  const isScreenShareMode = activeScreenShare != null;

  useEffect(() => {
    if (isScreenShareMode && !wasScreenShareRef.current) {
      layoutCtx.pin.dispatch?.({ msg: "clear_pin" });
    }
    wasScreenShareRef.current = isScreenShareMode;
  }, [isScreenShareMode, layoutCtx.pin.dispatch]);

  const layout = useMemo(() => {
    if (isScreenShareMode) {
      return { cols: 1, rows: isMobile ? 2 : 4, max: isMobile ? 2 : 4 };
    }
    return getGridLayout(cameraTracks.length, isMobile);
  }, [cameraTracks.length, isMobile, isScreenShareMode]);

  const totalPages = Math.max(1, Math.ceil(cameraTracks.length / layout.max));

  useEffect(() => {
    if (page >= totalPages) setPage(Math.max(0, totalPages - 1));
  }, [totalPages, page]);

  const visibleTracks = useMemo(
    () => cameraTracks.slice(page * layout.max, (page + 1) * layout.max),
    [cameraTracks, page, layout.max],
  );

  const pinnedTrack = pinnedTracks[0];
  const isFocusMode = Boolean(pinnedTrack) && !isScreenShareMode;

  const stripTracks = useMemo(() => {
    if (!pinnedTrack) return [];
    return cameraTracks.filter((t) => !isTrackReferencePinned(t, pinState));
  }, [cameraTracks, pinState, pinnedTrack]);

  if (isScreenShareMode) {
    return (
      <div className={`meet-screenshare${isMobile ? " meet-screenshare--mobile" : ""}`}>
        <div className="meet-screenshare__main">
          <ScreenShareTile trackRef={activeScreenShare} />
        </div>
        <div className="meet-screenshare__sidebar">
          {cameraTracks.map((t) => (
            <ParticipantTile
              key={`${t.participant.identity}-${t.source}`}
              trackRef={t}
              pinInteractive={false}
              layout="strip"
            />
          ))}
        </div>
      </div>
    );
  }

  if (isFocusMode && pinnedTrack) {
    return (
      <div className="meet-grid-container meet-focus">
        <button
          type="button"
          className="meet-gallery-btn"
          onClick={() => layoutCtx.pin.dispatch?.({ msg: "clear_pin" })}
        >
          Gallery view
        </button>
        <div className="meet-focus-main">
          <ParticipantTile trackRef={pinnedTrack} layout="focus-main" />
        </div>
        {stripTracks.length > 0 && (
          <div className="meet-focus-strip">
            {stripTracks.map((t) => (
              <ParticipantTile
                key={`${t.participant.identity}-${t.source}`}
                trackRef={t}
                layout="strip"
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="meet-grid-container">
      <div
        className="meet-grid"
        style={{
          gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
          gridTemplateRows: `repeat(${layout.rows}, 1fr)`,
        }}
      >
        {visibleTracks.map((t) => (
          <ParticipantTile key={`${t.participant.identity}-${t.source}`} trackRef={t} />
        ))}
      </div>

      {totalPages > 1 && (
        <>
          {page > 0 && (
            <button
              type="button"
              onClick={() => setPage((p) => p - 1)}
              className="meet-page-btn meet-page-btn--prev"
              aria-label="Previous page"
            >
              <ChevronLeft />
            </button>
          )}
          {page < totalPages - 1 && (
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              className="meet-page-btn meet-page-btn--next"
              aria-label="Next page"
            >
              <ChevronRight />
            </button>
          )}
          <div className="meet-page-indicator">
            {page + 1} / {totalPages}
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Participants Panel (side drawer)
   ═══════════════════════════════════════════════════════════ */

function ParticipantsPanel({
  classId,
  isTeacher,
  onClose,
}: {
  classId: string;
  isTeacher: boolean;
  onClose: () => void;
}) {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const [kicking, setKicking] = useState<string | null>(null);

  async function handleKick(identity: string) {
    setKicking(identity);
    try {
      await api.post(`/classes/${classId}/kick`, { identity });
    } catch (e) {
      console.error("Kick failed", e);
      window.alert(e instanceof Error ? e.message : "Failed to remove participant");
    } finally {
      setKicking(null);
    }
  }

  return (
    <div className="meet-panel">
      <div className="meet-panel__header">
        <h3 className="meet-panel__title">People ({participants.length})</h3>
        <button type="button" onClick={onClose} className="meet-panel__close">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="meet-panel__body">
        {participants.map((p) => {
          const isMe = p.identity === localParticipant?.identity;
          return (
            <div key={p.identity} className="meet-panel__person">
              <Avatar className="h-9 w-9 shrink-0 border border-white/15">
                <AvatarFallback
                  className="text-sm font-semibold text-white"
                  style={{ backgroundColor: getAvatarColor(p.name || p.identity) }}
                >
                  {getInitials(p.name || p.identity)}
                </AvatarFallback>
              </Avatar>
              <div className="meet-panel__person-info">
                <span className="meet-panel__person-name">
                  {p.name || p.identity}
                  {isMe && <span className="meet-panel__you"> (You)</span>}
                </span>
                <span className="meet-panel__person-status">
                  {!p.isMicrophoneEnabled && "Mic off"}
                  {!p.isMicrophoneEnabled && !p.isCameraEnabled && " · "}
                  {!p.isCameraEnabled && "Camera off"}
                </span>
              </div>
              {isTeacher && !isMe && (
                <button
                  type="button"
                  onClick={() => handleKick(p.identity)}
                  disabled={kicking === p.identity}
                  className="meet-panel__kick"
                >
                  {kicking === p.identity ? "…" : "Remove"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Host media policy (camera / mic required for students)
   ═══════════════════════════════════════════════════════════ */

function MeetingPolicySync({
  classId,
  teacherEmail,
  isTeacher,
  onRemotePolicy,
}: {
  classId: string;
  teacherEmail: string;
  isTeacher: boolean;
  onRemotePolicy: (p: { requireCamera: boolean; requireMic: boolean }) => void;
}) {
  const room = useRoomContext();

  useEffect(() => {
    if (isTeacher || !room) return;
    const onData = (payload: Uint8Array, participant?: Participant) => {
      if (!participant || participant.identity !== teacherEmail) return;
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload)) as {
          type?: string;
          requireCamera?: boolean;
          requireMic?: boolean;
        };
        if (
          msg?.type === MEDIA_POLICY_MSG &&
          typeof msg.requireCamera === "boolean" &&
          typeof msg.requireMic === "boolean"
        ) {
          onRemotePolicy({ requireCamera: msg.requireCamera, requireMic: msg.requireMic });
        }
      } catch {
        /* ignore malformed payloads */
      }
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room, isTeacher, teacherEmail, onRemotePolicy]);

  useEffect(() => {
    if (isTeacher || !classId) return;
    let cancelled = false;
    async function poll() {
      try {
        const cls = await api.get<{ requireCamera?: boolean; requireMic?: boolean }>(
          `/classes/${classId}`,
        );
        if (cancelled) return;
        onRemotePolicy({
          requireCamera: Boolean(cls.requireCamera),
          requireMic: Boolean(cls.requireMic),
        });
      } catch {
        /* ignore */
      }
    }
    void poll();
    const id = window.setInterval(poll, 20000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [classId, isTeacher, onRemotePolicy]);

  return null;
}

/** Credits attendance only while LiveKit reports both host and student in the room (server-verified on tick). */
function StudentAttendanceTick({ classId, isTeacher }: { classId: string; isTeacher: boolean }) {
  const room = useRoomContext();
  const connectionState = useConnectionState(room);

  useEffect(() => {
    if (isTeacher || !classId) return;
    if (connectionState !== ConnectionState.Connected) return;

    function tick() {
      api.post("/attendance/tick", { classId }).catch(() => {});
    }

    const initial = window.setTimeout(tick, 30000);
    const interval = window.setInterval(tick, 30000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [isTeacher, classId, connectionState]);

  return null;
}

type ClassStreakApiResponse =
  | { streakEnabled: false; classId: string; className: string }
  | {
      streakEnabled: true;
      classId: string;
      className: string;
      targetDays: number;
      minMinutesRequired: number;
      currentStreakClassDays: number;
      daysRemaining: number;
      goalMet: boolean;
      headline: string;
      detail: string;
    };

function StudentStreakBanner({
  classId,
  streakEnabledForClass,
}: {
  classId: string;
  streakEnabledForClass: boolean;
}) {
  const [data, setData] = useState<ClassStreakApiResponse | null>(null);

  useEffect(() => {
    if (!streakEnabledForClass || !classId) {
      setData(null);
      return;
    }
    let cancelled = false;
    function load() {
      api
        .get<ClassStreakApiResponse>(`/attendance/streak?classId=${encodeURIComponent(classId)}`)
        .then((r) => {
          if (!cancelled) setData(r);
        })
        .catch(() => {
          if (!cancelled) setData(null);
        });
    }
    load();
    const id = window.setInterval(load, 90000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [classId, streakEnabledForClass]);

  if (!streakEnabledForClass || !data || !data.streakEnabled) return null;

  return (
    <div className="meet-streak-banner" title={data.detail}>
      <span className="meet-streak-banner__badge">
        {data.currentStreakClassDays}/{data.targetDays}
      </span>
      <p className="meet-streak-banner__text">
        <strong>{data.headline}</strong>
        {" · "}
        {data.goalMet
          ? "You have finished this streak goal — keep joining live classes to extend your run."
          : `${data.daysRemaining} qualifying class ${data.daysRemaining === 1 ? "day" : "days"} left to complete your ${data.targetDays}-day streak (${data.minMinutesRequired}+ min with your teacher each class day).`}
      </p>
    </div>
  );
}

/**
 * Students only: host can require camera and/or mic. Until they accept, local A/V stays off
 * and meeting content (remote A/V) is hidden. Accept → enable only what’s required. Decline → disconnect.
 */
function MediaConsentGate({
  isTeacher,
  requireCamera,
  requireMic,
  teacherName,
  onRequestLeave,
  children,
}: {
  isTeacher: boolean;
  requireCamera: boolean;
  requireMic: boolean;
  teacherName: string;
  onRequestLeave: () => void;
  children: React.ReactNode;
}) {
  const room = useRoomContext();
  const { localParticipant, isCameraEnabled, isMicrophoneEnabled } = useLocalParticipant();
  const [consentBusy, setConsentBusy] = useState(false);
  const strippedForPromptRef = useRef(false);

  const blocked =
    !isTeacher &&
    ((requireCamera && !isCameraEnabled) || (requireMic && !isMicrophoneEnabled));

  const needCamera = requireCamera && !isCameraEnabled;
  const needMic = requireMic && !isMicrophoneEnabled;

  useEffect(() => {
    if (isTeacher || !localParticipant) return;
    if (!blocked) {
      strippedForPromptRef.current = false;
      return;
    }
    if (strippedForPromptRef.current || consentBusy) return;
    strippedForPromptRef.current = true;
    // Only shut off sources that currently violate policy (don't strip both if only one is required).
    if (requireCamera && isCameraEnabled) void localParticipant.setCameraEnabled(false);
    if (requireMic && isMicrophoneEnabled) void localParticipant.setMicrophoneEnabled(false);
  }, [
    blocked,
    consentBusy,
    isTeacher,
    localParticipant,
    requireCamera,
    requireMic,
    isCameraEnabled,
    isMicrophoneEnabled,
  ]);

  async function handleAccept() {
    if (!localParticipant || consentBusy) return;
    setConsentBusy(true);
    strippedForPromptRef.current = false;
    try {
      if (requireCamera) await localParticipant.setCameraEnabled(true);
      if (requireMic) await localParticipant.setMicrophoneEnabled(true);
      // Publication can lag behind the promise; poll briefly before failing.
      const deadline = Date.now() + 2500;
      while (Date.now() < deadline) {
        const camOk = !requireCamera || localParticipant.isCameraEnabled;
        const micOk = !requireMic || localParticipant.isMicrophoneEnabled;
        if (camOk && micOk) return;
        await new Promise((r) => setTimeout(r, 100));
      }
      const camOk = !requireCamera || localParticipant.isCameraEnabled;
      const micOk = !requireMic || localParticipant.isMicrophoneEnabled;
      if (!camOk || !micOk) {
        throw new Error("Camera or microphone permission was denied or unavailable");
      }
    } catch (e) {
      console.error("Media consent failed", e);
      window.alert(
        e instanceof Error
          ? e.message
          : "Could not enable required devices. Check browser permissions.",
      );
    } finally {
      setConsentBusy(false);
    }
  }

  function handleDecline() {
    onRequestLeave();
    void room.disconnect();
  }

  // Always wrap in a flex shell so meet-root's column layout (video + controls) is preserved.
  return (
    <>
      <div
        className={`meet-media-gate-shell${blocked ? " meet-media-gate-shell--inert" : ""}`}
        aria-hidden={blocked || undefined}
      >
        {children}
      </div>
      {blocked && (
        <div
          className="meet-media-gate"
          role="dialog"
          aria-modal="true"
          aria-labelledby="meet-media-gate-title"
        >
          <div className="meet-media-gate__card">
            <h2 id="meet-media-gate-title" className="meet-media-gate__title">
              {teacherName} requires {needCamera && needMic ? "camera and microphone" : needCamera ? "camera" : "microphone"}
            </h2>
            <p className="meet-media-gate__text">
              Your camera and microphone stay off until you continue. The meeting audio and video are hidden until
              you allow the required device{needCamera && needMic ? "s" : ""}. If you decline, you will leave the meeting.
            </p>
            <div className="meet-media-gate__actions">
              <button
                type="button"
                className="meet-media-gate__btn meet-media-gate__btn--primary"
                disabled={consentBusy}
                onClick={() => void handleAccept()}
              >
                {consentBusy ? "Enabling…" : needCamera && needMic ? "Turn on camera & mic" : needCamera ? "Turn on camera" : "Turn on microphone"}
              </button>
              <button
                type="button"
                className="meet-media-gate__btn meet-media-gate__btn--ghost"
                disabled={consentBusy}
                onClick={handleDecline}
              >
                Decline and leave
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   Screen share (with optional tab / system audio — LiveKit docs)
   ═══════════════════════════════════════════════════════════ */

/** Capture opts per https://docs.livekit.io/transport/media/screenshare/ */
function getScreenShareCaptureOptions(withAudio: boolean): ScreenShareCaptureOptions {
  if (!withAudio) {
    return { audio: false, selfBrowserSurface: "include" };
  }
  return {
    // Disable mic processing filters — they degrade shared tab/system audio.
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
    // Chrome: offer system audio when sharing a window/screen (tabs use “Share tab audio”).
    systemAudio: "include",
    selfBrowserSurface: "include",
    surfaceSwitching: "include",
  };
}

function ScreenShareToggleButton({ withAudio }: { withAudio: boolean }) {
  const { localParticipant, isScreenShareEnabled } = useLocalParticipant();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (!localParticipant || pending) return;
    setPending(true);
    try {
      if (isScreenShareEnabled) {
        await localParticipant.setScreenShareEnabled(false);
        return;
      }

      await localParticipant.setScreenShareEnabled(true, getScreenShareCaptureOptions(withAudio));

      if (withAudio) {
        // Audio is only attached if the user picks a browser Tab (or system audio)
        // and enables “Share tab audio” in the OS/browser picker.
        const hasShareAudio = Boolean(
          localParticipant.getTrackPublication(Track.Source.ScreenShareAudio)?.track,
        );
        if (!hasShareAudio) {
          window.alert(
            "Screen is sharing, but no shared audio was captured.\n\n" +
              "In the browser picker:\n" +
              "1. Choose a Chrome / Edge Tab (not Window)\n" +
              "2. Enable “Share tab audio”\n" +
              "3. Click Share again",
          );
        }
      }
    } catch (err) {
      console.error("Screen share failed", err);
      // Some browsers reject getDisplayMedia when audio is requested — retry video-only.
      if (withAudio && !localParticipant.isScreenShareEnabled) {
        try {
          await localParticipant.setScreenShareEnabled(true, getScreenShareCaptureOptions(false));
          window.alert(
            "This browser could not capture share audio. Screen is shared without sound.",
          );
        } catch (retryErr) {
          console.error("Screen share retry failed", retryErr);
          window.alert(
            retryErr instanceof Error ? retryErr.message : "Could not start screen share",
          );
        }
      } else {
        window.alert(err instanceof Error ? err.message : "Could not start screen share");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      className={`meet-ctrl-btn meet-ctrl-btn--toggle meet-ctrl-btn--share${
        isScreenShareEnabled ? " meet-ctrl-btn--share-on" : ""
      }`}
      data-lk-enabled={isScreenShareEnabled ? "true" : "false"}
      disabled={pending}
      aria-pressed={isScreenShareEnabled}
      aria-label={isScreenShareEnabled ? "Stop screen share" : "Share screen"}
      title={
        withAudio
          ? "Share screen with audio (pick a browser tab and enable Share tab audio)"
          : "Share screen"
      }
      onClick={() => void handleClick()}
    >
      {pending ? (
        <span className="text-sm">…</span>
      ) : isScreenShareEnabled ? (
        <ScreenShareStopIcon />
      ) : (
        <ScreenShareIcon />
      )}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════
   Bottom Control Bar (Google Meet style)
   ═══════════════════════════════════════════════════════════ */

function BottomControlBar({
  classId,
  isTeacher,
  isChatOpen,
  isPeopleOpen,
  chatUnread,
  onToggleChat,
  onTogglePeople,
  requireCameraPolicy,
  requireMicPolicy,
  onToggleRequireCamera,
  onToggleRequireMic,
  onRequestLeave,
}: {
  classId: string;
  isTeacher: boolean;
  isChatOpen: boolean;
  isPeopleOpen: boolean;
  chatUnread: number;
  onToggleChat: () => void;
  onTogglePeople: () => void;
  requireCameraPolicy: boolean;
  requireMicPolicy: boolean;
  onToggleRequireCamera: (next: boolean) => void;
  onToggleRequireMic: (next: boolean) => void;
  /** Mark leave intentional so onDisconnected can navigate (avoids React StrictMode bounce). */
  onRequestLeave: () => void;
}) {
  const room = useRoomContext();
  const participants = useParticipants();
  const isMobile = useIsMobile();
  const timer = useMeetingTimer();
  const [ending, setEnding] = useState(false);
  /** Next screen-share attempt requests tab/system audio when supported. */
  const [screenShareWithAudio, setScreenShareWithAudio] = useState(true);

  async function handleEndMeeting() {
    setEnding(true);
    onRequestLeave();
    try {
      await api.post(`/classes/${classId}/end`, {});
      void room.disconnect();
    } catch (e) {
      console.error("End meeting failed", e);
      window.alert(e instanceof Error ? e.message : "Failed to end meeting");
    } finally {
      setEnding(false);
    }
  }

  function handleLeave() {
    onRequestLeave();
    void room.disconnect();
  }

  return (
    <div className="meet-controls">
      <div className="meet-controls__left">
        <div className="meet-controls__info">
          <ClockIcon />
          <span>{timer}</span>
        </div>
      </div>

      <div className="meet-controls__center">
        <div className="meet-controls__btn-group">
          <TrackToggle
            source={Track.Source.Microphone}
            className="meet-ctrl-btn meet-ctrl-btn--toggle"
          />
          <NativeDeviceSelect kind="audioinput" />
        </div>

        <div className="meet-controls__btn-group">
          <TrackToggle
            source={Track.Source.Camera}
            className="meet-ctrl-btn meet-ctrl-btn--toggle"
          />
          <NativeDeviceSelect kind="videoinput" />
        </div>

        {!isMobile && (
          <div className="meet-controls__btn-group meet-controls__btn-group--screenshare">
            <label
              className="meet-screenshare-audio"
              title="Must be checked before sharing. In the browser picker choose a Tab and enable Share tab audio."
            >
              <input
                type="checkbox"
                checked={screenShareWithAudio}
                onChange={(e) => setScreenShareWithAudio(e.target.checked)}
              />
              <span>Share sound</span>
            </label>
            <ScreenShareToggleButton withAudio={screenShareWithAudio} />
          </div>
        )}

        <button
          type="button"
          onClick={onToggleChat}
          className={`meet-ctrl-btn meet-ctrl-btn--chat${isChatOpen ? " meet-ctrl-btn--active" : ""}`}
          aria-label={chatUnread > 0 ? `Chat, ${chatUnread} unread` : "Chat"}
        >
          <ChatIcon />
          {!isMobile && <span>Chat</span>}
          {chatUnread > 0 && (
            <span className="meet-ctrl-btn__badge">
              {chatUnread > 9 ? "9+" : chatUnread}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={onTogglePeople}
          className={`meet-ctrl-btn meet-ctrl-btn--people${isPeopleOpen ? " meet-ctrl-btn--active" : ""}`}
        >
          <PeopleIcon />
          {!isMobile && <span>{participants.length}</span>}
          {isMobile && (
            <span className="meet-ctrl-btn__badge">{participants.length}</span>
          )}
        </button>

        {isTeacher && (
          <div
            className="meet-policy-toggles"
            title="Students must keep camera or microphone on (when checked) to use the meeting."
          >
            <label className="meet-policy-toggle">
              <input
                type="checkbox"
                checked={requireCameraPolicy}
                onChange={(e) => onToggleRequireCamera(e.target.checked)}
              />
              <span>{isMobile ? "Req. cam" : "Require camera"}</span>
            </label>
            <label className="meet-policy-toggle">
              <input
                type="checkbox"
                checked={requireMicPolicy}
                onChange={(e) => onToggleRequireMic(e.target.checked)}
              />
              <span>{isMobile ? "Req. mic" : "Require mic"}</span>
            </label>
          </div>
        )}

        <button
          type="button"
          onClick={handleLeave}
          className="meet-ctrl-btn meet-ctrl-btn--leave"
        >
          Leave
        </button>

        {isTeacher && (
          <button
            type="button"
            onClick={() => void handleEndMeeting()}
            disabled={ending}
            className="meet-ctrl-btn meet-ctrl-btn--leave"
          >
            {ending ? "Ending…" : isMobile ? "End all" : "End for all"}
          </button>
        )}
      </div>

      <div className="meet-controls__right" />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Meeting Inner (layout orchestrator)
   ═══════════════════════════════════════════════════════════ */

type SidePanel = "chat" | "people" | null;

function MeetingInner({
  classId,
  isTeacher,
  teacherName,
  teacherEmail,
  initialRequireCamera,
  initialRequireMic,
  streakEnabledForClass,
  onRequestLeave,
}: {
  classId: string;
  isTeacher: boolean;
  teacherName: string;
  teacherEmail: string;
  initialRequireCamera: boolean;
  initialRequireMic: boolean;
  streakEnabledForClass: boolean;
  onRequestLeave: () => void;
}) {
  const room = useRoomContext();
  const participants = useParticipants();
  const isMobile = useIsMobile();
  const [panel, setPanel] = useState<SidePanel>(null);
  const [requireCamera, setRequireCamera] = useState(initialRequireCamera);
  const [requireMic, setRequireMic] = useState(initialRequireMic);
  const [chatUnread, setChatUnread] = useState(0);

  const handleChatUnread = useCallback((count: number) => {
    setChatUnread(count);
  }, []);

  const applyRemotePolicy = useCallback((p: { requireCamera: boolean; requireMic: boolean }) => {
    setRequireCamera(p.requireCamera);
    setRequireMic(p.requireMic);
  }, []);

  const broadcastPolicy = useCallback(
    async (camera: boolean, mic: boolean) => {
      if (!room) return;
      try {
        const enc = new TextEncoder().encode(
          JSON.stringify({ type: MEDIA_POLICY_MSG, requireCamera: camera, requireMic: mic }),
        );
        await room.localParticipant.publishData(enc, { reliable: true });
      } catch (e) {
        console.warn("publishData policy failed", e);
      }
    },
    [room],
  );

  const handleToggleRequireCamera = useCallback(
    async (next: boolean) => {
      const prevCam = requireCamera;
      setRequireCamera(next);
      try {
        await api.patch(`/classes/${classId}`, { requireCamera: next });
        await broadcastPolicy(next, requireMic);
      } catch (e) {
        console.error(e);
        setRequireCamera(prevCam);
      }
    },
    [classId, requireCamera, requireMic, broadcastPolicy],
  );

  const handleToggleRequireMic = useCallback(
    async (next: boolean) => {
      const prevMic = requireMic;
      setRequireMic(next);
      try {
        await api.patch(`/classes/${classId}`, { requireMic: next });
        await broadcastPolicy(requireCamera, next);
      } catch (e) {
        console.error(e);
        setRequireMic(prevMic);
      }
    },
    [classId, requireCamera, requireMic, broadcastPolicy],
  );

  const isTeacherPresent =
    isTeacher ||
    participants.some(
      (p) => p.identity.trim().toLowerCase() === teacherEmail.trim().toLowerCase(),
    );

  const togglePanel = (target: SidePanel) =>
    setPanel((prev) => (prev === target ? null : target));

  return (
    <div className="meet-root">
      <MeetingPolicySync
        classId={classId}
        teacherEmail={teacherEmail}
        isTeacher={isTeacher}
        onRemotePolicy={applyRemotePolicy}
      />
      <MediaConsentGate
        isTeacher={isTeacher}
        requireCamera={requireCamera}
        requireMic={requireMic}
        teacherName={teacherName}
        onRequestLeave={onRequestLeave}
      >
        <StudentAttendanceTick classId={classId} isTeacher={isTeacher} />
        {!isTeacher && (
          <StudentStreakBanner classId={classId} streakEnabledForClass={streakEnabledForClass} />
        )}
        <RoomAudioRenderer />
        <StartMediaButton label="Click to enable sound" className="meet-start-media" />

        <div className="meet-body">
          <div
            className={`meet-content${
              (panel === "chat" || panel === "people") && !isMobile
                ? " meet-content--with-panel"
                : ""
            }`}
          >
            {!isTeacherPresent && (
              <div className="meet-waiting">
                <div className="meet-waiting__card">
                  <div className="meet-waiting__icon">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold text-white mb-2">Waiting for Host</h2>
                  <p className="text-stone-400">
                    Please wait until{" "}
                    <span className="font-medium text-stone-200">{teacherName}</span>{" "}
                    starts the meeting.
                  </p>
                </div>
              </div>
            )}
            {(isTeacherPresent || isTeacher) && <VideoGrid />}
          </div>

          {/* Keep chat mounted always so LiveKit delivers / retains messages while the panel is closed. */}
          <div
            className={`meet-side-panel${isMobile ? " meet-side-panel--mobile" : ""}${
              panel === "chat" ? "" : " meet-side-panel--hidden"
            }`}
          >
            <Chat
              open={panel === "chat"}
              onClose={() => setPanel(null)}
              onUnreadChange={handleChatUnread}
            />
          </div>

          {panel === "people" && (
            <div className={`meet-side-panel${isMobile ? " meet-side-panel--mobile" : ""}`}>
              <ParticipantsPanel
                classId={classId}
                isTeacher={isTeacher}
                onClose={() => setPanel(null)}
              />
            </div>
          )}
        </div>

        <BottomControlBar
          classId={classId}
          isTeacher={isTeacher}
          isChatOpen={panel === "chat"}
          isPeopleOpen={panel === "people"}
          chatUnread={chatUnread}
          onToggleChat={() => togglePanel("chat")}
          onTogglePeople={() => togglePanel("people")}
          requireCameraPolicy={requireCamera}
          requireMicPolicy={requireMic}
          onToggleRequireCamera={(next) => {
            void handleToggleRequireCamera(next);
          }}
          onToggleRequireMic={(next) => {
            void handleToggleRequireMic(next);
          }}
          onRequestLeave={onRequestLeave}
        />
      </MediaConsentGate>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Meeting (outer shell – token & connection management)
   ═══════════════════════════════════════════════════════════ */

export default function Meeting() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tokenData, setTokenData] = useState<JoinMeetingResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const leaveRecorded = useRef(false);
  /** True after LiveKit reports Connected — attendance starts here, not on token fetch. */
  const connectedOnceRef = useRef(false);
  /**
   * Set before intentional disconnect (Leave / End / Decline).
   * Avoids bouncing to dashboard on React StrictMode remount CLIENT_INITIATED disconnects.
   */
  const userRequestedLeaveRef = useRef(false);
  const redirectUrlRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!classId || !user) return;
    api
      .post<JoinMeetingResponse>(`/classes/${classId}/join`, {})
      .then((data) => setTokenData(data))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to join"))
      .finally(() => setLoading(false));
  }, [classId, user]);

  const isHost = Boolean(tokenData?.isHost);

  const recordLeave = useCallback(() => {
    if (leaveRecorded.current || !classId || isHost) return;
    leaveRecorded.current = true;
    api.post("/attendance/leave", { classId }).catch(() => {});
  }, [classId, isHost]);

  const recordLeaveKeepalive = useCallback(() => {
    if (leaveRecorded.current || !classId || isHost) return;
    leaveRecorded.current = true;
    const token = localStorage.getItem("token");
    void fetch("/api/attendance/leave", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ classId }),
      keepalive: true,
    }).catch(() => {});
  }, [classId, isHost]);

  const redirectTo = useCallback(
    (fallback: string) => {
      recordLeave();
      const url = redirectUrlRef.current?.trim();
      if (url) {
        if (url.startsWith("http://") || url.startsWith("https://")) {
          window.location.href = url;
        } else {
          navigate(url.startsWith("/") ? url : `/${url}`, { replace: true });
        }
      } else {
        navigate(fallback, { replace: true });
      }
    },
    [recordLeave, navigate],
  );

  const markLeaveRequested = useCallback(() => {
    userRequestedLeaveRef.current = true;
  }, []);

  useEffect(() => {
    if (tokenData?.redirectUrl != null) redirectUrlRef.current = tokenData.redirectUrl;
  }, [tokenData?.redirectUrl]);

  // Flush leave on tab close after a successful connect (keepalive survives navigation teardown).
  useEffect(() => {
    function onPageHide() {
      if (connectedOnceRef.current) recordLeaveKeepalive();
    }
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [recordLeaveKeepalive]);

  const handleConnected = useCallback(() => {
    connectedOnceRef.current = true;
    if (!classId || isHost) return;
    api.post("/attendance/join", { classId }).catch(() => {});
  }, [classId, isHost]);

  const handleDisconnected = useCallback(
    (reason?: DisconnectReason) => {
      const code = reason as number | undefined;
      const serverForced =
        code === DisconnectReason.ROOM_DELETED ||
        code === DisconnectReason.PARTICIPANT_REMOVED ||
        code === DisconnectReason.SERVER_SHUTDOWN ||
        code === DisconnectReason.JOIN_FAILURE ||
        code === DisconnectReason.DUPLICATE_IDENTITY;

      if (serverForced || userRequestedLeaveRef.current) {
        redirectTo("/dashboard");
        return;
      }

      // CLIENT_INITIATED without our flag = remount/cleanup (e.g. React StrictMode). Stay put.
      if (code === DisconnectReason.CLIENT_INITIATED || !connectedOnceRef.current) {
        return;
      }

      // Reconnect exhausted / unexpected drop after we were in the room.
      redirectTo("/dashboard");
    },
    [redirectTo],
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#202124]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-blue-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-[#9aa0a6] text-sm">Connecting to meeting…</p>
        </div>
      </div>
    );
  }

  const hasValidUrl = (tokenData?.url?.trim() ?? "").length > 0;
  const studentNeedsMediaConsent =
    !isHost &&
    (Boolean(tokenData?.requireCamera) || Boolean(tokenData?.requireMic));

  if (error || !tokenData || !hasValidUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#202124]">
        <div className="text-center max-w-md px-6 py-8 rounded-2xl bg-[#292a2d] border border-[#3c4043]">
          <div className="w-14 h-14 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <p className="text-[#e8eaed] mb-2 font-medium">Unable to join meeting</p>
          <p className="text-[#9aa0a6] text-sm mb-6">
            {error ||
              "LiveKit server URL is not configured. Add LIVEKIT_URL to backend/.env and ensure the server is running."}
          </p>
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="px-5 py-2.5 rounded-full bg-[#8ab4f8] text-[#202124] text-sm font-medium hover:bg-[#aecbfa] transition-colors"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#202124]">
      <LiveKitRoom
        serverUrl={tokenData.url}
        token={tokenData.token}
        connect={true}
        audio={!studentNeedsMediaConsent}
        video={!studentNeedsMediaConsent}
        onConnected={handleConnected}
        onDisconnected={handleDisconnected}
        onError={(e) => {
          // Media publish / getUserMedia failures must NOT eject from the room (LiveKit routes those here).
          console.error("LiveKit error", e);
          if (!connectedOnceRef.current) {
            setError(e instanceof Error ? e.message : "Failed to connect to meeting");
          }
        }}
        onMediaDeviceFailure={(failure) => {
          console.warn("Media device failure", failure);
        }}
        style={{ height: "100%" }}
      >
        <LayoutContextProvider>
          <MeetingInner
            classId={classId!}
            isTeacher={isHost}
            teacherName={tokenData.teacherName || "the Host"}
            teacherEmail={tokenData.teacherEmail || ""}
            initialRequireCamera={Boolean(tokenData.requireCamera)}
            initialRequireMic={Boolean(tokenData.requireMic)}
            streakEnabledForClass={Boolean(tokenData.streakEnabled)}
            onRequestLeave={markLeaveRequested}
          />
        </LayoutContextProvider>
      </LiveKitRoom>
    </div>
  );
}
