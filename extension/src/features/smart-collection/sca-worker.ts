/// <reference lib="webworker" />
import { runSuggestionEngine } from "./suggestion-engine";
import { buildAnalysisContext } from "./analyzer";
import { computeHealthScore } from "./health-score";
import { RuleBasedProvider } from "./providers/RuleBasedProvider";
import type { BookmarkRecord } from "../../lib/bookmarks/types";
import type { ProviderConfig } from "./types";

interface WorkerRequest {
  id: number;
  bookmarks: BookmarkRecord[];
  config: ProviderConfig;
  jobId: string;
}

/** Worker uses rule-based analysis only (avoids bundling transformers in worker). */
self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { id, bookmarks, config, jobId } = e.data;
  try {
    const provider = new RuleBasedProvider();
    await provider.init(config);
    const engine = await runSuggestionEngine(
      bookmarks,
      [provider],
      config.settings,
      jobId,
      (p) => {
        self.postMessage({ id, type: "progress", progress: 0.1 + p * 0.85 });
      }
    );
    await provider.dispose();

    const ctx = buildAnalysisContext(bookmarks);
    const health = computeHealthScore({
      bookmarks,
      folders: ctx.folders,
      exactDuplicateCount: engine.exactDuplicateCount,
      fuzzyDuplicateCount: engine.fuzzyDuplicateCount,
    });

    self.postMessage({
      id,
      ok: true,
      result: {
        suggestions: engine.suggestions,
        healthScore: health.score,
        healthFactors: health.factors,
        exactDuplicateCount: engine.exactDuplicateCount,
        fuzzyDuplicateCount: engine.fuzzyDuplicateCount,
      },
    });
  } catch (err) {
    self.postMessage({
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
