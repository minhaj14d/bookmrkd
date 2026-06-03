import type { Suggestion } from "./types";
import { pathKey } from "./structure-guard";
import { findFolderIdByPathOrThrow } from "../../lib/bookmarks/tree-utils";
import { applyRaindropSuggestion, shouldApplyViaRaindrop } from "../raindrop/apply";
import { parseRaindropBookmarkId } from "../raindrop/storage";

async function moveAllChildren(fromFolderId: string, toFolderId: string): Promise<number> {
  let moved = 0;
  let children = await chrome.bookmarks.getChildren(fromFolderId);
  while (children.length > 0) {
    const child = children[0];
    if (!child.id) break;
    await chrome.bookmarks.move(child.id, { parentId: toFolderId });
    moved++;
    children = await chrome.bookmarks.getChildren(fromFolderId);
  }
  return moved;
}

export async function applySuggestion(suggestion: Suggestion): Promise<void> {
  if (await shouldApplyViaRaindrop(suggestion)) {
    return applyRaindropSuggestion(suggestion);
  }

  const { preview, kind } = suggestion;

  if (kind === "move" && preview.chromeId && preview.toPath?.length) {
    const parentId = await findFolderIdByPathOrThrow(preview.toPath);
    await chrome.bookmarks.move(preview.chromeId, { parentId });
    return;
  }

  if (kind === "duplicate" && preview.chromeId && !parseRaindropBookmarkId(preview.chromeId)) {
    await chrome.bookmarks.remove(preview.chromeId);
    return;
  }

  if (kind === "folder_merge" && preview.mergePaths?.length === 2) {
    const [fromSegs, toSegs] = preview.mergePaths;
    const toId = await findFolderIdByPathOrThrow(toSegs);
    const fromId = await findFolderIdByPathOrThrow(fromSegs);
    if (fromId === toId) return;

    const moved = await moveAllChildren(fromId, toId);
    const remaining = await chrome.bookmarks.getChildren(fromId);
    if (remaining.length === 0) {
      await chrome.bookmarks.removeTree(fromId);
    } else if (moved === 0) {
      throw new Error(`Could not merge "${pathKey(fromSegs)}" into "${pathKey(toSegs)}" — no items moved.`);
    }
    return;
  }

  if (kind === "folder_cleanup" && preview.fromPath?.length) {
    const folderId = await findFolderIdByPathOrThrow(preview.fromPath);
    const children = await chrome.bookmarks.getChildren(folderId);
    if (children.length === 0) {
      await chrome.bookmarks.removeTree(folderId);
      return;
    }
    throw new Error(
      `Folder "${pathKey(preview.fromPath)}" is not empty (${children.length} item(s)). Remove or move contents first.`
    );
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
