# Workstation Monitoring System — Installation Guide

## Prerequisites

- Docker 24+ and Docker Compose v2
- A domain name (or use `localhost` for local dev)
- Ports 80 and 443 open (Caddy handles TLS automatically)

---

## 1. Clone and configure

```bash
git clone https://github.com/gurungsandex/workstation-monitoring-system.git
cd workstation-monitoring-system
cp .env.example .env
```

Edit `.env` and set:

| Variable | Description |
|---|---|
| `DB_PASSWORD` | Strong postgres password |
| `JWT_SECRET` | 32+ char random string (user auth) |
| `AGENT_JWT_SECRET` | 32+ char random string (agent auth) |
| `CADDY_HOST` | Your domain (e.g. `monitor.example.com`) or `localhost` |
| `CORS_ORIGIN` | Same as your domain with `https://` prefix |
| `NEXT_PUBLIC_API_URL` | `https://<domain>/api` |
| `NEXT_PUBLIC_WS_URL` | `wss://<domain>/ws/live` |
| `SCAN_CIDRS` | Comma-separated CIDRs for network discovery |

Generate secrets quickly:
```bash
openssl rand -hex 32   # run twice — one for JWT_SECRET, one for AGENT_JWT_SECRET
```

---

## 2. Start the stack

```bash
docker compose up -d
```

The stack starts:
- **TimescaleDB** on internal port 5432 (migrations run automatically)
- **Server** (Fastify API + WebSocket) on internal port 4000
- **Web** (Next.js dashboard) on internal port 3000
- **Caddy** (reverse proxy + automatic TLS) on ports 80/443

Check everything is healthy:
```bash
docker compose ps
```

---

## 3. First admin login

The default admin account is seeded by `db/migrations/003_seed.sql`:

- **Email:** `admin@wms.local`
- **Password:** `changeme123`

**Change the password immediately** after first login via Settings → Users.

---

## 4. Enroll a workstation agent

### Generate an enrollment token

In the web UI: **Network → Discover & Enroll → Generate Token**

Or via the API:
```bash
TOKEN=$(curl -s -X POST https://<domain>/api/enroll/token \
  -H "Cookie: token=<your-admin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"label": "my-workstation"}' | jq -r .token)
echo "Enrollment token: $TOKEN"
```

### Install the agent

**Linux (systemd):**
```bash
curl -fsSL https://<domain>/install/linux | \
  WMS_SERVER_URL=wss://<domain>/ws/agent \
  WMS_ENROLL_TOKEN=$TOKEN \
  bash
```

**macOS (launchd):**
```bash
WMS_SERVER_URL=wss://<domain>/ws/agent \
WMS_ENROLL_TOKEN=$TOKEN \
bash agent/install/macos/install.sh
```

**Windows (PowerShell as Administrator):**
```powershell
.\agent\install\windows\install.ps1 `
  -WmsServerUrl "wss://<domain>/ws/agent" `
  -WmsEnrollToken "<token>"
```

The agent will:
1. Exchange the enrollment token for a permanent per-agent JWT
2. Persist credentials to `/etc/wms-agent/state.json`
3. Start sending metrics every 10 seconds

---

## 5. Network discovery scan

In the UI: **Network → Run Scan** — or:
```bash
curl -X POST https://<domain>/api/discover \
  -H "Cookie: token=<admin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"cidrs": ["192.168.1.0/24"]}'
```

---

## 6. Updating

```bash
git pull
docker compose build
docker compose up -d
```

Migrations run automatically on server startup.

---

## 7. Revoking an agent

In the UI: **Network → Enrolled → Revoke**

Or via the API:
```bash
curl -X DELETE https://<domain>/api/enroll/<workstation-id> \
  -H "Cookie: token=<admin-jwt>"
```

This marks the workstation offline and invalidates its agent token.
