import { normalizeTags } from "../../lib/url";
import { buildPatternKey } from "../smart-collection/feedback-store";
import type { Suggestion } from "../smart-collection/types";
import { disposeEmbeddingTagger } from "./embedding-tagger";
import { suggestTagsBatchGemini } from "./gemini-tags";
import { isGeminiQuotaError, suggestTagsLocalForCandidates } from "./local-tags";
import { loadTagCandidates } from "./load-candidates";
import type { AutoTagOptions, AutoTagProgress, TagCandidate, TagTargetSource } from "./types";

let seq = 0;

function nextId(): string {
  return `tag-${Date.now()}-${++seq}`;
}

function buildVocabulary(candidates: TagCandidate[]): string[] {
  const counts = new Map<string, number>();
  for (const c of candidates) {
    for (const t of c.existingTags) {
      const n = normalizeTags([t])[0];
      if (n) counts.set(n, (counts.get(n) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t);
}

function pushSuggestion(
  suggestions: Suggestion[],
  jobId: string,
  c: TagCandidate,
  newOnly: string[],
  confidence: number,
  reasoning: string,
  providerId: string
): void {
  if (!newOnly.length) return;
  suggestions.push({
    id: nextId(),
    jobId,
    kind: "tag",
    confidence,
    reasoning,
    preview: {
      title: c.title,
      href: c.href,
      chromeId: c.source === "raindrop" ? c.id : null,
      fromPath: [...c.path],
      suggestedTags: newOnly,
      existingTags: [...c.existingTags],
      raindropItemId: c.raindropItemId,
      libraryId: c.libraryId,
      tagSource: c.source,
    },
    status: "pending",
    createdAt: Date.now(),
    providerId,
    signals: ["auto-tag", providerId],
    patternKey: buildPatternKey("tag", c.path, undefined, newOnly.join(",")),
  });
}

async function collectLocalSuggestions(
  batch: TagCandidate[],
  jobId: string,
  options: AutoTagOptions,
  vocabulary: string[],
  suggestions: Suggestion[],
  onStatus?: (message: string) => void
): Promise<void> {
  const results = await suggestTagsLocalForCandidates(
    batch,
    options.maxTags,
    vocabulary,
    onStatus
  );
  for (const c of batch) {
    const r = results.get(c.id);
    if (!r?.tags.length) continue;
    const newOnly = r.tags.filter(
      (t) => !c.existingTags.map((x) => x.toLowerCase()).includes(t.toLowerCase())
    );
    pushSuggestion(suggestions, jobId, c, newOnly, r.confidence, r.reasoning, "transformers");
  }
}

async function collectGeminiSuggestions(
  batch: TagCandidate[],
  jobId: string,
  options: AutoTagOptions,
  vocabulary: string[],
  suggestions: Suggestion[]
): Promise<void> {
  if (!options.apiKey?.trim()) {
    throw new Error("Gemini API key required. Use Local (MiniLM) or add a key in Advanced.");
  }
  const tagMap = await suggestTagsBatchGemini(
    batch,
    options.apiKey,
    options.geminiModel || "gemini-2.0-flash",
    options.maxTags,
    vocabulary
  );
  for (const c of batch) {
    const add = tagMap.get(c.id);
    if (!add?.length) continue;
    const newOnly = add.filter(
      (t) => !c.existingTags.map((x) => x.toLowerCase()).includes(t.toLowerCase())
    );
    pushSuggestion(
      suggestions,
      jobId,
      c,
      newOnly,
      88,
      `Add tags: ${newOnly.join(", ")}`,
      "gemini"
    );
  }
}

export interface AutoTagRunResult {
  jobId: string;
  suggestions: Suggestion[];
  usedLocalFallback?: boolean;
}

export async function runAutoTagSuggestions(
  source: TagTargetSource,
  options: AutoTagOptions,
  onProgress?: (p: AutoTagProgress) => void
): Promise<AutoTagRunResult> {
  const jobId = `tag-job-${Date.now()}`;
  onProgress?.({ phase: "Loading bookmarks…", done: 0, total: 0 });

  let candidates = await loadTagCandidates(source, (msg) =>
    onProgress?.({ phase: msg, done: 0, total: 0 })
  );

  if (options.untaggedOnly) {
    candidates = candidates.filter((c) => c.existingTags.length === 0);
  }

  if (candidates.length > options.maxBookmarks) {
    candidates = candidates.slice(0, options.maxBookmarks);
  }

  const vocabulary = buildVocabulary(candidates);
  const suggestions: Suggestion[] = [];
  let usedLocalFallback = false;

  try {
    if (options.provider === "local") {
      const localBatch = 40;
      for (let i = 0; i < candidates.length; i += localBatch) {
        const batch = candidates.slice(i, i + localBatch);
        onProgress?.({
          phase: `Local MiniLM ${Math.min(i + localBatch, candidates.length)}/${candidates.length}…`,
          done: i,
          total: candidates.length,
        });
        await collectLocalSuggestions(batch, jobId, options, vocabulary, suggestions, (msg) =>
          onProgress?.({ phase: msg, done: i, total: candidates.length })
        );
      }
    } else {
      const batchSize = 10;
      const totalBatches = Math.ceil(candidates.length / batchSize) || 1;

      for (let i = 0; i < candidates.length; i += batchSize) {
        const batch = candidates.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;

        try {
          onProgress?.({
            phase: `Gemini batch ${batchNum}/${totalBatches}…`,
            done: i,
            total: candidates.length,
          });
          await collectGeminiSuggestions(batch, jobId, options, vocabulary, suggestions);
        } catch (e) {
          if (
            (options.provider === "auto" || options.provider === "gemini") &&
            isGeminiQuotaError(e)
          ) {
            usedLocalFallback = true;
            onProgress?.({
              phase: `Gemini rate limited (429) — local MiniLM for remaining ${candidates.length - i}…`,
              done: i,
              total: candidates.length,
            });
            const rest = candidates.slice(i);
            const localBatch = 40;
            for (let j = 0; j < rest.length; j += localBatch) {
              const lb = rest.slice(j, j + localBatch);
              await collectLocalSuggestions(
                lb,
                jobId,
                options,
                vocabulary,
                suggestions,
                (msg) => onProgress?.({ phase: msg, done: i + j, total: candidates.length })
              );
            }
            break;
          }
          throw e;
        }
      }
    }
  } finally {
    await disposeEmbeddingTagger();
  }

  onProgress?.({ phase: "Done", done: candidates.length, total: candidates.length });
  return { jobId, suggestions, usedLocalFallback };
}
