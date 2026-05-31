import { hostKey } from "../../../lib/bookmarks/host-key";
import { titleSimilarity } from "../../../lib/bookmarks/title-similarity";
import type { BookmarkRecord } from "../../../lib/bookmarks/types";
import type { FolderProfile, ProviderConfig } from "../types";
import type { BookmarkClassifierProvider, FolderScoreResult } from "./BookmarkClassifierProvider";

export class RuleBasedProvider implements BookmarkClassifierProvider {
  readonly id = "rule";
  readonly label = "Local rules";
  readonly capabilities = { embeddings: false, batchSize: 500, requiresNetwork: false };

  async init(_config: ProviderConfig): Promise<void> {}

  async embedTexts(texts: string[]): Promise<Float32Array[]> {
    return texts.map((t) => pseudoEmbed(t));
  }

  async scoreBookmarkFolder(
    bookmark: BookmarkRecord,
    folder: FolderProfile,
    neighbors: BookmarkRecord[]
  ): Promise<FolderScoreResult> {
    const h = hostKey(bookmark.href);
    const domainHits = folder.domains[h] || 0;
    const title = (bookmark.title || "").toLowerCase();
    const folderName = folder.segments[folder.segments.length - 1]?.toLowerCase() || "";
    let score = 0;
    const reasons: string[] = [];

    if (domainHits > 0) {
      score += Math.min(0.45, domainHits * 0.12);
      reasons.push(`${domainHits} similar domain(s) in folder`);
    }

    if (folderName && title.includes(folderName)) {
      score += 0.25;
      reasons.push("title mentions folder name");
    }

    for (const tok of folder.titleTokens.slice(0, 30)) {
      if (tok.length > 3 && title.includes(tok)) {
        score += 0.03;
      }
    }

    let neighborInFolder = 0;
    for (const n of neighbors) {
      if (pathEqual(n.originalPath, folder.segments)) neighborInFolder++;
    }
    if (neighborInFolder > 0) {
      score += Math.min(0.35, neighborInFolder * 0.08);
      reasons.push(`${neighborInFolder} neighbor(s) in same folder`);
    }

    for (const sample of folder.sampleTitles.slice(0, 5)) {
      if (titleSimilarity(title, sample) > 0.55) {
        score += 0.1;
        reasons.push("similar to bookmarks already in folder");
        break;
      }
    }

    return {
      score: Math.min(1, score),
      reasoning: reasons.length ? reasons.join("; ") : "weak rule match",
    };
  }

  async dispose(): Promise<void> {}
}

function pathEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((s, i) => s === b[i]);
}

function pseudoEmbed(text: string): Float32Array {
  const dim = 32;
  const v = new Float32Array(dim);
  const s = text.toLowerCase();
  for (let i = 0; i < s.length; i++) {
    v[i % dim] += s.charCodeAt(i) / 255;
  }
  const norm = Math.sqrt(v.reduce((a, x) => a + x * x, 0)) || 1;
  for (let i = 0; i < dim; i++) v[i] /= norm;
  return v;
}
