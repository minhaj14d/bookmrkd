import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { folderNameDistance, shouldBlockNewFolder } from "./structure-guard";
import type { FolderProfile } from "./types";

describe("structure-guard", () => {
  it("detects similar folder names", () => {
    assert.ok(folderNameDistance("Learning", "Learning Resources") < 0.5);
  });

  it("blocks new folder when sibling exists", () => {
    const folders: FolderProfile[] = [
      {
        pathKey: "Dev > Learning",
        segments: ["Dev", "Learning"],
        depth: 2,
        bookmarkCount: 5,
        domains: {},
        titleTokens: [],
        sampleTitles: [],
      },
    ];
    assert.equal(shouldBlockNewFolder("Learning Resources", ["Dev"], folders), true);
  });
});
