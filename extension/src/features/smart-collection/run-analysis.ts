import { flattenChromeTree } from "../organize/organizer.js";
import { parseBookmarksHtml } from "../organize/html-parser.js";
import { loadImportHtml } from "../../lib/settings.js";
import { saveJob, saveSuggestions } from "../../storage/sca-idb";
import { buildAnalysisContext } from "./analyzer";
import { computeHealthScore } from "./health-score";
import { createProviderStack } from "./providers/provider-registry";
import { runSuggestionEngine } from "./suggestion-engine";
import type { AnalysisJob, ProviderConfig, ScaSettings } from "./types";

export async function loadChromeBookmarks(): Promise<import("../../lib/bookmarks/types").BookmarkRecord[]> {
  const tree = await chrome.bookmarks.getTree();
  return flattenChromeTree(tree);
}

export async function loadBookmarksFromSource(
  source: "browser" | "html"
): Promise<import("../../lib/bookmarks/types").BookmarkRecord[]> {
  if (source === "html") {
    const { html } = await loadImportHtml();
    if (!html) throw new Error("Import HTML in Advanced settings first.");
    return parseBookmarksHtml(html);
  }
  return loadChromeBookmarks();
}

export async function runAnalysis(
  config: ProviderConfig,
  source: "browser" | "html" = "browser",
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
    const bookmarks = await loadBookmarksFromSource(source);
    job.bookmarkCount = bookmarks.length;
    onProgress?.({ ...job, progress: 0.05 });

    const providers = await createProviderStack(config);
    const engine = await runSuggestionEngine(
      bookmarks,
      providers,
      config.settings,
      jobId,
      (p) => {
        job.progress = 0.1 + p * 0.85;
        onProgress?.({ ...job });
      }
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
