import type { Suggestion } from "./types";
import { pathKey } from "./structure-guard";

async function findFolderIdByPath(segments: string[]): Promise<string | null> {
  const tree = await chrome.bookmarks.getTree();
  let nodes = tree;
  let lastId: string | null = null;
  for (const seg of segments) {
    const match = nodes.find((n) => !n.url && (n.title || "").trim() === seg);
    if (!match?.id) return null;
    lastId = match.id;
    nodes = match.children || [];
  }
  return lastId;
}

export async function applySuggestion(suggestion: Suggestion): Promise<void> {
  const { preview, kind } = suggestion;

  if (kind === "move" && preview.chromeId && preview.toPath?.length) {
    const parentId = await findFolderIdByPath(preview.toPath);
    if (!parentId) throw new Error(`Target folder not found: ${pathKey(preview.toPath)}`);
    await chrome.bookmarks.move(preview.chromeId, { parentId });
    return;
  }

  if (kind === "duplicate" && preview.chromeId) {
    await chrome.bookmarks.remove(preview.chromeId);
    return;
  }

  if (kind === "folder_merge" && preview.mergePaths?.length === 2) {
    const [fromSegs, toSegs] = preview.mergePaths;
    const toId = await findFolderIdByPath(toSegs);
    const fromId = await findFolderIdByPath(fromSegs);
    if (!toId || !fromId) throw new Error("Merge folders not found in Chrome tree");
    const children = await chrome.bookmarks.getChildren(fromId);
    for (const child of children) {
      if (child.id) await chrome.bookmarks.move(child.id, { parentId: toId });
    }
    await chrome.bookmarks.removeTree(fromId);
    return;
  }

  if (kind === "folder_cleanup" && preview.fromPath?.length) {
    const folderId = await findFolderIdByPath(preview.fromPath);
    if (!folderId) return;
    const children = await chrome.bookmarks.getChildren(folderId);
    if (children.length === 0) await chrome.bookmarks.removeTree(folderId);
    return;
  }

  if (kind === "uncategorized" || kind === "folder_split" || kind === "leave_unchanged") {
    return;
  }

  throw new Error(`Cannot apply suggestion kind: ${kind}`);
}

export async function applySuggestionsBatch(
  items: Suggestion[],
  onItem?: (s: Suggestion, err?: Error) => void
): Promise<{ ok: number; failed: number }> {
  let ok = 0;
  let failed = 0;
  for (const s of items) {
    try {
      await applySuggestion(s);
      ok++;
      onItem?.(s);
    } catch (e) {
      failed++;
      onItem?.(s, e instanceof Error ? e : new Error(String(e)));
    }
  }
  return { ok, failed };
}
