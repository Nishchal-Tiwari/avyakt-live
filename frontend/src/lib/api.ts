/** Relative `/api` uses Vite dev proxy; absolute URL talks to backend directly (needs CORS). */
const envApiBase = import.meta.env.VITE_API_BASE;
const API_BASE =
  typeof envApiBase === "string" && envApiBase.trim() !== ""
    ? envApiBase.trim().replace(/\/$/, "")
    : "/api";

function joinApiPath(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${p}`;
}

const SESSION_EVENT = "auth:session-expired";

function getToken(): string | null {
  return localStorage.getItem("token");
}

function getHeaders(includeAuth = true): HeadersInit {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  const token = includeAuth ? getToken() : null;
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

function clearSessionIfStaleRequest(sentWithAuthHeader: boolean, res: Response) {
  if (res.status !== 401 || !sentWithAuthHeader) return;
  const hadToken = Boolean(getToken());
  if (!hadToken) return;
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.dispatchEvent(new CustomEvent(SESSION_EVENT));
}

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? "Request failed");
  }
  return data as T;
}

export const api = {
  /** GET /health on the backend (via /api/health when using the Vite proxy). */
  async pingBackend(): Promise<boolean> {
    try {
      const res = await fetch(joinApiPath("/health"));
      return res.ok;
    } catch {
      return false;
    }
  },

  async post<T>(path: string, body?: unknown, auth = true): Promise<T> {
    const headers = getHeaders(auth);
    const sentWithAuthHeader = auth && Boolean(getToken());
    const res = await fetch(joinApiPath(path), {
      method: "POST",
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    clearSessionIfStaleRequest(sentWithAuthHeader, res);
    return handleResponse<T>(res);
  },

  async get<T>(path: string): Promise<T> {
    const sentWithAuthHeader = Boolean(getToken());
    const res = await fetch(joinApiPath(path), {
      headers: getHeaders(),
    });
    clearSessionIfStaleRequest(sentWithAuthHeader, res);
    return handleResponse<T>(res);
  },

  async patch<T>(path: string, body?: unknown): Promise<T> {
    const sentWithAuthHeader = Boolean(getToken());
    const res = await fetch(joinApiPath(path), {
      method: "PATCH",
      headers: getHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    clearSessionIfStaleRequest(sentWithAuthHeader, res);
    return handleResponse<T>(res);
  },
};

export type UserRole = "TEACHER" | "STUDENT";

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface ClassResponse {
  id: string;
  name: string;
  description: string | null;
  roomName: string;
  redirectUrl?: string | null;
  requireCamera?: boolean;
  requireMic?: boolean;
  streakEnabled?: boolean;
  streakTargetDays?: number;
  teacher: { id: string; email: string; name: string | null };
  createdAt: string;
}

export interface JoinMeetingResponse {
  token: string;
  url: string;
  roomName: string;
  redirectUrl?: string;
  teacherName: string;
  teacherEmail: string;
  requireCamera?: boolean;
  requireMic?: boolean;
  streakEnabled?: boolean;
  streakTargetDays?: number;
}
