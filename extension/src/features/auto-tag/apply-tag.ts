import { normalizeTags } from "../../lib/url";
import { getBookmarkById, putBookmark } from "../../storage/idb";
import { updateRaindropTags } from "../raindrop/api";
import { parseRaindropBookmarkId } from "../raindrop/storage";
import type { Suggestion } from "../smart-collection/types";

export async function applyTagSuggestion(suggestion: Suggestion): Promise<void> {
  if (suggestion.kind !== "tag") {
    throw new Error("Not a tag suggestion");
  }

  const { preview } = suggestion;
  const add = normalizeTags(preview.suggestedTags || []);
  if (!add.length) throw new Error("No tags to apply.");

  const merged = normalizeTags([...(preview.existingTags || []), ...add]);

  if (preview.tagSource === "library" || preview.libraryId) {
    const id = preview.libraryId;
    if (!id) throw new Error("Missing library bookmark id.");
    const entry = await getBookmarkById(id);
    if (!entry) throw new Error("Library bookmark not found.");
    await putBookmark({ ...entry, tags: merged, updatedAt: Date.now() });
    return;
  }

  const itemId =
    preview.raindropItemId ?? parseRaindropBookmarkId(preview.chromeId) ?? undefined;
  if (!itemId) throw new Error("Missing Raindrop bookmark id for tagging.");

  await updateRaindropTags(itemId, merged);
}
