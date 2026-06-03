import { pathKey } from "../smart-collection/structure-guard";
import { buildCollectionPathMap, fetchAllCollections } from "./api";
import { loadRaindropCollectionMap, saveRaindropCollectionMap } from "./storage";

export function raindropCollectionIdForPath(
  map: Record<string, number>,
  segments: string[]
): number | undefined {
  const key = pathKey(segments);
  if (map[key] != null) return map[key];
  return undefined;
}

/** Session map is cleared on restart — fall back to local + API refresh. */
export async function ensureRaindropCollectionMap(): Promise<Record<string, number>> {
  let map = await loadRaindropCollectionMap();
  if (Object.keys(map).length > 0) return map;

  const collections = await fetchAllCollections();
  const { pathToCollectionId } = buildCollectionPathMap(collections);
  await saveRaindropCollectionMap(pathToCollectionId);
  return pathToCollectionId;
}
