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
    expect(a.join(" ")).toContain("-framerate 30");
    expect(a[a.length - 1]).toBe("/t/out.mp4");
  });

  it("throws on an unknown codec", () => {
    expect(() => buildVideoArgs({ ...base, codec: "wat" })).toThrow(/unsupported codec/i);
  });

  it("adds a second input and AAC mux when audioSourcePath is given", () => {
    const a = buildVideoArgs({ ...base, codec: "h264", audioSourcePath: "/src/clip.mov" });
    const j = a.join(" ");
    expect(j).toContain("-i /t/frame_%06d.png");   // video input 0
    expect(j).toContain("-i /src/clip.mov");        // audio input 1
    expect(j).toContain("-map 0:v:0");
    expect(j).toContain("-map 1:a:0?");             // optional → never fails if no track
    expect(j).toContain("-c:a aac");
    expect(j).toContain("-b:a 192k");
    expect(j).toContain("-shortest");
    expect(a[a.length - 1]).toBe("/t/out.mp4");      // output still last
  });

  it("omits all audio args when no audioSourcePath", () => {
    const j = buildVideoArgs({ ...base, codec: "h264" }).join(" ");
    expect(j).not.toContain("-c:a");
    expect(j).not.toContain(":a:0");
    expect(j).not.toContain("-shortest");
  });
});
