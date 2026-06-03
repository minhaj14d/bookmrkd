import { flattenChromeTree } from "../organize/organizer.js";
import { parseBookmarksHtml } from "../organize/html-parser.js";
import { loadImportHtml } from "../../lib/settings.js";
import { loadRaindropBookmarks } from "../raindrop/load-bookmarks.js";
import { isRaindropConnected } from "../raindrop/storage.js";
import { saveJob, saveSuggestions } from "../../storage/sca-idb";
import { buildAnalysisContext } from "./analyzer";
import { computeHealthScore } from "./health-score";
import { createProviderStack } from "./providers/provider-registry";
import { runSuggestionEngine } from "./suggestion-engine";
import type { AnalysisJob, ProviderConfig } from "./types";

export type AnalysisSource = "browser" | "html" | "raindrop";

export async function loadChromeBookmarks(): Promise<import("../../lib/bookmarks/types").BookmarkRecord[]> {
  const tree = await chrome.bookmarks.getTree();
  return flattenChromeTree(tree);
}

export async function loadBookmarksFromSource(
  source: AnalysisSource,
  onStatus?: (message: string) => void
): Promise<{
  bookmarks: import("../../lib/bookmarks/types").BookmarkRecord[];
  pathToCollectionId?: Record<string, number>;
}> {
  if (source === "raindrop") {
    if (!(await isRaindropConnected())) {
      throw new Error("Connect Raindrop first (AI Suggestions → Raindrop section).");
    }
    const result = await loadRaindropBookmarks(onStatus);
    return {
      bookmarks: result.bookmarks,
      pathToCollectionId: result.pathToCollectionId,
    };
  }
  if (source === "html") {
    const { html } = await loadImportHtml();
    if (!html) throw new Error("Import HTML in Advanced settings first.");
    return { bookmarks: parseBookmarksHtml(html) };
  }
  return { bookmarks: await loadChromeBookmarks() };
}

export async function runAnalysis(
  config: ProviderConfig,
  source: AnalysisSource = "browser",
  onProgress?: (job: AnalysisJob) => void
): Promise<AnalysisJob> {
  const jobId = `job-${Date.now()}`;
  const job: AnalysisJob = {
    id: jobId,
    state: "running",
    bookmarkCount: 0,
    progress: 0,
    suggestions: [],
    startedAt: Date.now(),
  };
  await saveJob(job);
  onProgress?.(job);

  try {
    const { bookmarks, pathToCollectionId } = await loadBookmarksFromSource(source, (message) => {
      job.statusMessage = message;
      onProgress?.({ ...job });
    });
    job.bookmarkCount = bookmarks.length;
    onProgress?.({ ...job, progress: 0.05 });

    const providers = await createProviderStack(config);
    const engine = await runSuggestionEngine(
      bookmarks,
      providers,
      config.settings,
      jobId,
      (p, message) => {
        job.progress = p;
        if (message) job.statusMessage = message;
        onProgress?.({ ...job });
      },
      pathToCollectionId
    );

    for (const p of providers) await p.dispose();

    const ctx = buildAnalysisContext(bookmarks);
    const health = computeHealthScore({
      bookmarks,
      folders: ctx.folders,
      exactDuplicateCount: engine.exactDuplicateCount,
      fuzzyDuplicateCount: engine.fuzzyDuplicateCount,
    });

    job.suggestions = engine.suggestions;
    job.healthScore = health.score;
    job.healthFactors = health.factors;
    job.state = "done";
    job.progress = 1;
    job.finishedAt = Date.now();
    job.statusMessage = undefined;

    await saveSuggestions(engine.suggestions);
    await saveJob(job);
    onProgress?.(job);
    return job;
  } catch (e) {
    job.state = "error";
    job.error = e instanceof Error ? e.message : String(e);
    job.finishedAt = Date.now();
    await saveJob(job);
    onProgress?.(job);
    throw e;
  }
}
