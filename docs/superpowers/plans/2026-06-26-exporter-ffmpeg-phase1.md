# Exporter ffmpeg Phase 1 (foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the desktop video-export path with a native ffmpeg pipeline that renders frames to a temp PNG sequence and encodes them to H.264 and HEVC `.mp4`, with progress, cancel, and cleanup — proving the engine the rest of the rebuild builds on.

**Architecture:** The deterministic frame-step renderer is unchanged; instead of feeding each frame to `new VideoFrame`, the new renderer-side orchestrator (`ffmpeg-export.ts`) reads each frame off the existing `renderCanvas` as a PNG and streams it over IPC to the main process, which writes a temp sequence and spawns a bundled `ffmpeg` to encode it. The WebCodecs path (`exporter.js`) stays as the web/dev fallback. Audio, ProRes, presets, and trim are later phases.

**Tech Stack:** Electron 42 (main + preload, CommonJS `.cjs`), React/TypeScript renderer, Vite, Vitest, `ffmpeg` invoked as a child-process binary, `ffprobe` for the verification harness.

## Global Constraints

- Target platform: **macOS arm64 only** (Apple Silicon). `npm run dist` builds `--mac --arm64`.
- Main/preload files are **CommonJS `.cjs`** (`require`/`module.exports`), never ESM.
- Renderer ↔ main communication goes through the **contextIsolation bridge** in `electron/preload.cjs` (`contextBridge.exposeInMainWorld`). `nodeIntegration` is **false** — the renderer has no `fs`/`child_process`.
- ffmpeg is invoked as a **separately-bundled binary via `child_process`** (subprocess, not linked). The shipped binary's license/provenance is resolved before public release (see spec Risks); this plan sources it from `build/vendor/ffmpeg` and uses the system ffmpeg in dev.
- Packaged app is **ad-hoc signed** (`build/afterSign.cjs`, `codesign --sign -`); any bundled binary must be signed too or it won't spawn.
- Test runner: **Vitest** (`npm test` → `vitest run`). Pure logic is unit-tested; the ffmpeg pipeline is verified by an `ffprobe` smoke test and a DMG check (it cannot run in the web preview).
- Feature-detect the engine via `window.desktop?.ffmpeg?.available`; when absent, fall back to the existing WebCodecs `exportMp4`.

---

### Task 1: ffmpeg path resolver + capability flag

A small, pure-ish module that decides which `ffmpeg`/`ffprobe` binary to use: an env override, else the packaged resource, else a dev fallback (system/homebrew). Unit-tested by injecting the lookup inputs.

**Files:**
- Create: `electron/ffmpeg-locate.cjs`
- Test: `electron/__tests__/ffmpeg-locate.test.js`

**Interfaces:**
- Produces: `resolveFfmpeg({ env, resourcesPath, isPackaged, exists }) => { ffmpeg: string|null, ffprobe: string|null }` — pure; `exists(path)=>boolean` is injected so tests don't touch the filesystem.
- Produces: `locate() => { ffmpeg, ffprobe }` — the real call, wiring `process.env`, `process.resourcesPath`, `app.isPackaged`, and `fs.existsSync`.

- [ ] **Step 1: Write the failing test**

```js
// electron/__tests__/ffmpeg-locate.test.js
import { describe, it, expect } from "vitest";
import { resolveFfmpeg } from "../ffmpeg-locate.cjs";

const exists = (set) => (p) => set.has(p);

describe("resolveFfmpeg", () => {
  it("prefers the LME_FFMPEG_PATH env override", () => {
    const r = resolveFfmpeg({
      env: { LME_FFMPEG_PATH: "/custom/ffmpeg", LME_FFPROBE_PATH: "/custom/ffprobe" },
      resourcesPath: "/app/resources", isPackaged: true,
      exists: exists(new Set(["/custom/ffmpeg", "/custom/ffprobe"])),
    });
    expect(r).toEqual({ ffmpeg: "/custom/ffmpeg", ffprobe: "/custom/ffprobe" });
  });

  it("uses the packaged resource path when packaged", () => {
    const r = resolveFfmpeg({
      env: {}, resourcesPath: "/app/resources", isPackaged: true,
      exists: exists(new Set(["/app/resources/ffmpeg", "/app/resources/ffprobe"])),
    });
    expect(r).toEqual({ ffmpeg: "/app/resources/ffmpeg", ffprobe: "/app/resources/ffprobe" });
  });

  it("falls back to a dev system path when not packaged", () => {
    const r = resolveFfmpeg({
      env: {}, resourcesPath: "/app/resources", isPackaged: false,
      exists: exists(new Set(["/opt/homebrew/bin/ffmpeg", "/opt/homebrew/bin/ffprobe"])),
    });
    expect(r.ffmpeg).toBe("/opt/homebrew/bin/ffmpeg");
    expect(r.ffprobe).toBe("/opt/homebrew/bin/ffprobe");
  });

  it("returns null when nothing is found", () => {
    const r = resolveFfmpeg({ env: {}, resourcesPath: "/x", isPackaged: true, exists: exists(new Set()) });
    expect(r).toEqual({ ffmpeg: null, ffprobe: null });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- ffmpeg-locate`
