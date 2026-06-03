import { dedupeExact, dedupeFuzzy } from "../../lib/bookmarks";
import type { BookmarkRecord, FuzzyDedupeLog } from "../../lib/bookmarks/types";
import { getFeedbackMap } from "../../storage/sca-idb";
import { buildPatternKey, adjustConfidence } from "./feedback-store";
import type { BookmarkClassifierProvider } from "./providers/BookmarkClassifierProvider";
import { TransformersProvider } from "./providers/TransformersProvider";
import { buildEmbeddingIndex, bestFolderFromIndex } from "./embedding-index";
import { bestFolderForBookmark, canSuggestMoveTo } from "./semantic-match";
import {
  folderNameDistance,
  pathKey,
  isCatchAllFolderSegments,
  isUncategorizedBookmarkPath,
} from "./structure-guard";
import type {
  AnalysisContext,
  ScaSettings,
  Suggestion,
  SuggestionKind,
} from "./types";
import { buildAnalysisContext } from "./analyzer";
import { fetchRaindropSuggest } from "../raindrop/api";
import { bestFolderForUnsortedBookmark } from "../raindrop/unsorted-match";
import { parseRaindropBookmarkId } from "../raindrop/storage";
import { domainFromUrl } from "../../lib/url";

let suggestionSeq = 0;

function nextId(): string {
  return `sca-${Date.now()}-${++suggestionSeq}`;
}

export interface EngineResult {
  suggestions: Suggestion[];
  exactDuplicateCount: number;
  fuzzyDuplicateCount: number;
}

const MAX_EMBEDDING_BOOKMARKS = 1200;

export type EngineProgressFn = (fraction: number, message?: string) => void;

