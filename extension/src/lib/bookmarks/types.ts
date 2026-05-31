export interface BookmarkRecord {
  chromeId: string | null;
  href: string;
  title: string;
  addDate: number;
  originalPath: string[];
  icon: string | null;
  relevance: number;
  categoryTop: string;
  categorySub: string | null;
  categorizationSource: string;
  fuzzyDuplicateOf: string | null;
}

export interface ExactDedupeRemoved {
  norm: string;
  removedTitle: string;
  keptTitle: string;
  path: string;
  removedChromeId: string | null;
  keptChromeId: string | null;
}

export interface FuzzyDedupeLog {
  host: string;
  removed: string;
  similarTo: string;
  ratioThreshold: number;
  removedChromeId: string | null;
  keptChromeId: string | null;
}
