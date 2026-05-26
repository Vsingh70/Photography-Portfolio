#!/usr/bin/env bash
# Build the Tauri .app with the real auth token baked in.
#
# Tauri 2's --config flag is unreliable — sometimes it overlays correctly,
# sometimes the default tauri.conf.json wins and the placeholder ends up in
# the binary. This script avoids that by swapping the real config into
# place for the duration of the build, then restoring the safe placeholder.
#
# Usage:
#   npm run tauri:build        # uses src-tauri/tauri.conf.local.json
#   npm run tauri:dev          # same, but for dev mode

set -euo pipefail

CMD="${1:-build}"   # build | dev
TAURI_DIR="$(cd "$(dirname "$0")/.." && pwd)/src-tauri"
DEFAULT="$TAURI_DIR/tauri.conf.json"
LOCAL="$TAURI_DIR/tauri.conf.local.json"
BACKUP="$TAURI_DIR/tauri.conf.json.bak"

if [ ! -f "$LOCAL" ]; then
  echo "❌ Missing $LOCAL"
  echo "   Copy tauri.conf.json to tauri.conf.local.json and replace REPLACE_WITH_STUDIO_UPLOAD_TOKEN"
  echo "   with your real STUDIO_UPLOAD_TOKEN value. See src-tauri/README.md."
  exit 1
fi

if grep -q "REPLACE_WITH_STUDIO_UPLOAD_TOKEN" "$LOCAL"; then
  echo "❌ $LOCAL still contains the placeholder REPLACE_WITH_STUDIO_UPLOAD_TOKEN"
  echo "   Replace both occurrences with your real token before building."
  exit 1
fi

# Ensure Rust is on PATH
if [ -f "$HOME/.cargo/env" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.cargo/env"
fi

# Restore is always-run, even on error/interrupt
restore() {
  if [ -f "$BACKUP" ]; then
    mv "$BACKUP" "$DEFAULT"
    echo "↩ restored placeholder tauri.conf.json"
  fi
}
trap restore EXIT INT TERM

cp "$DEFAULT" "$BACKUP"
cp "$LOCAL" "$DEFAULT"
echo "✱ swapped in tauri.conf.local.json (token-bearing)"

# Run Tauri
cd "$TAURI_DIR/.."
case "$CMD" in
  build) npx tauri build ;;
  dev)   npx tauri dev ;;
  *) echo "unknown command: $CMD"; exit 1 ;;
esac
