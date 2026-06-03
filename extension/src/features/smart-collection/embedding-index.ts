import type { BookmarkRecord } from "../../lib/bookmarks/types";
import type { BookmarkClassifierProvider } from "./providers/BookmarkClassifierProvider";
import { bookmarkText, folderCentroidText, cosineSimilarity } from "./semantic-match";
import { pathKey } from "./structure-guard";
import type { FolderProfile } from "./types";

export interface EmbeddingIndex {
  bookmarkMap: Map<string, Float32Array>;
  folderMap: Map<string, Float32Array>;
}

const BATCH = 32;

export async function buildEmbeddingIndex(
  provider: BookmarkClassifierProvider,
  bookmarks: BookmarkRecord[],
  folders: FolderProfile[],
  onStatus?: (message: string) => void
): Promise<EmbeddingIndex> {
  const folderMap = new Map<string, Float32Array>();
  const bookmarkMap = new Map<string, Float32Array>();

  const folderRows = folders
    .filter((f) => f.bookmarkCount > 0 && f.segments.length > 0)
    .map((f) => ({ key: pathKey(f.segments), text: folderCentroidText(f) }));

  onStatus?.(`Embedding ${folderRows.length} folders…`);
  for (let i = 0; i < folderRows.length; i += BATCH) {
    const chunk = folderRows.slice(i, i + BATCH);
    const vecs = await provider.embedTexts(chunk.map((c) => c.text));
    chunk.forEach((row, j) => folderMap.set(row.key, vecs[j]));
  }

  const bookmarkRows = bookmarks
    .filter((b) => b.chromeId)
    .map((b) => ({ id: b.chromeId as string, text: bookmarkText(b) }));

  for (let i = 0; i < bookmarkRows.length; i += BATCH) {
    const chunk = bookmarkRows.slice(i, i + BATCH);
    onStatus?.(`Embedding bookmarks ${Math.min(i + BATCH, bookmarkRows.length)}/${bookmarkRows.length}…`);
    const vecs = await provider.embedTexts(chunk.map((c) => c.text));
    chunk.forEach((row, j) => bookmarkMap.set(row.id, vecs[j]));
  }

  return { folderMap, bookmarkMap };
}

export function bestFolderFromIndex(
  bookmark: BookmarkRecord,
  folders: FolderProfile[],
  index: EmbeddingIndex,
  semanticThreshold: number
): { folder: FolderProfile | null; score: number; reasoning: string } {
  const chromeId = bookmark.chromeId;
  const bmVec = chromeId ? index.bookmarkMap.get(chromeId) : undefined;
  if (!bmVec) {
    return { folder: null, score: 0, reasoning: "no embedding" };
  }

  const currentPath = bookmark.originalPath;
  const candidates = folders.filter((f) => f.bookmarkCount > 0 && f.segments.length > 0);
  const sameParent = candidates.filter((f) => {
    if (f.segments.length < 2) return true;
    return f.segments.slice(0, -1).join("/") === currentPath.slice(0, -1).join("/");
  });
  const pool = sameParent.length ? sameParent : candidates;

  let best: FolderProfile | null = null;
  let bestScore = 0;

  for (const folder of pool) {
    if (pathKey(folder.segments) === pathKey(currentPath)) continue;
    const fVec = index.folderMap.get(pathKey(folder.segments));
    if (!fVec) continue;
    const sim = cosineSimilarity(bmVec, fVec);
    if (sim > bestScore) {
      bestScore = sim;
      best = folder;
    }
  }

  if (bestScore < semanticThreshold) {
    return { folder: null, score: bestScore, reasoning: "" };
  }
  return {
    folder: best,
    score: bestScore,
    reasoning: `semantic similarity ${(bestScore * 100).toFixed(0)}%`,
  };
}
