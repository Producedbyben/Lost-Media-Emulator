// electron-builder config (env-aware signing).
//
// Default: ad-hoc signed DMG — runs locally, but macOS Gatekeeper flags it as
// "damaged / unidentified" once the file is DOWNLOADED to another Mac (use
// tools/fix-gatekeeper.command to clear it there).
//
// Real fix: set these env vars (requires a paid Apple Developer ID with a
// "Developer ID Application" certificate installed in your login keychain) and
// `npm run dist` will Developer-ID-sign + notarize automatically — no warnings
// anywhere:
//   APPLE_ID                     your Apple account email
//   APPLE_APP_SPECIFIC_PASSWORD  an app-specific password (appleid.apple.com)
//   APPLE_TEAM_ID                your 10-char Developer Team ID
const notarizeReady =
  !!process.env.APPLE_ID &&
  !!process.env.APPLE_APP_SPECIFIC_PASSWORD &&
  !!process.env.APPLE_TEAM_ID;

// Bundle the native ffmpeg/ffprobe binaries only when present, so `npm run dist`
// keeps working before the licensed arm64 binaries are dropped into build/vendor/.
// Without them the desktop export falls back to the WebCodecs path at runtime.
const fs = require("fs");
const path = require("path");
const hasFfmpeg =
  fs.existsSync(path.join(__dirname, "build/vendor/ffmpeg")) &&
  fs.existsSync(path.join(__dirname, "build/vendor/ffprobe"));

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: "uk.co.producedbyben.lostmediaemulator",
  productName: "Lost Media Emulator",
  directories: {
    output: "release",
    buildResources: "build",
  },
  // Only ad-hoc sign in the afterSign hook when we are NOT doing a real,
  // notarized Developer ID signing pass.
  afterSign: notarizeReady ? undefined : "build/afterSign.cjs",
  files: [
    "dist/**/*",
    "electron/main.cjs",
    "electron/preload.cjs",
    "electron/gpu-flags.cjs",
    "electron/ffmpeg-locate.cjs",
    "electron/ffmpeg-args.cjs",
    "electron/ffmpeg-session.cjs",
    "electron/updater.cjs",
    "electron/license.html",
    "electron/license/identity.cjs",
    "electron/license/store.cjs",
    "electron/license/api.cjs",
  ],
  // Auto-update feed: electron-updater generic provider → Cloudflare R2 served at
  // /api/updates/mac (latest-mac.yml + the signed zip), generated on `npm run dist`.
  // NOTE: macOS only APPLIES updates for Developer-ID-signed + notarized builds
  // (see mac.notarize); unsigned builds publish a feed but won't self-apply until
  // Apple signing is configured.
  publish: [
    {
      provider: "generic",
      url: "https://lostmediaemulator.com/api/updates/mac",
      channel: "latest",
    },
  ],
  // Native ffmpeg/ffprobe binaries (arm64) for the export pipeline — bundled only
  // when present (see hasFfmpeg). The afterSign hook ad-hoc signs them.
  extraResources: hasFfmpeg
    ? [
        { from: "build/vendor/ffmpeg", to: "ffmpeg" },
        { from: "build/vendor/ffprobe", to: "ffprobe" },
        // LGPL compliance: ship the license + credits alongside the binary.
        { from: "build/vendor/FFMPEG-COPYING.LGPLv2.1.txt", to: "FFMPEG-COPYING.LGPLv2.1.txt" },
        { from: "build/vendor/FFMPEG-CREDITS.txt", to: "FFMPEG-CREDITS.txt" },
      ]
    : [],
  mac: {
    // dmg = the shop download; zip = what electron-updater/Squirrel.Mac applies.
    target: [
      { target: "dmg", arch: "arm64" },
      { target: "zip", arch: "arm64" },
    ],
    category: "public.app-category.video",
    icon: "build/icon.icns",
    darkModeSupport: true,
    minimumSystemVersion: "11.0",
    // Real signing path: hardened runtime + auto-discovered Developer ID cert +
    // notarization. Fallback path: ad-hoc (identity null), no hardened runtime.
    hardenedRuntime: notarizeReady,
    gatekeeperAssess: false,
    identity: notarizeReady ? undefined : null,
    entitlements: notarizeReady ? "build/entitlements.mac.plist" : undefined,
    entitlementsInherit: notarizeReady ? "build/entitlements.mac.plist" : undefined,
    notarize: notarizeReady ? { teamId: process.env.APPLE_TEAM_ID } : false,
  },
  dmg: {
    title: "Lost Media Emulator",
    backgroundColor: "#0a0a0b",
    window: { width: 540, height: 380 },
    contents: [
      { x: 150, y: 200, type: "file" },
      { x: 390, y: 200, type: "link", path: "/Applications" },
    ],
  },
};
