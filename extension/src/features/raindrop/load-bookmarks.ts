import type { BookmarkRecord } from "../../lib/bookmarks/types";
import {
  fetchAllCollections,
  fetchAllRaindrops,
  buildCollectionPathMap,
} from "./api";
import { raindropBookmarkId, saveRaindropCollectionMap } from "./storage";
import type { RaindropLoadResult } from "./types";

export async function loadRaindropBookmarks(
  onStatus?: (message: string) => void
): Promise<RaindropLoadResult> {
  onStatus?.("Fetching Raindrop collections…");
  const collections = await fetchAllCollections();
  const { pathToCollectionId, pathForId } = buildCollectionPathMap(collections);

  onStatus?.("Fetching Raindrop bookmarks (collections + Unsorted)…");
  const items = await fetchAllRaindrops((n) => onStatus?.(`Loaded ${n} bookmarks…`));
  const unsortedCount = items.filter(
    (i) => !i.collection?.$id || (i.collection.$id ?? 0) <= 0
  ).length;
  if (unsortedCount > 0) {
    onStatus?.(`Loaded ${items.length} bookmarks (${unsortedCount} in Unsorted)`);
  }

  const bookmarks: BookmarkRecord[] = [];
  for (const item of items) {
    const collectionId = item.collection?.$id;
    const path =
      collectionId != null && collectionId > 0
        ? pathForId(collectionId)
        : ["Unsorted"];

    bookmarks.push({
      chromeId: raindropBookmarkId(item._id),
      href: item.link || "",
      title: item.title || item.link || "Untitled",
      addDate: item.created ? Math.floor(new Date(item.created).getTime() / 1000) : 0,
      originalPath: path,
      icon: null,
      relevance: 0,
      categoryTop: path[0] || "Raindrop",
      categorySub: path.length > 1 ? path[path.length - 1] : null,
      categorizationSource: "raindrop",
      fuzzyDuplicateOf: null,
    });
  }

  await saveRaindropCollectionMap(pathToCollectionId);

  return { bookmarks, pathToCollectionId };
}
