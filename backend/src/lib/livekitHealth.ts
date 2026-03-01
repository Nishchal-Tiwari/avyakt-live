import { env } from "../config/env.js";

const CHECK_TIMEOUT_MS = 3000;

/**
 * Check if the LiveKit server at LIVEKIT_URL is reachable.
 * Converts ws(s) URL to http(s) and does a GET; any response means server is up.
 */
export async function checkLiveKitReachable(): Promise<boolean> {
  const url = (env.LIVEKIT_INTERNAL_URL || env.LIVEKIT_URL)?.trim();
  if (!url) return false;

  const httpUrl = url.replace(/^wss:\/\//i, "https://").replace(/^ws:\/\//i, "http://");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);

  try {
    const res = await fetch(httpUrl, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return true;
  } catch {
    clearTimeout(timeout);
    return false;
  }
}
