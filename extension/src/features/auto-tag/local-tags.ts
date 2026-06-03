import { suggestTags } from "../../lib/tag-suggest";
import { domainFromUrl, normalizeTags } from "../../lib/url";
import { cosineSimilarity } from "../smart-collection/semantic-match";
import { CATCH_ALL_FOLDER_NAMES } from "../smart-collection/structure-guard";
import type { TagCandidate } from "./types";
import { initEmbeddingTagger } from "./embedding-tagger";

const TAG_SIM_THRESHOLD = 0.4;
const NEIGHBOR_SIM_THRESHOLD = 0.52;
const MAX_NEIGHBORS = 8;

export interface LocalTagResult {
  tags: string[];
  confidence: number;
  reasoning: string;
}

function pathToTags(path: string[]): string[] {
  const out: string[] = [];
  for (const seg of path) {
    if (!seg || CATCH_ALL_FOLDER_NAMES.has(seg.toLowerCase())) continue;
    const t = seg.trim().toLowerCase().replace(/\s+/g, "-");
    if (t.length >= 2) out.push(t);
  }
  return normalizeTags(out);
}

function bookmarkEmbedText(c: TagCandidate): string {
  const host = domainFromUrl(c.href);
  return `${c.title || ""} ${host} ${c.href} ${c.path.join(" ")}`.trim().slice(0, 512);
}

export async function suggestTagsLocalForCandidates(
  candidates: TagCandidate[],
  maxTags: number,
  vocabulary: string[],
  onStatus?: (message: string) => void
): Promise<Map<string, LocalTagResult>> {
  const out = new Map<string, LocalTagResult>();
  if (!candidates.length) return out;

  const provider = await initEmbeddingTagger(onStatus);

  onStatus?.("Loading MiniLM for local tagging…");
  const candidateTexts = candidates.map(bookmarkEmbedText);
  const candidateVecs = await provider.embedTexts(candidateTexts);

  const vocabTags = normalizeTags(vocabulary).filter((t) => t.length >= 2);
  const tagVecs =
    vocabTags.length > 0
      ? await provider.embedTexts(vocabTags.map((t) => `topic: ${t}`))
      : [];

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const vec = candidateVecs[i];
    if (!vec) continue;

    const existing = new Set(c.existingTags.map((t) => t.toLowerCase()));
    const scored = new Map<string, number>();

    const add = (tag: string, score: number) => {
      const t = normalizeTags([tag])[0];
      if (!t || existing.has(t)) return;
      scored.set(t, Math.max(scored.get(t) || 0, score));
    };

    for (const t of suggestTags(c.href, c.title, maxTags + 2)) add(t, 0.55);
    for (const t of pathToTags(c.path)) add(t, 0.62);

    for (let ti = 0; ti < vocabTags.length; ti++) {
      const sim = cosineSimilarity(vec, tagVecs[ti]);
      if (sim >= TAG_SIM_THRESHOLD) add(vocabTags[ti], sim);
    }

    const neighborScores: { idx: number; sim: number }[] = [];
    for (let j = 0; j < candidates.length; j++) {
      if (i === j) continue;
      const other = candidateVecs[j];
      if (!other) continue;
      const sim = cosineSimilarity(vec, other);
      if (sim >= NEIGHBOR_SIM_THRESHOLD) neighborScores.push({ idx: j, sim });
    }
    neighborScores.sort((a, b) => b.sim - a.sim);
    for (const { idx, sim } of neighborScores.slice(0, MAX_NEIGHBORS)) {
      for (const t of candidates[idx].existingTags) add(t, sim * 0.95);
      for (const t of pathToTags(candidates[idx].path)) add(t, sim * 0.85);
    }

    const ranked = [...scored.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxTags);

    if (!ranked.length) continue;

    const tags = ranked.map(([t]) => t);
    const avgScore = ranked.reduce((s, [, sc]) => s + sc, 0) / ranked.length;
    out.set(c.id, {
      tags,
      confidence: Math.min(92, Math.round(55 + avgScore * 40)),
      reasoning: `Local tags (MiniLM): ${tags.join(", ")}`,
    });
  }

  return out;
}

export { isGeminiRateLimitError as isGeminiQuotaError } from "../../lib/gemini-errors";
