// Stable per-install device identity. A persisted random UUID (no native
// node-machine-id dependency) stored in userData, surviving relaunches.
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

function getDeviceId(app) {
  const file = path.join(app.getPath("userData"), "device-id");
  try {
    const existing = fs.readFileSync(file, "utf8").trim();
    if (existing) return existing;
  } catch {
    /* not created yet */
  }
  const id = crypto.randomUUID();
  try {
    fs.writeFileSync(file, id, "utf8");
  } catch {
    /* best effort — falls back to a fresh id next launch */
  }
  return id;
}

function getDeviceName() {
  try {
    return os.hostname() || "Mac";
  } catch {
    return "Mac";
  }
}

module.exports = { getDeviceId, getDeviceName };
