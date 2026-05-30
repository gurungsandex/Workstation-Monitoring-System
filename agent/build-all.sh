#!/usr/bin/env bash
# Build agent binaries for all supported platforms.
# Output goes to ../server/binaries/
set -euo pipefail

OUT="$(cd "$(dirname "$0")/../server/binaries" && pwd)"
mkdir -p "$OUT"

targets=(
  "darwin  arm64"
  "darwin  amd64"
  "linux   amd64"
  "linux   arm64"
  "windows amd64"
)

for t in "${targets[@]}"; do
  os=$(echo $t | awk '{print $1}')
  arch=$(echo $t | awk '{print $2}')
  ext=""
  [ "$os" = "windows" ] && ext=".exe"
  name="wms-agent-${os}-${arch}${ext}"
  printf "  building %-36s" "$name"
  GOOS=$os GOARCH=$arch go build -ldflags="-s -w" -o "$OUT/$name" . 2>/dev/null
  echo "✓"
done

echo ""
echo "Binaries written to $OUT"
ls -lh "$OUT"/wms-agent-*
