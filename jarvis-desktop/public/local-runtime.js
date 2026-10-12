// Pont local : fournit à l'interface Jarvis les mêmes fonctions que sur claude.ai
// (window.claude.use("db") et window.claude.use("sample")), mais branchées sur le serveur local.
(function () {
  const COLS = ["goals", "projects", "companies", "transactions", "clients", "chat", "settings"];
  const state = Object.fromEntries(COLS.map(c => [c, new Map()]));
  const listeners = new Set();

  const ready = fetch("/api/state").then(r => r.json()).then(all => {
    for (const c of COLS) for (const { id, ...d } of all[c] || []) state[c].set(id, d);
  });

  async function api(method, url, data) {
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: data === undefined ? undefined : JSON.stringify(data) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) throw { code: "unavailable", message: (j.error && j.error.message) || "Le serveur Jarvis ne répond pas. Relance-le." };
    return j;
  }

  const docSnap = (id, d) => ({ id, exists: d !== undefined, data: () => (d === undefined ? undefined : { ...d }), metadata: { fromCache: false, hasPendingWrites: false } });
  function querySnap(col, q) {
    let docs = [...state[col].entries()].map(([id, d]) => ({ id, d }));
    if (q.orderBy) {
      const f = q.orderBy, s = q.dir === "desc" ? -1 : 1;
      docs.sort((a, b) => (a.d[f] > b.d[f] ? 1 : a.d[f] < b.d[f] ? -1 : 0) * s);
    }
    if (q.limit) docs = docs.slice(0, q.limit);
    const out = docs.map(x => docSnap(x.id, x.d));
    return { docs: out, size: out.length, empty: !out.length, docChanges: () => [], metadata: { fromCache: false, hasPendingWrites: false } };
  }
  function fire(l) {
    try {
      if (l.docId) l.fn(docSnap(l.docId, state[l.col].get(l.docId)));
      else l.fn(querySnap(l.col, l.q));
    } catch (e) { console.error(e); }
  }
  function notify(col) { for (const l of listeners) if (l.col === col) fire(l); }
  function check(col) { if (!state[col]) throw { code: "invalid_argument", message: "Collection inconnue : " + col }; }

  function docRef(col, id) {
    check(col);
    return {
      id, path: col + "/" + id,
      async get() { await ready; return docSnap(id, state[col].get(id)); },
      async set(data) { await api("PUT", `/api/db/${col}/${id}`, data); state[col].set(id, { ...data }); notify(col); },
      async update(data) { await api("PATCH", `/api/db/${col}/${id}`, data); state[col].set(id, { ...(state[col].get(id) || {}), ...data }); notify(col); },
      async delete() { await api("DELETE", `/api/db/${col}/${id}`); state[col].delete(id); notify(col); },
      onSnapshot(fn) { const l = { col, docId: id, fn }; listeners.add(l); ready.then(() => listeners.has(l) && fire(l)); return () => listeners.delete(l); },
    };
  }
  function query(col, q = {}) {
    check(col);
    return {
      path: col,
      where() { return query(col, q); },
      orderBy(field, dir) { return query(col, { ...q, orderBy: field, dir }); },
      limit(n) { return query(col, { ...q, limit: n }); },
      async get() { await ready; return querySnap(col, q); },
      onSnapshot(fn) { const l = { col, q, fn }; listeners.add(l); ready.then(() => listeners.has(l) && fire(l)); return () => listeners.delete(l); },
      doc(id) { return docRef(col, id || Math.random().toString(36).slice(2, 14)); },
      async add(data) { const { id } = await api("POST", `/api/db/${col}`, data); state[col].set(id, { ...data }); notify(col); return docRef(col, id); },
    };
  }
  const db = {
    collection: col => query(col),
    doc: p => { const [col, id] = String(p).split("/"); return docRef(col, id); },
  };

  /* ---------- Claude (boucle d'outils) ---------- */
  async function sample(input, opts = {}) {
    const messages = typeof input === "string" ? [{ role: "user", content: input }] : input.map(m => ({ role: m.role, content: m.content }));
    const defs = opts.tools || [];
    const tools = defs.map(t => ({ name: t.name, description: t.description, input_schema: t.inputSchema || { type: "object", properties: {} } }));
    const byName = Object.fromEntries(defs.map(t => [t.name, t]));
    let text = "";
    for (let turn = 0; turn < 10; turn++) {
      if (opts.signal && opts.signal.aborted) throw { code: "cancelled", message: "Annulé" };
      let res;
      try {
        const r = await fetch("/api/claude", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages, tools, tier: opts.modelTier || "default" }), signal: opts.signal });
        res = await r.json();
      } catch (e) { throw { code: "upstream_error", message: "Le serveur Jarvis ne répond pas. Relance-le." }; }
      if (res.error) {
        if (res.error.code === "no_key" || res.error.code === "bad_key" || res.error.code === "no_credit") openSettings(res.error.message);
        throw { code: res.error.code === "rate_limited" ? "rate_limited" : "upstream_error", message: res.error.message };
      }
      if (res.stop_reason === "refusal") throw { code: "refused", message: "Claude a refusé de répondre à cette demande." };
      const t = (res.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
      if (t) { text = t; if (opts.onText) opts.onText({ text, delta: t }); }
      const uses = (res.content || []).filter(b => b.type === "tool_use");
      if (res.stop_reason === "pause_turn") { messages.push({ role: "assistant", content: res.content }); continue; }
      if (res.stop_reason !== "tool_use" || !uses.length) return { text, truncated: res.stop_reason === "max_tokens", modelTierApplied: opts.modelTier || "default", modelApplied: res.model };
      messages.push({ role: "assistant", content: res.content });
      const results = await Promise.all(uses.map(async u => {
        try {
          const tool = byName[u.name];
          if (!tool) throw new Error("Outil inconnu : " + u.name);
          const out = await tool.execute(u.input || {}, { signal: opts.signal || new AbortController().signal });
          return { type: "tool_result", tool_use_id: u.id, content: JSON.stringify(out === undefined ? { ok: true } : out) };
        } catch (e) {
          return { type: "tool_result", tool_use_id: u.id, content: String((e && e.message) || e), is_error: true };
        }
      }));
      messages.push({ role: "user", content: results });
    }
    return { text, truncated: true, modelTierApplied: opts.modelTier || "default" };
  }
  sample.json = async (input, opts) => { const r = await sample(input, opts); const m = r.text.match(/[\[{][\s\S]*[\]}]/); try { return JSON.parse(m ? m[0] : r.text); } catch { throw { code: "invalid_json", message: "Réponse illisible", text: r.text }; } };
  sample.limits = async () => ({ maxPromptBytes: 4e6, tools: { maxCount: 64 } });

  window.claude = { use: async name => (name === "db" ? db : name === "sample" ? sample : null) };
  window.JARVIS_LOCAL = true;

  /* ---------- Réglages (clé API, export) ---------- */
  const dlg = document.createElement("dialog");
  dlg.id = "settingsDlg";
  dlg.innerHTML = `<form method="dialog" id="settingsForm">
    <h3>Réglages de Jarvis</h3>
    <p id="settingsMsg" style="margin:0;color:var(--warn)"></p>
    <div class="field"><label for="apiKey">Clé API Anthropic</label>
      <input id="apiKey" type="password" autocomplete="off" placeholder="sk-ant-…">
      <span class="hint" id="keyHint">Crée ta clé sur <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener" style="color:var(--accent)">console.anthropic.com</a> (Settings → API Keys). Elle reste sur ton ordinateur, dans le dossier data.</span></div>
    <div class="field"><label>Tes données</label>
      <span class="hint">Elles sont enregistrées dans le dossier <b>data</b> de Jarvis, avec une sauvegarde automatique par jour.</span>
      <div><a class="btn small" href="/api/export" download>Exporter mes données</a></div></div>
    <div class="field"><label>Raccourci</label><span class="hint"><b>Ctrl + J</b> démarre ou arrête la conversation vocale.</span></div>
    <div class="actions"><span class="spacer"></span><button type="button" class="btn" id="settingsClose">Fermer</button><button type="submit" class="btn primary">Enregistrer</button></div>
  </form>`;
  function openSettings(msg) {
    document.getElementById("settingsMsg").textContent = msg || "";
    fetch("/api/config").then(r => r.json()).then(c => {
      document.getElementById("apiKey").placeholder = c.hasKey ? "Clé enregistrée (" + c.keyHint + "). Colle une nouvelle clé pour la remplacer." : "sk-ant-…";
    }).catch(() => {});
    if (!dlg.open) dlg.showModal();
  }
  window.openSettings = openSettings;
  document.addEventListener("DOMContentLoaded", () => {
    document.body.appendChild(dlg);
    document.getElementById("settingsClose").addEventListener("click", () => dlg.close());
    document.getElementById("settingsForm").addEventListener("submit", async e => {
      e.preventDefault();
      const key = document.getElementById("apiKey").value.trim();
      if (key && !/^sk-ant-/.test(key)) { document.getElementById("settingsMsg").textContent = "Cette clé ne ressemble pas à une clé Anthropic (elle commence par « sk-ant- »)."; return; }
      if (key) await fetch("/api/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey: key }) });
      document.getElementById("apiKey").value = "";
      dlg.close();
    });
    const foot = document.querySelector(".rail-foot");
    if (foot) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "btn small"; b.textContent = "Réglages";
      b.addEventListener("click", () => openSettings());
      foot.appendChild(b);
    }
    fetch("/api/config").then(r => r.json()).then(c => { if (!c.hasKey) openSettings("Bienvenue ! Pour que Jarvis puisse réfléchir et te répondre, colle ta clé API Anthropic."); }).catch(() => {});
  });
  document.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
      e.preventDefault();
      if (typeof window.convo !== "undefined" || typeof startConvo === "function") {
        try { if (convo) stopConvo(false); else startConvo(); } catch (_) {}
      }
    }
  });
})();
