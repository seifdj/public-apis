// Jarvis — serveur local. Sert l'interface, garde tes données dans data/ et parle à Claude avec ta clé API.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "jarvis-data.json");
const CONFIG_FILE = path.join(DATA_DIR, "config.json");
const PORT = Number(process.env.JARVIS_PORT) || 4747;
const URL_APP = `http://localhost:${PORT}`;
const COLLECTIONS = ["goals", "projects", "companies", "transactions", "clients", "chat", "settings"];
const MODEL = "claude-opus-5-5";
const EFFORT = { quick: "low", default: "medium", complex: "high" };

fs.mkdirSync(DATA_DIR, { recursive: true });

/* ---------- Données ---------- */
function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}
function writeJson(file, value) {
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}
function seed() {
  const empty = Object.fromEntries(COLLECTIONS.map(c => [c, {}]));
  empty.settings.main = { currency: "EUR" };
  empty.companies.shd = {
    name: "SHD Multiservices", status: "active", sector: "Multiservices", services: "", monthlyRevenue: 0,
    notes: "Clique sur « Modifier » pour ajouter tes services et ton objectif de chiffre d'affaires mensuel.", createdAt: Date.now(),
  };
  return empty;
}
let store = readJson(DATA_FILE, null);
if (!store) { store = seed(); writeJson(DATA_FILE, store); }
for (const c of COLLECTIONS) store[c] ||= {};

let lastBackupDay = "";
function save() {
  const day = new Date().toISOString().slice(0, 10);
  if (day !== lastBackupDay && fs.existsSync(DATA_FILE)) {
    // Une sauvegarde par jour, les 14 dernières sont conservées.
    fs.mkdirSync(path.join(DATA_DIR, "sauvegardes"), { recursive: true });
    fs.copyFileSync(DATA_FILE, path.join(DATA_DIR, "sauvegardes", `jarvis-${day}.json`));
    const old = fs.readdirSync(path.join(DATA_DIR, "sauvegardes")).sort().slice(0, -14);
    for (const f of old) fs.rmSync(path.join(DATA_DIR, "sauvegardes", f), { force: true });
    lastBackupDay = day;
  }
  writeJson(DATA_FILE, store);
}

function getConfig() {
  const cfg = readJson(CONFIG_FILE, {});
  return { apiKey: cfg.apiKey || process.env.ANTHROPIC_API_KEY || "" };
}

/* ---------- Claude ---------- */
let clientCache = { key: "", client: null };
async function claudeClient() {
  const { apiKey } = getConfig();
  if (!apiKey) { const e = new Error("Ajoute ta clé API Anthropic dans les Réglages de Jarvis."); e.code = "no_key"; throw e; }
  if (clientCache.key !== apiKey) {
    let Anthropic;
    try { ({ default: Anthropic } = await import("@anthropic-ai/sdk")); }
    catch { const e = new Error("Le module Claude n'est pas installé. Relance Jarvis avec le fichier de démarrage (il installe ce qu'il faut)."); e.code = "sdk_missing"; throw e; }
    clientCache = { key: apiKey, client: new Anthropic({ apiKey }), Anthropic };
  }
  return clientCache;
}
async function askClaude({ messages, tools, tier }) {
  const { client, Anthropic } = await claudeClient();
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: EFFORT[tier] || "medium" },
      messages,
      ...(tools && tools.length ? { tools } : {}),
    });
    return response;
  } catch (err) {
    const e = new Error(err.message || "Erreur de Claude");
    if (err instanceof Anthropic.AuthenticationError) { e.code = "bad_key"; e.message = "La clé API est refusée. Vérifie-la dans les Réglages."; }
    else if (err instanceof Anthropic.PermissionDeniedError) { e.code = "bad_key"; e.message = "Cette clé API n'a pas accès au modèle. Vérifie ton compte sur console.anthropic.com."; }
    else if (err instanceof Anthropic.RateLimitError) { e.code = "rate_limited"; e.message = "Trop de demandes d'un coup. Attends une minute."; }
    else if (err instanceof Anthropic.APIConnectionError) { e.code = "offline"; e.message = "Pas de connexion Internet : Jarvis ne peut pas joindre Claude."; }
    else if (err instanceof Anthropic.APIError && err.status === 400 && /credit|balance/i.test(err.message)) { e.code = "no_credit"; e.message = "Ton compte API n'a plus de crédit. Recharge-le sur console.anthropic.com."; }
    else e.code = "upstream_error";
    throw e;
  }
}

