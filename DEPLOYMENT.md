# Running the Yoga Class Platform on a Server

This guide covers what you need and how to run the full stack on a Linux server (e.g. Ubuntu).

---

## What You Need on the Server

| Requirement | Notes |
|-------------|--------|
| **Node.js 18+** | For backend and frontend build |
| **npm** | Comes with Node |
| **Docker & Docker Compose** | For LiveKit (and optionally PostgreSQL) |
| **PostgreSQL** | Local install or Docker; need connection URL |
| **Ports** | 4000 (backend), 3000 (frontend), 7880/7881 (LiveKit), 50000–50100/UDP (LiveKit) |

---

## 1. Environment Files

### Backend (`backend/.env`)

Copy from `backend/.env.example` and set:

```env
NODE_ENV=production
PORT=4000

DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public"
JWT_SECRET="your-strong-secret-at-least-32-chars"
JWT_EXPIRES_IN=7d

LIVEKIT_URL=ws://YOUR_SERVER_IP:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret

FRONTEND_URL=http://YOUR_SERVER_IP:3000
```

- Use your server IP or domain for `LIVEKIT_URL` and `FRONTEND_URL`.
- For HTTPS later, set `FRONTEND_URL=https://yourdomain.com` and use a reverse proxy.

### Frontend (`frontend/.env`)

When using the start script (no reverse proxy), the frontend is served on port 3000 and the backend on 4000, so the app must call the backend by URL. Set:

```env
VITE_API_BASE=http://YOUR_SERVER_IP:4000
```

Replace `YOUR_SERVER_IP` with your server’s IP or hostname (or `localhost` if testing on the same machine).

If you later put Nginx (or similar) in front and proxy `/api` to the backend, you can switch to:

```env
VITE_API_BASE=/api
```

and rebuild the frontend.

---

## 2. One-command Docker Compose (recommended)

Run **frontend, backend, LiveKit and PostgreSQL** in one go:

```bash
# Optional: set env for production (create .env in project root)
echo "JWT_SECRET=your-strong-secret" >> .env
echo "BACKEND_LIVEKIT_URL=ws://YOUR_SERVER_IP:7880" >> .env   # URL browsers use for LiveKit
echo "FRONTEND_URL=http://YOUR_SERVER_IP" >> .env              # for CORS

docker compose up -d
```

- **App (frontend + API):** http://localhost (port 80)
- **LiveKit:** port 7880 (exposed for WebSocket)

Containers: `postgres`, `livekit`, `backend`, `frontend`. Frontend serves the app and proxies `/api` to the backend. Backend uses `LIVEKIT_INTERNAL_URL` to talk to LiveKit inside Docker and returns `LIVEKIT_URL` (or `BACKEND_LIVEKIT_URL`) to clients.

To stop: `docker compose down`

---

## 2b. Temporary demo on your Mac (free, to show someone)

Two free options: **same WiFi** (no signup) or **public URL** (anyone can open the link).

### Option A: Same WiFi (easiest, no signup)

Good when you and the viewer are on the same network (e.g. same office/home WiFi).

1. **Get your Mac’s IP** (e.g. `192.168.1.42`):
   ```bash
   ipconfig getifaddr en0
   ```
   (Use `en0` for Wi‑Fi; if empty try `en1` or run `ifconfig` and pick the inet under your active interface.)

2. **Set env and start** (from project root):
   ```bash
   export FRONTEND_URL="http://YOUR_IP"
   export BACKEND_LIVEKIT_URL="ws://YOUR_IP:7880"
   docker compose up -d
   ```
   Replace `YOUR_IP` with the IP from step 1.

3. **Share the link:** `http://YOUR_IP` (port 80). The other person opens it in the browser. Demo users: `teacher@yoga.demo` / `student@yoga.demo`, password `demo123`.

### Option B: Public URL (viewer anywhere – e.g. ngrok)

Good when the viewer is not on your network. Use a free tunnel so your Mac is reachable from the internet.

1. **Start the stack:**
   ```bash
   docker compose up -d
   ```

2. **Install ngrok** (one-time): https://ngrok.com/download or `brew install ngrok`. Sign up for a free account and run `ngrok config add-authtoken YOUR_TOKEN`.

