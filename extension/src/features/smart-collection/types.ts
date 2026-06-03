import type { BookmarkRecord } from "../../lib/bookmarks/types";

export type { BookmarkRecord };

export type SuggestionKind =
  | "move"
  | "duplicate"
  | "folder_merge"
  | "folder_split"
  | "folder_cleanup"
  | "uncategorized"
  | "tag"
  | "leave_unchanged";

export type SuggestionStatus = "pending" | "approved" | "rejected" | "ignored";

export interface SuggestionPreview {
  title: string;
  href?: string;
  chromeId?: string | null;
  fromPath: string[];
  toPath?: string[];
  mergePaths?: string[][];
  folderLabel?: string;
  duplicateOfChromeId?: string | null;
  /** Raindrop bookmark id (numeric). */
  raindropItemId?: number;
  targetRaindropCollectionId?: number;
  raindropCollectionId?: number;
  /** [fromCollectionId, toCollectionId] */
  mergeRaindropCollectionIds?: [number, number];
  /** Tags to add (auto-tag). */
  suggestedTags?: string[];
  existingTags?: string[];
  /** bookmrkd Library entry id */
  libraryId?: string;
  tagSource?: "raindrop" | "library";
}

export interface Suggestion {
  id: string;
  jobId: string;
  kind: SuggestionKind;
  confidence: number;
  reasoning: string;
  preview: SuggestionPreview;
  status: SuggestionStatus;
  createdAt: number;
  providerId: string;
  signals: string[];
  patternKey: string;
}

export interface FolderProfile {
  pathKey: string;
  segments: string[];
  depth: number;
  bookmarkCount: number;
  domains: Record<string, number>;
  titleTokens: string[];
  sampleTitles: string[];
  embeddingId?: string;
}

export type AnalysisJobState = "idle" | "running" | "done" | "error";

export interface AnalysisJob {
  id: string;
  state: AnalysisJobState;
  bookmarkCount: number;
  progress: number;
  healthScore?: number;
  healthFactors?: HealthFactors;
  suggestions: Suggestion[];
  startedAt: number;
  finishedAt?: number;
  error?: string;
  statusMessage?: string;
}

export interface HealthFactors {
  duplicateRatio: number;
  uncategorizedRatio: number;
  avgDepth: number;
  fragmentationRatio: number;
  deadLinkRatio: number;
}

export type ScaProviderId = "rule" | "transformers" | "gemini" | "openai" | "desktop";

export interface ScaSettings {
  scaProvider: ScaProviderId;
  scaFallbackProvider: ScaProviderId;
  scaAutoRun: boolean;
  scaSemanticThreshold: number;
  scaNewFolderMinConfidence: number;
  scaMaxSuggestionsPerKind: number;
  fuzzyDedupe: boolean;
}

export interface ProviderConfig {
  settings: ScaSettings;
  apiKeys?: Record<string, string>;
  geminiModel?: string;
  openaiModel?: string;
}

export interface AnalysisContext {
  bookmarks: BookmarkRecord[];
  folders: FolderProfile[];
  neighborsByChromeId: Map<string, BookmarkRecord[]>;
}
