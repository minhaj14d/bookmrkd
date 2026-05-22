/** Use worker when bookmark count exceeds this (keeps small libraries on main thread). */
export const WORKER_THRESHOLD = 2500;

import OrganizeWorker from "./organize-worker?worker";

/** @type {Worker|null} */
let worker = null;
let jobSeq = 0;

function getWorker() {
  if (!worker) {
    worker = new OrganizeWorker();
  }
  return worker;
}

/**
 * @param {import("./organizer.js").BookmarkRecord[]} bookmarks
 * @param {Parameters<typeof import("./organizer.js").organizeBookmarks>[1]} config
 * @param {Parameters<typeof import("./organizer.js").organizeBookmarks>[2]} options
 */
export function organizeBookmarksOffThread(bookmarks, config, options) {
  return new Promise((resolve, reject) => {
    const id = ++jobSeq;
    const w = getWorker();

    /** @param {MessageEvent} e */
    const onMessage = (e) => {
      if (e.data?.id !== id) return;
      w.removeEventListener("message", onMessage);
      w.removeEventListener("error", onError);
      if (e.data.ok) resolve(e.data.result);
      else reject(new Error(e.data.error || "Organize worker failed"));
    };

    /** @param {ErrorEvent} e */
    const onError = (e) => {
      w.removeEventListener("message", onMessage);
      w.removeEventListener("error", onError);
      reject(e.error || new Error("Organize worker error"));
    };

    w.addEventListener("message", onMessage);
    w.addEventListener("error", onError);
    w.postMessage({ id, bookmarks, config, options });
  });
}

/** @param {number} count */
export function shouldUseOrganizeWorker(count) {
  return count >= WORKER_THRESHOLD;
}

export function terminateOrganizeWorker() {
  if (worker) {
    worker.terminate();
    worker = null;
  }
}
