#!/usr/bin/env bash
# WMS Agent installer for macOS (launchd)
set -euo pipefail

: "${WMS_SERVER_URL:?WMS_SERVER_URL must be set}"
: "${WMS_ENROLL_TOKEN:?WMS_ENROLL_TOKEN must be set}"

INSTALL_DIR="/usr/local/bin"
STATE_DIR="/etc/wms-agent"
PLIST_DIR="/Library/LaunchDaemons"
PLIST_LABEL="com.wms.agent"
BINARY="wms-agent"

echo "==> Installing WMS Agent (macOS)"

sudo mkdir -p "$STATE_DIR"

if command -v go &>/dev/null; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  AGENT_DIR="$SCRIPT_DIR/../.."
  (cd "$AGENT_DIR" && go build -o "/tmp/$BINARY" .)
  sudo mv "/tmp/$BINARY" "$INSTALL_DIR/$BINARY"
else
  echo "ERROR: Go toolchain required to build agent."
  exit 1
fi

sudo tee "$PLIST_DIR/$PLIST_LABEL.plist" > /dev/null <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$PLIST_LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$INSTALL_DIR/$BINARY</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>WMS_SERVER_URL</key>      <string>$WMS_SERVER_URL</string>
    <key>WMS_ENROLL_TOKEN</key>    <string>$WMS_ENROLL_TOKEN</string>
    <key>WMS_STATE_FILE</key>      <string>$STATE_DIR/state.json</string>
    <key>WMS_INTERVAL</key>        <string>10s</string>
  </dict>
  <key>RunAtLoad</key>             <true/>
  <key>KeepAlive</key>             <true/>
  <key>StandardOutPath</key>       <string>/var/log/wms-agent.log</string>
  <key>StandardErrorPath</key>     <string>/var/log/wms-agent.log</string>
</dict>
</plist>
EOF

sudo launchctl load "$PLIST_DIR/$PLIST_LABEL.plist"

echo "==> WMS Agent installed."
echo "    Check status: sudo launchctl list | grep wms"
echo "    View logs:    tail -f /var/log/wms-agent.log"
