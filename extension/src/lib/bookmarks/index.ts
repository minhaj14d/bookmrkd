export { titleSimilarity } from "./title-similarity";
export { hostKey } from "./host-key";
export { normalizeBookmarkUrl } from "./normalize-url";
export { dedupeExact, dedupeFuzzy } from "./dedupe";
export {
  normalizeBookmarkTreeRoots,
  bookmarkFolderSegment,
  findFolderIdByPath,
  findFolderIdByPathOrThrow,
} from "./tree-utils";
export type { BookmarkRecord, ExactDedupeRemoved, FuzzyDedupeLog } from "./types";
