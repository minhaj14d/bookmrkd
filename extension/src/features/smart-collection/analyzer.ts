import type { BookmarkRecord } from "../../lib/bookmarks/types";
import { folderProfilesFromBookmarks } from "./health-score";
import type { AnalysisContext } from "./types";
import { pathKey } from "./structure-guard";

export function buildNeighborsMap(bookmarks: BookmarkRecord[]): Map<string, BookmarkRecord[]> {
  const byFolder = new Map<string, BookmarkRecord[]>();
  for (const b of bookmarks) {
    const key = pathKey(b.originalPath);
    if (!byFolder.has(key)) byFolder.set(key, []);
    byFolder.get(key)!.push(b);
  }
  const out = new Map<string, BookmarkRecord[]>();
  for (const b of bookmarks) {
    if (!b.chromeId) continue;
    const key = pathKey(b.originalPath);
    const peers = (byFolder.get(key) || []).filter((p) => p.chromeId !== b.chromeId);
    out.set(b.chromeId, peers.slice(0, 12));
  }
  return out;
}

export function buildAnalysisContext(bookmarks: BookmarkRecord[]): AnalysisContext {
  return {
    bookmarks,
    folders: folderProfilesFromBookmarks(bookmarks),
    neighborsByChromeId: buildNeighborsMap(bookmarks),
  };
}
