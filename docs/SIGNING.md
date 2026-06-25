# Code signing & Gatekeeper

## Current state (no Apple Developer account)

`npm run dist` produces an **ad-hoc signed** arm64 DMG. It runs fine on the Mac that
built it. But once the DMG is **downloaded or transferred** to another Mac, macOS adds a
quarantine flag and Gatekeeper refuses to open an un-notarized app ("damaged / unidentified
developer").

**Quick fix on any Mac:** run `tools/fix-gatekeeper.command` (double-click, or
`bash fix-gatekeeper.command`). It strips the quarantine flag from the installed app. Or
manually:

```sh
xattr -dr com.apple.quarantine "/Applications/Lost Media Emulator.app"
```

## Real fix (notarized — no warnings anywhere)

Requires a paid **Apple Developer ID** with a *Developer ID Application* certificate in your
login keychain. Then set three env vars and rebuild — the config
(`electron-builder.config.cjs`) auto-switches to Developer-ID signing + notarization:

```sh
export APPLE_ID="you@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"   # appleid.apple.com → App-Specific Passwords
export APPLE_TEAM_ID="ABCDE12345"                          # 10-char Team ID
npm run dist
```

That path enables the hardened runtime, signs with your cert + `build/entitlements.mac.plist`,
and notarizes via Apple's notarytool. The resulting DMG opens with no Gatekeeper prompt on any
Mac. No env vars set → falls back to the ad-hoc build above.
