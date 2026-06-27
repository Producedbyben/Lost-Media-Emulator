// Client for the Cloudflare Worker license API. Uses global fetch (present in
// Electron's main-process Node). The body is sent as text/plain so it's a
// "simple" CORS request (no preflight); the Worker also handles OPTIONS.
const BASE = process.env.LME_LICENSE_API || "https://lostmediaemulator.com";

async function post(pathname, body) {
  const res = await fetch(BASE + pathname, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify(body),
  });
  return res.json();
}

module.exports = {
  BASE,
  activate: (b) => post("/api/license/activate", b),
  validate: (b) => post("/api/license/validate", b),
  deactivate: (b) => post("/api/license/deactivate", b),
};
