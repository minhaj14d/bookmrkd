/**
 * Bookmark organizer pipeline — dedupe, score, categorize, export.
 */
import { legacyClassify } from "./legacy-classify-module.js";
import { titleSimilarity } from "./similarity.js";
import { escapeHtml, minMaxPositive, forEachChunked } from "./utils.js";

export { loadRulesConfig } from "./rules-loader.js";
export { parseBookmarksHtml } from "./html-parser.js";

/** @typedef {object} BookmarkRecord
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

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "gws_rd",
  "ei",
]);

/**
 * @param {string} url
 */
export function normalizeUrl(url) {
  const u = (url || "").trim();
  if (!u) return "";
  try {
    const p = new URL(u);
    const scheme = (p.protocol || "http:").replace(":", "").toLowerCase();
    let host = (p.hostname || "").toLowerCase();
    if (host.startsWith("www.")) host = host.slice(4);
    let path = p.pathname || "/";
    if (path !== "/" && path.endsWith("/")) path = path.slice(0, -1);
    const params = new URLSearchParams(p.search);
    for (const k of [...params.keys()]) {
      if (TRACKING_PARAMS.has(k.toLowerCase())) params.delete(k);
    }
    const qs = params.toString();
    return `${scheme}://${host}${path}${qs ? `?${qs}` : ""}`.toLowerCase();
  } catch {
    return u.toLowerCase();
  }
}

/**
 * @param {string} href
 */
export function hostKey(href) {
  try {
    let h = (new URL(href).hostname || "").toLowerCase();
    if (h.startsWith("www.")) h = h.slice(4);
    return h;
  } catch {
    return "";
  }
}

/**
 * @param {chrome.bookmarks.BookmarkTreeNode[]} nodes
 * @param {string[]} [path]
 * @returns {BookmarkRecord[]}
 */
export function flattenChromeTree(nodes, path = []) {
  /** @type {BookmarkRecord[]} */
  const out = [];
  for (const node of nodes || []) {
    if (node.url) {
      const url = node.url.trim();
      if (!url || url.toLowerCase().startsWith("javascript:")) continue;
      out.push({
        chromeId: node.id,
        href: url,
        title: node.title || url,
        addDate: node.dateAdded ? Math.floor(node.dateAdded / 1000) : 0,
        originalPath: [...path],
        icon: null,
        relevance: 0,
        categoryTop: "Archive",
        categorySub: "Uncategorized",
        categorizationSource: "default",
        fuzzyDuplicateOf: null,
      });
    } else if (node.children) {
      const folderTitle = (node.title || "").trim() || "Untitled";
      out.push(...flattenChromeTree(node.children, [...path, folderTitle]));
    }
  }
  return out;
}

/**
 * @param {BookmarkRecord} b
 */
function attrWeight(b) {
  return (b.title?.length || 0) + (b.href?.length || 0) + (b.addDate ? 8 : 0);
}

/**
 * @param {BookmarkRecord[]} bookmarks
 */
export function dedupeExact(bookmarks) {
  /** @type {Map<string, BookmarkRecord[]>} */
  const groups = new Map();
  for (const bm of bookmarks) {
    const k = normalizeUrl(bm.href);
    if (!k) continue;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(bm);
  }
  /** @type {BookmarkRecord[]} */
  const kept = [];
  /** @type {object[]} */
  const removed = [];
  for (const [key, g] of groups) {
    const best = g.reduce((a, b) =>
      b.addDate > a.addDate || (b.addDate === a.addDate && attrWeight(b) > attrWeight(a)) ? b : a
    );
    kept.push(best);
    for (const b of g) {
      if (b !== best) {
        removed.push({
          norm: key,
          removedTitle: (b.title || "").slice(0, 160),
          keptTitle: (best.title || "").slice(0, 160),
          path: b.originalPath.length ? b.originalPath.join(" > ") : "(root)",
        });
      }
    }
  }
  return { kept, removed };
}

