import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: parseInt(process.env.PORT ?? "4000", 10),
  DATABASE_URL: process.env.DATABASE_URL ?? "",
  JWT_SECRET: process.env.JWT_SECRET ?? "change-me-in-production",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? "7d",
  LIVEKIT_URL: process.env.LIVEKIT_URL ?? "",
  /** Optional: use for server-side API (e.g. Docker internal). Client still gets LIVEKIT_URL. */
  LIVEKIT_INTERNAL_URL: process.env.LIVEKIT_INTERNAL_URL ?? "",
  LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY ?? "",
  LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET ?? "",
  FRONTEND_URL: process.env.FRONTEND_URL ?? "http://localhost:5173",
} as const;
