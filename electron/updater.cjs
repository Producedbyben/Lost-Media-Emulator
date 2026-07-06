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

// --- Interactive check ("Check for Updates…" menu item) ----------------------
// Unlike the silent startup check, every outcome gets a dialog: available,
// up to date, or error. `checking` guards double-invocation while in flight.

// Naive-but-sufficient semver comparison ("1.2.10" > "1.2.9"). Returns true when
// `candidate` is strictly newer than `current`.
function isNewerVersion(candidate, current) {
  const a = String(candidate).split(/[.+-]/).map((n) => parseInt(n, 10) || 0);
  const b = String(current).split(/[.+-]/).map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((a[i] || 0) > (b[i] || 0)) return true;
    if ((a[i] || 0) < (b[i] || 0)) return false;
  }
  return false;
}

let checking = false;

async function checkForUpdatesInteractive(win) {
  if (checking) return; // a check is already in flight — don't stack dialogs
  checking = true;
  const { app, dialog } = require("electron");
  const current = app.getVersion();
  try {
    if (!app.isPackaged) {
      await dialog.showMessageBox(win, {
        type: "info",
        message: "Update checks are unavailable in development builds.",
        detail: `Current version: ${current}`,
      });
      return;
    }

    let autoUpdater;
    try {
      ({ autoUpdater } = require("electron-updater"));
    } catch (e) {
      await dialog.showMessageBox(win, {
        type: "error",
        message: "Couldn't check for updates",
        detail: `The update module is unavailable: ${e.message}`,
      });
      return;
    }

    let result;
    try {
      result = await autoUpdater.checkForUpdates();
    } catch (err) {
      await dialog.showMessageBox(win, {
        type: "error",
        message: "Couldn't check for updates",
        detail:
          (err && err.message ? err.message : String(err)) +
          "\n\nYou can always grab the latest version from lostmediaemulator.com/mac.",
      });
      return;
    }

    const info = result && result.updateInfo;
    const available =
      result && typeof result.isUpdateAvailable === "boolean"
        ? result.isUpdateAvailable
        : !!(info && info.version && isNewerVersion(info.version, current));

    if (available) {
      await dialog.showMessageBox(win, {
        type: "info",
        message: `Lost Media Emulator ${info.version} is available.`,
        detail:
          `You're on ${current}. Unsigned builds can't install updates automatically — ` +
          "download the latest version from lostmediaemulator.com/mac.",
      });
    } else {
      await dialog.showMessageBox(win, {
        type: "info",
        message: "You're up to date.",
        detail: `Lost Media Emulator ${current} is the latest version.`,
      });
    }
  } finally {
    checking = false;
  }
}

module.exports = { initAutoUpdate, checkForUpdatesInteractive };
