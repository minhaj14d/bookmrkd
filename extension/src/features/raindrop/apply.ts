import type { Suggestion } from "../smart-collection/types";
import { pathKey } from "../smart-collection/structure-guard";
import { parseRaindropBookmarkId, loadRaindropCollectionMap } from "./storage";
import {
  ensureRaindropCollectionMap,
  raindropCollectionIdForPath,
} from "./collection-map";
import {
  moveRaindrop,
  deleteRaindrop,
  mergeRaindropCollections,
  deleteRaindropCollection,
  countRaindropsInCollection,
} from "./api";

export function isRaindropSuggestion(suggestion: Suggestion): boolean {
  if (parseRaindropBookmarkId(suggestion.preview.chromeId)) return true;
  if (suggestion.preview.raindropCollectionId != null) return true;
  if (suggestion.preview.targetRaindropCollectionId != null) return true;
  if (suggestion.preview.mergeRaindropCollectionIds?.length === 2) return true;
  if (
    suggestion.kind === "uncategorized" &&
    (suggestion.preview.targetRaindropCollectionId != null || suggestion.preview.toPath?.length)
  ) {
    return true;
  }
  return false;
}

export async function shouldApplyViaRaindrop(suggestion: Suggestion): Promise<boolean> {
  if (isRaindropSuggestion(suggestion)) return true;
  if (suggestion.kind !== "folder_merge" && suggestion.kind !== "folder_cleanup") {
    return false;
  }
  const map = await loadRaindropCollectionMap();
  if (Object.keys(map).length === 0) return false;
  if (suggestion.kind === "folder_merge" && suggestion.preview.mergePaths?.length === 2) {
    const [fromSegs, toSegs] = suggestion.preview.mergePaths;
    return (
      raindropCollectionIdForPath(map, fromSegs) != null ||
      raindropCollectionIdForPath(map, toSegs) != null
    );
  }
  if (suggestion.preview.fromPath?.length) {
    return raindropCollectionIdForPath(map, suggestion.preview.fromPath) != null;
  }
  return false;
}

export async function applyRaindropSuggestion(suggestion: Suggestion): Promise<void> {
  const { preview, kind } = suggestion;
  const map = await ensureRaindropCollectionMap();

  if (kind === "move" || kind === "uncategorized") {
    const itemId =
      preview.raindropItemId ??
      parseRaindropBookmarkId(preview.chromeId) ??
      undefined;
    const targetId =
      preview.targetRaindropCollectionId ??
      (preview.toPath?.length ? raindropCollectionIdForPath(map, preview.toPath) : undefined);

    if (!itemId || targetId == null) {
      if (kind === "uncategorized") {
        throw new Error(
          "No target collection for this bookmark. Run Analyze again (Raindrop + MiniLM) to get Move suggestions, or approve a Move row."
        );
      }
      throw new Error("Missing Raindrop bookmark or target collection for move.");
    }
    await moveRaindrop(itemId, targetId);
    return;
  }

  if (kind === "duplicate") {
    const itemId =
      preview.raindropItemId ?? parseRaindropBookmarkId(preview.chromeId);
    if (!itemId) throw new Error("Missing Raindrop bookmark id for duplicate removal.");
    await deleteRaindrop(itemId);
    return;
  }

  if (kind === "folder_merge") {
    let toId = preview.mergeRaindropCollectionIds?.[1];
    let fromId = preview.mergeRaindropCollectionIds?.[0];
    if (preview.mergePaths?.length === 2) {
      const [fromSegs, toSegs] = preview.mergePaths;
      fromId = fromId ?? raindropCollectionIdForPath(map, fromSegs);
      toId = toId ?? raindropCollectionIdForPath(map, toSegs);
    }
    if (toId == null || fromId == null) {
      throw new Error(
        `Could not resolve Raindrop collections for merge (${preview.mergePaths?.map((p) => pathKey(p)).join(" → ") || "unknown paths"}). Run Analyze again.`
      );
    }
    await mergeRaindropCollections(toId, fromId);
    return;
  }

  if (kind === "folder_cleanup" && preview.fromPath?.length) {
    const colId =
      preview.raindropCollectionId ?? raindropCollectionIdForPath(map, preview.fromPath);
    if (colId == null) throw new Error(`Collection not found: ${pathKey(preview.fromPath)}`);
    const count = await countRaindropsInCollection(colId);
    if (count === 0) {
      await deleteRaindropCollection(colId);
      return;
    }
    throw new Error(
      `Collection "${pathKey(preview.fromPath)}" still has ${count} bookmark(s).`
    );
  }

  if (kind === "folder_split" || kind === "leave_unchanged") {
    return;
  }

  throw new Error(`Cannot apply Raindrop suggestion kind: ${kind}`);
}
