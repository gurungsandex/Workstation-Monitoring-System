#!/usr/bin/env bash
# WMS Agent installer for Linux (systemd)
set -euo pipefail

: "${WMS_SERVER_URL:?WMS_SERVER_URL must be set}"
: "${WMS_ENROLL_TOKEN:?WMS_ENROLL_TOKEN must be set}"

INSTALL_DIR="/usr/local/bin"
STATE_DIR="/etc/wms-agent"
SERVICE_FILE="/etc/systemd/system/wms-agent.service"
BINARY="wms-agent"
DOWNLOAD_URL="${WMS_DOWNLOAD_URL:-}"

echo "==> Installing WMS Agent"

mkdir -p "$STATE_DIR"

if [[ -n "$DOWNLOAD_URL" ]]; then
  curl -fsSL "$DOWNLOAD_URL" -o "$INSTALL_DIR/$BINARY"
  chmod +x "$INSTALL_DIR/$BINARY"
elif command -v go &>/dev/null; then
  echo "==> Building from source..."
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  AGENT_DIR="$SCRIPT_DIR/../.."
  (cd "$AGENT_DIR" && go build -o "$INSTALL_DIR/$BINARY" .)
else
  echo "ERROR: No download URL and no Go toolchain found."
  exit 1
fi

cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=WMS Monitoring Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=$INSTALL_DIR/$BINARY
Restart=always
RestartSec=10
Environment=WMS_SERVER_URL=$WMS_SERVER_URL
Environment=WMS_ENROLL_TOKEN=$WMS_ENROLL_TOKEN
Environment=WMS_STATE_FILE=$STATE_DIR/state.json
Environment=WMS_INTERVAL=10s

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now wms-agent

echo "==> WMS Agent installed and started."
echo "    Check status: systemctl status wms-agent"
echo "    View logs:    journalctl -u wms-agent -f"