export async function runSuggestionEngine(
  bookmarks: BookmarkRecord[],
  providers: BookmarkClassifierProvider[],
  settings: ScaSettings,
  jobId: string,
  onProgress?: EngineProgressFn,
  pathToCollectionId?: Record<string, number>
): Promise<EngineResult> {
  const ctx = buildAnalysisContext(bookmarks);
  const feedback = await getFeedbackMap();
  const primary = providers[0];
  const ruleProvider =
    providers.find((p) => p.id === "rule") ?? providers[providers.length - 1];
  const maxPerKind = settings.scaMaxSuggestionsPerKind;

  let embeddingIndex = null as Awaited<ReturnType<typeof buildEmbeddingIndex>> | null;
  const embeddingProvider = providers.find((p) => p.capabilities.embeddings);

  if (embeddingProvider) {
    if (bookmarks.length > MAX_EMBEDDING_BOOKMARKS) {
      throw new Error(
        `Local embeddings support up to ${MAX_EMBEDDING_BOOKMARKS} bookmarks (you have ${bookmarks.length}). Use Local rules or reduce your library.`
      );
    }
    if (embeddingProvider instanceof TransformersProvider && onProgress) {
      embeddingProvider.setStatusCallback((message) => onProgress(0.08, message));
    }
    onProgress?.(0.08, "Preparing embeddings…");
    embeddingIndex = await buildEmbeddingIndex(
      embeddingProvider,
      bookmarks,
      ctx.folders,
      (message) => onProgress?.(0.12, message)
    );
    onProgress?.(0.2, "Embeddings ready — scoring bookmarks…");
  }

  const { removed: exactRemoved } = dedupeExact(bookmarks);
  const { fuzzyLog } = settings.fuzzyDedupe
    ? dedupeFuzzy(bookmarks)
    : { fuzzyLog: [] as FuzzyDedupeLog[] };

  const suggestions: Suggestion[] = [];
  const counts: Record<SuggestionKind, number> = {
    move: 0,
    duplicate: 0,
    folder_merge: 0,
    folder_split: 0,
    folder_cleanup: 0,
    uncategorized: 0,
    tag: 0,
    leave_unchanged: 0,
  };

  const push = (s: Omit<Suggestion, "id" | "jobId" | "createdAt" | "status">) => {
    if (counts[s.kind] >= maxPerKind) return;
    counts[s.kind]++;
    const conf = adjustConfidence(s.confidence, s.patternKey, feedback);
    suggestions.push({
      ...s,
      id: nextId(),
      jobId,
      confidence: Math.round(conf),
      createdAt: Date.now(),
      status: "pending",
    });
  };

  for (const r of exactRemoved) {
    if (!r.removedChromeId) continue;
    push({
      kind: "duplicate",
      confidence: 98,
      reasoning: `Same URL as "${r.keptTitle}"`,
      preview: {
        title: r.removedTitle,
        chromeId: r.removedChromeId,
        fromPath: r.path.split(" > ").filter(Boolean),
        duplicateOfChromeId: r.keptChromeId,
        raindropItemId: parseRaindropBookmarkId(r.removedChromeId) ?? undefined,
      },
      providerId: "rule",
      signals: ["exact-url"],
      patternKey: buildPatternKey("duplicate", r.path.split(" > ").filter(Boolean)),
    });
  }

  for (const f of fuzzyLog) {
    if (!f.removedChromeId) continue;
    push({
      kind: "duplicate",
      confidence: 85,
      reasoning: `Very similar title to "${f.similarTo}" on ${f.host || "same host"}`,
      preview: {
        title: f.removed,
        chromeId: f.removedChromeId,
        fromPath: [],
        duplicateOfChromeId: f.keptChromeId,
        raindropItemId: parseRaindropBookmarkId(f.removedChromeId) ?? undefined,
      },
      providerId: "rule",
      signals: ["fuzzy-title"],
      patternKey: buildPatternKey("duplicate", [], undefined, f.host),
    });
  }

  detectFolderMerges(ctx, push, pathToCollectionId);
  detectFolderCleanup(ctx, push, pathToCollectionId);
  if (!pathToCollectionId) {
    detectUncategorized(ctx, push);
  }

  const total = ctx.bookmarks.length;
  const movedChromeIds = new Set<string>();
  let done = 0;
  for (const bm of ctx.bookmarks) {
    if (!bm.chromeId) {
      done++;
      continue;
    }
    const neighbors = ctx.neighborsByChromeId.get(bm.chromeId) || [];
    let bestScore = 0;
    let bestFolder = null as (typeof ctx.folders)[0] | null;
    let bestReason = "";

    if (embeddingIndex) {
      const res = bestFolderFromIndex(
        bm,
        ctx.folders,
        embeddingIndex,
        settings.scaSemanticThreshold
      );
      if (res.folder && res.score > bestScore) {
        bestScore = res.score;
        bestFolder = res.folder;
        bestReason = res.reasoning;
      }
      const ruleRes = await bestFolderForBookmark(
        bm,
        ctx.folders,
        ruleProvider,
        neighbors,
        settings.scaSemanticThreshold
      );
      if (ruleRes.folder && ruleRes.score > bestScore) {
        bestScore = ruleRes.score;
        bestFolder = ruleRes.folder;
        bestReason = ruleRes.reasoning;
      }
    } else {
      for (const prov of providers) {
        const res = await bestFolderForBookmark(
          bm,
          ctx.folders,
          prov,
          neighbors,
          settings.scaSemanticThreshold
        );
        if (res.folder && res.score > bestScore) {
          bestScore = res.score;
          bestFolder = res.folder;
          bestReason = res.reasoning;
        }
      }
    }

    const currentKey = pathKey(bm.originalPath);
    if (
      bestFolder &&
      pathKey(bestFolder.segments) !== currentKey &&
      bestScore >= settings.scaSemanticThreshold
    ) {
      if (canSuggestMoveTo(bestFolder.segments, ctx.folders, bestFolder.segments.at(-1) || "")) {
        const conf = Math.min(99, Math.round(bestScore * 100));
        const toKey = pathKey(bestFolder.segments);
        push({
          kind: "move",
          confidence: conf,
          reasoning:
            bestReason ||
            `Similar bookmarks already exist in ${bestFolder.segments[bestFolder.segments.length - 1]}.`,
          preview: {
            title: bm.title || bm.href,
            href: bm.href,
            chromeId: bm.chromeId,
            fromPath: [...bm.originalPath],
            toPath: [...bestFolder.segments],
            raindropItemId: parseRaindropBookmarkId(bm.chromeId) ?? undefined,
            targetRaindropCollectionId: pathToCollectionId?.[toKey],
          },
          providerId: primary.id,
          signals: [`score:${bestScore.toFixed(2)}`],
          patternKey: buildPatternKey("move", bm.originalPath, bestFolder.segments),
        });
        if (bm.chromeId) movedChromeIds.add(bm.chromeId);
      }
    }

    done++;
    if (onProgress && (done % 50 === 0 || done === total)) {
      const base = embeddingIndex ? 0.2 : 0.1;
      const span = embeddingIndex ? 0.75 : 0.85;
      onProgress(base + (done / total) * span);
    }
  }

  if (pathToCollectionId) {
    await suggestRaindropUncategorizedMoves(
      ctx,
      push,
      pathToCollectionId,
      embeddingIndex,
      settings,
      ruleProvider,
      providers,
      movedChromeIds
    );
  }

  detectFolderSplits(ctx, push);
  onProgress?.(1, "Done");
  return {
    suggestions: suggestions.sort((a, b) => b.confidence - a.confidence),
    exactDuplicateCount: exactRemoved.length,
    fuzzyDuplicateCount: fuzzyLog.length,
  };
}

