#!/bin/bash
# vflics Upload Studio launcher
# Double-click to start the local dev server and open the Studio.
# Ctrl+C the terminal window when you're done.

set -e
cd "$(dirname "$0")/../../app"

# Open the browser ~3s after the dev server starts.
( sleep 3 && open "http://localhost:3000/studio" ) &

# Hand control to next dev — Ctrl+C cleans up the background `open` too.
exec npm run dev
