export type TagTargetSource = "raindrop" | "library";

export interface TagCandidate {
  /** `rd:123` or library UUID */
  id: string;
  href: string;
  title: string;
  existingTags: string[];
  path: string[];
  source: TagTargetSource;
  raindropItemId?: number;
  libraryId?: string;
}

/** `auto` = try Gemini, fall back to local MiniLM on quota errors */
export type AutoTagProviderId = "local" | "gemini" | "auto";

export interface AutoTagOptions {
  provider: AutoTagProviderId;
  maxTags: number;
  untaggedOnly: boolean;
  maxBookmarks: number;
  geminiModel?: string;
  apiKey?: string;
}

export interface AutoTagProgress {
  phase: string;
  done: number;
  total: number;
}
