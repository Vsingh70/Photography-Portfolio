#!/usr/bin/env bash
# Build / dev the Tauri .app.
#
# The Tauri binary loads https://vflics.com/studio and signs in to Google
# Drive via the loopback OAuth flow on first launch. No secrets are embedded
# in the binary; nothing needs to be swapped in before building.
#
# Usage:
#   npm run tauri:build
#   npm run tauri:dev

set -euo pipefail

CMD="${1:-build}"   # build | dev
TAURI_DIR="$(cd "$(dirname "$0")/.." && pwd)/src-tauri"

# Ensure Rust is on PATH
if [ -f "$HOME/.cargo/env" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.cargo/env"
fi

cd "$TAURI_DIR/.."
case "$CMD" in
  build) npx tauri build ;;
  dev)   npx tauri dev ;;
  *) echo "unknown command: $CMD"; exit 1 ;;
esac
