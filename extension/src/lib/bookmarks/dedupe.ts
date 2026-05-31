import type { BookmarkRecord, ExactDedupeRemoved, FuzzyDedupeLog } from "./types";
import { hostKey } from "./host-key";
import { normalizeBookmarkUrl } from "./normalize-url";
import { titleSimilarity } from "./title-similarity";

function attrWeight(b: BookmarkRecord): number {
  return (b.title?.length || 0) + (b.href?.length || 0) + (b.addDate ? 8 : 0);
}

export function dedupeExact(bookmarks: BookmarkRecord[]): {
  kept: BookmarkRecord[];
  removed: ExactDedupeRemoved[];
} {
  const groups = new Map<string, BookmarkRecord[]>();
  for (const bm of bookmarks) {
    const k = normalizeBookmarkUrl(bm.href);
    if (!k) continue;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(bm);
  }
  const kept: BookmarkRecord[] = [];
  const removed: ExactDedupeRemoved[] = [];
  for (const [key, g] of groups) {
    const best = g.reduce((a, b) =>
      b.addDate > a.addDate || (b.addDate === a.addDate && attrWeight(b) > attrWeight(a)) ? b : a
    );
    kept.push(best);
    for (const b of g) {
      if (b !== best) {
        removed.push({
          norm: key,
          removedTitle: (b.title || "").slice(0, 160),
          keptTitle: (best.title || "").slice(0, 160),
          path: b.originalPath.length ? b.originalPath.join(" > ") : "(root)",
          removedChromeId: b.chromeId,
          keptChromeId: best.chromeId,
        });
      }
    }
  }
  return { kept, removed };
}

export function dedupeFuzzy(
  bookmarks: BookmarkRecord[],
  titleRatioThreshold = 0.88
): { kept: BookmarkRecord[]; fuzzyLog: FuzzyDedupeLog[] } {
  const byHost = new Map<string, BookmarkRecord[]>();
  for (const bm of bookmarks) {
    const h = hostKey(bm.href);
    if (!byHost.has(h)) byHost.set(h, []);
    byHost.get(h)!.push(bm);
  }
  const keptAll: BookmarkRecord[] = [];
  const fuzzyLog: FuzzyDedupeLog[] = [];
  for (const [host, group] of byHost) {
    if (group.length < 2) {
      keptAll.push(...group);
      continue;
    }
    group.sort((a, b) => b.addDate - a.addDate);
    const kept: BookmarkRecord[] = [];
    for (const bm of group) {
      let dupOf: BookmarkRecord | null = null;
      for (const k of kept) {
        if (titleSimilarity(bm.title, k.title) >= titleRatioThreshold) {
          dupOf = k;
          break;
        }
      }
      if (dupOf) {
        bm.fuzzyDuplicateOf = normalizeBookmarkUrl(dupOf.href);
        fuzzyLog.push({
          host,
          removed: (bm.title || "").slice(0, 120),
          similarTo: (dupOf.title || "").slice(0, 120),
          ratioThreshold: titleRatioThreshold,
          removedChromeId: bm.chromeId,
          keptChromeId: dupOf.chromeId,
        });
        continue;
      }
      kept.push(bm);
    }
    keptAll.push(...kept);
  }
  return { kept: keptAll, fuzzyLog };
}