/* ---------- HTTP ---------- */
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon" };
function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}
function body(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", c => { raw += c; if (raw.length > 5e6) { reject(new Error("Requête trop grande")); req.destroy(); } });
    req.on("end", () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { reject(e); } });
  });
}
const validId = s => typeof s === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(s);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, URL_APP);
  const p = url.pathname;
  // N'accepte que les pages servies par Jarvis lui-même.
  const origin = req.headers.origin;
  if (req.method !== "GET" && origin && !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return send(res, 403, { error: { message: "Origine refusée" } });
  try {
    if (p === "/api/state" && req.method === "GET") {
      const out = {};
      for (const c of COLLECTIONS) out[c] = Object.entries(store[c]).map(([id, d]) => ({ id, ...d }));
      return send(res, 200, out);
    }
    const m = p.match(/^\/api\/db\/([a-z]+)(?:\/([A-Za-z0-9_-]+))?$/);
    if (m) {
      const [, col, id] = m;
      if (!COLLECTIONS.includes(col)) return send(res, 404, { error: { message: "Collection inconnue" } });
      if (req.method === "POST" && !id) {
        const data = await body(req);
        const newId = crypto.randomUUID().replace(/-/g, "").slice(0, 20);
        store[col][newId] = data; save();
        return send(res, 200, { id: newId });
      }
      if (!validId(id)) return send(res, 400, { error: { message: "Identifiant invalide" } });
      if (req.method === "PUT") { store[col][id] = await body(req); save(); return send(res, 200, { ok: true }); }
      if (req.method === "PATCH") {
        if (!store[col][id]) return send(res, 404, { error: { message: "Élément introuvable" } });
        store[col][id] = { ...store[col][id], ...(await body(req)) }; save(); return send(res, 200, { ok: true });
      }
      if (req.method === "DELETE") { delete store[col][id]; save(); return send(res, 200, { ok: true }); }
    }
    if (p === "/api/config") {
      if (req.method === "GET") { const { apiKey } = getConfig(); return send(res, 200, { hasKey: !!apiKey, keyHint: apiKey ? "…" + apiKey.slice(-4) : "", model: MODEL }); }
      if (req.method === "POST") {
        const { apiKey } = await body(req);
        const cfg = readJson(CONFIG_FILE, {});
        if (typeof apiKey === "string") cfg.apiKey = apiKey.trim();
        writeJson(CONFIG_FILE, cfg);
        try { fs.chmodSync(CONFIG_FILE, 0o600); } catch {}
        return send(res, 200, { ok: true });
      }
    }
    if (p === "/api/claude" && req.method === "POST") {
      const { messages, tools, tier } = await body(req);
      try { return send(res, 200, await askClaude({ messages, tools, tier })); }
      catch (e) { return send(res, 200, { error: { code: e.code || "upstream_error", message: e.message } }); }
    }
    if (p === "/api/export" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="jarvis-export-${new Date().toISOString().slice(0, 10)}.json"` });
      return res.end(JSON.stringify(store, null, 2));
    }
    if (p.startsWith("/api/")) return send(res, 404, { error: { message: "Route inconnue" } });

    // Fichiers de l'interface
    const file = path.normalize(path.join(PUBLIC, p === "/" ? "index.html" : decodeURIComponent(p)));
    if (!file.startsWith(PUBLIC) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end("Introuvable"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" });
    fs.createReadStream(file).pipe(res);
  } catch (err) {
    send(res, 500, { error: { message: err.message } });
  }
});

/* ---------- Ouvre la fenêtre Jarvis ---------- */
function has(cmd) { try { execSync(process.platform === "win32" ? `where ${cmd}` : `command -v ${cmd}`, { stdio: "ignore" }); return true; } catch { return false; } }
function openWindow() {
  if (process.env.JARVIS_NO_OPEN) return;
  const run = (cmd, args) => spawn(cmd, args, { detached: true, stdio: "ignore", shell: process.platform === "win32" }).unref();
  if (process.platform === "win32") {
    // Edge en mode application : fenêtre dédiée, voix naturelles « Henri » et micro.
    run("start", ['""', "msedge", `--app=${URL_APP}`]);
  } else if (process.platform === "darwin") {
    const chrome = "/Applications/Google Chrome.app", edge = "/Applications/Microsoft Edge.app";
    if (fs.existsSync(edge)) run("open", ["-na", edge, "--args", `--app=${URL_APP}`]);
    else if (fs.existsSync(chrome)) run("open", ["-na", chrome, "--args", `--app=${URL_APP}`]);
    else run("open", [URL_APP]);
  } else {
    const b = ["microsoft-edge", "google-chrome", "chromium", "chromium-browser"].find(has);
    if (b) run(b, [`--app=${URL_APP}`]); else run("xdg-open", [URL_APP]);
  }
}

server.on("error", err => {
  if (err.code === "EADDRINUSE") { console.log("Jarvis tourne déjà : ouverture de la fenêtre."); openWindow(); setTimeout(() => process.exit(0), 500); }
  else { console.error(err); process.exit(1); }
});
server.listen(PORT, "127.0.0.1", () => {
  console.log(`\n  J.A.R.V.I.S. en ligne sur ${URL_APP}`);
  console.log("  Laisse cette fenêtre ouverte tant que tu utilises Jarvis. Ferme-la pour l'arrêter.\n");
  openWindow();
});
