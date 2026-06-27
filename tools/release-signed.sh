#!/usr/bin/env bash
# Build a Developer-ID-signed + notarized release of Lost Media Emulator.
#
#   tools/release-signed.sh   (or: npm run dist:signed)
#
# Loads ./.env.signing, fails fast if the credentials or signing certificate are
# missing (so you never ship an unsigned build thinking it's notarized), then
# runs `npm run dist`. On success it prints the exact R2 push + verify steps.
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE=".env.signing"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "✗ $ENV_FILE not found. Copy .env.signing.example → .env.signing and fill it in." >&2
  echo "  See docs/NOTARIZATION.md for how to get each value." >&2
  exit 1
fi

# Load the credentials into the environment for electron-builder.
set -a; # shellcheck disable=SC1090
source "$ENV_FILE"; set +a

missing=()
[[ -n "${APPLE_ID:-}" ]]                    || missing+=(APPLE_ID)
[[ -n "${APPLE_APP_SPECIFIC_PASSWORD:-}" ]] || missing+=(APPLE_APP_SPECIFIC_PASSWORD)
[[ -n "${APPLE_TEAM_ID:-}" ]]               || missing+=(APPLE_TEAM_ID)
if (( ${#missing[@]} )); then
  echo "✗ Missing in $ENV_FILE: ${missing[*]}" >&2
  exit 1
fi

# A "Developer ID Application" cert MUST be in the keychain — electron-builder
# auto-discovers it. Without it the build would silently fall back to ad-hoc.
if ! security find-identity -v -p codesigning | grep -q "Developer ID Application"; then
  echo "✗ No 'Developer ID Application' certificate in your login keychain." >&2
  echo "  Create/install it first (developer.apple.com → Certificates)." >&2
  echo "  See docs/NOTARIZATION.md." >&2
  exit 1
fi

echo "✓ Credentials loaded, Developer ID cert present — building + notarizing (this calls Apple; allow a few minutes)…"
npm run dist

DMG=$(ls -t "release/"*.dmg 2>/dev/null | head -1 || true)
echo
echo "✓ Notarized build complete: ${DMG:-release/*.dmg}"
echo
echo "Verify the staple:"
echo "  xcrun stapler validate \"$DMG\""
echo "  spctl -a -vvv -t install \"$DMG\"   # expect: accepted, source=Notarized Developer ID"
echo
echo "Then ship to R2 (from ~/Projects/lost-media-emulator-site):"
echo "  ./.claude/skills/lme-r2-release/push.sh dmg \"$PWD/$DMG\""
echo "  ./.claude/skills/lme-r2-release/push.sh update \"$PWD/release\""
echo "  # bump mac.version in versions.json, then:"
echo "  ./.claude/skills/lme-r2-release/push.sh versions versions.json"
