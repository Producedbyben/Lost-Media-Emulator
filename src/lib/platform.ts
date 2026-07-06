// Platform-aware modifier label. The desktop app is macOS-only, but labels historically read
// "Ctrl" (a web/Windows tell). `mod` renders the correct symbol so shortcut hints match the
// keys the user actually presses (handlers already accept metaKey). Audit fix.
const isMac =
  (typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) ||
  (typeof window !== "undefined" && (window as unknown as { desktop?: { platform?: string } }).desktop?.platform === "darwin");

/** The command/ctrl symbol: "⌘" on macOS, "Ctrl" elsewhere. */
export const mod = isMac ? "⌘" : "Ctrl";
/** The shift symbol: "⇧" on macOS, "Shift" elsewhere. */
export const shiftKey = isMac ? "⇧" : "Shift";

/** Join modifier tokens with the platform-appropriate separator ("" on mac, "+" elsewhere). */
export function combo(...parts: string[]): string {
  return isMac ? parts.join("") : parts.join("+");
}
