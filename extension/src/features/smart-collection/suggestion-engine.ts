import { dedupeExact, dedupeFuzzy } from "../../lib/bookmarks";
import type { BookmarkRecord, FuzzyDedupeLog } from "../../lib/bookmarks/types";
import { getFeedbackMap } from "../../storage/sca-idb";
import { buildPatternKey, adjustConfidence } from "./feedback-store";
import type { BookmarkClassifierProvider } from "./providers/BookmarkClassifierProvider";
import { bestFolderForBookmark, canSuggestMoveTo } from "./semantic-match";
import { folderNameDistance, pathKey } from "./structure-guard";
import type {
  AnalysisContext,
  ScaSettings,
  Suggestion,
  SuggestionKind,
} from "./types";
import { buildAnalysisContext } from "./analyzer";

let suggestionSeq = 0;

function nextId(): string {
  return `sca-${Date.now()}-${++suggestionSeq}`;
}

export interface EngineResult {
  suggestions: Suggestion[];
  exactDuplicateCount: number;
  fuzzyDuplicateCount: number;
}

export async function runSuggestionEngine(
  bookmarks: BookmarkRecord[],
  providers: BookmarkClassifierProvider[],
  settings: ScaSettings,
  jobId: string,
  onProgress?: (p: number) => void
): Promise<EngineResult> {
  const ctx = buildAnalysisContext(bookmarks);
  const feedback = await getFeedbackMap();
  const primary = providers[0];
  const maxPerKind = settings.scaMaxSuggestionsPerKind;

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
      },
      providerId: "rule",
      signals: ["fuzzy-title"],
      patternKey: buildPatternKey("duplicate", [], undefined, f.host),
    });
  }

  detectFolderMerges(ctx, push);
  detectFolderCleanup(ctx, push);
  detectUncategorized(ctx, push);

  const total = ctx.bookmarks.length;
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

    const currentKey = pathKey(bm.originalPath);
    if (
      bestFolder &&
      pathKey(bestFolder.segments) !== currentKey &&
      bestScore >= settings.scaSemanticThreshold
    ) {
      if (canSuggestMoveTo(bestFolder.segments, ctx.folders, bestFolder.segments.at(-1) || "")) {
        const conf = Math.min(99, Math.round(bestScore * 100));
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
          },
          providerId: primary.id,
          signals: [`score:${bestScore.toFixed(2)}`],
          patternKey: buildPatternKey("move", bm.originalPath, bestFolder.segments),
        });
      }
    }

    done++;
    if (onProgress && done % 50 === 0) onProgress(done / total);
  }

  detectFolderSplits(ctx, push);
  onProgress?.(1);
  return {
    suggestions: suggestions.sort((a, b) => b.confidence - a.confidence),
    exactDuplicateCount: exactRemoved.length,
    fuzzyDuplicateCount: fuzzyLog.length,
  };
}

type PushFn = (s: Omit<Suggestion, "id" | "jobId" | "createdAt" | "status">) => void;

function detectFolderMerges(ctx: AnalysisContext, push: PushFn): void {
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
          mergePaths: [a.segments, b.segments],
          folderLabel: keep.segments[keep.segments.length - 1],
        },
        providerId: "rule",
        signals: [`name-distance:${dist.toFixed(2)}`],
        patternKey: buildPatternKey("folder_merge", merge.segments, keep.segments),
      });
    }
  }
}

function detectFolderCleanup(ctx: AnalysisContext, push: PushFn): void {
  for (const f of ctx.folders) {
    if (f.bookmarkCount > 0) continue;
    if (f.segments.length === 0) continue;
    push({
      kind: "folder_cleanup",
      confidence: 70,
      reasoning: "Empty folder — consider removing or merging.",
      preview: {
        title: f.pathKey,
        fromPath: [...f.segments],
        folderLabel: f.segments[f.segments.length - 1],
      },
      providerId: "rule",
      signals: ["empty-folder"],
      patternKey: buildPatternKey("folder_cleanup", f.segments),
    });
  }
}

function detectUncategorized(ctx: AnalysisContext, push: PushFn): void {
  const names = new Set(["other bookmarks", "unsorted", "uncategorized"]);
  for (const bm of ctx.bookmarks) {
    const last = (bm.originalPath[bm.originalPath.length - 1] || "").toLowerCase();
    if (!names.has(last) && bm.originalPath.length > 0) continue;
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
