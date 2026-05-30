#!/usr/bin/env bash
# Start the full WMS dev stack: API server + Next.js frontend
# Usage: bash dev.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

# ── 1. Kill any leftover processes ──────────────────────────────────────────
echo "→ Stopping any running instances..."
pkill -9 -f "tsx watch"    2>/dev/null || true
pkill -9 -f "next dev"     2>/dev/null || true
pkill -9 -f "next-server"  2>/dev/null || true
lsof -ti :3000 | xargs kill -9 2>/dev/null || true
lsof -ti :4000 | xargs kill -9 2>/dev/null || true
sleep 1

# ── 2. Clear stale Next.js build cache ──────────────────────────────────────
echo "→ Clearing .next cache..."
rm -rf "$ROOT/.next"

# ── 3. Check PostgreSQL ──────────────────────────────────────────────────────
echo "→ Checking database..."
if ! pg_isready -q 2>/dev/null; then
  # Try Homebrew postgres
  PG_CTL=$(find /opt/homebrew/Cellar/postgresql* -name "pg_ctl" 2>/dev/null | head -1)
  if [ -n "$PG_CTL" ]; then
    PG_DATA=$(find /opt/homebrew/var -name "PG_VERSION" 2>/dev/null | head -1 | xargs dirname)
    "$PG_CTL" start -D "$PG_DATA" -l /tmp/postgres.log 2>/dev/null || true
    sleep 2
  fi
fi

# Ensure wms role and DB exist
PSQL=$(find /opt/homebrew/Cellar/postgresql* -name "psql" 2>/dev/null | head -1)
if [ -n "$PSQL" ]; then
  "$PSQL" -U "$USER" postgres -c "CREATE ROLE wms WITH LOGIN PASSWORD 'wms';" 2>/dev/null || true
  "$PSQL" -U "$USER" postgres -c "CREATE DATABASE wms OWNER wms;"              2>/dev/null || true
fi

# ── 4. Run migrations ────────────────────────────────────────────────────────
echo "→ Running migrations..."
cd "$ROOT/server" && node --env-file=.env scripts/migrate.js 2>&1 | tail -3

# ── 5. Start API server ──────────────────────────────────────────────────────
echo "→ Starting API server  (http://localhost:4000)..."
cd "$ROOT/server"
npm run dev > /tmp/wms-server.log 2>&1 &
SERVER_PID=$!

# Wait for server
for i in $(seq 1 20); do
  curl -s http://localhost:4000/health > /dev/null 2>&1 && break
  sleep 0.5
done
curl -s http://localhost:4000/health | grep -q '"ok":true' \
  && echo "  ✓ API server ready" \
  || { echo "  ✗ API server failed — check /tmp/wms-server.log"; cat /tmp/wms-server.log | tail -10; exit 1; }

# ── 6. Start frontend ────────────────────────────────────────────────────────
echo "→ Starting frontend    (http://localhost:3000)..."
cd "$ROOT"
npm run dev > /tmp/wms-frontend.log 2>&1 &
FRONTEND_PID=$!

# Wait for frontend
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null)
  [ "$code" = "200" ] && break
  sleep 1
done
code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null)
[ "$code" = "200" ] \
  && echo "  ✓ Frontend ready" \
  || { echo "  ✗ Frontend failed (HTTP $code) — check /tmp/wms-frontend.log"; cat /tmp/wms-frontend.log | tail -10; exit 1; }

echo ""
echo "┌──────────────────────────────────────────────┐"
echo "│  WorkstationMonSys is running                │"
echo "│                                              │"
echo "│  Frontend  →  http://localhost:3000          │"
echo "│  API       →  http://localhost:4000          │"
echo "│                                              │"
echo "│  Login: admin@wms.local / changeme123        │"
echo "│                                              │"
echo "│  Logs:                                       │"
echo "│    tail -f /tmp/wms-server.log               │"
echo "│    tail -f /tmp/wms-frontend.log             │"
echo "│                                              │"
echo "│  Press Ctrl+C to stop both services          │"
echo "└──────────────────────────────────────────────┘"

# Keep running; kill children on Ctrl+C
trap "echo ''; echo 'Stopping...'; kill $SERVER_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait
