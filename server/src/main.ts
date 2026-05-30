import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import fastifyCookie from "@fastify/cookie";
import fastifyCors from "@fastify/cors";
import fastifyWebsocket from "@fastify/websocket";
import fastifyRateLimit from "@fastify/rate-limit";
import { config } from "./config";
import { authRoutes } from "./routes/auth";
import { enrollmentRoutes } from "./routes/enrollment";
import { metricsRoutes } from "./routes/metrics";
import { workstationRoutes } from "./routes/workstations";
import { alertRoutes } from "./routes/alerts";
import { discoveryRoutes } from "./routes/discovery";
import { agentWsRoutes } from "./ws/agentHandler";
import { browserWsRoutes } from "./ws/browserHandler";
import { raiseHeartbeatAlert } from "./services/alertEngine";
import { query } from "./db";

const app = Fastify({ logger: { level: "info" } });

async function main() {
  // Plugins
  await app.register(fastifyCors, {
    origin: config.cors.origin,
    credentials: true,
  });

  await app.register(fastifyRateLimit, {
    max: parseInt(process.env.RATE_LIMIT_MAX ?? "600"),
    timeWindow: "1 minute",
  });

  await app.register(fastifyCookie);

  await app.register(fastifyJwt, {
    secret: config.jwt.secret,
    cookie: { cookieName: "wms_token", signed: false },
  });

  await app.register(fastifyWebsocket);

  // Routes (each route file declares full /api/... paths)
  await app.register(authRoutes);
  await app.register(enrollmentRoutes);
  await app.register(metricsRoutes);
  await app.register(workstationRoutes);
  await app.register(alertRoutes);
  await app.register(discoveryRoutes);

  // WebSocket routes
  await app.register(agentWsRoutes);
  await app.register(browserWsRoutes);

  // Health check
  app.get("/health", async () => ({ ok: true }));

  // ── Install scripts (served so `curl URL | bash` works) ──────────────────
  app.get("/install/macos", async (_req, reply) => {
    reply.type("text/plain");
    return `#!/usr/bin/env bash
set -euo pipefail

: "\${WMS_ENROLL_TOKEN:?WMS_ENROLL_TOKEN must be set}"
: "\${WMS_SERVER_URL:?WMS_SERVER_URL must be set}"

INSTALL_DIR="/usr/local/bin"
STATE_DIR="/etc/wms-agent"
PLIST_DIR="/Library/LaunchDaemons"
PLIST_LABEL="com.wms.agent"
BINARY="wms-agent"

echo "==> Installing WMS Agent (macOS)"

# ── Build agent binary ──────────────────────────────────────────────────────
TMP_SRC="/tmp/wms-agent-src"
rm -rf "$TMP_SRC" && mkdir -p "$TMP_SRC"

if ! command -v go &>/dev/null; then
  echo "ERROR: Go is not installed. Install from https://go.dev/dl/ and retry."
  exit 1
fi

# Clone or copy source — running on the same machine as the dev server
SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]:-/dev/stdin}")" 2>/dev/null || echo ".")"
AGENT_SRC="$(dirname "$(dirname "$SCRIPT_DIR")")/agent"
if [ -d "$AGENT_SRC" ]; then
  (cd "$AGENT_SRC" && go build -o "/tmp/$BINARY" .)
else
  echo "ERROR: Agent source not found at $AGENT_SRC"
  echo "       Clone the repo and run this script from the project root, or pre-build the binary."
  exit 1
fi

sudo mkdir -p "$STATE_DIR" "$INSTALL_DIR"
sudo mv "/tmp/$BINARY" "$INSTALL_DIR/$BINARY"
echo "    Binary: $INSTALL_DIR/$BINARY"

# ── LaunchDaemon plist ───────────────────────────────────────────────────────
sudo tee "$PLIST_DIR/$PLIST_LABEL.plist" > /dev/null <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>             <string>$PLIST_LABEL</string>
  <key>ProgramArguments</key>  <array><string>$INSTALL_DIR/$BINARY</string></array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>WMS_SERVER_URL</key>  <string>\${WMS_SERVER_URL}</string>
    <key>WMS_ENROLL_TOKEN</key><string>\${WMS_ENROLL_TOKEN}</string>
    <key>WMS_STATE_FILE</key>  <string>$STATE_DIR/state.json</string>
    <key>WMS_INTERVAL</key>    <string>10s</string>
  </dict>
  <key>RunAtLoad</key>         <true/>
  <key>KeepAlive</key>         <true/>
  <key>StandardOutPath</key>   <string>/var/log/wms-agent.log</string>
  <key>StandardErrorPath</key> <string>/var/log/wms-agent.log</string>
</dict>
</plist>
PLIST

# ── Load service ─────────────────────────────────────────────────────────────
sudo launchctl unload "$PLIST_DIR/$PLIST_LABEL.plist" 2>/dev/null || true
sudo launchctl load   "$PLIST_DIR/$PLIST_LABEL.plist"

echo "==> WMS Agent installed and running."
echo "    Status : sudo launchctl list | grep wms"
echo "    Logs   : tail -f /var/log/wms-agent.log"
`;
  });

  app.get("/install/linux", async (_req, reply) => {
    reply.type("text/plain");
    return `#!/usr/bin/env bash
set -euo pipefail

: "\${WMS_ENROLL_TOKEN:?WMS_ENROLL_TOKEN must be set}"
: "\${WMS_SERVER_URL:?WMS_SERVER_URL must be set}"

INSTALL_DIR="/usr/local/bin"
STATE_DIR="/etc/wms-agent"
SERVICE_FILE="/etc/systemd/system/wms-agent.service"
BINARY="wms-agent"

echo "==> Installing WMS Agent (Linux)"

if ! command -v go &>/dev/null; then
  echo "ERROR: Go is not installed. See https://go.dev/dl/"
  exit 1
fi

AGENT_SRC="\$(dirname "\$(dirname "\$(realpath "\${BASH_SOURCE[0]:-/dev/stdin}")")")/agent"
if [ -d "\$AGENT_SRC" ]; then
  (cd "\$AGENT_SRC" && go build -o "/tmp/\$BINARY" .)
else
  echo "ERROR: Agent source not found at \$AGENT_SRC"
  exit 1
fi

install -d "\$STATE_DIR" "\$INSTALL_DIR"
install -m 755 "/tmp/\$BINARY" "\$INSTALL_DIR/\$BINARY"

cat > "\$SERVICE_FILE" <<SERVICE
[Unit]
Description=WMS Monitoring Agent
After=network.target

[Service]
ExecStart=\$INSTALL_DIR/\$BINARY
Environment=WMS_SERVER_URL=\${WMS_SERVER_URL}
Environment=WMS_ENROLL_TOKEN=\${WMS_ENROLL_TOKEN}
Environment=WMS_STATE_FILE=\$STATE_DIR/state.json
Environment=WMS_INTERVAL=10s
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable --now wms-agent

echo "==> WMS Agent installed."
echo "    Status: systemctl status wms-agent"
echo "    Logs  : journalctl -u wms-agent -f"
`;
  });

  app.get("/install/windows", async (_req, reply) => {
    reply.type("text/plain");
    return `# WMS Agent installer (Windows / PowerShell)
$ErrorActionPreference = "Stop"
if (-not $env:WMS_ENROLL_TOKEN) { throw "WMS_ENROLL_TOKEN must be set" }
if (-not $env:WMS_SERVER_URL)   { throw "WMS_SERVER_URL must be set" }

$InstallDir = "C:\\wms-agent"
$StateDir   = "C:\\wms-agent"
$Binary     = "wms-agent.exe"

if (-not (Get-Command go -ErrorAction SilentlyContinue)) {
  throw "Go is not installed. Download from https://go.dev/dl/"
}

$AgentSrc = Join-Path (Split-Path (Split-Path $PSScriptRoot)) "agent"
Push-Location $AgentSrc
go build -o "$env:TEMP\\$Binary" .
Pop-Location

New-Item -ItemType Directory -Force $InstallDir | Out-Null
Copy-Item "$env:TEMP\\$Binary" "$InstallDir\\$Binary" -Force

$action  = New-ScheduledTaskAction -Execute "$InstallDir\\$Binary" \`
             -WorkingDirectory $InstallDir
$trigger = New-ScheduledTaskTrigger -AtStartup
$env_vars = @("WMS_SERVER_URL=$env:WMS_SERVER_URL",
              "WMS_ENROLL_TOKEN=$env:WMS_ENROLL_TOKEN",
              "WMS_STATE_FILE=$StateDir\\state.json",
              "WMS_INTERVAL=10s")
$settings = New-ScheduledTaskSettingsSet -RestartInterval (New-TimeSpan -Seconds 10) \`
              -RestartCount 999
Register-ScheduledTask -TaskName "WMSAgent" -Action $action \`
  -Trigger $trigger -Settings $settings -RunLevel Highest -Force | Out-Null

Start-ScheduledTask -TaskName "WMSAgent"
Write-Host "==> WMS Agent installed. Check Task Scheduler for status."
`;
  });

  // Start heartbeat watchdog
  startHeartbeatWatchdog();

  await app.listen({ port: config.port, host: "0.0.0.0" });
  app.log.info(`Server listening on port ${config.port}`);
}

// Detect agents that haven't sent a metric in >5 minutes
function startHeartbeatWatchdog() {
  setInterval(async () => {
    try {
      const stale = await query<{ id: string }>(
        `SELECT id FROM workstations
         WHERE status != 'offline'
           AND last_seen_at < NOW() - INTERVAL '5 minutes'`
      );
      for (const ws of stale) {
        await raiseHeartbeatAlert(ws.id);
      }
    } catch (err) {
      app.log.error({ err }, "Heartbeat watchdog error");
    }
  }, config.alerts.intervalMs);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