/**
 * @param {BookmarkRecord[]} bookmarks
 * @param {number} titleRatioThreshold
 */
export function dedupeFuzzy(bookmarks, titleRatioThreshold = 0.88) {
  /** @type {Map<string, BookmarkRecord[]>} */
  const byHost = new Map();
  for (const bm of bookmarks) {
    const h = hostKey(bm.href);
    if (!byHost.has(h)) byHost.set(h, []);
    byHost.get(h).push(bm);
  }
  /** @type {BookmarkRecord[]} */
  const keptAll = [];
  /** @type {object[]} */
  const fuzzyLog = [];
  for (const [host, group] of byHost) {
    if (group.length < 2) {
      keptAll.push(...group);
      continue;
    }
    group.sort((a, b) => b.addDate - a.addDate);
    /** @type {BookmarkRecord[]} */
    const kept = [];
    for (const bm of group) {
      /** @type {BookmarkRecord|null} */
      let dupOf = null;
      for (const k of kept) {
        if (titleSimilarity(bm.title, k.title) >= titleRatioThreshold) {
          dupOf = k;
          break;
        }
      }
      if (dupOf) {
        bm.fuzzyDuplicateOf = normalizeUrl(dupOf.href);
        fuzzyLog.push({
          host,
          removed: (bm.title || "").slice(0, 120),
          similarTo: (dupOf.title || "").slice(0, 120),
          ratioThreshold: titleRatioThreshold,
        });
        continue;
      }
      kept.push(bm);
    }
    keptAll.push(...kept);
  }
  return { kept: keptAll, fuzzyLog };
}

/**
 * @param {BookmarkRecord} bm
 * @param {{ lo: number, hi: number }|null} dateRange
 * @param {Record<string, unknown>} [settings]
 */
export function scoreRelevance(bm, dateRange, settings = {}) {
  const wRec = Number(settings.relevance_recency_weight ?? 30);
  const iconB = Number(settings.relevance_icon_bonus ?? 10);
  const genPen = Number(settings.relevance_generic_title_penalty ?? 12);
  let score = 45;
  if (bm.icon) score += iconB;
  if (bm.title?.trim() === bm.href?.trim() || bm.title?.startsWith("http")) score -= genPen;
  if (["bit.ly/", "tinyurl.com/", "t.co/"].some((x) => bm.href.toLowerCase().includes(x))) score -= 15;
  if (dateRange && bm.addDate > 0) {
    const { lo, hi } = dateRange;
    if (hi > lo) score += wRec * ((bm.addDate - lo) / (hi - lo));
    else score += wRec * 0.5;
  }
  return Math.max(0, Math.min(100, score));
}

/**
 * @param {unknown[]} rawRules
 */
export function compileRules(rawRules = []) {
  const rules = rawRules.map((r) => {
    const rule = /** @type {Record<string, unknown>} */ (r);
    const folder = /** @type {string[]} */ (rule.folder || ["Archive", "Uncategorized"]);
    let sub = folder.length > 1 ? folder[1] : null;
    if (sub != null && String(sub).toLowerCase() === "null") sub = null;
    let any_ = rule.any || [];
    if (!Array.isArray(any_)) any_ = [any_];
    return {
      id: String(rule.id || "rule"),
      priority: Number(rule.priority || 0),
      top: String(folder[0]),
      sub,
      anyConditions: any_.filter((b) => b && typeof b === "object").map((b) => ({ .../** @type {object} */ (b) })),
    };
  });
  rules.sort((a, b) => b.priority - a.priority);
  return rules;
}

/**
 * @param {Record<string, string>} cond
 * @param {BookmarkRecord} bm
 */
