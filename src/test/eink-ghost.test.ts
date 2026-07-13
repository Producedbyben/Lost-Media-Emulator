import { describe, it, expect, vi, beforeEach } from "vitest";

// E-ink refresh-ghost continuity guard (1.1.7 fast-follow on PE's e-ink spec).
// jsdom has no canvas 2D backend, so pixel content can't be asserted here — instead
// (same pattern as osd-pipeline-order.test.ts) we install a recording fake 2D context
// on every canvas the renderer creates and assert on WHICH source canvas the ghost
// composite draws from:
//   - einkGhostCanvas (the real previous-frame buffer) on a genuinely continuous call
//     (same renderer instance, matching width/height, frameIndex === lastFrame + 1)
//   - tempCanvas (the old synthetic same-frame offset echo) on the first frame, a
//     frameIndex jump (seek), a size change, or right after reset()

const events: string[] = [];

function makeFakeCtx(canvas: any) {
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
  return ctx;
}

let canvasSeq = 0;
beforeEach(() => {
  events.length = 0;
  canvasSeq = 0;
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

function makeOutCtx() {
  const outCanvas: any = document.createElement("canvas");
  outCanvas.__tag = "out";
  return outCanvas.getContext("2d");
}

describe("E-ink refresh ghost: real prior-frame buffer with synthetic fallback (1.1.7)", () => {
  it("falls back to the synthetic echo on frame 0, uses the real buffer on the next continuous frame, and falls back again on a frameIndex jump", async () => {
    const { CRTRendererFull } = await import("@/lib/crt-renderer-full.js");
    const r: any = new CRTRendererFull();
    r.hasImage = true; // skip setImage; render reads from sourceCanvas (fake ctx)

    const outCtx = makeOutCtx();
    const ghostTag = r.einkGhostCanvas.__tag;
    const tempTag = r.tempCanvas.__tag;
    const params: any = { einkGrey: 1, einkGhost: 0.6 };

    events.length = 0;
    r.render(outCtx, 4, 4, 0, params, 0, 30, {});
    expect(events).toContain(`drawImage:${tempTag}->out`);
    expect(events).not.toContain(`drawImage:${ghostTag}->out`);

    events.length = 0;
    r.render(outCtx, 4, 4, 1 / 30, params, 1, 30, {});
    expect(events).toContain(`drawImage:${ghostTag}->out`);
    expect(events).not.toContain(`drawImage:${tempTag}->out`);

    events.length = 0;
    r.render(outCtx, 4, 4, 5 / 30, params, 5, 30, {});
    expect(events).toContain(`drawImage:${tempTag}->out`);
    expect(events).not.toContain(`drawImage:${ghostTag}->out`);
  });

  it("does not treat a resized frame as continuous even if frameIndex advances by 1", async () => {
    const { CRTRendererFull } = await import("@/lib/crt-renderer-full.js");
    const r: any = new CRTRendererFull();
    r.hasImage = true;

    const outCtx = makeOutCtx();
    const ghostTag = r.einkGhostCanvas.__tag;
    const tempTag = r.tempCanvas.__tag;
    const params: any = { einkGrey: 1, einkGhost: 0.6 };

    r.render(outCtx, 4, 4, 0, params, 0, 30, {});

    events.length = 0;
    r.render(outCtx, 8, 8, 1 / 30, params, 1, 30, {});
    expect(events).toContain(`drawImage:${tempTag}->out`);
    expect(events).not.toContain(`drawImage:${ghostTag}->out`);
  });

  it("clears the continuity state on reset() so the next frame falls back to the synthetic echo", async () => {
    const { CRTRendererFull } = await import("@/lib/crt-renderer-full.js");
    const r: any = new CRTRendererFull();
    r.hasImage = true;

    const outCtx = makeOutCtx();
    const ghostTag = r.einkGhostCanvas.__tag;
    const tempTag = r.tempCanvas.__tag;
    const params: any = { einkGrey: 1, einkGhost: 0.6 };

    r.render(outCtx, 4, 4, 0, params, 0, 30, {});
    r.reset();

    events.length = 0;
    // Same frameIndex sequence as an uninterrupted continuation, but reset() must
    // have cleared the buffer's continuity tracking regardless.
    r.render(outCtx, 4, 4, 1 / 30, params, 1, 30, {});
    expect(events).toContain(`drawImage:${tempTag}->out`);
    expect(events).not.toContain(`drawImage:${ghostTag}->out`);
  });
});
