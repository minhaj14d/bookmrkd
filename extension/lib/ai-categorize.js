import { normalizeUrl } from "./organizer.js";
import { getProvider } from "./ai-providers.js";

/**
 * @param {string} text
 */
function extractJsonArray(text) {
  const t = text.trim();
  const fence = /```(?:json)?\s*(\[[\s\S]*?\])\s*```/i.exec(t);
  if (fence) {
    try {
      return JSON.parse(fence[1]);
    } catch {
      /* continue */
    }
  }
  const m = /\[[\s\S]*\]/.exec(t);
  if (m) {
    try {
      return JSON.parse(m[0]);
    } catch {
      /* continue */
    }
  }
  try {
    const p = JSON.parse(t);
    if (Array.isArray(p)) return p;
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * @param {unknown[]} arr
 */
function rowsToMap(arr) {
  /** @type {Map<string, { top: string, sub: string|null }>} */
  const out = new Map();
  for (const row of arr) {
    if (!row || typeof row !== "object") continue;
    const r = /** @type {Record<string, unknown>} */ (row);
    const href = r.href;
    if (!href) continue;
    const nk = normalizeUrl(String(href));
    if (!nk) continue;
    const sub = r.sub != null && r.sub !== "" ? String(r.sub) : null;
    out.set(nk, { top: String(r.top || "Archive"), sub });
  }
  return out;
}

/**
 * @param {import('./organizer.js').BookmarkRecord[]} items
 */
function taskPayload(items) {
  const payload = items.map((b) => ({ href: b.href, title: (b.title || "").slice(0, 200) }));
  const instr =
    "You classify browser bookmarks into: AI & Machine Learning, Data Science, Mathematics, Research, " +
    "Web Development, Design, Productivity, Career & Jobs, Learning, Linux & Systems, Security, Archive. " +
    'Reply with a single JSON array only: [{"href":"...","top":"...","sub":"..."}, ...] where sub may be null.';
  return `${instr}\n\nBookmarks JSON:\n${JSON.stringify(payload)}`;
}

/**
 * @param {import('./organizer.js').BookmarkRecord[]} items
 * @param {string} apiKey
 * @param {string} model
 */
async function aiCategorizeGemini(items, apiKey, model) {
  if (!items.length) return { map: new Map(), error: null };
  const safeModel = model.trim().replace(/\//g, "");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(safeModel)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: taskPayload(items) }] }],
      generationConfig: { temperature: 0.2 },
    }),
  });
  const raw = await res.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return { map: new Map(), error: `Invalid Gemini response (${res.status})` };
  }
  if (!res.ok) {
    const msg = data?.error?.message || raw.slice(0, 220);
    if (res.status === 400) return { map: new Map(), error: "Invalid Gemini API key" };
    if (res.status === 429) return { map: new Map(), error: "Gemini quota exceeded" };
    return { map: new Map(), error: `Gemini HTTP ${res.status}: ${msg}` };
  }
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text = parts.map((p) => p.text || "").join("");
  const arr = extractJsonArray(text);
  if (!arr) return { map: new Map(), error: "Could not parse JSON from Gemini response" };
  return { map: rowsToMap(arr), error: null };
}

/**
 * @param {import('./organizer.js').BookmarkRecord[]} items
 * @param {import('./settings.js').BookmrkdSettings} settings
 * @param {string} apiKey
 */
async function categorizeBatch(items, settings, apiKey) {
  const prov = getProvider(settings.aiProvider);
  const model = settings.aiModel || prov.models[0]?.id;
  return aiCategorizeGemini(items, apiKey, model);
}

/**
 * @param {import('./organizer.js').BookmarkRecord[]} bookmarks
 * @param {import('./settings.js').BookmrkdSettings} settings
 * @param {Record<string, string>} keys
 * @param {(msg: string) => void} [onProgress]
 */
export async function applyAiAssist(bookmarks, settings, keys, onProgress) {
  const errors = [];
  if (settings.aiMode !== "on") return { errors };

  const apiKey = keys[settings.aiProvider] || "";
  if (!apiKey.trim()) {
    errors.push(`Missing ${getProvider(settings.aiProvider).label} API key — add it in Settings`);
    return { errors };
  }

  const low = bookmarks.filter(
    (b) =>
      b.relevance < 55 ||
      (b.categoryTop === "Archive" && (b.categorySub === "Uncategorized" || !b.categorySub))
  );
  const seen = new Set();
  /** @type {import('./organizer.js').BookmarkRecord[]} */
  const uniq = [];
  for (const b of low) {
    const k = normalizeUrl(b.href);
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(b);
  }

  const batchSize = 12;
  for (let i = 0; i < uniq.length; i += batchSize) {
    const batch = uniq.slice(i, i + batchSize);
    onProgress?.(`AI batch ${Math.floor(i / batchSize) + 1}…`);
    const result = await categorizeBatch(batch, settings, apiKey);
    if (result.error) errors.push(result.error);
    for (const bm of bookmarks) {
      const tup = result.map.get(normalizeUrl(bm.href));
      if (tup) {
        bm.categoryTop = tup.top;
        bm.categorySub = tup.sub;
        bm.categorizationSource = `ai:${settings.aiProvider}`;
      }
    }
  }
  return { errors };
}
