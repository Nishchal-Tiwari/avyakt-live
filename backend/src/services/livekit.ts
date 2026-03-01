import { AccessToken } from "livekit-server-sdk";
import { env } from "../config/env.js";

export async function createLiveKitToken(
  roomName: string,
  participantIdentity: string,
  participantName: string,
  isModerator: boolean
): Promise<string> {
  const at = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
    identity: participantIdentity,
    name: participantName,
    ttl: "2h",
  });

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    ...(isModerator && { roomAdmin: true }),
  });

  return await at.toJwt();
}

export function getLiveKitUrl(): string {
  return env.LIVEKIT_URL;
}
