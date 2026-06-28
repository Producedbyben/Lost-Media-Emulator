# LME Headless Render — Design

**Goal:** Give Claude Code a reusable, faithful way to create assets (still PNGs and animated
MP4/MOV clips) by running the Lost Media Emulator engine headlessly — no GUI clicks. Delivered as
a stable in-app render API, an Electron CLI, a Claude Code skill, and an MCP connector.

## Truest-render principle

The CPU renderer `CRTRendererFull` is the authoritative pipeline (the GPU only approximates it
< 6 mean-err, and exports already force `preferGPU=false`). It is pure Canvas2D, so it runs in an
offscreen Electron `BrowserWindow` with no GPU/display. Rendering through it = byte-identical to
the app's export, deterministically. The headless API uses it directly.

## Components

### 1. `src/lib/headless-render.ts` — `window.lmeHeadless` (initialised in `main.tsx`)
Attached to `window` on load, independent of the React tree (so it's ready even behind a
license/onboarding gate). ~Stable surface:
- `listLooks(): { name: string; category: string }[]` — from `PRESETS` + the category map.
- `renderStill({ input, look, width=1280, height=720, frameIndex=0 }): Promise<string>` — decodes
  `input` (an image data URL), resolves `look` (a preset name → `PRESETS[name]`, or a look-JSON
  object/`{params}`) merged over `DEFAULT_PARAMS`, builds `renderOptions = { formatProfile:
  getFormatProfile(lookName) }`, renders ONE frame with `CRTRendererFull` (`seconds = frameIndex/fps`),
  returns a `image/png` data URL.
- `renderVideo({ input, look, width, height, fps=30, durationSec=4, codec='h264', outPath }):
  Promise<{ outPath }>` — image input → animated clip (temporal effects evolve over `frameIndex`).
  Drives `window.desktop.ffmpeg.begin/frame/encode`: per frame render → `getImageData` bytes →
  `ffmpeg.frame`; then `ffmpeg.encode({ codec, outPath })`. Silent track (no `audioSourcePath`).

Look/param resolution lives in one helper `resolveLook(look)` returning `{ name, params }`.

### 2. `electron/ffmpeg-ipc.cjs` (small refactor)
Extract the `ffmpeg:available|begin|frame|encode|cancel` + `ffmpeg:write-temp-audio` IPC
registration from `main.cjs` into `registerFfmpegIpc(ipcMain)`. `main.cjs` calls it (no behaviour
change); the CLI main calls it too, so the headless video path uses the EXACT same ffmpeg session.

### 3. `electron/lme-render.cjs` — the CLI
Own Electron entry. Applies `gpu-flags`, registers ffmpeg IPC, opens an offscreen `BrowserWindow`
(`show:false`, the repo `preload.cjs`), `loadFile('dist/index.html')`, polls for `window.lmeHeadless`,
then calls the API and writes the output. Args: `--in <img>`, `--look <name|look.json>`,
`--out <path>`, `--width`, `--height`, `--fps`, `--duration` (video), `--frame` (still), `--list`.
Reads `--in` from disk → base64 data URL → passes via `executeJavaScript`. Exit 0 on success,
non-zero + stderr on failure. Wrapped by `tools/lme-render.sh` (runs `electron electron/lme-render.cjs`).

### 4. Skill `~/.claude/skills/lme-render/SKILL.md`
When/how Claude uses it: `--list` to discover looks, render a still, render a clip; look-selection
guidance (era families), sizing defaults, that `look` accepts the exported look JSON.

### 5. MCP connector `tools/lme-mcp/server.mjs` (stdio)
Tools `lme_list_looks`, `lme_render_still`, `lme_render_video` → shell out to the CLI, return the
output path (Claude `Read`s the PNG to inspect). Registered via `claude mcp add lme-render -- node
<abs>/tools/lme-mcp/server.mjs`.

## Build order (tasks)
1. `headless-render.ts` + wire into `main.tsx`; `vite build`; verify `window.lmeHeadless.renderStill`
   in the preview produces a PNG matching a CPU `render()` (mean-err ~0).
2. `ffmpeg-ipc.cjs` refactor; keep 153 tests + the export smoke green.
3. `lme-render.cjs` + `tools/lme-render.sh`; verify a real still + a real MP4 off a temp image.
4. Skill SKILL.md.
5. MCP connector + `claude mcp add`; verify the tools render.

## Constraints
Keep 153 tests / tsc / `vite build` green. CPU path only (deterministic, headless-safe). No GUI
driving. Commit per task; push after each. Optional follow-up: rebuild+repush the DMG so the
installed app also carries `window.lmeHeadless`.

## Out of scope (YAGNI)
Video-file input (image→clip only), audio tracks, GPU headless rendering.
