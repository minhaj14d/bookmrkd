import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeHealthScore, folderProfilesFromBookmarks } from "./health-score";
import type { BookmarkRecord } from "../../lib/bookmarks/types";

function bm(path: string[], title: string, href = "https://example.com/a"): BookmarkRecord {
  return {
    chromeId: "1",
    href,
    title,
    addDate: 1,
    originalPath: path,
    icon: null,
    relevance: 0,
    categoryTop: "Archive",
    categorySub: null,
    categorizationSource: "default",
    fuzzyDuplicateOf: null,
  };
}

describe("health-score", () => {
  it("computes score in 0-100 range", () => {
    const bookmarks = [
      bm(["Dev"], "A"),
      bm(["Dev"], "B", "https://example.com/b"),
      bm([], "Root", "https://example.com/c"),
    ];
    const folders = folderProfilesFromBookmarks(bookmarks);
    const { score } = computeHealthScore({
      bookmarks,
      folders,
      exactDuplicateCount: 0,
      fuzzyDuplicateCount: 0,
    });
    assert.ok(score >= 0);
    assert.ok(score <= 100);
  });
});
