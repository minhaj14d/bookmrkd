import type { BookmarkRecord } from "../../lib/bookmarks/types";
import type { BookmarkClassifierProvider } from "./providers/BookmarkClassifierProvider";
import type { FolderProfile } from "./types";
import { pathKey, shouldBlockNewFolder, isDepthAllowed } from "./structure-guard";

export function bookmarkText(bm: BookmarkRecord): string {
  const host = tryHost(bm.href);
  return `${bm.title || ""} ${host} ${bm.href}`.trim();
}

export function folderCentroidText(folder: FolderProfile): string {
  const name = folder.segments[folder.segments.length - 1] || "";
  const topDomains = Object.entries(folder.domains)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([d]) => d)
    .join(" ");
  const samples = folder.sampleTitles.slice(0, 20).join(" ");
  return `${name} ${topDomains} ${samples}`.trim();
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom ? dot / denom : 0;
}

export async function bestFolderForBookmark(
  bookmark: BookmarkRecord,
  folders: FolderProfile[],
  provider: BookmarkClassifierProvider,
  neighbors: BookmarkRecord[],
  semanticThreshold: number
): Promise<{ folder: FolderProfile | null; score: number; reasoning: string }> {
  const currentPath = bookmark.originalPath;
  let best: FolderProfile | null = null;
  let bestScore = 0;
  let bestReason = "";

  const candidates = folders.filter((f) => f.bookmarkCount > 0 && f.segments.length > 0);
  const sameParent = candidates.filter((f) => {
    if (f.segments.length < 2) return true;
    return f.segments.slice(0, -1).join("/") === currentPath.slice(0, -1).join("/");
  });
  const pool = sameParent.length ? sameParent : candidates;

  for (const folder of pool) {
    if (pathKey(folder.segments) === pathKey(currentPath)) continue;
    const { score, reasoning } = await provider.scoreBookmarkFolder(bookmark, folder, neighbors);
    if (score > bestScore) {
      bestScore = score;
      best = folder;
      bestReason = reasoning;
    }
  }

  if (provider.capabilities.embeddings) {
    const [bmVec] = await provider.embedTexts([bookmarkText(bookmark)]);
    for (const folder of pool.slice(0, 80)) {
      const [fVec] = await provider.embedTexts([folderCentroidText(folder)]);
      const sim = cosineSimilarity(bmVec, fVec);
      if (sim > bestScore) {
        bestScore = sim;
        best = folder;
        bestReason = `semantic similarity ${(sim * 100).toFixed(0)}%`;
      }
    }
  }

  if (bestScore < semanticThreshold) return { folder: null, score: bestScore, reasoning: bestReason };
  return { folder: best, score: bestScore, reasoning: bestReason };
}

export function canSuggestMoveTo(
  targetSegments: string[],
  folders: FolderProfile[],
  proposedLeafName: string
): boolean {
  const parent = targetSegments.slice(0, -1);
  const leaf = targetSegments[targetSegments.length - 1] || proposedLeafName;
  if (shouldBlockNewFolder(leaf, parent, folders)) return false;
  return isDepthAllowed(targetSegments.length, folders);
}

function tryHost(href: string): string {
  try {
    let h = new URL(href).hostname.toLowerCase();
    if (h.startsWith("www.")) h = h.slice(4);
    return h;
  } catch {
    return "";
  }
}
