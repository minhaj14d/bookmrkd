import type { BookmarkRecord } from "../../lib/bookmarks/types";
import type { FolderProfile, HealthFactors } from "./types";
import { pathKey } from "./structure-guard";

const UNCATEGORIZED_NAMES = new Set([
  "other bookmarks",
  "unsorted",
  "uncategorized",
  "bookmark bar",
  "bookmarks bar",
]);

export interface HealthInput {
  bookmarks: BookmarkRecord[];
  folders: FolderProfile[];
  exactDuplicateCount: number;
  fuzzyDuplicateCount: number;
}

export function computeHealthFactors(input: HealthInput): HealthFactors {
  const total = Math.max(1, input.bookmarks.length);
  const dup = input.exactDuplicateCount + input.fuzzyDuplicateCount;
  const duplicateRatio = dup / total;

  let uncategorized = 0;
  for (const b of input.bookmarks) {
    const last = (b.originalPath[b.originalPath.length - 1] || "").toLowerCase();
    if (!b.originalPath.length || UNCATEGORIZED_NAMES.has(last)) uncategorized++;
  }
  const uncategorizedRatio = uncategorized / total;

  const depths = input.bookmarks.map((b) => b.originalPath.length);
  const avgDepth = depths.reduce((a, d) => a + d, 0) / total;

  const smallFolders = input.folders.filter((f) => f.bookmarkCount > 0 && f.bookmarkCount < 3).length;
  const fragmentationRatio =
    input.folders.length > 0 ? smallFolders / input.folders.length : 0;

  return {
    duplicateRatio,
    uncategorizedRatio,
    avgDepth,
    fragmentationRatio,
    deadLinkRatio: 0,
  };
}

export function healthScoreFromFactors(f: HealthFactors): number {
  let score = 100;
  score -= 35 * f.duplicateRatio;
  score -= 25 * f.uncategorizedRatio;
  if (f.avgDepth > 4) score -= Math.min(15, (f.avgDepth - 4) * 5);
  score -= 20 * f.fragmentationRatio;
  score -= 10 * f.deadLinkRatio;
  return Math.round(Math.max(0, Math.min(100, score)));
}

export function computeHealthScore(input: HealthInput): { score: number; factors: HealthFactors } {
  const factors = computeHealthFactors(input);
  return { score: healthScoreFromFactors(factors), factors };
}

export function folderProfilesFromBookmarks(bookmarks: BookmarkRecord[]): FolderProfile[] {
  const map = new Map<string, FolderProfile>();
  for (const b of bookmarks) {
    for (let i = 1; i <= b.originalPath.length; i++) {
      const segments = b.originalPath.slice(0, i);
      const key = pathKey(segments);
      if (!map.has(key)) {
        map.set(key, {
          pathKey: key,
          segments,
          depth: segments.length,
          bookmarkCount: 0,
          domains: {},
          titleTokens: [],
          sampleTitles: [],
        });
      }
    }
    if (b.originalPath.length) {
      const leaf = pathKey(b.originalPath);
      const prof = map.get(leaf);
      if (prof) {
        prof.bookmarkCount++;
        const host = tryHost(b.href);
        if (host) prof.domains[host] = (prof.domains[host] || 0) + 1;
        if (prof.sampleTitles.length < 20) prof.sampleTitles.push(b.title || b.href);
        for (const t of tokenize(b.title)) prof.titleTokens.push(t);
      }
    }
  }
  return [...map.values()];
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

function tokenize(title: string): string[] {
  return (title || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2)
    .slice(0, 12);
}