type PushFn = (s: Omit<Suggestion, "id" | "jobId" | "createdAt" | "status">) => void;

function collectionIdForPath(
  map: Record<string, number> | undefined,
  segments: string[]
): number | undefined {
  if (!map) return undefined;
  return map[pathKey(segments)];
}

function detectFolderMerges(
  ctx: AnalysisContext,
  push: PushFn,
  pathToCollectionId?: Record<string, number>
): void {
  const leaves = ctx.folders.filter((f) => f.bookmarkCount > 0);
  for (let i = 0; i < leaves.length; i++) {
    for (let j = i + 1; j < leaves.length; j++) {
      const a = leaves[i];
      const b = leaves[j];
      if (a.segments.length !== b.segments.length) continue;
      const parentA = a.segments.slice(0, -1).join("/");
      const parentB = b.segments.slice(0, -1).join("/");
      if (parentA !== parentB) continue;
      const nameA = a.segments[a.segments.length - 1];
      const nameB = b.segments[b.segments.length - 1];
      const dist = folderNameDistance(nameA, nameB);
      if (dist > 0.25) continue;
      const keep = a.bookmarkCount >= b.bookmarkCount ? a : b;
      const merge = a.bookmarkCount >= b.bookmarkCount ? b : a;
      push({
        kind: "folder_merge",
        confidence: Math.round((1 - dist) * 90),
        reasoning: `Folders "${nameA}" and "${nameB}" overlap in naming and content.`,
        preview: {
          title: `${nameA} + ${nameB}`,
          fromPath: [...merge.segments],
          toPath: [...keep.segments],
          mergePaths: [merge.segments, keep.segments],
          ...(pathToCollectionId
            ? (() => {
                const fromId = collectionIdForPath(pathToCollectionId, merge.segments);
                const toId = collectionIdForPath(pathToCollectionId, keep.segments);
                return fromId != null && toId != null
                  ? { mergeRaindropCollectionIds: [fromId, toId] as [number, number] }
                  : {};
              })()
            : {}),
          folderLabel: keep.segments[keep.segments.length - 1],
        },
        providerId: "rule",
        signals: [`name-distance:${dist.toFixed(2)}`],
        patternKey: buildPatternKey("folder_merge", merge.segments, keep.segments),
      });
    }
  }
}

