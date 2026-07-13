import { describe, it, expect, vi, beforeEach } from "vitest";

// VFD readout + TN viewing-angle-shift display looks (1.1.7, PE alternates #6/#7,
// agency/pe-1.1.6-display-looks.md). jsdom has no canvas 2D backend, so pixel content
// can't be asserted — instead (same pattern as eink-ghost.test.ts) we install a
// recording fake 2D context on every canvas the renderer creates and assert on the
// getImageData/putImageData/drawImage event trail plus the cached grid-tile canvas.

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

describe("VFD readout (1.1.7)", () => {
  it("runs the per-pixel phosphor pass and caches a grid-tile canvas", async () => {
    const { CRTRendererFull } = await import("@/lib/crt-renderer-full.js");
    const r: any = new CRTRendererFull();
    r.hasImage = true;

    const outCtx = makeOutCtx();
    const params: any = { vfdGlow: 1, vfdLevels: 8, vfdGrid: 0.5, vfdBloom: 0.55, vfdBlackCrush: 0.7 };

    events.length = 0;
    r.render(outCtx, 4, 4, 0, params, 0, 30, {});

    expect(events).toContain("getImageData:out");
    expect(events).toContain("putImageData:out");
    // Bloom composites the output canvas onto itself (self-referential screen blur).
    expect(events).toContain("drawImage:out->out");
    // Grid tile is built once and cached on the instance.
    expect(r._vfdGridKey).toBe(5);
    expect(r._vfdGrid).toBeTruthy();
  });

  it("skips the per-pixel pass entirely when all VFD params are zero", async () => {
    const { CRTRendererFull } = await import("@/lib/crt-renderer-full.js");
    const r: any = new CRTRendererFull();
    r.hasImage = true;

    const outCtx = makeOutCtx();
    events.length = 0;
    r.render(outCtx, 4, 4, 0, { vfdGlow: 0, vfdGrid: 0, vfdBloom: 0 }, 0, 30, {});

    expect(r._vfdGrid).toBeUndefined();
  });
});

describe("TN panel viewing-angle shift (1.1.7)", () => {
  it("runs the per-pixel gamma/dither pass and draws the response ghost from tempCanvas", async () => {
    const { CRTRendererFull } = await import("@/lib/crt-renderer-full.js");
    const r: any = new CRTRendererFull();
    r.hasImage = true;

    const outCtx = makeOutCtx();
    const tempTag = r.tempCanvas.__tag;
    const params: any = { tnGammaShift: 0.6, tnAxis: 0, tnFrcDither: 0.5, tnCoolCast: 0.3, tnGhost: 0.15 };

    events.length = 0;
    r.render(outCtx, 4, 4, 0, params, 0, 30, {});

    expect(events).toContain("getImageData:out");
    expect(events).toContain("putImageData:out");
    expect(events).toContain(`drawImage:${tempTag}->out`);
  });

  it("does not draw a response ghost when tnGhost is zero", async () => {
    const { CRTRendererFull } = await import("@/lib/crt-renderer-full.js");
    const r: any = new CRTRendererFull();
    r.hasImage = true;

    const outCtx = makeOutCtx();
    const tempTag = r.tempCanvas.__tag;
    const params: any = { tnGammaShift: 0.6, tnAxis: 0, tnFrcDither: 0, tnCoolCast: 0, tnGhost: 0 };

    events.length = 0;
    r.render(outCtx, 4, 4, 0, params, 0, 30, {});

    expect(events).not.toContain(`drawImage:${tempTag}->out`);
  });
});
