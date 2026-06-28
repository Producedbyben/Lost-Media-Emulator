#!/usr/bin/env node
// Lost Media Emulator — MCP connector (stdio). Exposes the headless render CLI as MCP tools so
// Claude Code can create LME-processed assets (stills + video) automatically. Dependency-free:
// raw newline-delimited JSON-RPC so `claude mcp add` works with no install step.
//
// Tools: lme_list_looks, lme_render_still, lme_render_video. Each shells out to tools/lme-render.sh
// (the real CPU export pipeline → byte-identical to an app export).
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import path from "node:path";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = path.join(REPO_ROOT, "tools", "lme-render.sh");

function runCli(args) {
  return new Promise((resolve) => {
    const child = spawn("bash", [CLI, ...args], { cwd: REPO_ROOT });
    let out = "", err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => resolve({ code: 1, out, err: String(e) }));
    child.on("close", (code) => resolve({ code: code ?? 1, out: out.trim(), err: err.trim() }));
  });
}

const TOOLS = [
  {
    name: "lme_list_looks",
    description: "List all Lost Media Emulator looks (presets) available for rendering, with each look's signal system (NTSC/PAL/digital/film) and the real medium it emulates. Call this first to pick a look.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "lme_render_still",
    description: "Render an input image through a Lost Media Emulator look and write a processed PNG (byte-identical to an app export). Use for retro/degraded still assets.",
    inputSchema: {
      type: "object",
      properties: {
        input: { type: "string", description: "Absolute path to the source image (png/jpg/webp)." },
        out: { type: "string", description: "Absolute path for the output .png." },
        look: { type: "string", description: "A look/preset NAME (see lme_list_looks) or an absolute path to an exported look .json. Omit for a clean pass." },
        width: { type: "number", description: "Output width (default 1280)." },
        height: { type: "number", description: "Output height (default 720)." },
        frame: { type: "number", description: "Which frame of the temporal effects to capture (default 0)." },
        noFormat: { type: "boolean", description: "Disable the NTSC/PAL/resolution format pre-pass (default false)." },
      },
      required: ["input", "out"],
      additionalProperties: false,
    },
  },
  {
    name: "lme_render_video",
    description: "Render an input image into an animated Lost Media Emulator clip (temporal effects evolve over the duration) and write an MP4/MOV (byte-identical to an app export). Silent track.",
    inputSchema: {
      type: "object",
      properties: {
        input: { type: "string", description: "Absolute path to the source image." },
        out: { type: "string", description: "Absolute path for the output .mp4 or .mov." },
        look: { type: "string", description: "A look/preset NAME or path to a look .json. Omit for a clean pass." },
        duration: { type: "number", description: "Clip length in seconds (default 4)." },
        fps: { type: "number", description: "Frames per second (default 30)." },
        width: { type: "number", description: "Output width (default 1280)." },
        height: { type: "number", description: "Output height (default 720)." },
        codec: { type: "string", description: "h264 (default), hevc, or prores." },
        noFormat: { type: "boolean", description: "Disable the format pre-pass (default false)." },
      },
      required: ["input", "out"],
      additionalProperties: false,
    },
  },
];

function argify(a) {
  const args = [];
  const push = (k, v) => { if (v !== undefined && v !== null && v !== "") { args.push("--" + k, String(v)); } };
  push("in", a.input); push("out", a.out); push("look", a.look);
  push("width", a.width); push("height", a.height); push("frame", a.frame);
  push("duration", a.duration); push("fps", a.fps); push("codec", a.codec);
  if (a.noFormat) args.push("--no-format");
  return args;
}

async function callTool(name, a = {}) {
  if (name === "lme_list_looks") {
    const r = await runCli(["--list"]);
    if (r.code !== 0) return { isError: true, text: r.err || "list failed" };
    return { text: r.out };
  }
  if (name === "lme_render_still" || name === "lme_render_video") {
    if (!a.input || !a.out) return { isError: true, text: "input and out are required" };
    const args = argify(a);
    // a still out path that ends .mp4/.mov would be treated as video by the CLI; trust the caller's extension.
    const r = await runCli(args);
    if (r.code !== 0) return { isError: true, text: (r.err || "render failed") + (r.out ? "\n" + r.out : "") };
    return { text: r.out || `wrote ${a.out}` };
  }
  return { isError: true, text: `unknown tool: ${name}` };
}

function send(msg) { process.stdout.write(JSON.stringify(msg) + "\n"); }
function reply(id, result) { send({ jsonrpc: "2.0", id, result }); }
function replyErr(id, code, message) { send({ jsonrpc: "2.0", id, error: { code, message } }); }

const rl = createInterface({ input: process.stdin });
rl.on("close", () => process.exit(0)); // client closed the transport
rl.on("line", async (line) => {
  const t = line.trim();
  if (!t) return;
  let msg;
  try { msg = JSON.parse(t); } catch { return; }
  const { id, method, params } = msg;
  if (id === undefined || id === null) return; // notification — no response

  if (method === "initialize") {
    reply(id, {
      protocolVersion: (params && params.protocolVersion) || "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "lme-render", version: "1.0.0" },
    });
  } else if (method === "tools/list") {
    reply(id, { tools: TOOLS });
  } else if (method === "tools/call") {
    try {
      const res = await callTool(params?.name, params?.arguments || {});
      reply(id, { content: [{ type: "text", text: res.text }], isError: !!res.isError });
    } catch (e) {
      reply(id, { content: [{ type: "text", text: String(e?.stack || e) }], isError: true });
    }
  } else if (method === "ping") {
    reply(id, {});
  } else {
    replyErr(id, -32601, `method not found: ${method}`);
  }
});
