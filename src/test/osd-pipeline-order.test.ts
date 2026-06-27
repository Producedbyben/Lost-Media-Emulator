import { describe, it, expect, vi, beforeEach } from "vitest";

// Pipeline-ordering guard for the OSD rebuild (Pillar 3).
// jsdom has no canvas 2D backend, so we can't render real pixels here. Instead we
// install a recording fake 2D context on every canvas the renderer creates and
// assert the *structural* contract the rebuild guarantees:
//
//   Stage A (capture signal): renderGrade -> renderOSD are burned into the SIGNAL
//   buffer (the fit canvas) BEFORE Stage B (the display optics) reads that buffer
//   via getImageData and composites the work canvas into the output.
//
// That ordering is what makes scanlines / mask / barrel ride OVER the OSD while the
// OSD sits AFTER the grade (handoff defects #1 and #4).

const events: string[] = [];

function makeFakeCtx(canvas: any) {
  const data = new Uint8ClampedArray(4);
  const ctx: any = {
    canvas,
    fillStyle: "",
    strokeStyle: "",
    filter: "none",
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    shadowColor: "",
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    lineWidth: 1,
    font: "",
    textBaseline: "alphabetic",
    imageSmoothingEnabled: true,
    imageSmoothingQuality: "high",
    save() {},
    restore() {},
    clearRect() {},
    fillRect() {},
    strokeRect() {},
    fillText() {},
    strokeText() {},
    measureText() { return { width: 10 }; },
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    arc() {},
    fill() {},
    stroke() {},
    drawImage(src: any) {
      const tag = src && src.__tag ? src.__tag : "img";
      events.push(`drawImage:${tag}->${canvas.__tag}`);
    },
    getImageData(_x: number, _y: number, w: number, h: number) {
      events.push(`getImageData:${canvas.__tag}`);
      return { data: new Uint8ClampedArray(Math.max(4, w * h * 4)), width: w, height: h };
    },
    putImageData() {
      events.push(`putImageData:${canvas.__tag}`);
    },
    createImageData(w: number, h: number) {
      return { data: new Uint8ClampedArray(Math.max(4, (w | 0) * (h | 0) * 4)), width: w, height: h };
    },
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
    createPattern() { return {}; },
    setTransform() {},
    translate() {},
    scale() {},
    rotate() {},
  };
  void data;
  return ctx;
}

let canvasSeq = 0;
beforeEach(() => {
  events.length = 0;
  canvasSeq = 0;
  // Tag each created canvas so we can read the event order, and give it a fake ctx.
  const realCreate = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
    const el: any = realCreate(tag);
    if (tag === "canvas") {
      el.__tag = `canvas${canvasSeq++}`;
      el.width = 4;
      el.height = 4;
      el.getContext = () => makeFakeCtx(el);
    }
    return el;
  });
});

describe("OSD pipeline ordering (Stage A signal -> Stage B display)", () => {
  it("grades + burns the OSD into the signal buffer before the display optics read it", async () => {
    const { CRTRendererFull } = await import("@/lib/crt-renderer-full.js");
    const r: any = new CRTRendererFull();

    // Spy on the two Stage-A steps so we can locate them in the event stream.
    const gradeSpy = vi.spyOn(r, "renderGrade").mockImplementation(() => {
      events.push("renderGrade");
    });
    const osdSpy = vi.spyOn(r, "renderOSD").mockImplementation(() => {
      events.push("renderOSD");
    });

    r.hasImage = true; // skip setImage; render reads from sourceCanvas (fake ctx)

    // Output context (also a fake recording ctx).
    const outCanvas: any = document.createElement("canvas");
    outCanvas.__tag = "out";
    const outCtx = outCanvas.getContext("2d");

    const params: any = {}; // all-neutral -> per-pixel loop skipped (fast path)
    r.render(outCtx, 4, 4, 0, params, 0, 30, {});

    expect(gradeSpy).toHaveBeenCalledTimes(1);
    expect(osdSpy).toHaveBeenCalledTimes(1);

    const gradeIdx = events.indexOf("renderGrade");
    const osdIdx = events.indexOf("renderOSD");
    // The display stage hands the work canvas to the output via drawImage.
    const displayCompositeIdx = events.findIndex((e) => e.endsWith("->out"));

    expect(gradeIdx).toBeGreaterThanOrEqual(0);
    expect(osdIdx).toBeGreaterThan(gradeIdx); // OSD after grade (defect #4)
    expect(displayCompositeIdx).toBeGreaterThan(osdIdx); // display optics after OSD (defect #1)
  });

  it("passes the SIGNAL buffer (not the output) to renderGrade and renderOSD", async () => {
    const { CRTRendererFull } = await import("@/lib/crt-renderer-full.js");
    const r: any = new CRTRendererFull();
    let gradeCanvasTag = "";
    let osdCanvasTag = "";
    vi.spyOn(r, "renderGrade").mockImplementation((ctx: any) => {
      gradeCanvasTag = ctx?.canvas?.__tag;
    });
    vi.spyOn(r, "renderOSD").mockImplementation((ctx: any) => {
      osdCanvasTag = ctx?.canvas?.__tag;
    });
    r.hasImage = true;
    const fitTag = r.fitCanvas.__tag;

    const outCanvas: any = document.createElement("canvas");
    outCanvas.__tag = "out";
    const outCtx = outCanvas.getContext("2d");
    r.render(outCtx, 4, 4, 0, {}, 0, 30, {});

    // Both Stage-A steps must operate on the fit/signal canvas, never the output.
    expect(gradeCanvasTag).toBe(fitTag);
    expect(osdCanvasTag).toBe(fitTag);
    expect(gradeCanvasTag).not.toBe("out");
  });
});
