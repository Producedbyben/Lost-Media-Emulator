# Bundled binaries (build/vendor/)

The native export pipeline shells out to `ffmpeg` (and `ffprobe` for the test
harness). Place macOS **arm64** binaries here before `npm run dist`:

```
build/vendor/ffmpeg
build/vendor/ffprobe
```

`electron-builder.config.cjs` bundles them into the app's `Contents/Resources/`
**only when both are present** (`hasFfmpeg`), and `build/afterSign.cjs` ad-hoc
signs them so they spawn under the app's seal. Without them, `npm run dist` still
produces a working DMG — the desktop export simply falls back to the WebCodecs
path at runtime (`window.desktop.ffmpeg.available()` returns false).

## Pre-ship gate: licensing

This is a **paid** product. Before any public release, settle the bundled
binary's license/provenance (see the design spec's Risks section):

- Invoke ffmpeg as a separately-bundled **subprocess** (mere aggregation), never
  linked into the app.
- Prefer an **LGPL** build; document the build's provenance and license in the
  app's About/credits.
- `ffmpeg-static` ships a **GPL** build — evaluate it against a self-built LGPL
  binary before choosing.

These binaries are intentionally **not committed** (see `.gitignore`).
