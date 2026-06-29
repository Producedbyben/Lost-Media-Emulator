#!/usr/bin/env bash
# Safe local install of a Lost Media Emulator build into /Applications.
#
# WHY THIS EXISTS (incident 2026-06-29): the installed app is a SHARED SINGLETON.
# `osascript quit "Lost Media Emulator"` (and pkill) terminate ALL instances —
# INCLUDING headless `--lme-render` processes. An atomic quit+install killed a
# launch-critical in-flight render (its output was lost). This script makes a
# local install safe and repeatable:
#   1. PRE-FLIGHT: refuses to install while an `--lme-render` is active (the exact
#      thing that got killed) — no stale external "go-window" required.
#   2. NEVER quits the app. It `mv`s the old bundle aside and `ditto`s the new one
#      in. Unix inode semantics let any still-running instance finish on the held
#      inode; the NEXT launch (e.g. the next `lme-render.sh` call) uses the new build.
#   3. Backs up the old bundle reversibly (atomic rename).
#   4. Clears the quarantine xattr so headless launches don't hit Gatekeeper.
#   5. Self-verifies the installed CFBundleShortVersionString.
#
# Usage:
#   tools/install-local.sh [--dry-run] [--allow-running] [path/to/build.dmg]
# With no DMG arg, uses the newest release/*.dmg in this repo.
set -euo pipefail

APP_NAME="Lost Media Emulator"
APP="/Applications/$APP_NAME.app"
EXEC_PATH="$APP_NAME.app/Contents/MacOS/$APP_NAME"  # substring that identifies a running instance
RELEASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/release"

DRY_RUN=0
ALLOW_RUNNING=0
DMG=""

usage() { sed -n '2,20p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)       DRY_RUN=1 ;;
    --allow-running) ALLOW_RUNNING=1 ;;
    -h|--help)       usage; exit 0 ;;
    -*)              echo "unknown flag: $1" >&2; exit 64 ;;
    *)               DMG="$1" ;;
  esac
  shift
done

# Default to the newest built DMG in release/.
if [[ -z "$DMG" ]]; then
  DMG="$(ls -t "$RELEASE_DIR"/*.dmg 2>/dev/null | head -1 || true)"
fi
[[ -n "$DMG" && -f "$DMG" ]] || { echo "no DMG found — pass one explicitly (looked in $RELEASE_DIR)" >&2; exit 1; }

# --- PRE-FLIGHT: never install over an active render ---------------------------
RENDER_PIDS="$(pgrep -f "$APP_NAME --lme-render" 2>/dev/null || true)"
if [[ -n "$RENDER_PIDS" ]]; then
  echo "ABORT: an LME --lme-render process is ACTIVE — installing now would kill it:" >&2
  # shellcheck disable=SC2086
  ps -p $RENDER_PIDS -o pid,etime,command 2>/dev/null | sed 1d >&2 || true
  echo "Wait for renders to finish (or stop them deliberately), then re-run." >&2
  exit 2
fi

# A GUI instance with no active render: replacing the bundle won't kill a render,
# but the open window keeps running on the moved bundle until relaunched. Require
# an explicit opt-in so this isn't a surprise.
GUI_PIDS="$(pgrep -f "$EXEC_PATH" 2>/dev/null || true)"
if [[ -n "$GUI_PIDS" && "$ALLOW_RUNNING" -ne 1 ]]; then
  echo "ABORT: $APP_NAME is running (PIDs: $GUI_PIDS) but no render is active." >&2
  echo "Quit the app, or pass --allow-running to replace the bundle WITHOUT quitting" >&2
  echo "(the open window stays on the old copy until you relaunch; new launches get the new build)." >&2
  exit 3
fi
[[ -n "$GUI_PIDS" ]] && echo "note: app is running (no render) and --allow-running is set — replacing bundle without quitting."

# --- plan ----------------------------------------------------------------------
TS="$(date +%Y%m%d-%H%M%S)"
BAK="${TMPDIR:-/tmp}/LME-backup-$TS.app"
echo "DMG    : $DMG"
echo "target : $APP"
echo "backup : $BAK"
if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "(dry-run) pre-flight clear. Would: mv old→backup · mount DMG · ditto new→$APP · clear quarantine · detach · verify version."
  exit 0
fi

# --- backup (atomic rename; NO osascript quit) ---------------------------------
if [[ -d "$APP" ]]; then
  mv "$APP" "$BAK"
  echo "backed up old build → $BAK"
fi

# --- mount + copy --------------------------------------------------------------
MNT="$(hdiutil attach "$DMG" -nobrowse -noverify | grep -o '/Volumes/.*' | head -1)"
[[ -n "$MNT" && -d "$MNT" ]] || { echo "failed to mount $DMG" >&2; exit 4; }
# shellcheck disable=SC2064
trap "hdiutil detach \"$MNT\" >/dev/null 2>&1 || true" EXIT
SRC="$MNT/$APP_NAME.app"
[[ -d "$SRC" ]] || { echo "no '$APP_NAME.app' inside the DMG ($MNT)" >&2; exit 5; }
ditto "$SRC" "$APP"
xattr -dr com.apple.quarantine "$APP" 2>/dev/null || true
hdiutil detach "$MNT" >/dev/null 2>&1 || true
trap - EXIT

# --- verify --------------------------------------------------------------------
VER="$(/usr/libexec/PlistBuddy -c 'Print CFBundleShortVersionString' "$APP/Contents/Info.plist" 2>/dev/null || echo '?')"
echo "✅ installed $APP_NAME $VER  (rollback: rm -rf \"$APP\" && mv \"$BAK\" \"$APP\")"
