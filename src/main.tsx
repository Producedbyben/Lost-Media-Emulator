import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./styles/osd-fonts.css";
import { loadOSDFonts } from "./lib/osd-fonts";

// Kick off bundled OSD font loading at boot so the digital-era faces are resident
// before the first render. Canvas fillText() won't wait for fonts on its own.
void loadOSDFonts();

createRoot(document.getElementById("root")!).render(<App />);
