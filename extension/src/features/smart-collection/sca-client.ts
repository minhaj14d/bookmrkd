import type { BookmarkRecord } from "../../lib/bookmarks/types";
import type { AnalysisJob, ProviderConfig } from "./types";
import { loadBookmarksFromSource, runAnalysis, type AnalysisSource } from "./run-analysis";
import { saveJob, saveSuggestions } from "../../storage/sca-idb";

export const SCA_WORKER_THRESHOLD = 2500;

import ScaWorker from "./sca-worker?worker";

let worker: Worker | null = null;
let jobSeq = 0;

function getWorker(): Worker {
  if (!worker) worker = new ScaWorker();
  return worker;
}

function runInWorker(
  bookmarks: BookmarkRecord[],
  config: ProviderConfig,
  jobId: string
): Promise<{
  suggestions: AnalysisJob["suggestions"];
  healthScore: number;
  healthFactors: AnalysisJob["healthFactors"];
}> {
  return new Promise((resolve, reject) => {
    const id = ++jobSeq;
    const w = getWorker();

    const onMessage = (e: MessageEvent) => {
      if (e.data?.id !== id) return;
      if (e.data.type === "progress") return;
      w.removeEventListener("message", onMessage);
      w.removeEventListener("error", onError);
      if (e.data.ok) resolve(e.data.result);
      else reject(new Error(e.data.error || "SCA worker failed"));
    };

    const onError = (ev: ErrorEvent) => {
      w.removeEventListener("message", onMessage);
      w.removeEventListener("error", onError);
      reject(ev.error || new Error("SCA worker error"));
    };

    w.addEventListener("message", onMessage);
    w.addEventListener("error", onError);
    w.postMessage({ id, bookmarks, config, jobId });
  });
}

export function shouldUseScaWorker(count: number): boolean {
  return count >= SCA_WORKER_THRESHOLD;
}

export async function runAnalysisWithWorker(
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
    const { bookmarks } = await loadBookmarksFromSource(source);
    job.bookmarkCount = bookmarks.length;
    onProgress?.({ ...job, progress: 0.05 });

    let result;
    if (shouldUseScaWorker(bookmarks.length)) {
      result = await runInWorker(bookmarks, config, jobId);
    } else {
      return runAnalysis(config, source, onProgress);
    }

    job.suggestions = result.suggestions;
    job.healthScore = result.healthScore;
    job.healthFactors = result.healthFactors;
    job.state = "done";
    job.progress = 1;
    job.finishedAt = Date.now();
    await saveSuggestions(result.suggestions);
    await saveJob(job);
    onProgress?.(job);
    return job;
  } catch (e) {
    job.state = "error";
    job.error = e instanceof Error ? e.message : String(e);
    await saveJob(job);
    onProgress?.(job);
    throw e;
  }
}

export async function runAnalysisAuto(
  config: ProviderConfig,
  source: AnalysisSource = "browser",
  onProgress?: (job: AnalysisJob) => void
): Promise<AnalysisJob> {
  const { bookmarks } = await loadBookmarksFromSource(source);
  const workerOk =
    shouldUseScaWorker(bookmarks.length) &&
    source !== "raindrop" &&
    config.settings.scaProvider === "rule" &&
    config.settings.scaFallbackProvider === "rule";
  if (workerOk) {
    return runAnalysisWithWorker(config, source, onProgress);
  }
  return runAnalysis(config, source, onProgress);
}
