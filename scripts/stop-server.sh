#!/usr/bin/env bash
# Stop backend and frontend processes started by start-server.sh.
# LiveKit (Docker) is left running; stop it with: cd livekit-server && docker compose down

set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="$ROOT/.server-pids"

echo "=== Stopping Yoga Class Platform ==="

if [ -f "$PID_FILE" ]; then
  while read -r pid; do
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      echo "Stopped process $pid"
    fi
  done < "$PID_FILE"
  rm -f "$PID_FILE"
else
  echo "No .server-pids found; trying to stop node/serve processes on 4000 and 3000..."
  for port in 4000 3000; do
    pid=$(lsof -ti ":$port" 2>/dev/null || true)
    if [ -n "$pid" ]; then
      kill $pid 2>/dev/null || true
      echo "Stopped process on port $port (PID $pid)"
    fi
  done
fi

echo "Done. To stop LiveKit: cd livekit-server && docker compose down"
