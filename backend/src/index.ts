import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import authRoutes from "./routes/auth.js";
import classesRoutes from "./routes/classes.js";
import attendanceRoutes from "./routes/attendance.js";
import { checkLiveKitReachable } from "./lib/livekitHealth.js";

const app = express();

app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/classes", classesRoutes);
app.use("/attendance", attendanceRoutes);

app.get("/health", async (_req, res) => {
  const livekitOk = env.LIVEKIT_URL?.trim()
    ? await checkLiveKitReachable()
    : false;
  res.json({
    ok: true,
    livekit: env.LIVEKIT_URL?.trim()
      ? livekitOk
        ? "reachable"
        : "unreachable"
      : "not_configured",
  });
});

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

async function main() {
  await prisma.$connect();

  if (env.LIVEKIT_URL?.trim()) {
    const livekitOk = await checkLiveKitReachable();
    if (livekitOk) {
      console.log(`LiveKit server reachable at ${env.LIVEKIT_URL}`);
    } else {
      console.warn(
        `LiveKit server not reachable at ${env.LIVEKIT_URL}. Ensure 'docker compose up -d' in livekit-server/ or that LIVEKIT_URL is correct.`
      );
    }
  } else {
    console.warn("LIVEKIT_URL not set. Meeting join will fail until configured.");
  }

  app.listen(env.PORT, () => {
    console.log(`Server listening on port ${env.PORT}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
