/**
 * Returns a path safe to use after login/register (same-app relative paths only).
 */
export function getSafeRedirectPath(raw: string | null | undefined): string | null {
  if (raw == null || raw === "") return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw).trim();
  } catch {
    return null;
  }
  if (!decoded.startsWith("/") || decoded.startsWith("//")) return null;
  if (decoded.includes("://")) return null;
  return decoded;
}
