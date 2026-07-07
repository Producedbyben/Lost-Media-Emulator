// Compare button state machine (1.1.6 regression fix, Ben report via Session A):
// the old button was HOLD-only — a quick click flashed the original for ~100ms and read
// as "Compare doesn't work". New semantics: quick click = sticky toggle (lock), long
// press = momentary peek (hold) that ends on release, click while comparing = off.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, screen, cleanup } from "@testing-library/react";
import PreviewControls, { DEFAULT_PREVIEW_SETTINGS, PreviewSettings } from "./PreviewControls";

function setup(initial: Partial<PreviewSettings> = {}) {
  let settings: PreviewSettings = { ...DEFAULT_PREVIEW_SETTINGS, ...initial };
  const onChange = vi.fn((next: PreviewSettings) => { settings = next; });
  const view = render(
    <PreviewControls settings={settings} onChange={onChange} isVideo={false} />
  );
  const rerender = () =>
    view.rerender(<PreviewControls settings={settings} onChange={onChange} isVideo={false} />);
  const button = () => screen.getByTitle(/Compare with the original/i);
  return { get settings() { return settings; }, onChange, rerender, button };
}

describe("Compare button state machine", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.spyOn(performance, "now").mockReturnValue(0); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); cleanup(); });

  const press = (t: ReturnType<typeof setup>, holdMs: number) => {
    (performance.now as ReturnType<typeof vi.fn>).mockReturnValue(1000);
    fireEvent.pointerDown(t.button());
    t.rerender();
    (performance.now as ReturnType<typeof vi.fn>).mockReturnValue(1000 + holdMs);
    fireEvent.pointerUp(t.button());
    t.rerender();
  };

  it("quick click toggles the comparison ON (sticky lock)", () => {
    const t = setup();
    press(t, 80);
    expect(t.settings.compareMode).toBe("lock");
  });

  it("click while comparing turns it OFF", () => {
    const t = setup({ compareMode: "lock" });
    press(t, 80);
    expect(t.settings.compareMode).toBe("off");
  });

  it("long press is a momentary peek: hold shows the original, release ends it", () => {
    const t = setup();
    (performance.now as ReturnType<typeof vi.fn>).mockReturnValue(1000);
    fireEvent.pointerDown(t.button());
    t.rerender();
    expect(t.settings.compareMode).toBe("hold"); // peeking while held
    (performance.now as ReturnType<typeof vi.fn>).mockReturnValue(1600); // 600ms > 300ms threshold
    fireEvent.pointerUp(t.button());
    t.rerender();
    expect(t.settings.compareMode).toBe("off");
  });

  it("pointer leaving mid-press cancels the peek", () => {
    const t = setup();
    (performance.now as ReturnType<typeof vi.fn>).mockReturnValue(1000);
    fireEvent.pointerDown(t.button());
    t.rerender();
    expect(t.settings.compareMode).toBe("hold");
    fireEvent.pointerLeave(t.button());
    t.rerender();
    expect(t.settings.compareMode).toBe("off");
  });

  it("label reflects the active comparison", () => {
    const t = setup({ compareMode: "lock" });
    expect(t.button().textContent).toContain("Original");
  });
});
