import { RoomServiceClient } from "livekit-server-sdk";
import { env } from "../config/env.js";

const livekitHostRaw = env.LIVEKIT_INTERNAL_URL || env.LIVEKIT_URL;
const livekitHost =
  livekitHostRaw.replace(/^wss:\/\//, "https://").replace(/^ws:\/\//, "http://") ||
  livekitHostRaw;

export const roomService = new RoomServiceClient(
  livekitHost,
  env.LIVEKIT_API_KEY,
  env.LIVEKIT_API_SECRET,
);

/** LiveKit participant identities currently in the room (empty if room missing or error). */
export async function getRoomParticipantIdentities(roomName: string): Promise<Set<string>> {
  try {
    const participants = await roomService.listParticipants(roomName);
    return new Set(participants.map((p) => p.identity));
  } catch (e) {
    console.warn("listParticipants failed:", roomName, e);
    return new Set();
  }
}

export function identityInRoom(identities: Set<string>, email: string): boolean {
  const lower = email.toLowerCase();
  for (const id of identities) {
    if (id.toLowerCase() === lower) return true;
  }
  return false;
}
