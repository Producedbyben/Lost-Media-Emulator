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

  it("builds a ProRes 422 HQ .mov (editorial master, no faststart)", () => {
    const a = buildVideoArgs({ ...base, codec: "prores422", outPath: "/t/out.mov" });
    const j = a.join(" ");
    expect(j).toContain("prores_ks");
    expect(j).toContain("-profile:v 3");
    expect(j).toContain("yuv422p10le");
    expect(j).not.toContain("+faststart");   // a master is for editing, not streaming
    expect(j).not.toContain("-b:v");          // ProRes is profile-driven, not bitrate
    expect(a[a.length - 1]).toBe("/t/out.mov");
  });

  it("builds ProRes 4444", () => {
    const j = buildVideoArgs({ ...base, codec: "prores4444", outPath: "/t/o.mov" }).join(" ");
    expect(j).toContain("-profile:v 4");
    expect(j).toContain("yuv444p10le");
  });

  it("uses PCM audio for a ProRes mov, AAC for mp4", () => {
    const prores = buildVideoArgs({ ...base, codec: "prores422", outPath: "/t/o.mov", audioSourcePath: "/s.mov" }).join(" ");
    expect(prores).toContain("-c:a pcm_s16le");
    expect(prores).not.toContain("aac");
    const mp4 = buildVideoArgs({ ...base, codec: "h264", audioSourcePath: "/s.mov" }).join(" ");
    expect(mp4).toContain("-c:a aac");
  });

  it("trims the muxed audio with -ss/-t placed before the audio input", () => {
    const a = buildVideoArgs({ ...base, codec: "h264", audioSourcePath: "/src/clip.mov", inSec: 2, outSec: 5 });
    const j = a.join(" ");
    expect(j).toContain("-ss 2");                 // start at the in point
    expect(j).toContain("-t 3");                  // duration = out − in
    expect(j).toContain("-shortest");             // still clamp to rendered video
    // -ss/-t must apply to the audio input → appear before "-i /src/clip.mov"
    const ss = a.indexOf("-ss");
    const audioIn = j.indexOf("-i /src/clip.mov");
    expect(ss).toBeGreaterThanOrEqual(0);
    expect(j.indexOf("-ss")).toBeLessThan(audioIn);
    expect(j.indexOf("-t ")).toBeLessThan(audioIn);
  });

  it("omits -ss when the in point is 0 but still sets -t to the window length", () => {
    const j = buildVideoArgs({ ...base, codec: "h264", audioSourcePath: "/s.mov", inSec: 0, outSec: 4 }).join(" ");
    expect(j).not.toContain("-ss");
    expect(j).toContain("-t 4");
  });

  it("never adds trim flags to a silent (no audioSourcePath) encode", () => {
    const j = buildVideoArgs({ ...base, codec: "h264", inSec: 2, outSec: 5 }).join(" ");
    expect(j).not.toContain("-ss");
    expect(j).not.toContain("-t ");
  });

  it("adds no trim flags when in/out are absent (unchanged behaviour)", () => {
    const j = buildVideoArgs({ ...base, codec: "h264", audioSourcePath: "/s.mov" }).join(" ");
    expect(j).not.toContain("-ss");
    expect(j).not.toContain("-t ");
  });
});
