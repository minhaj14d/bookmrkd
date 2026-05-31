/**
 * v2.1 — Tag-based maintenance suggestions for IndexedDB library (no Chrome folders).
 */
import type { BookmarkEntry } from "../../lib/types/bookmark";
import type { Suggestion } from "./types";
import { buildPatternKey } from "./feedback-store";

let seq = 0;

export function suggestLibraryTagHygiene(
  bookmarks: BookmarkEntry[],
  jobId: string
): Suggestion[] {
  const out: Suggestion[] = [];
  const tagCounts = new Map<string, number>();

  for (const b of bookmarks) {
    for (const t of b.tags) tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
  }

  for (const b of bookmarks) {
    if (b.tags.length > 0) continue;
    out.push({
      id: `lib-${++seq}`,
      jobId,
      kind: "uncategorized",
      confidence: 80,
      reasoning: "Library bookmark has no tags — add tags for easier search.",
      preview: {
        title: b.title,
        href: b.url,
        fromPath: ["library"],
        toPath: ["suggested-tags"],
      },
      status: "pending",
      createdAt: Date.now(),
      providerId: "rule",
      signals: ["no-tags"],
      patternKey: buildPatternKey("uncategorized", ["library"], undefined, b.domain),
    });
  }

  const tags = [...tagCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  for (let i = 0; i < tags.length; i++) {
    for (let j = i + 1; j < tags.length; j++) {
      const [a, ca] = tags[i];
      const [b, cb] = tags[j];
      if (a === b) continue;
      if (a.replace(/s$/, "") === b.replace(/s$/, "") || a.includes(b) || b.includes(a)) {
        out.push({
          id: `lib-${++seq}`,
          jobId,
          kind: "folder_cleanup",
          confidence: 72,
          reasoning: `Tags "${a}" (${ca}) and "${b}" (${cb}) may be duplicates — merge in Library.`,
          preview: {
            title: `${a} ↔ ${b}`,
            fromPath: [a],
            toPath: [ca >= cb ? a : b],
            folderLabel: "tags",
          },
          status: "pending",
          createdAt: Date.now(),
          providerId: "rule",
          signals: ["tag-merge"],
          patternKey: buildPatternKey("folder_cleanup", [a], [b]),
        });
      }
    }
  }

  return out.slice(0, 100);
}
