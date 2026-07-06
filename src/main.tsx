import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./styles/osd-fonts.css";
import { loadOSDFonts } from "./lib/osd-fonts";
import { installHeadlessRenderApi } from "./lib/headless-render";

// Kick off bundled OSD font loading at boot so the digital-era faces are resident
// before the first render. Canvas fillText() won't wait for fonts on its own.
void loadOSDFonts();

// Expose window.lmeHeadless for the headless render CLI (electron/lme-render.cjs). Inert in
// the normal app; lets the asset-creation pipeline drive the real CPU export path without the GUI.
installHeadlessRenderApi();

// Window-level drop guard (audit #4): a file dropped OUTSIDE a dropzone must never
// navigate the app away (Chromium's default is to open the file, blanking the workspace).
// Dropzone components handle their own drops before this bubbles to window.
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => e.preventDefault());

createRoot(document.getElementById("root")!).render(<App />);
