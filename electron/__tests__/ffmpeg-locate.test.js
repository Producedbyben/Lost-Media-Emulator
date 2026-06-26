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

  it("does not use resourcesPath when not packaged, even if it exists", () => {
    const r = resolveFfmpeg({
      env: {}, resourcesPath: "/app/resources", isPackaged: false,
      exists: exists(new Set(["/app/resources/ffmpeg", "/app/resources/ffprobe",
                              "/opt/homebrew/bin/ffmpeg", "/opt/homebrew/bin/ffprobe"])),
    });
    expect(r.ffmpeg).toBe("/opt/homebrew/bin/ffmpeg");
    expect(r.ffprobe).toBe("/opt/homebrew/bin/ffprobe");
  });
});
