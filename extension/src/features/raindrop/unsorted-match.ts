import type { BookmarkRecord } from "../../lib/bookmarks/types";
import type { FolderProfile } from "../smart-collection/types";
import {
  isCatchAllFolderSegments,
  isUncategorizedBookmarkPath,
  pathKey,
} from "../smart-collection/structure-guard";
import { cosineSimilarity } from "../smart-collection/semantic-match";
import type { EmbeddingIndex } from "../smart-collection/embedding-index";
import type { BookmarkClassifierProvider } from "../smart-collection/providers/BookmarkClassifierProvider";
import { bestFolderForBookmark } from "../smart-collection/semantic-match";

/** Folders valid as move targets (not Unsorted / catch-all). */
export function targetFoldersForRaindrop(folders: FolderProfile[]): FolderProfile[] {
  return folders.filter(
    (f) => f.bookmarkCount > 0 && f.segments.length > 0 && !isCatchAllFolderSegments(f.segments)
  );
}

export function bestFolderFromIndexUnsorted(
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

  const pool = targetFoldersForRaindrop(folders);
  let best: FolderProfile | null = null;
  let bestScore = 0;

  for (const folder of pool) {
    if (pathKey(folder.segments) === pathKey(bookmark.originalPath)) continue;
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

export async function bestFolderForUnsortedBookmark(
  bookmark: BookmarkRecord,
  folders: FolderProfile[],
  embeddingIndex: EmbeddingIndex | null,
  providers: BookmarkClassifierProvider[],
  ruleProvider: BookmarkClassifierProvider,
  neighbors: BookmarkRecord[],
  semanticThreshold: number
): Promise<{ folder: FolderProfile | null; score: number; reasoning: string }> {
  const pool = targetFoldersForRaindrop(folders);
  let bestScore = 0;
  let bestFolder: FolderProfile | null = null;
  let bestReason = "";

  if (embeddingIndex) {
    const res = bestFolderFromIndexUnsorted(
      bookmark,
      folders,
      embeddingIndex,
      semanticThreshold
    );
    if (res.folder && res.score > bestScore) {
      bestScore = res.score;
      bestFolder = res.folder;
      bestReason = res.reasoning;
    }
  }

  for (const prov of providers) {
    const res = await bestFolderForBookmark(
      bookmark,
      pool.length ? pool : folders,
      prov,
      neighbors,
      semanticThreshold
    );
    if (res.folder && res.score > bestScore) {
      bestScore = res.score;
      bestFolder = res.folder;
      bestReason = res.reasoning;
    }
  }

  if (bestFolder) return { folder: bestFolder, score: bestScore, reasoning: bestReason };

  const ruleRes = await bestFolderForBookmark(
    bookmark,
    pool,
    ruleProvider,
    neighbors,
    semanticThreshold
  );
  return ruleRes;
}

export function isRaindropUnsortedPath(path: string[]): boolean {
  return isUncategorizedBookmarkPath(path);
}
