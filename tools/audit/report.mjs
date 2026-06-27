// tools/audit/report.mjs
// Emits docs/audit/coverage.md: which presets are scored vs outstanding.
// Reads every docs/audit/scorecards/*.json (array of scorecards) and diffs the
// scored ids against the full preset inventory.
//
// Run with:
//   node_modules/.bin/vite-node tools/audit/report.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ALL_PRESET_NAMES } from "@/lib/audit/inventory";
import { presetCoverage } from "@/lib/audit/schema";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");

const scorecardsDir = path.join(root, "docs/audit/scorecards");
const scored = new Set();

if (fs.existsSync(scorecardsDir)) {
  for (const f of fs.readdirSync(scorecardsDir).filter((f) => f.endsWith(".json"))) {
    const contents = JSON.parse(fs.readFileSync(path.join(scorecardsDir, f), "utf8"));
    for (const c of contents) {
      if (c.kind === "preset" && c.id) scored.add(c.id);
    }
  }
}

const cov = presetCoverage([...scored]);
const total = ALL_PRESET_NAMES.length;
const pct = total > 0 ? ((cov.covered.length / total) * 100).toFixed(1) : "0.0";

const out = [
  `# Audit coverage`,
  ``,
  `Presets scored: **${cov.covered.length} / ${total}** (${pct}%)`,
  ``,
  `## Outstanding presets`,
  ``,
  ...cov.missing.map((n) => `- [ ] ${n}`),
  ``,
].join("\n");

fs.writeFileSync(path.join(root, "docs/audit/coverage.md"), out);
console.log(`coverage: ${cov.covered.length}/${total} (${pct}%)`);
