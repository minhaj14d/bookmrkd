import { titleSimilarity } from "../../lib/bookmarks/title-similarity";
import type { FolderProfile } from "./types";

export function pathKey(segments: string[]): string {
  return segments.join(" > ");
}

export function folderNameDistance(a: string, b: string): number {
  const na = a.toLowerCase().trim();
  const nb = b.toLowerCase().trim();
  if (na === nb) return 0;
  if (na.includes(nb) || nb.includes(na)) return 0.15;
  return 1 - titleSimilarity(na, nb);
}

/** Block new folder if an existing sibling is semantically close. */
export function shouldBlockNewFolder(
  proposedName: string,
  parentSegments: string[],
  folders: FolderProfile[],
  maxNameDistance = 0.35
): boolean {
  const parentKey = pathKey(parentSegments);
  for (const f of folders) {
    if (f.segments.length !== parentSegments.length + 1) continue;
    const parent = f.segments.slice(0, -1);
    if (pathKey(parent) !== parentKey) continue;
    const existing = f.segments[f.segments.length - 1];
    if (folderNameDistance(proposedName, existing) <= maxNameDistance) return true;
  }
  return false;
}

export function maxObservedDepth(folders: FolderProfile[]): number {
  return folders.reduce((m, f) => Math.max(m, f.depth), 0);
}

export function isDepthAllowed(proposedDepth: number, folders: FolderProfile[], slack = 1): boolean {
  return proposedDepth <= maxObservedDepth(folders) + slack;
}
