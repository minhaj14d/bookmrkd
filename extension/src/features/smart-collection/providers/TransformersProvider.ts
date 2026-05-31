import type { BookmarkRecord } from "../../../lib/bookmarks/types";
import { getEmbedding, putEmbedding } from "../../../storage/sca-idb";
import { bookmarkText, folderCentroidText, cosineSimilarity } from "../semantic-match";
import type { FolderProfile, ProviderConfig } from "../types";
import type { BookmarkClassifierProvider, FolderScoreResult } from "./BookmarkClassifierProvider";
import { RuleBasedProvider } from "./RuleBasedProvider";

const MODEL_ID = "Xenova/all-MiniLM-L6-v2";

type Pipeline = (
  task: string,
  model: string,
  options?: { quantized?: boolean }
) => Promise<(text: string, options?: { pooling?: string; normalize?: boolean }) => Promise<{ data: Float32Array }>>;

export class TransformersProvider implements BookmarkClassifierProvider {
  readonly id = "transformers";
  readonly label = "Local embeddings (MiniLM)";
  readonly capabilities = { embeddings: true, batchSize: 32, requiresNetwork: false };

  private pipeline: Awaited<ReturnType<Pipeline>> | null = null;
  private fallback = new RuleBasedProvider();

  async init(_config: ProviderConfig): Promise<void> {
    await this.fallback.init(_config);
  }

  private async ensurePipeline(): Promise<NonNullable<typeof this.pipeline>> {
    if (this.pipeline) return this.pipeline;
    const { pipeline } = await import("@xenova/transformers");
    this.pipeline = await (pipeline as Pipeline)("feature-extraction", MODEL_ID, {
      quantized: true,
    });
    return this.pipeline;
  }

  async embedTexts(texts: string[]): Promise<Float32Array[]> {
    const pipe = await this.ensurePipeline();
    const out: Float32Array[] = [];
    for (const text of texts) {
      const cacheKey = `emb:${hashText(text)}`;
      const cached = await getEmbedding(cacheKey);
      if (cached?.modelId === MODEL_ID) {
        out.push(new Float32Array(cached.vector));
        continue;
      }
      const result = await pipe(text.slice(0, 512), { pooling: "mean", normalize: true });
      const vec = result.data;
      await putEmbedding({
        entityKey: cacheKey,
        modelId: MODEL_ID,
        vector: [...vec],
        updatedAt: Date.now(),
      });
      out.push(vec);
    }
    return out;
  }

  async scoreBookmarkFolder(
    bookmark: BookmarkRecord,
    folder: FolderProfile,
    neighbors: BookmarkRecord[]
  ): Promise<FolderScoreResult> {
    const [bmVec, folderVec] = await this.embedTexts([
      bookmarkText(bookmark),
      folderCentroidText(folder),
    ]);
    const sim = cosineSimilarity(bmVec, folderVec);
    const rule = await this.fallback.scoreBookmarkFolder(bookmark, folder, neighbors);
    const blended = sim * 0.7 + rule.score * 0.3;
    return {
      score: blended,
      reasoning: `semantic ${(sim * 100).toFixed(0)}%; ${rule.reasoning}`,
    };
  }

  async dispose(): Promise<void> {
    this.pipeline = null;
    await this.fallback.dispose();
  }
}

function hashText(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return String(h >>> 0);
}