function detectFolderCleanup(
  ctx: AnalysisContext,
  push: PushFn,
  pathToCollectionId?: Record<string, number>
): void {
  for (const f of ctx.folders) {
    if (f.bookmarkCount > 0) continue;
    if (f.segments.length === 0) continue;
    push({
      kind: "folder_cleanup",
      confidence: 70,
      reasoning: "Empty collection — consider removing or merging.",
      preview: {
        title: f.pathKey,
        fromPath: [...f.segments],
        folderLabel: f.segments[f.segments.length - 1],
        raindropCollectionId: collectionIdForPath(pathToCollectionId, f.segments),
      },
      providerId: "rule",
      signals: ["empty-folder"],
      patternKey: buildPatternKey("folder_cleanup", f.segments),
    });
  }
}

function segmentsForCollectionId(
  pathToCollectionId: Record<string, number>,
  collectionId: number
): string[] | null {
  for (const [key, id] of Object.entries(pathToCollectionId)) {
    if (id === collectionId) return key.split(" > ").filter(Boolean);
  }
  return null;
}

async function suggestRaindropUncategorizedMoves(
  ctx: AnalysisContext,
  push: PushFn,
  pathToCollectionId: Record<string, number>,
  embeddingIndex: Awaited<ReturnType<typeof buildEmbeddingIndex>> | null,
  settings: ScaSettings,
  ruleProvider: BookmarkClassifierProvider,
  providers: BookmarkClassifierProvider[],
  alreadyMoved: Set<string>
): Promise<void> {
  const threshold = Math.max(0.55, settings.scaSemanticThreshold - 0.2);
  const primary = providers[0];

  for (const bm of ctx.bookmarks) {
    if (!bm.chromeId || alreadyMoved.has(bm.chromeId)) continue;
    if (!isUncategorizedBookmarkPath(bm.originalPath)) continue;

    const itemId = parseRaindropBookmarkId(bm.chromeId);
    let bestFolder: (typeof ctx.folders)[0] | null = null;
    let bestScore = 0;
    let bestReason = "";
    let targetId: number | undefined;
    let signals = ["unsorted-move"];

    if (itemId != null) {
      try {
        const suggest = await fetchRaindropSuggest(itemId);
        if (suggest.collectionId) {
          const segs = segmentsForCollectionId(pathToCollectionId, suggest.collectionId);
          if (segs?.length) {
            targetId = suggest.collectionId;
            bestFolder =
              ctx.folders.find((f) => pathKey(f.segments) === pathKey(segs)) || {
                pathKey: pathKey(segs),
                segments: segs,
                depth: segs.length,
                bookmarkCount: 0,
                domains: {},
                titleTokens: [],
                sampleTitles: [],
              };
            bestScore = 0.9;
            bestReason = "Raindrop suggest API";
            signals = ["raindrop-suggest"];
          }
        }
      } catch {
        /* fall through to embeddings */
      }
    }

    if (!bestFolder) {
      const neighbors = ctx.neighborsByChromeId.get(bm.chromeId) || [];
      const res = await bestFolderForUnsortedBookmark(
        bm,
        ctx.folders,
        embeddingIndex,
        providers,
        ruleProvider,
        neighbors,
        threshold
      );
      bestFolder = res.folder;
      bestScore = res.score;
      bestReason = res.reasoning;
    }

    if (!bestFolder) {
      const host = domainFromUrl(bm.href);
      if (host) {
        const byPath = new Map<string, number>();
        for (const other of ctx.bookmarks) {
          if (other.chromeId === bm.chromeId) continue;
          if (isUncategorizedBookmarkPath(other.originalPath)) continue;
          if (domainFromUrl(other.href) !== host) continue;
          const k = pathKey(other.originalPath);
          if (isCatchAllFolderSegments(other.originalPath)) continue;
          byPath.set(k, (byPath.get(k) || 0) + 1);
        }
        let topPath = "";
        let topN = 0;
        for (const [k, n] of byPath) {
          if (n > topN) {
            topN = n;
            topPath = k;
          }
        }
        if (topPath && topN >= 1) {
          const segs = topPath.split(" > ").filter(Boolean);
          bestFolder =
            ctx.folders.find((f) => pathKey(f.segments) === topPath) || null;
          if (!bestFolder && segs.length) {
            bestFolder = {
              pathKey: topPath,
              segments: segs,
              depth: segs.length,
              bookmarkCount: topN,
              domains: { [host]: topN },
              titleTokens: [],
              sampleTitles: [],
            };
          }
          bestScore = Math.max(threshold, 0.72);
          bestReason = `${topN} similar bookmark(s) on ${host} in ${segs[segs.length - 1]}`;
          signals = ["domain-match"];
        }
      }
    }

    if (!bestFolder || bestScore < threshold) continue;
    if (isCatchAllFolderSegments(bestFolder.segments)) continue;
    if (pathKey(bestFolder.segments) === pathKey(bm.originalPath)) continue;
    if (!canSuggestMoveTo(bestFolder.segments, ctx.folders, bestFolder.segments.at(-1) || "")) {
      continue;
    }

    const toKey = pathKey(bestFolder.segments);
    const resolvedTarget = targetId ?? pathToCollectionId[toKey];
    if (resolvedTarget == null) continue;

    const conf = Math.min(99, Math.round(Math.max(bestScore, threshold) * 100));
    push({
      kind: "move",
      confidence: conf,
      reasoning:
        bestReason ||
        `Move from Unsorted → ${bestFolder.segments[bestFolder.segments.length - 1]}.`,
      preview: {
        title: bm.title || bm.href,
        href: bm.href,
        chromeId: bm.chromeId,
        fromPath: [...bm.originalPath],
        toPath: [...bestFolder.segments],
        raindropItemId: itemId ?? undefined,
        targetRaindropCollectionId: resolvedTarget,
      },
      providerId: signals[0] === "raindrop-suggest" ? "raindrop" : primary.id,
      signals,
      patternKey: buildPatternKey("move", bm.originalPath, bestFolder.segments),
    });
    alreadyMoved.add(bm.chromeId);
  }
}

