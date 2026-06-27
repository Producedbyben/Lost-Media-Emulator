// License activation persisted as JSON in userData. Written ONLY by the main
// process (never exposed to the renderer for writing) so the gate can't be
// forged from the page. Holds the opaque server token + its `exp` (epoch
// seconds), which is what the offline grace window is keyed off.
const fs = require("fs");
const path = require("path");

function file(app) {
  return path.join(app.getPath("userData"), "license.json");
}

function read(app) {
  try {
    return JSON.parse(fs.readFileSync(file(app), "utf8"));
  } catch {
    return null;
  }
}

function write(app, record) {
  try {
    fs.writeFileSync(file(app), JSON.stringify(record), "utf8");
    return true;
  } catch {
    return false;
  }
}

function clear(app) {
  try {
    fs.unlinkSync(file(app));
  } catch {
    /* already gone */
  }
}

module.exports = { read, write, clear };
