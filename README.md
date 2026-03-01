# Yoga Class Meeting Platform

Production-ready MVP for invite-only online yoga classes with LiveKit video, JWT auth, and attendance tracking.

## Stack

- **Frontend:** React (Vite), TypeScript, TailwindCSS, React Router, LiveKit React SDK
- **Backend:** Node.js, Express, TypeScript, Prisma ORM
- **Database:** PostgreSQL
- **Video:** LiveKit (self-hosted SFU)
- **Auth:** JWT (email + password)

## Features

- **Roles:** Teacher, Student
- **Invite-only meetings:** Teachers invite by email; only invited users can join
- **Meeting controls:** Teachers can kick participants and end the meeting
- **Attendance:** Records email, joinTime, leaveTime, duration
- **Redirect:** On meeting end or disconnect, users are redirected to `/dashboard`
- **Security:** LiveKit tokens are issued only by the backend

---

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL
- LiveKit server (self-hosted; provides `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`)

### 1. Database

Create a PostgreSQL database and note the connection URL.

### 2. Backend

```bash
cd backend
cp .env.example .env
# Edit .env: set DATABASE_URL, JWT_SECRET, LIVEKIT_* and FRONTEND_URL

npm install
npx prisma generate
npx prisma db push
```

Backend runs at `http://localhost:4000`.

### 3. Frontend

```bash
cd frontend
cp .env.example .env
# Optional: set VITE_API_BASE if not using proxy (default /api)

npm install
```

Frontend runs at `http://localhost:5173` and proxies `/api` to the backend.

### 4. Run both from root

From the project root (where this README is), install once then start backend and frontend together:

```bash
npm install
npm run dev
```

This runs the backend and frontend in one terminal (backend on port 4000, frontend on 5173). To run only one: `npm run dev:backend` or `npm run dev:frontend`.

### 5. LiveKit (self-hosted)

A self-hosted LiveKit server is included in `livekit-server/`:

```bash
cd livekit-server
docker compose up -d
```

This runs LiveKit on `ws://localhost:7880`. In `backend/.env`:

```env
LIVEKIT_URL=ws://localhost:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
```

These match the default keys in `livekit-server/livekit.yaml`. See `livekit-server/README.md` for production deployment (domain, TLS, generator).

---

## Running on a Server

To run the full stack on a server (Node, Docker, PostgreSQL):

1. **Read [DEPLOYMENT.md](./DEPLOYMENT.md)** for prerequisites, env vars, and options.
2. **Start everything** (LiveKit + backend + frontend):
   ```bash
   chmod +x scripts/start-server.sh scripts/stop-server.sh
   ./scripts/start-server.sh
   ```
3. **Stop** backend and frontend: `./scripts/stop-server.sh`

Backend listens on port **4000**, frontend on **3000**. Set `backend/.env` and `frontend/.env` (see DEPLOYMENT.md) before running.

---

## API Reference

### Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Register (body: `email`, `password`, `name?`, `role?`) |
| POST | `/auth/login` | Login (body: `email`, `password`) |

### Classes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/classes` | List classes (as teacher + invited) |
| POST | `/classes` | Create class (teacher; body: `name`, `description?`) |
| GET | `/classes/:id` | Get class details |
| POST | `/classes/:id/invite` | Invite emails (teacher; body: `emails[]`) |
| POST | `/classes/:id/join` | Get LiveKit token to join meeting |
| POST | `/classes/:id/end` | End meeting (teacher) |
| POST | `/classes/:id/kick` | Kick participant (teacher; body: `identity` = email) |

### Attendance

| Method | Path | Description |
|--------|------|-------------|
| POST | `/attendance/join` | Record join (body: `classId`, `email`) |
| POST | `/attendance/leave` | Record leave (body: `classId`, `email`) |

All routes except `/auth/register` and `/auth/login` require `Authorization: Bearer <token>`.

---

## Frontend Routes

- `/login` — Sign in
- `/register` — Create account (Teacher or Student)
- `/dashboard` — List/create classes, invite (teachers), join meeting
- `/meeting/:classId` — LiveKit video room; teacher controls (end, kick); redirect to dashboard on disconnect

---

## Project Structure

```
livekit/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── lib/
│   │   └── index.ts
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── contexts/
│   │   ├── lib/
│   │   ├── pages/
│   │   └── App.tsx
│   ├── .env.example
│   └── package.json
└── README.md
```

---

## Database Models (Prisma)

- **User** — email, password, role (TEACHER | STUDENT), name
- **Class** — name, description, teacherId, roomName
- **ClassInvite** — classId, email, invitedBy
- **Attendance** — classId, email, joinTime, leaveTime, duration

---

## License

MIT