function detectUncategorized(ctx: AnalysisContext, push: PushFn): void {
  for (const bm of ctx.bookmarks) {
    if (!isUncategorizedBookmarkPath(bm.originalPath)) continue;
    if (!bm.chromeId) continue;
    push({
      kind: "uncategorized",
      confidence: 75,
      reasoning: "Bookmark is in a catch-all or root area.",
      preview: {
        title: bm.title || bm.href,
        href: bm.href,
        chromeId: bm.chromeId,
        fromPath: [...bm.originalPath],
        raindropItemId: parseRaindropBookmarkId(bm.chromeId) ?? undefined,
      },
      providerId: "rule",
      signals: ["uncategorized-path"],
      patternKey: buildPatternKey("uncategorized", bm.originalPath),
    });
  }
}

function detectFolderSplits(ctx: AnalysisContext, push: PushFn): void {
  for (const f of ctx.folders) {
    if (f.bookmarkCount < 40) continue;
    const domains = Object.keys(f.domains);
    if (domains.length < 4) continue;
    push({
      kind: "folder_split",
      confidence: 65,
      reasoning: `Large folder (${f.bookmarkCount} items, ${domains.length} domains) — consider thematic subfolders.`,
      preview: {
        title: f.pathKey,
        fromPath: [...f.segments],
        folderLabel: f.segments[f.segments.length - 1],
      },
      providerId: "rule",
      signals: ["large-folder"],
      patternKey: buildPatternKey("folder_split", f.segments),
    });
  }
}
