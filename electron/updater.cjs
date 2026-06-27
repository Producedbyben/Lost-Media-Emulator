// Mac auto-update via electron-updater (generic provider → Cloudflare R2, served
// at /api/updates/mac). See electron-builder.config.cjs `publish`.
//
// PREREQUISITE: Squirrel.Mac only applies Developer-ID-signed + NOTARIZED builds.
// The current DMG is ad-hoc signed, so update *application* is a silent no-op
// until signing is configured (set APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD /
// APPLE_TEAM_ID and rebuild). We attach an error handler so unsigned builds log
// quietly instead of alarming the user.
let started = false;

function initAutoUpdate(app, log = () => {}) {
  if (started) return;
  started = true;
  if (!app.isPackaged) return; // never in dev
  if (process.env.LME_AUTO_UPDATE === "0") return; // explicit off switch

  let autoUpdater;
  try {
    ({ autoUpdater } = require("electron-updater"));
  } catch (e) {
    log("[update] electron-updater unavailable:", e.message);
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("error", (err) =>
    log("[update] error (expected on unsigned builds):", err && err.message),
  );
  autoUpdater.on("update-available", (i) => log("[update] available:", i && i.version));
  autoUpdater.on("update-not-available", () => log("[update] up to date"));
  autoUpdater.on("update-downloaded", (i) =>
    log("[update] downloaded:", i && i.version, "— installs on quit"),
  );

  try {
    autoUpdater.checkForUpdatesAndNotify();
  } catch (e) {
    log("[update] check failed:", e.message);
  }
}

module.exports = { initAutoUpdate };