3. **Create two tunnels** (in two terminals):
   - Terminal 1 (app): `ngrok http 80`  
   - Terminal 2 (LiveKit): `ngrok http 7880`  
   Note the **https** URLs ngrok shows (e.g. `https://abc123.ngrok-free.app` and `https://def456.ngrok-free.app`).

4. **Point the app to those URLs:**
   - `FRONTEND_URL` = URL from Terminal 1 (e.g. `https://abc123.ngrok-free.app`)
   - `BACKEND_LIVEKIT_URL` = WebSocket version of URL from Terminal 2: replace `https://` with `wss://` (e.g. `wss://def456.ngrok-free.app`)

   From project root:
   ```bash
   export FRONTEND_URL="https://YOUR_APP_NGROK_URL"
   export BACKEND_LIVEKIT_URL="wss://YOUR_LIVEKIT_NGROK_URL"
   docker compose up -d
   ```
   (Or put `FRONTEND_URL` and `BACKEND_LIVEKIT_URL` in a `.env` in the project root and run `docker compose up -d` again.)

5. **Share the app URL** (Terminal 1’s https URL). The viewer can open it from anywhere. Keep both ngrok terminals running while you demo.

**Tip:** Free ngrok URLs change each time you start ngrok. For a fixed URL, use a free ngrok domain (if available on your plan) or another tunnel (e.g. Cloudflare Tunnel).

---

## 3. Quick Start with the Script (no Docker for app)

From the project root:

```bash
chmod +x scripts/start-server.sh scripts/stop-server.sh
./scripts/start-server.sh
```

This will:

1. Start LiveKit (Docker) in `livekit-server/`
2. Install dependencies and build backend, run Prisma migrations, start backend on port **4000**
3. Install dependencies and build frontend, serve it on port **3000** (via `serve`)

Backend and frontend run in the background. Logs: `backend/logs/backend.log`, `frontend/logs/frontend.log`.

To stop:

```bash
./scripts/stop-server.sh
```

**Requirements for the script:** Node 18+, Docker, Docker Compose, and a running PostgreSQL with `DATABASE_URL` set in `backend/.env`. The script uses `npx serve` to serve the built frontend; install it once with `npm install -g serve` if you don’t want to rely on npx.

---

## 4. Manual Steps (without the script)

### 3.1 LiveKit

```bash
cd livekit-server
docker compose up -d
cd ..
```

Ensure `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` in `backend/.env` match `livekit-server/livekit.yaml`.

### 3.2 Backend

```bash
cd backend
npm ci
npx prisma generate
npx prisma db push
npm run build
PORT=4000 node dist/index.js
```

Or with PM2:

```bash
pm2 start dist/index.js --name yoga-backend -i 1
```

### 3.3 Frontend

Build (with optional API base for production):

```bash
cd frontend
npm ci
VITE_API_BASE=/api npm run build
```

Serve the build (example with `serve`):

```bash
npx serve -s dist -l 3000
```

Or with PM2:

```bash
pm2 serve dist 3000 --name yoga-frontend --spa
```

---

## 5. Production Checklist

- [ ] Use a **strong `JWT_SECRET`** (e.g. 32+ random characters).
- [ ] Use **HTTPS** (reverse proxy: Nginx or Caddy) and set `FRONTEND_URL` / cookies accordingly.
- [ ] Point **LIVEKIT_URL** to your LiveKit host (e.g. `wss://livekit.yourdomain.com` if you add TLS).
- [ ] Use a **process manager** (e.g. PM2 or systemd) for backend and frontend so they restart on crash.
- [ ] Optionally run **PostgreSQL** and **LiveKit** in Docker with restart policies.

---

## 6. Example Nginx (optional)

If you use Nginx in front of the app:

- Serve the frontend build from one server block (root = `frontend/dist`, try files for SPA).
- Proxy `/api` to `http://127.0.0.1:4000`.
- Proxy LiveKit WebSocket if you host it on the same server.

---

## 7. Ports Summary

| Service   | Port(s)        | Purpose                |
|----------|----------------|------------------------|
| Backend  | 4000           | API                    |
| Frontend | 3000 (script)  | Web app                |
| LiveKit  | 7880 (HTTP/WS) | Signaling              |
| LiveKit  | 7881           | WebRTC TCP             |
| LiveKit  | 50000–50100/UDP| WebRTC media           |

Open these (and 80/443 if using Nginx) in your firewall.