function condMatch(cond, bm) {
  const host = hostKey(bm.href);
  const urlL = bm.href.toLowerCase();
  const titleL = (bm.title || "").toLowerCase();
  for (const [key, val] of Object.entries(cond)) {
    const v = String(val).toLowerCase();
    try {
      if (key === "host_contains") {
        if (!host.includes(v)) return false;
      } else if (key === "url_contains") {
        if (!urlL.includes(v)) return false;
      } else if (key === "title_contains") {
        if (!titleL.includes(v)) return false;
      } else if (key === "host_regex") {
        if (!new RegExp(val, "i").test(host)) return false;
      } else if (key === "url_regex") {
        if (!new RegExp(val, "i").test(bm.href)) return false;
      } else if (key === "title_regex") {
        if (!new RegExp(val, "i").test(bm.title || "")) return false;
      } else {
        return false;
      }
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * @param {ReturnType<typeof compileRules>} rules
 * @param {BookmarkRecord} bm
 */
export function categorizeWithRules(rules, bm) {
  for (const rule of rules) {
    if (!rule.anyConditions?.length) continue;
    if (rule.anyConditions.some((c) => condMatch(c, bm)))
      return { top: rule.top, sub: rule.sub, source: `yaml:${rule.id}` };
  }
  return null;
}

/**
 * @param {BookmarkRecord} bm
 */
export function renderATag(bm) {
  const addDate = bm.addDate || Math.floor(Date.now() / 1000);
  const nowTs = String(Math.floor(Date.now() / 1000));
  let tag = `<DT><A HREF="${escapeHtml(bm.href)}" ADD_DATE="${addDate}" LAST_MODIFIED="${nowTs}"`;
  if (bm.icon) tag += ` ICON="${escapeHtml(bm.icon)}"`;
  tag += `>${escapeHtml(bm.title || bm.href)}</A>`;
  return tag;
}

/**
 * @param {BookmarkRecord[]} bookmarks
 * @param {string} nowTs
 */
export function buildFolderTreeHtml(bookmarks, nowTs) {
  const tree = new Map();
  const ensure = (top) => {
    if (!tree.has(top)) tree.set(top, { folders: new Map(), bookmarks: [] });
    return tree.get(top);
  };
  for (const bm of bookmarks) {
    const node = ensure(bm.categoryTop);
    if (bm.categorySub) {
      if (!node.folders.has(bm.categorySub)) node.folders.set(bm.categorySub, []);
      node.folders.get(bm.categorySub).push(renderATag(bm));
    } else {
      node.bookmarks.push(renderATag(bm));
    }
  }
  const lines = [];
  for (const name of [...tree.keys()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))) {
    const node = tree.get(name);
    lines.push(`        <DT><H3 ADD_DATE="${nowTs}" LAST_MODIFIED="${nowTs}">${escapeHtml(name)}</H3>`);
    lines.push("        <DL><p>");
    for (const [sub, tags] of [...node.folders.entries()].sort((a, b) =>
      a[0].localeCompare(b[0], undefined, { sensitivity: "base" })
    )) {
      lines.push(`            <DT><H3 ADD_DATE="${nowTs}" LAST_MODIFIED="${nowTs}">${escapeHtml(sub)}</H3>`);
      lines.push("            <DL><p>");
      for (const raw of [...tags].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })))
        lines.push(`                ${raw}`);
      lines.push("            </DL><p>");
    }
    for (const raw of [...node.bookmarks].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })))
      lines.push(`            ${raw}`);
    lines.push("        </DL><p>");
  }
  return lines.join("\n");
}

/**
 * @param {string} inner
 * @param {string} nowTs
 */
export function emitNetscapeHtml(inner, nowTs) {
  return `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- bookmrkd — Semantic Bookmark Organizer -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="${nowTs}" LAST_MODIFIED="${nowTs}" PERSONAL_TOOLBAR_FOLDER="true">Bookmarks bar</H3>
    <DL><p>
${inner}
    </DL><p>
</DL><p>
`;
}

/**
 * @param {BookmarkRecord[]} bookmarks
 */
