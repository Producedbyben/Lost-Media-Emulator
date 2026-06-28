#!/usr/bin/env bash
# Headless Lost Media Emulator render — create assets through the real CPU export pipeline.
# Output is byte-identical to an app export. Emits a single JSON result line on stdout.
#
#   tools/lme-render.sh --list
#   tools/lme-render.sh --in src.png --look "Consumer TV" --out out.png [--width 1280 --height 720 --frame 0]
#   tools/lme-render.sh --in src.png --look look.json --out clip.mp4 --duration 4 --fps 30 [--codec h264]
#
# Prefers the INSTALLED app's self-contained `--lme-render` mode (no repo / node_modules / build
# needed — futureproof). Falls back to the repo dev entry only if the installed app lacks the mode.
#
# A packaged macOS .app is a GUI app: its stdout is NOT reliably delivered to a shell. So we always
# route the JSON result through a `--result-file` and cat THAT to stdout — uniform across both paths.
set -euo pipefail

APP="/Applications/Lost Media Emulator.app/Contents/MacOS/Lost Media Emulator"
RES="/Applications/Lost Media Emulator.app/Contents/Resources"

RESULT="$(mktemp -t lme-render-result.XXXXXX)"
cleanup() { rm -f "$RESULT"; }
trap cleanup EXIT

code=0
# Capability check is GUI-free (a content-sentinel grep, not a launch) so an OLD installed app can't
# pop a window: the marker string only exists inside the bundled lme-render-core.cjs.
if [[ -x "$APP" ]] && grep -qa "LME_HEADLESS_CORE_MARKER_v1" "$RES/app.asar" 2>/dev/null; then
  "$APP" --lme-render "$@" --result-file "$RESULT" >/dev/null 2>&1 || code=$?
else
  # Dev fallback: the repo's Electron + built dist.
  cd "$(dirname "$0")/.."
  [[ -f dist/index.html ]] || { echo "dist not built — running 'npm run build'…" >&2; npm run build >/dev/null; }
  npx electron electron/lme-render.cjs "$@" --result-file "$RESULT" >/dev/null 2>&1 || code=$?
fi

# Emit the JSON result (looks list, or render metadata, or {ok:false,error}) on stdout.
if [[ -s "$RESULT" ]]; then cat "$RESULT"; fi
exit "$code"
