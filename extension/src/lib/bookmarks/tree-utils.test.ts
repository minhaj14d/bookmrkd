import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeBookmarkTreeRoots, bookmarkFolderSegment } from "./tree-utils";

describe("tree-utils", () => {
  it("unwraps Firefox-style root wrapper", () => {
    const child = { id: "2", title: "Bookmarks Menu", children: [] };
    const roots = normalizeBookmarkTreeRoots([
      { id: "0", title: "", children: [child] } as chrome.bookmarks.BookmarkTreeNode,
    ]);
    assert.equal(roots.length, 1);
    assert.equal(roots[0].title, "Bookmarks Menu");
  });

  it("skips empty root segment in paths", () => {
    const seg = bookmarkFolderSegment({ id: "0", title: "", children: [] } as chrome.bookmarks.BookmarkTreeNode);
    assert.equal(seg, null);
  });
});
