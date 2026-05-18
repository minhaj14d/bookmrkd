/** @typedef {'info'|'success'|'error'|'warn'} StatusKind */

/**
 * @param {string} s
 */
export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {string} filename
 * @param {string} mime
 * @param {string} content
 */
export function downloadText(filename, mime, content) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    chrome.downloads.download({ url, filename, saveAs: true }, () => {
      const err = chrome.runtime.lastError;
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      if (err) reject(new Error(err.message));
      else resolve();
    });
  });
}

/**
 * @param {string} key
 * @param {string} value
 */
export function sessionSet(key, value) {
  try {
    sessionStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {number} ms
 */
export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Run fn without blocking UI; yields between chunks.
 * @template T
 * @param {T[]} items
 * @param {(item: T, index: number) => void} fn
 * @param {number} [chunkSize]
 */
export async function forEachChunked(items, fn, chunkSize = 500) {
  for (let i = 0; i < items.length; i += chunkSize) {
    const end = Math.min(i + chunkSize, items.length);
    for (let j = i; j < end; j++) fn(items[j], j);
    if (end < items.length) await sleep(0);
  }
}

/**
 * @param {number[]} values
 */
export function minMaxPositive(values) {
  let lo = Infinity;
  let hi = -Infinity;
  let any = false;
  for (const v of values) {
    if (v > 0) {
      any = true;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  return any ? { lo, hi } : null;
}
