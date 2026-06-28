#!/usr/bin/env bash
# Headless Lost Media Emulator render — create assets through the real CPU export pipeline.
#
#   tools/lme-render.sh --list
#   tools/lme-render.sh --in src.png --look "Consumer TV" --out out.png [--width 1280 --height 720 --frame 0]
#   tools/lme-render.sh --in src.png --look look.json --out clip.mp4 --duration 4 --fps 30 [--codec h264]
#
# --look: a preset name, a path to an exported look .json, or omitted (clean defaults).
# Output is byte-identical to an app export. Requires a built dist (auto-builds if missing).
set -euo pipefail
cd "$(dirname "$0")/.."

[[ -f dist/index.html ]] || { echo "dist not built — running 'npm run build'…" >&2; npm run build >/dev/null; }

exec npx electron electron/lme-render.cjs "$@"
