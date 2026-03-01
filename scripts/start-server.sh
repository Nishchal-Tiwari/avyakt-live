#!/usr/bin/env bash
# Start the full Yoga Class platform on a server:
# - LiveKit (Docker)
# - Backend (Node)
# - Frontend (built and served with 'serve')
# Run from project root. Requires: Node 18+, Docker, Docker Compose, PostgreSQL.

set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
PID_FILE="$ROOT/.server-pids"

echo "=== Yoga Class Platform - Start ==="

# 1. LiveKit
if command -v docker >/dev/null 2>&1 && [ -f "$ROOT/livekit-server/docker-compose.yml" ]; then
  echo "Starting LiveKit..."
  (cd "$ROOT/livekit-server" && docker compose up -d) || true
else
  echo "Docker not found or livekit-server missing; skipping LiveKit."
fi

# 2. Backend
if [ ! -f "$ROOT/backend/.env" ]; then
  echo "Missing backend/.env. Copy from backend/.env.example and set DATABASE_URL, JWT_SECRET, LIVEKIT_*."
  exit 1
fi

echo "Building and starting backend..."
mkdir -p "$ROOT/backend/logs"
(cd "$ROOT/backend" && npm ci --omit=dev 2>/dev/null || npm install --omit=dev)
(cd "$ROOT/backend" && npx prisma generate && npx prisma db push)
(cd "$ROOT/backend" && npm run build)
(cd "$ROOT/backend" && nohup node dist/index.js > logs/backend.log 2>&1 &)
BACKEND_PID=$!
echo $BACKEND_PID >> "$PID_FILE"
sleep 2
if kill -0 $BACKEND_PID 2>/dev/null; then
  echo "Backend started (PID $BACKEND_PID) on port 4000."
else
  echo "Backend may have failed; check backend/logs/backend.log"
fi

# 3. Frontend
echo "Building and starting frontend..."
mkdir -p "$ROOT/frontend/logs"
(cd "$ROOT/frontend" && npm ci 2>/dev/null || npm install)
(cd "$ROOT/frontend" && npm run build)
if command -v serve >/dev/null 2>&1; then
  (cd "$ROOT/frontend" && nohup serve -s dist -l 3000 > logs/frontend.log 2>&1 &)
else
  (cd "$ROOT/frontend" && nohup npx serve -s dist -l 3000 > logs/frontend.log 2>&1 &)
fi
FRONTEND_PID=$!
echo $FRONTEND_PID >> "$PID_FILE"
sleep 1
if kill -0 $FRONTEND_PID 2>/dev/null; then
  echo "Frontend started (PID $FRONTEND_PID) on port 3000."
else
  echo "Frontend may have failed; check frontend/logs/frontend.log"
fi

echo ""
echo "Done. Backend: http://localhost:4000  Frontend: http://localhost:3000"
echo "To stop: ./scripts/stop-server.sh"
echo "If frontend calls API fail, set VITE_API_BASE in frontend/.env to your backend URL and rebuild frontend."
