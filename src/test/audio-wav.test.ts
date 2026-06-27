import { describe, it, expect } from "vitest";
import { audioBufferToWav } from "@/lib/audio-wav";

function fakeBuffer(ch: number, sr: number, samples: number[][]) {
  return { numberOfChannels: ch, sampleRate: sr, length: samples[0].length, getChannelData: (c: number) => Float32Array.from(samples[c]) };
}

describe("audioBufferToWav", () => {
  it("writes a valid RIFF/WAVE header with correct sizes", () => {
    const wav = audioBufferToWav(fakeBuffer(1, 8000, [[0, 0.5, -0.5, 1]]));
    const dv = new DataView(wav);
    const tag = (o: number) => String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3));
    expect(tag(0)).toBe("RIFF");
    expect(tag(8)).toBe("WAVE");
    expect(tag(12)).toBe("fmt ");
    expect(dv.getUint16(22, true)).toBe(1);     // channels
    expect(dv.getUint32(24, true)).toBe(8000);  // sample rate
    expect(tag(36)).toBe("data");
    expect(wav.byteLength).toBe(44 + 4 * 2);     // header + 4 mono 16-bit samples
  });

  it("clamps and quantizes samples to 16-bit", () => {
    const wav = audioBufferToWav(fakeBuffer(1, 8000, [[2, -2, 0]])); // out-of-range clamps
    const dv = new DataView(wav);
    expect(dv.getInt16(44, true)).toBe(32767);   // +clip
    expect(dv.getInt16(46, true)).toBe(-32768);  // -clip
    expect(dv.getInt16(48, true)).toBe(0);
  });
});
