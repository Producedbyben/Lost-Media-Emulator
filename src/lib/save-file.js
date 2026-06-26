// Unified "save with a real dialog" for every exported asset, so the user
// controls the filename and destination instead of files silently landing in
// the Downloads folder.
//
//   • Desktop (Electron): an anchor download, which the main process intercepts
//     via the session 'will-download' event and routes through a native macOS
//     Save panel (see electron/main.cjs). The panel opens pre-filled with the
//     name we pass, lets the user choose the folder, and reveals the saved file
//     in Finder when done.
//   • Web (Chromium): the File System Access API (showSaveFilePicker) opens a
//     real Save dialog with both name and location.
//   • Anything else (or a blocked picker): a normal download using the name.

function anchorDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const isDesktop = () =>
  typeof window !== "undefined" && !!window.desktop && window.desktop.isDesktop === true;

/**
 * Save a Blob, letting the user choose name + destination.
 * @param {Blob} blob
 * @param {string} suggestedName  full filename incl. extension, e.g. "Consumer-TV.mp4"
 * @param {{ mimeType?: string, extension?: string, description?: string }} [opts]
 * @returns {Promise<"saved"|"cancelled">}
 */
export async function saveBlob(blob, suggestedName, opts = {}) {
  // Desktop — the native Save panel is handled by the main-process interceptor.
  if (isDesktop()) {
    anchorDownload(blob, suggestedName);
    return "saved";
  }

  // Web — open a real Save dialog where the browser supports it.
  if (typeof window !== "undefined" && typeof window.showSaveFilePicker === "function") {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: opts.mimeType
          ? [{
              description: opts.description || "File",
              accept: { [opts.mimeType]: ["." + (opts.extension || suggestedName.split(".").pop())] },
            }]
          : undefined,
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return "saved";
    } catch (err) {
      if (err && err.name === "AbortError") return "cancelled";
      // Unsupported / blocked by permissions policy → fall through to download.
    }
  }

  anchorDownload(blob, suggestedName);
  return "saved";
}

/**
 * Turn a user-supplied name into a safe filename carrying exactly one correct
 * extension. Strips path separators and illegal characters, collapses spaces,
 * and falls back to a default when the field is empty.
 * @param {string} name        raw user input (may include or omit the extension)
 * @param {string} extension   without the dot, e.g. "mp4"
 * @param {string} fallback    base name to use when `name` is blank
 * @returns {string}
 */
export function ensureFilename(name, extension, fallback) {
  let base = (name || "")
    .trim()
    .replace(/[/\\:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/\.+$/, "");
  if (!base) base = fallback;
  const ext = extension.toLowerCase();
  if (base.toLowerCase().endsWith("." + ext)) base = base.slice(0, -(ext.length + 1));
  return `${base}.${ext}`;
}