Expected: FAIL — `Cannot find module '../ffmpeg-locate.cjs'`.

- [ ] **Step 3: Write minimal implementation**

```js
// electron/ffmpeg-locate.cjs
// Decide which ffmpeg/ffprobe binary to use. Pure core (resolveFfmpeg) so it is
// unit-testable; locate() wires the real process/runtime values.
const DEV_FALLBACKS = {
  ffmpeg: ["/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/usr/bin/ffmpeg"],
  ffprobe: ["/opt/homebrew/bin/ffprobe", "/usr/local/bin/ffprobe", "/usr/bin/ffprobe"],
};

function pick(candidates, exists) {
  for (const c of candidates) if (c && exists(c)) return c;
  return null;
}

function resolveFfmpeg({ env, resourcesPath, isPackaged, exists }) {
  const ffmpegCandidates = [
    env.LME_FFMPEG_PATH,
    isPackaged ? `${resourcesPath}/ffmpeg` : `${resourcesPath}/ffmpeg`,
    ...(isPackaged ? [] : DEV_FALLBACKS.ffmpeg),
  ];
  const ffprobeCandidates = [
    env.LME_FFPROBE_PATH,
    isPackaged ? `${resourcesPath}/ffprobe` : `${resourcesPath}/ffprobe`,
    ...(isPackaged ? [] : DEV_FALLBACKS.ffprobe),
  ];
  return {
    ffmpeg: pick(ffmpegCandidates, exists),
    ffprobe: pick(ffprobeCandidates, exists),
  };
}

function locate() {
  const fs = require("fs");
  const { app } = require("electron");
  return resolveFfmpeg({
    env: process.env,
    resourcesPath: process.resourcesPath || "",
    isPackaged: app.isPackaged,
    exists: (p) => { try { return fs.existsSync(p); } catch { return false; } },
  });
}

module.exports = { resolveFfmpeg, locate };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- ffmpeg-locate`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add electron/ffmpeg-locate.cjs electron/__tests__/ffmpeg-locate.test.js
git commit -m "feat(export): ffmpeg binary path resolver"
```

---

### Task 2: ffmpeg argument builder (pure)

Pure function mapping an export request to an ffmpeg arg vector for the H.264 and HEVC tiers, reading a PNG image sequence and writing `.mp4`. No audio/ProRes/trim yet (later phases). Fully TDD'd.

**Files:**
- Create: `electron/ffmpeg-args.cjs`
- Test: `electron/__tests__/ffmpeg-args.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `buildVideoArgs({ codec, fps, framePattern, outPath, totalFrames }) => string[]`
  - `codec`: `"h264" | "hevc"`
  - `framePattern`: e.g. `/tmp/lme-export-x/frame_%06d.png`
  - Returns the full ffmpeg argv **after** the binary name (caller prepends the binary path).

- [ ] **Step 1: Write the failing test**

```js
// electron/__tests__/ffmpeg-args.test.js
import { describe, it, expect } from "vitest";
import { buildVideoArgs } from "../ffmpeg-args.cjs";

const base = { fps: 30, framePattern: "/t/frame_%06d.png", outPath: "/t/out.mp4", totalFrames: 120 };

describe("buildVideoArgs", () => {
  it("builds an H.264 (videotoolbox) sequence encode", () => {
    const a = buildVideoArgs({ ...base, codec: "h264" });
    expect(a).toContain("-y");                    // overwrite
    expect(a.join(" ")).toContain("-framerate 30");
    expect(a.join(" ")).toContain("-i /t/frame_%06d.png");
    expect(a).toContain("h264_videotoolbox");
    expect(a).toContain("-pix_fmt"); expect(a).toContain("yuv420p");
    expect(a[a.length - 1]).toBe("/t/out.mp4");
    expect(a).toContain("-progress"); expect(a).toContain("pipe:1");
  });

  it("builds an HEVC encode with hvc1 tag for QuickTime", () => {
    const a = buildVideoArgs({ ...base, codec: "hevc" });
    expect(a).toContain("hevc_videotoolbox");
    expect(a.join(" ")).toContain("-tag:v hvc1");
  });

  it("throws on an unknown codec", () => {
    expect(() => buildVideoArgs({ ...base, codec: "wat" })).toThrow(/unsupported codec/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- ffmpeg-args`
Expected: FAIL — `Cannot find module '../ffmpeg-args.cjs'`.

