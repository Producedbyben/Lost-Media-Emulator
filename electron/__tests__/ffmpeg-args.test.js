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
