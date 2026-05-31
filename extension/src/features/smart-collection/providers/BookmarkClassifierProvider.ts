import type { BookmarkRecord } from "../../../lib/bookmarks/types";
import type { FolderProfile, ProviderConfig } from "../types";

export interface FolderScoreResult {
  score: number;
  reasoning: string;
}

export interface BookmarkClassifierProvider {
  readonly id: string;
  readonly label: string;
  readonly capabilities: {
    embeddings: boolean;
    batchSize: number;
    requiresNetwork: boolean;
  };
  init(config: ProviderConfig): Promise<void>;
  embedTexts(texts: string[]): Promise<Float32Array[]>;
  scoreBookmarkFolder(
    bookmark: BookmarkRecord,
    folder: FolderProfile,
    neighbors: BookmarkRecord[]
  ): Promise<FolderScoreResult>;
  dispose(): Promise<void>;
}