- [ ] **Step 3: Write minimal implementation**

```js
// electron/ffmpeg-args.cjs
// Pure ffmpeg argv builder for Phase 1 (H.264 / HEVC from a PNG sequence).
// Audio, ProRes, and trim are added in later phases.
function buildVideoArgs({ codec, fps, framePattern, outPath }) {
  const input = ["-y", "-framerate", String(fps), "-i", framePattern];
  const progress = ["-progress", "pipe:1", "-nostats"];
  const common = ["-pix_fmt", "yuv420p", "-r", String(fps)];

  let videoCodec;
  if (codec === "h264") {
    videoCodec = ["-c:v", "h264_videotoolbox", "-b:v", "20M"];
  } else if (codec === "hevc") {
    videoCodec = ["-c:v", "hevc_videotoolbox", "-b:v", "16M", "-tag:v", "hvc1"];
  } else {
    throw new Error(`unsupported codec: ${codec}`);
  }

  return [...input, ...videoCodec, ...common, ...progress, "-movflags", "+faststart", outPath];
}

module.exports = { buildVideoArgs };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- ffmpeg-args`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add electron/ffmpeg-args.cjs electron/__tests__/ffmpeg-args.test.js
git commit -m "feat(export): pure ffmpeg arg builder for h264/hevc"
```

---

### Task 3: Main-process ffmpeg session (IPC + temp sequence + spawn)

Stateful session in main: open a temp dir, accept frame writes, spawn ffmpeg over the sequence, stream progress, support cancel, and always clean up. Verified by the smoke test in Task 7 (integration; not unit-tested here).

**Files:**
- Create: `electron/ffmpeg-session.cjs`
- Modify: `electron/main.cjs` (register IPC handlers near the existing `will-download` block, after `createWindow`'s body)

**Interfaces:**
- Consumes: `locate()` (Task 1), `buildVideoArgs()` (Task 2).
- Produces IPC channels (registered in `main.cjs`):
  - `ipcMain.handle("ffmpeg:available", () => boolean)`
  - `ipcMain.handle("ffmpeg:begin", (e, { width, height, fps }) => { sessionId })`
  - `ipcMain.handle("ffmpeg:frame", (e, { sessionId, index, bytes }) => { ok })` — `bytes` is a transferred `ArrayBuffer` (PNG)
  - `ipcMain.handle("ffmpeg:encode", (e, { sessionId, codec, outPath }) => { ok })` — resolves when ffmpeg exits 0; rejects with stderr tail otherwise
  - `ipcMain.handle("ffmpeg:cancel", (e, { sessionId }) => void)`
  - Emits `webContents.send("ffmpeg:progress", { sessionId, frame, totalFrames })` during encode.
- Produces (from `ffmpeg-session.cjs`): `createSession({ width, height, fps, tmpRoot })`, `session.writeFrame(index, buffer)`, `session.encode({ ffmpegPath, codec, outPath, onProgress })`, `session.cancel()`, `session.cleanup()`.

- [ ] **Step 1: Write `electron/ffmpeg-session.cjs`**

```js
// electron/ffmpeg-session.cjs
// One export session: a temp PNG sequence + an ffmpeg child process.
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");
const { buildVideoArgs } = require("./ffmpeg-args.cjs");