export function categoryBreakdown(bookmarks) {
  const counts = new Map();
  for (const bm of bookmarks) {
    const key = bm.categorySub ? `${bm.categoryTop} › ${bm.categorySub}` : bm.categoryTop;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

/**
 * @param {BookmarkRecord[]} rawBookmarks
 * @param {{ settings?: Record<string, unknown>, rules?: unknown[] }} [config]
 * @param {{ fuzzyDedupe?: boolean }} [options]
 */
export async function organizeBookmarks(rawBookmarks, config = {}, options = {}) {
  const settings = config.settings || {};
  const rules = compileRules(config.rules || []);
  const fuzzy = options.fuzzyDedupe !== false;
  const ratio = Number(settings.fuzzy_duplicate_title_ratio ?? 0.88);

  const { kept: afterExact, removed: exactRemoved } = dedupeExact(rawBookmarks);
  let kept = afterExact;
  let fuzzyLog = [];
  if (fuzzy) {
    const fuzzyResult = dedupeFuzzy(kept, ratio);
    kept = fuzzyResult.kept;
    fuzzyLog = fuzzyResult.fuzzyLog;
  }

  const dateRange = minMaxPositive(kept.map((b) => b.addDate));
  await forEachChunked(
    kept,
    (bm) => {
      const hit = categorizeWithRules(rules, bm);
      if (hit) {
        bm.categoryTop = hit.top;
        bm.categorySub = hit.sub;
        bm.categorizationSource = hit.source;
      } else {
        const leg = legacyClassify(bm.href, bm.title);
        bm.categoryTop = leg.top;
        bm.categorySub = leg.sub;
        bm.categorizationSource = "legacy";
      }
      bm.relevance = scoreRelevance(bm, dateRange, settings);
    },
    400
  );

  return {
    bookmarks: kept,
    stats: {
      inputCount: rawBookmarks.length,
      outputCount: kept.length,
      exactDuplicatesRemoved: exactRemoved.length,
      fuzzyDuplicatesRemoved: fuzzyLog.length,
      categories: categoryBreakdown(kept),
    },
    exactRemoved,
    fuzzyLog,
  };
}

/**
 * @param {ReturnType<typeof organizeBookmarks>} result
 */
export function buildReportMarkdown(result) {
  const { stats, exactRemoved, fuzzyLog, bookmarks } = result;
  const lines = [
    "# bookmrkd Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Summary",
    "",
    "| Metric | Value |",
    "| --- | --- |",
    `| Input bookmarks | ${stats.inputCount} |`,
    `| After dedupe | ${stats.outputCount} |`,
    `| Exact duplicates removed | ${stats.exactDuplicatesRemoved} |`,
    `| Fuzzy duplicates removed | ${stats.fuzzyDuplicatesRemoved} |`,
    "",
    "## Categories",
    "",
  ];
  for (const [cat, n] of stats.categories.slice(0, 40)) lines.push(`- **${cat}**: ${n}`);
  if (stats.categories.length > 40) lines.push(`- … and ${stats.categories.length - 40} more`);
  lines.push("", "## Low relevance (sample)", "");
  const low = [...bookmarks].sort((a, b) => a.relevance - b.relevance).slice(0, 15);
  for (const bm of low) {
    lines.push(
      `- (${bm.relevance.toFixed(0)}) ${bm.title} → ${bm.categoryTop}${bm.categorySub ? ` / ${bm.categorySub}` : ""}`
    );
    lines.push(`  ${bm.href}`);
  }
  if (exactRemoved.length) {
    lines.push("", "## Exact duplicates (sample)", "");
    for (const r of exactRemoved.slice(0, 20))
      lines.push(`- Removed \`${r.removedTitle}\` (kept \`${r.keptTitle}\`) @ ${r.path}`);
  }
  if (fuzzyLog.length) {
    lines.push("", "## Fuzzy duplicates (sample)", "");
    for (const r of fuzzyLog.slice(0, 15)) lines.push(`- \`${r.removed}\` ≈ \`${r.similarTo}\` (${r.host})`);
  }
  return lines.join("\n");
}
