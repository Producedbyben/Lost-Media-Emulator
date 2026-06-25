// electron-builder afterSign hook.
// We ship without an Apple Developer identity, so apply a *deep* ad-hoc
// signature to the whole bundle. This seals resources and sets the correct
// bundle identifier, so the app launches cleanly from Finder on Apple Silicon
// (arm64 requires a valid code signature; ad-hoc satisfies it for local use).
const { execFileSync } = require("child_process");
const path = require("path");

exports.default = async function afterSign(context) {
  if (context.electronPlatformName !== "darwin") return;
  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);
  console.log(`[afterSign] deep ad-hoc signing ${appPath}`);
  execFileSync("codesign", ["--deep", "--force", "--sign", "-", appPath], {
    stdio: "inherit",
  });
  execFileSync("codesign", ["--verify", "--deep", "--strict", appPath], {
    stdio: "inherit",
  });
  console.log("[afterSign] signature verified");
};
