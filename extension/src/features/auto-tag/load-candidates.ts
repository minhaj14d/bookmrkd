import { listBookmarks } from "../../storage/idb";
import { fetchAllRaindrops, fetchAllCollections, buildCollectionPathMap } from "../raindrop/api";
import { raindropBookmarkId, saveRaindropCollectionMap } from "../raindrop/storage";
import type { TagCandidate, TagTargetSource } from "./types";

export async function loadTagCandidates(
  source: TagTargetSource,
  onStatus?: (message: string) => void
): Promise<TagCandidate[]> {
  if (source === "library") {
    onStatus?.("Loading bookmrkd library…");
    const entries = await listBookmarks();
    return entries.map((b) => ({
      id: b.id,
      href: b.url,
      title: b.title,
      existingTags: [...b.tags],
      path: ["library"],
      source: "library",
      libraryId: b.id,
    }));
  }

  onStatus?.("Loading Raindrop bookmarks…");
  const collections = await fetchAllCollections();
  const { pathToCollectionId, pathForId } = buildCollectionPathMap(collections);
  await saveRaindropCollectionMap(pathToCollectionId);

  const items = await fetchAllRaindrops((n) => onStatus?.(`Loaded ${n} Raindrop items…`));
  const out: TagCandidate[] = [];
  for (const item of items) {
    const collectionId = item.collection?.$id;
    const path =
      collectionId != null && collectionId > 0 ? pathForId(collectionId) : ["Unsorted"];
    out.push({
      id: raindropBookmarkId(item._id),
      href: item.link || "",
      title: item.title || item.link || "Untitled",
      existingTags: (item.tags || []).map((t) => String(t)),
      path,
      source: "raindrop",
      raindropItemId: item._id,
    });
  }
  return out;
}