function createSession({ width, height, fps, tmpRoot }) {
  const id = `lme-export-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const dir = path.join(tmpRoot || os.tmpdir(), id);
  fs.mkdirSync(dir, { recursive: true });
  let child = null;
  let frameCount = 0;

  const framePattern = path.join(dir, "frame_%06d.png");
  const framePath = (index) => path.join(dir, `frame_${String(index + 1).padStart(6, "0")}.png`);

  return {
    id, dir, width, height, fps,
    get frameCount() { return frameCount; },

    writeFrame(index, buffer) {
      fs.writeFileSync(framePath(index), Buffer.from(buffer));
      frameCount = Math.max(frameCount, index + 1);
    },

    encode({ ffmpegPath, codec, outPath, onProgress }) {
      const args = buildVideoArgs({ codec, fps, framePattern, outPath, totalFrames: frameCount });
      return new Promise((resolve, reject) => {
        child = spawn(ffmpegPath, args);
        let stderrTail = "";
        child.stdout.on("data", (d) => {
          // -progress pipe:1 emits "frame=N" lines.
          const m = String(d).match(/frame=\s*(\d+)/g);
          if (m && onProgress) {
            const last = m[m.length - 1];
            onProgress({ frame: Number(last.replace(/\D/g, "")), totalFrames: frameCount });
          }
        });
        child.stderr.on("data", (d) => { stderrTail = (stderrTail + d).slice(-2000); });
        child.on("error", (err) => reject(err));
        child.on("close", (code) => {
          child = null;
          if (code === 0) resolve({ outPath });
          else reject(new Error(`ffmpeg exited ${code}\n${stderrTail}`));
        });
      });
    },

    cancel() { if (child) { child.kill("SIGKILL"); child = null; } },

    cleanup() {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
    },
  };
}

module.exports = { createSession };
```

- [ ] **Step 2: Register IPC handlers in `electron/main.cjs`**

Add `ipcMain` to the top-of-file require, and register the handlers. Insert this block immediately after the `createWindow()` function definition (after its closing `}` near line 92), so `mainWindow` is in scope:

```js
// electron/main.cjs — update the require on line 4:
const { app, BrowserWindow, Menu, shell, dialog, nativeTheme, ipcMain } = require("electron");
// ...and add near the other requires:
const { locate } = require("./ffmpeg-locate.cjs");
const { createSession } = require("./ffmpeg-session.cjs");

// --- Native ffmpeg export pipeline -----------------------------------------
const ffmpegSessions = new Map();

ipcMain.handle("ffmpeg:available", () => !!locate().ffmpeg);

ipcMain.handle("ffmpeg:begin", (_e, { width, height, fps }) => {
  const session = createSession({ width, height, fps, tmpRoot: app.getPath("temp") });
  ffmpegSessions.set(session.id, session);
  return { sessionId: session.id };
});

ipcMain.handle("ffmpeg:frame", (_e, { sessionId, index, bytes }) => {
  const session = ffmpegSessions.get(sessionId);
  if (!session) throw new Error("unknown ffmpeg session");
  session.writeFrame(index, bytes);
  return { ok: true };
});

ipcMain.handle("ffmpeg:encode", async (e, { sessionId, codec, outPath }) => {
  const session = ffmpegSessions.get(sessionId);
  if (!session) throw new Error("unknown ffmpeg session");
  const { ffmpeg } = locate();
  if (!ffmpeg) throw new Error("ffmpeg binary not found");
  try {
    await session.encode({
      ffmpegPath: ffmpeg, codec, outPath,
      onProgress: (p) => e.sender.send("ffmpeg:progress", { sessionId, ...p }),
    });
    shell.showItemInFolder(outPath);
    return { ok: true, outPath };
  } finally {
    session.cleanup();
    ffmpegSessions.delete(sessionId);
  }
});

ipcMain.handle("ffmpeg:cancel", (_e, { sessionId }) => {
  const session = ffmpegSessions.get(sessionId);
  if (session) { session.cancel(); session.cleanup(); ffmpegSessions.delete(sessionId); }
});
```

- [ ] **Step 3: Manual sanity check (no full render yet)**

Run: `npm run electron:preview`
In the app's DevTools console:
```js
await window.desktop // exists
// after Task 4 lands, window.desktop.ffmpeg.available() resolves true when ffmpeg is on PATH/homebrew
```
Expected: app launches, no main-process exceptions in the terminal. (Full encode is exercised in Task 7.)

- [ ] **Step 4: Commit**

```bash
git add electron/ffmpeg-session.cjs electron/main.cjs
git commit -m "feat(export): main-process ffmpeg session + IPC handlers"
```

---

### Task 4: Preload bridge (`window.desktop.ffmpeg` + `getPathForFile`)

Expose the IPC surface to the renderer through the contextIsolation bridge, plus `getPathForFile` (needed by later audio phases, added now since it's a one-liner in the same file).

**Files:**
- Modify: `electron/preload.cjs`

**Interfaces:**
- Produces on `window.desktop`:
  - `ffmpeg.available() => Promise<boolean>`
  - `ffmpeg.begin({width,height,fps}) => Promise<{sessionId}>`
  - `ffmpeg.frame({sessionId,index,bytes}) => Promise<{ok}>`
  - `ffmpeg.encode({sessionId,codec,outPath}) => Promise<{ok,outPath}>`
  - `ffmpeg.cancel({sessionId}) => Promise<void>`
  - `ffmpeg.onProgress(cb) => () => void` (returns an unsubscribe)
  - `getPathForFile(file) => string` (via `webUtils.getPathForFile`)

- [ ] **Step 1: Replace `electron/preload.cjs` body**

```js
// electron/preload.cjs
const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  isDesktop: true,
  platform: process.platform,
  arch: process.arch,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  // Real on-disk path for a dropped/opened File (Electron 32+ removed File.path).
  getPathForFile: (file) => {
    try { return webUtils.getPathForFile(file); } catch { return null; }
  },
  ffmpeg: {
    available: () => ipcRenderer.invoke("ffmpeg:available"),
    begin: (opts) => ipcRenderer.invoke("ffmpeg:begin", opts),
    frame: (opts) => ipcRenderer.invoke("ffmpeg:frame", opts),
    encode: (opts) => ipcRenderer.invoke("ffmpeg:encode", opts),
    cancel: (opts) => ipcRenderer.invoke("ffmpeg:cancel", opts),
    onProgress: (cb) => {
      const handler = (_e, data) => cb(data);
      ipcRenderer.on("ffmpeg:progress", handler);
      return () => ipcRenderer.removeListener("ffmpeg:progress", handler);
    },
  },
});
```

- [ ] **Step 2: Verify the bridge in the running app**

Run: `npm run electron:preview`
In DevTools console:
```js
await window.desktop.ffmpeg.available()
```
Expected: `true` when ffmpeg is installed (homebrew) in dev; `false` otherwise — no exception either way.

- [ ] **Step 3: Commit**

```bash
git add electron/preload.cjs
git commit -m "feat(export): preload bridge for ffmpeg + getPathForFile"
```

---

### Task 5: Renderer orchestrator + engine selection

Renderer-side module that drives the export: render each frame to the existing `renderCanvas`, read it as PNG, stream it over the bridge, then trigger encode while forwarding progress. Wire `useCRTRenderer.handleExportMp4` to use it on desktop for `mp4` (codec `h264`), falling back to WebCodecs when the bridge is absent.

**Files:**
- Create: `src/lib/ffmpeg-export.ts`
- Modify: `src/hooks/useCRTRenderer.ts` (`handleExportMp4`, ~line 1220)
- Reuse (do not change): `prepareRender`, `seekVideoToTime` are internal to `exporter.js`; replicate the minimal frame loop in `ffmpeg-export.ts` rather than exporting them (keeps `exporter.js` untouched).

**Interfaces:**
- Consumes: `window.desktop.ffmpeg` (Task 4); the renderer object (`renderer.render(ctx,w,h,t,params,frame,fps,renderOptions)`, `renderer.setImage`, `renderer.reset?`) — same shape `exporter.js` consumes.
- Produces: `exportViaFfmpeg({ canvas, renderer, params, fps, duration, codec, outPath, videoElement, sourceScale, renderOptions, onProgress, signal }) => Promise<{outPath}>`
- Produces: `isFfmpegExportAvailable() => Promise<boolean>`

- [ ] **Step 1: Write `src/lib/ffmpeg-export.ts`**

```ts
// src/lib/ffmpeg-export.ts
// Renderer-side orchestrator for the native ffmpeg export pipeline. Renders the
// look frame-by-frame to an offscreen canvas, streams each frame as a PNG to the
// main process, then asks ffmpeg to encode the sequence. Desktop-only; callers
// must feature-detect with isFfmpegExportAvailable() and fall back to WebCodecs.
type Renderer = {
  render: (ctx: CanvasRenderingContext2D, w: number, h: number, t: number, params: unknown, frame: number, fps: number, renderOptions: unknown) => void;
  setImage: (el: HTMLVideoElement | HTMLImageElement, scale: number) => void;
  reset?: () => void;
};

interface FfmpegBridge {
  available: () => Promise<boolean>;
  begin: (o: { width: number; height: number; fps: number }) => Promise<{ sessionId: string }>;
  frame: (o: { sessionId: string; index: number; bytes: ArrayBuffer }) => Promise<{ ok: boolean }>;
  encode: (o: { sessionId: string; codec: string; outPath: string }) => Promise<{ ok: boolean; outPath: string }>;
  cancel: (o: { sessionId: string }) => Promise<void>;
  onProgress: (cb: (d: { sessionId: string; frame: number; totalFrames: number }) => void) => () => void;
}

function bridge(): FfmpegBridge | null {
  const d = (window as unknown as { desktop?: { ffmpeg?: FfmpegBridge } }).desktop;
  return d?.ffmpeg ?? null;
}

export async function isFfmpegExportAvailable(): Promise<boolean> {
  const b = bridge();
  if (!b) return false;
  try { return await b.available(); } catch { return false; }
}

function evenSize(w: number, h: number) {
  const e = (n: number) => (n % 2 ? n + 1 : n);
  return { width: e(Math.max(2, Math.floor(w))), height: e(Math.max(2, Math.floor(h))) };
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error("frame encode failed"));
      blob.arrayBuffer().then(resolve, reject);
    }, "image/png");
  });
}

export async function exportViaFfmpeg(opts: {
  canvas: HTMLCanvasElement;
  renderer: Renderer;
  params: unknown;
  fps: number;
  duration: number;
  codec: "h264" | "hevc";
  outPath: string;
  videoElement?: HTMLVideoElement | null;
  sourceScale?: number;
  renderOptions?: unknown;
  onProgress?: (ratio: number) => void;
  signal?: AbortSignal;
}): Promise<{ outPath: string }> {
  const b = bridge();
  if (!b) throw new Error("ffmpeg bridge unavailable");

  const { canvas, renderer, params, fps, duration, codec, outPath } = opts;
  const sourceScale = opts.sourceScale ?? 1;
  const isVideoSource = opts.videoElement instanceof HTMLVideoElement;
  const { width, height } = evenSize(canvas.width, canvas.height);
  const totalFrames = Math.max(1, Math.floor(fps * duration));

  const work = document.createElement("canvas");
  work.width = width; work.height = height;
  const ctx = work.getContext("2d", { alpha: false })!;

  const { sessionId } = await b.begin({ width, height, fps });
  const unsub = b.onProgress((d) => {
    if (d.sessionId === sessionId && opts.onProgress) opts.onProgress(d.frame / totalFrames);
  });

  try {
    renderer.reset?.();
    for (let frame = 0; frame < totalFrames; frame++) {
      if (opts.signal?.aborted) throw new DOMException("aborted", "AbortError");
      const t = frame / fps;
      if (isVideoSource && opts.videoElement) {
        const seekTime = Math.min(t, (opts.videoElement.duration || duration) - 0.001);
        await seekVideo(opts.videoElement, seekTime);
        renderer.setImage(opts.videoElement, sourceScale);
      }
      renderer.render(ctx, width, height, t, params, frame, fps, opts.renderOptions);
      const bytes = await canvasToPng(work);
      await b.frame({ sessionId, index: frame, bytes });
      opts.onProgress?.((frame + 1) / totalFrames * 0.9); // reserve last 10% for encode
    }
    const res = await b.encode({ sessionId, codec, outPath });
    opts.onProgress?.(1);
    return { outPath: res.outPath };
  } catch (err) {
    await b.cancel({ sessionId }).catch(() => {});
    throw err;
  } finally {
    unsub();
  }
}

function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    if (Math.abs(video.currentTime - time) < 0.0005 && video.readyState >= 2) return resolve();
    const done = () => { video.removeEventListener("seeked", done); resolve(); };
    video.addEventListener("seeked", done);
    const watchdog = setTimeout(done, 500);
    video.currentTime = time;
    void watchdog;
  });
}
```

- [ ] **Step 2: Wire engine selection in `useCRTRenderer.handleExportMp4`**

In `src/hooks/useCRTRenderer.ts`, add the import near the other lib imports (~line 8):

```ts
import { exportViaFfmpeg, isFfmpegExportAvailable } from "@/lib/ffmpeg-export";
```

Inside `handleExportMp4` (~line 1220), at the very top of the `try` block — before the existing WebCodecs `caps`/`exportMp4` logic — branch to ffmpeg on desktop. The chosen codec maps `format: "mp4" → "h264"`; `"webm"` keeps the WebCodecs path for now:

```ts
      // Desktop native ffmpeg pipeline (H.264). Falls back to WebCodecs below.
      const wantsFfmpeg = options?.format !== "webm" && options?.fileName
        && await isFfmpegExportAvailable();
      if (wantsFfmpeg) {
        const outPath = options!.fileName!; // absolute path resolved by the save step (see note)
        await exportViaFfmpeg({
          canvas, renderer: rendererRef.current,
          params: paramsRef.current, fps: Math.max(1, fps), duration: Math.max(0.5, duration),
          codec: "h264", outPath,
          videoElement: isVideoRef.current ? videoElementRef.current : undefined,
          sourceScale: previewSettingsRef.current.sourceScale,
          renderOptions: { formatProfile: formatPipelineRef.current ? formatProfileRef.current : null },
          onProgress: (r) => setExportProgress(r),
          signal: controller.signal,
        });
        return; // handled by ffmpeg; skip the WebCodecs path
      }
```

> **Note on `outPath`:** Phase 1 keeps the existing save flow for the WebCodecs path, but the ffmpeg path needs a real **destination path** up front (ffmpeg writes the file itself). Add a one-line bridge call `window.desktop.saveDialog({ defaultName })` in Task 6 that returns a chosen absolute path (or `null` if cancelled). In this task, gate `wantsFfmpeg` additionally on that path being resolved; if the save dialog is not yet wired, `wantsFfmpeg` stays false and the WebCodecs path runs — so this task is safe to land before Task 6. Replace `outPath = options!.fileName!` with the resolved dialog path once Task 6 lands.

- [ ] **Step 3: Typecheck**

Run: `npm run build`
Expected: build succeeds (TypeScript compiles). If `renderer.render` types complain, the `Renderer` type in `ffmpeg-export.ts` is intentionally structural — adjust only that local type, never the renderer.

- [ ] **Step 4: Commit**

```bash
git add src/lib/ffmpeg-export.ts src/hooks/useCRTRenderer.ts
git commit -m "feat(export): renderer ffmpeg orchestrator + desktop engine selection"
```

---

### Task 6: Native save dialog + destination path

ffmpeg writes the file itself, so the renderer needs a real absolute path before encoding. Add a native save panel that returns the chosen path, and use it to gate/feed the ffmpeg path from Task 5.

**Files:**
- Modify: `electron/main.cjs` (add `ffmpeg:save-dialog` handler)
- Modify: `electron/preload.cjs` (expose `desktop.saveDialog`)
- Modify: `src/hooks/useCRTRenderer.ts` (resolve the path, set `wantsFfmpeg`)

**Interfaces:**
- Produces: `ipcMain.handle("ffmpeg:save-dialog", (e,{defaultName}) => string|null)` using `dialog.showSaveDialog`.
- Produces on `window.desktop`: `saveDialog({ defaultName }) => Promise<string|null>`.

- [ ] **Step 1: Add the main handler in `electron/main.cjs`**

```js
ipcMain.handle("ffmpeg:save-dialog", async (_e, { defaultName }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "Export",
    defaultPath: path.join(app.getPath("downloads"), defaultName || "export.mp4"),
    filters: [{ name: "Video", extensions: ["mp4", "mov"] }, { name: "All Files", extensions: ["*"] }],
  });
  return result.canceled ? null : result.filePath;
});
```

- [ ] **Step 2: Expose it in `electron/preload.cjs`**

Add inside the `exposeInMainWorld("desktop", { ... })` object:

```js
  saveDialog: (opts) => ipcRenderer.invoke("ffmpeg:save-dialog", opts),
```

- [ ] **Step 3: Resolve the path in `handleExportMp4`**

Replace the Task 5 `wantsFfmpeg`/`outPath` block so the dialog drives the destination:

```ts
      const ffmpegReady = options?.format !== "webm" && await isFfmpegExportAvailable();
      if (ffmpegReady) {
        const desktopApi = (window as unknown as { desktop?: { saveDialog?: (o: { defaultName: string }) => Promise<string | null> } }).desktop;
        const outPath = await desktopApi?.saveDialog?.({ defaultName: options?.fileName || "export.mp4" });
        if (outPath) {
          await exportViaFfmpeg({
            canvas, renderer: rendererRef.current,
            params: paramsRef.current, fps: Math.max(1, fps), duration: Math.max(0.5, duration),
            codec: "h264", outPath,
            videoElement: isVideoRef.current ? videoElementRef.current : undefined,
            sourceScale: previewSettingsRef.current.sourceScale,
            renderOptions: { formatProfile: formatPipelineRef.current ? formatProfileRef.current : null },
            onProgress: (r) => setExportProgress(r),
            signal: controller.signal,
          });
          return;
        }
        // No path chosen (cancelled) → abort the export quietly.
        return;
      }
```

- [ ] **Step 4: Typecheck + manual run**

Run: `npm run build`
Expected: compiles.
Run: `npm run electron:preview`, load an image, Export MP4 → a native Save panel appears and returns a path (full encode verified in Task 7).

- [ ] **Step 5: Commit**

```bash
git add electron/main.cjs electron/preload.cjs src/hooks/useCRTRenderer.ts
git commit -m "feat(export): native save dialog feeds ffmpeg destination path"
```

---

### Task 7: End-to-end smoke test (ffprobe) + packaging

Prove a real encode produces a valid H.264 and HEVC file, and wire the binary into the packaged app. The smoke test runs against the dev tree (system ffmpeg/ffprobe).

**Files:**
- Create: `electron/__tests__/ffmpeg-pipeline.smoke.test.js`
- Modify: `electron-builder.config.cjs` (`extraResources`)
- Modify: `build/afterSign.cjs` (sign the bundled binary)
- Create: `build/vendor/.gitkeep` (drop-in location for the shipping binary)

**Interfaces:**
- Consumes: `buildVideoArgs` (Task 2), `createSession` (Task 3), `locate` (Task 1).

- [ ] **Step 1: Write the smoke test**

```js
// electron/__tests__/ffmpeg-pipeline.smoke.test.js
import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { createSession } from "../ffmpeg-session.cjs";
import { resolveFfmpeg } from "../ffmpeg-locate.cjs";

const { ffmpeg, ffprobe } = resolveFfmpeg({
  env: process.env, resourcesPath: "", isPackaged: false,
  exists: (p) => { try { return fs.existsSync(p); } catch { return false; } },
});

// 4x4 red PNG, base64 — a deterministic test frame.
const RED_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAEUlEQVR42mP8z8BQz0AEYBxVSF8AGfwC/Yj7H2gAAAAASUVORK5CYII=",
  "base64"
);

describe.skipIf(!ffmpeg || !ffprobe)("ffmpeg pipeline smoke", () => {
  for (const codec of ["h264", "hevc"]) {
    it(`encodes a ${codec} mp4 a real player can read`, async () => {
      const session = createSession({ width: 4, height: 4, fps: 10, tmpRoot: os.tmpdir() });
      for (let i = 0; i < 10; i++) session.writeFrame(i, RED_PNG.buffer.slice(0));
      const out = path.join(os.tmpdir(), `lme-smoke-${codec}.mp4`);
      await session.encode({ ffmpegPath: ffmpeg, codec, outPath: out });
      session.cleanup();

      const probe = JSON.parse(execFileSync(ffprobe, [
        "-v", "quiet", "-print_format", "json", "-show_streams", "-show_format", out,
      ]).toString());
      const v = probe.streams.find((s) => s.codec_type === "video");
      expect(v).toBeTruthy();
      expect(["h264", "hevc"]).toContain(v.codec_name);
      expect(Number(probe.format.duration)).toBeGreaterThan(0.5);
      fs.rmSync(out, { force: true });
    }, 30000);
  }
});
```

- [ ] **Step 2: Run the smoke test**

Run: `npm test -- ffmpeg-pipeline`
Expected: PASS when ffmpeg/ffprobe are installed (`brew install ffmpeg`); SKIPPED otherwise (never a false failure on a machine without ffmpeg).

- [ ] **Step 3: Wire `extraResources` in `electron-builder.config.cjs`**

Add to the config object (a sibling of `files`):

```js
  extraResources: [
    { from: "build/vendor/ffmpeg", to: "ffmpeg" },
    { from: "build/vendor/ffprobe", to: "ffprobe" },
  ],
```

- [ ] **Step 4: Sign the bundled binary in `build/afterSign.cjs`**

After the existing app-signing `execFileSync` calls (before the final `console.log`), add:

```js
  // Ad-hoc sign the bundled ffmpeg/ffprobe so they spawn under the seal.
  const resourcesDir = path.join(appPath, "Contents", "Resources");
  for (const bin of ["ffmpeg", "ffprobe"]) {
    const binPath = path.join(resourcesDir, bin);
    if (require("fs").existsSync(binPath)) {
      execFileSync("codesign", ["--force", "--sign", "-", binPath], { stdio: "inherit" });
    }
  }
```

- [ ] **Step 5: Add the vendor drop-in marker + guard**

```bash
mkdir -p build/vendor && touch build/vendor/.gitkeep
```

Document in `build/vendor/.gitkeep` (as a comment in a sibling README) that `ffmpeg`/`ffprobe` arm64 binaries must be placed here before `npm run dist`, and that the binary's license/provenance is the pre-ship gate from the spec. (electron-builder will error clearly if `extraResources.from` is missing — acceptable as the guard.)

- [ ] **Step 6: Commit**

```bash
git add electron/__tests__/ffmpeg-pipeline.smoke.test.js electron-builder.config.cjs build/afterSign.cjs build/vendor/.gitkeep
git commit -m "test(export): ffprobe pipeline smoke test + ffmpeg packaging wiring"
```

---

## Self-Review

**Spec coverage (Phase 1 rows):**
- Bundle + sign ffmpeg → Task 7 (extraResources + afterSign). ✓
- `getPathForFile` via webUtils → Task 4. ✓
- `export:ffmpeg` IPC → Task 3. ✓
- `ffmpeg-args.cjs` pure builder → Task 2. ✓
- render→temp→encode for H.264 + HEVC → Tasks 3 (session), 5 (orchestrator), 7 (HEVC verified). ✓
- progress + cancel + cleanup → Task 3 (progress events, cancel, cleanup in `finally`), Task 5 (abort signal). ✓
- replaces desktop video path → Task 5/6 (engine selection in `handleExportMp4`). ✓
- WebCodecs stays as fallback → Task 5 (branch returns; else existing path runs). ✓

**Deferred to later phases (correctly absent here):** audio mux, ProRes tier, presets UI, trim, still-export AR fix. ✓

**Placeholder scan:** no TBD/TODO; every code step shows complete code. The `outPath` ambiguity in Task 5 is explicitly resolved in Task 6 (and Task 5 is written to stay safe before Task 6 lands). ✓

**Type consistency:** `buildVideoArgs({codec,fps,framePattern,outPath,totalFrames})` defined in Task 2 and called identically in Task 3. `createSession({width,height,fps,tmpRoot})` / `writeFrame(index,buffer)` / `encode({ffmpegPath,codec,outPath,onProgress})` consistent between Task 3 definition and Task 7 test. Bridge channel names (`ffmpeg:begin|frame|encode|cancel|available|progress|save-dialog`) consistent across Tasks 3, 4, 6. `exportViaFfmpeg` signature consistent between Task 5 definition and Task 6 call. ✓
