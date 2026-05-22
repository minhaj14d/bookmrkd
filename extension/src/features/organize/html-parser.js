/**
 * Parse Netscape / Chrome bookmark HTML exports.
 */

/**
 * @typedef {object} BookmarkRecord
 * @property {string|null} chromeId
 * @property {string} href
 * @property {string} title
 * @property {number} addDate
 * @property {string[]} originalPath
 * @property {string|null} icon
 * @property {number} relevance
 * @property {string} categoryTop
 * @property {string|null} categorySub
 * @property {string} categorizationSource
 * @property {string|null} fuzzyDuplicateOf
 */

/**
 * @param {Element} a
 */
function folderPathForAnchor(a) {
  /** @type {string[]} */
  const parts = [];
  let cur = a.parentElement;
  while (cur) {
    if (cur.tagName === "DT") {
      const h3 = cur.querySelector(":scope > h3");
      if (h3) parts.unshift((h3.textContent || "").trim() || "Untitled");
    }
    cur = cur.parentElement;
  }
  return parts;
}

/**
 * @param {string} raw
 */
function addDateFromAttrs(raw) {
  if (!raw) return 0;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * @param {string} htmlText
 * @returns {BookmarkRecord[]}
 */
export function parseBookmarksHtml(htmlText) {
  const doc = new DOMParser().parseFromString(htmlText, "text/html");
  /** @type {BookmarkRecord[]} */
  const out = [];
  const anchors = doc.querySelectorAll("a[href]");
  for (const a of anchors) {
    const href = (a.getAttribute("href") || "").trim();
    if (!href || href.toLowerCase().startsWith("javascript:")) continue;
    const addAttr = a.getAttribute("add_date") || a.getAttribute("ADD_DATE");
    out.push({
      chromeId: null,
      href,
      title: (a.textContent || "").trim() || href,
      addDate: addDateFromAttrs(addAttr),
      originalPath: folderPathForAnchor(a),
      icon: a.getAttribute("icon") || a.getAttribute("ICON") || null,
      relevance: 0,
      categoryTop: "Archive",
      categorySub: "Uncategorized",
      categorizationSource: "default",
      fuzzyDuplicateOf: null,
    });
  }
  return out;
}
