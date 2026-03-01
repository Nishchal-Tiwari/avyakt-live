# LiveKit SFU (self-hosted)

Run your own LiveKit server in this folder. The yoga app backend connects to it to issue tokens and call the Room API.

## Prerequisites

- Docker and Docker Compose

## Quick start

```bash
docker compose up -d
```

LiveKit listens on:
- **7880** – HTTP/WebSocket (client connections)
- **7881** – WebRTC TCP
- **50000–50100/UDP** – WebRTC media

## Connect the yoga app backend

1. **URL:** Point to your LiveKit server:
   - Local: `ws://localhost:7880`
   - Remote: `wss://livekit.yourdomain.com`

2. **API key/secret:** Must match `livekit.yaml` under `keys:`.

Default keys in `livekit.yaml`:

```yaml
keys:
  devkey: secret
```

3. In `backend/.env`:

```env
LIVEKIT_URL=ws://localhost:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
```

If you change keys in `livekit.yaml`, update `backend/.env` accordingly.

## Production

For production with a domain and TLS:

1. Use the [official generator](https://docs.livekit.io/home/self-hosting/vm):
   ```bash
   docker run --rm -it -v $PWD:/output livekit/generate
   ```
2. Deploy the generated config (Caddy, Redis, etc.) to your VM.
3. Ensure firewall allows: 80, 443, 7881, 3478/UDP, 50000–60000/UDP.
4. Set `LIVEKIT_URL=wss://your-domain.com` and your keys in `backend/.env`.

## Useful commands

```bash
# Run in foreground (see logs)
docker compose up

# Stop
docker compose down
```
