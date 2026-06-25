#!/bin/bash
# Double-click this (or run it in Terminal) to make "Lost Media Emulator" open
# without the macOS "damaged / unidentified developer" warning.
#
# Why it's needed: the app is ad-hoc signed, not Apple-notarized (no paid Apple
# Developer ID). macOS flags anything *downloaded* with a quarantine attribute
# and refuses to launch un-notarized apps until that flag is removed. This just
# removes the quarantine flag from the installed app — it does not disable
# Gatekeeper system-wide.
set -e

APP_CANDIDATES=(
  "/Applications/Lost Media Emulator.app"
  "$HOME/Applications/Lost Media Emulator.app"
  "$HOME/Downloads/Lost Media Emulator.app"
)

found=""
for app in "${APP_CANDIDATES[@]}"; do
  if [ -d "$app" ]; then found="$app"; break; fi
done

if [ -z "$found" ]; then
  echo "Couldn't find 'Lost Media Emulator.app'."
  echo "Drag the app to your /Applications folder first, then run this again."
  read -n 1 -s -r -p "Press any key to close."
  exit 1
fi

echo "Clearing quarantine on: $found"
xattr -dr com.apple.quarantine "$found" 2>/dev/null || true
xattr -dr com.apple.provenance "$found" 2>/dev/null || true
echo "Done. You can now open Lost Media Emulator normally."
read -n 1 -s -r -p "Press any key to close."
