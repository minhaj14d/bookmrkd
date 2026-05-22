/**
 * Module worker — runs organize pipeline off the UI thread for large libraries.
 */
import { organizeBookmarks } from "./organizer.js";

/** @param {MessageEvent} e */
self.addEventListener("message", async (e) => {
  const { id, bookmarks, config, options } = e.data || {};
  if (!id) return;
  try {
    const result = await organizeBookmarks(bookmarks, config, options);
    self.postMessage({ id, ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    self.postMessage({ id, ok: false, error: message });
  }
});
