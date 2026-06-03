import { normalizeTags } from "../../lib/url";
import { geminiRateLimitError } from "../../lib/gemini-errors";
import type { TagCandidate } from "./types";

function extractJsonArray(text: string): unknown[] | null {
  const t = text.trim();
  const fence = /```(?:json)?\s*(\[[\s\S]*?\])\s*```/i.exec(t);
  if (fence) {
    try {
      return JSON.parse(fence[1]) as unknown[];
    } catch {
      /* continue */
    }
  }
  const m = /\[[\s\S]*\]/.exec(t);
  if (m) {
    try {
      return JSON.parse(m[0]) as unknown[];
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

function tagPayload(batch: TagCandidate[], maxTags: number, vocabulary: string[]): string {
  const items = batch.map((b) => ({
    id: b.id,
    title: (b.title || "").slice(0, 200),
    url: (b.href || "").slice(0, 300),
    collection: b.path.join(" > ") || "Unsorted",
    existingTags: b.existingTags,
  }));
  const vocabHint =
    vocabulary.length > 0
      ? `\nPrefer reusing these tags when relevant: ${vocabulary.slice(0, 40).join(", ")}`
      : "";
  return (
    `You assign search tags for bookmarks (like Raindrop.io). ` +
    `Rules: lowercase; use hyphens not spaces; 1-3 words per tag; ${maxTags} new tags max per item; ` +
    `tags should help search and grouping (topic, type, language, year if obvious). ` +
    `Do not duplicate existing tags. Only suggest NEW tags to add.` +
    vocabHint +
    `\nReply with a single JSON array only: [{"id":"...","add":["tag-one","tag-two"]}, ...] ` +
    `Use empty add [] if nothing to add.\n\nBookmarks:\n${JSON.stringify(items)}`
  );
}

export async function suggestTagsBatchGemini(
  batch: TagCandidate[],
  apiKey: string,
  model: string,
  maxTags: number,
  vocabulary: string[]
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (!batch.length) return out;

  const safeModel = model.trim().replace(/\//g, "") || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(safeModel)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: tagPayload(batch, maxTags, vocabulary) }] }],
      generationConfig: { temperature: 0.25, maxOutputTokens: 4096 },
    }),
  });

  const raw = await res.text();
  let data: { error?: { message?: string }; candidates?: { content?: { parts?: { text?: string }[] } }[] };
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid Gemini response (${res.status})`);
  }
  if (!res.ok) {
    const msg = data?.error?.message || raw.slice(0, 220);
    if (res.status === 400) throw new Error("Invalid Gemini API key");
    if (res.status === 429 || res.status === 503) throw geminiRateLimitError(res.status, msg);
    throw new Error(`Gemini HTTP ${res.status}: ${msg}`);
  }

  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  const arr = extractJsonArray(text);
  if (!arr) throw new Error("Could not parse tag JSON from Gemini");

  for (const row of arr) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = String(r.id || "");
    if (!id) continue;
    const addRaw = r.add ?? r.tags ?? r.newTags;
    if (!Array.isArray(addRaw)) continue;
    const add = normalizeTags(addRaw.map((t) => String(t))).slice(0, maxTags);
    if (add.length) out.set(id, add);
  }

  return out;
}
