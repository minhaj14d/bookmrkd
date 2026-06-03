import type { BookmarkRecord } from "../../../lib/bookmarks/types";
import { bookmarkText, folderCentroidText, cosineSimilarity } from "../semantic-match";
import type { FolderProfile, ProviderConfig } from "../types";
import type { BookmarkClassifierProvider, FolderScoreResult } from "./BookmarkClassifierProvider";
import { RuleBasedProvider } from "./RuleBasedProvider";

const MODEL_ID = "Xenova/all-MiniLM-L6-v2";
const BATCH_SIZE = 32;

type Pipeline = (
  task: string,
  model: string,
  options?: { quantized?: boolean; progress_callback?: (p: { status: string }) => void }
) => Promise<(text: string, options?: { pooling?: string; normalize?: boolean }) => Promise<{ data: Float32Array }>>;

let envConfigured = false;

async function configureTransformersEnv(): Promise<void> {
  if (envConfigured) return;
  const { env } = await import("@xenova/transformers");
  env.allowLocalModels = false;
  env.useBrowserCache = true;
  env.backends.onnx.wasm.numThreads = 1;
  envConfigured = true;
}

function formatProviderError(err: unknown): Error {
  const name = err instanceof Error ? err.name : "";
  const msg = err instanceof Error ? err.message : String(err);
  if (name === "AbortError" || msg.includes("aborted")) {
    return new Error(
      "Model download or inference was aborted. Keep this tab open, check your connection, allow huggingface.co in extension permissions, or switch to Local rules and retry."
    );
  }
  if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
    return new Error(
      "Could not download the MiniLM model. Check network access to huggingface.co or use Local rules."
    );
  }
  return err instanceof Error ? err : new Error(msg);
}

export class TransformersProvider implements BookmarkClassifierProvider {
  readonly id = "transformers";
  readonly label = "Local embeddings (MiniLM)";
  readonly capabilities = { embeddings: true, batchSize: BATCH_SIZE, requiresNetwork: true };

  private pipeline: Awaited<ReturnType<Pipeline>> | null = null;
  private pipelinePromise: Promise<NonNullable<typeof this.pipeline>> | null = null;
  private fallback = new RuleBasedProvider();
  private memCache = new Map<string, Float32Array>();
  private onStatus: ((message: string) => void) | null = null;

  async init(_config: ProviderConfig): Promise<void> {
    await this.fallback.init(_config);
  }

  setStatusCallback(cb: (message: string) => void): void {
    this.onStatus = cb;
  }

  private async ensurePipeline(): Promise<NonNullable<typeof this.pipeline>> {
    if (this.pipeline) return this.pipeline;
    if (this.pipelinePromise) return this.pipelinePromise;

    this.pipelinePromise = (async () => {
      try {
        await configureTransformersEnv();
        this.onStatus?.("Downloading MiniLM model (first run, ~25 MB)…");
        const { pipeline } = await import("@xenova/transformers");
        const pipe = await (pipeline as Pipeline)("feature-extraction", MODEL_ID, {
          quantized: true,
          progress_callback: (p) => {
            if (p.status) this.onStatus?.(p.status);
          },
        });
        this.pipeline = pipe;
        this.onStatus?.("Model ready.");
        return pipe;
      } catch (e) {
        this.pipelinePromise = null;
        throw formatProviderError(e);
      }
    })();

    return this.pipelinePromise;
  }

  async embedTexts(texts: string[]): Promise<Float32Array[]> {
    if (!texts.length) return [];
    const pipe = await this.ensurePipeline();
    const results: Float32Array[] = new Array(texts.length);
    const pending: { index: number; text: string; key: string }[] = [];

    for (let i = 0; i < texts.length; i++) {
      const text = texts[i].slice(0, 512);
      const key = hashText(text);
      const cached = this.memCache.get(key);
      if (cached) {
        results[i] = cached;
      } else {
        pending.push({ index: i, text, key });
      }
    }

    for (let b = 0; b < pending.length; b += BATCH_SIZE) {
      const chunk = pending.slice(b, b + BATCH_SIZE);
      for (const item of chunk) {
        try {
          const result = await pipe(item.text, { pooling: "mean", normalize: true });
          const vec = result.data;
          this.memCache.set(item.key, vec);
          results[item.index] = vec;
        } catch (e) {
          throw formatProviderError(e);
        }
      }
      if (pending.length > BATCH_SIZE) {
        this.onStatus?.(`Computing embeddings ${Math.min(b + BATCH_SIZE, pending.length)}/${pending.length}…`);
      }
    }

    return results;
  }

  async scoreBookmarkFolder(
    bookmark: BookmarkRecord,
    folder: FolderProfile,
    neighbors: BookmarkRecord[]
  ): Promise<FolderScoreResult> {
    const rule = await this.fallback.scoreBookmarkFolder(bookmark, folder, neighbors);
    try {
      const [bmVec, folderVec] = await this.embedTexts([
        bookmarkText(bookmark),
        folderCentroidText(folder),
      ]);
      const sim = cosineSimilarity(bmVec, folderVec);
      return {
        score: sim * 0.7 + rule.score * 0.3,
        reasoning: `semantic ${(sim * 100).toFixed(0)}%; ${rule.reasoning}`,
      };
    } catch (e) {
      if (e instanceof Error && e.message.includes("aborted")) throw e;
      return rule;
    }
  }

  async dispose(): Promise<void> {
    this.pipeline = null;
    this.pipelinePromise = null;
    this.memCache.clear();
    this.onStatus = null;
    await this.fallback.dispose();
  }
}

function hashText(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return String(h >>> 0);
}
