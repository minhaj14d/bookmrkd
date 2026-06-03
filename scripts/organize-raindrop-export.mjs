/**
 * Organize Raindrop HTML export: few folders, few tags (Raindrop + Obsidian friendly).
 * Usage: node scripts/organize-raindrop-export.mjs [input.html] [output.html]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const inputPath = process.argv[2] || join(root, "my-backup-bm.html");
const outputPath = process.argv[3] || join(root, "my-backup-bm-organized.html");

const MAX_TAGS = 3;

/** Orphan top-level folders from Raindrop → nest under Learning before simplify. */
const LEARNING_ORPHAN_TOPS = new Set([
  "Articles & Blogs",
  "Books",
  "Coding Practice",
  "Courses & Platforms",
  "Critical Thinking",
  "DIY",
  "Educational Content",
  "Events",
  "Flashcards",
  "Git",
  "Institutions",
  "Language Docs",
  "Projects",
  "Q&A",
  "Quotes",
  "Reading",
  "Science",
  "Study Aids",
  "Summaries",
  "Talks",
  "Tech Blog",
  "Tech Guides",
  "Tech News",
  "Video & Channels",
]);

/** @type {Record<string, string[]>} */
const DOMAIN_HINTS = {
  "langchain.com": ["AI", "Learn"],
  "developers.google.com": ["AI", "Learn"],
  "adk.dev": ["AI", "Tools"],
  "huggingface.co": ["AI", "Learn"],
  "kiro.dev": ["AI", "Tools"],
  "tinyfish.ai": ["AI", "Tools"],
  "hfviewer.com": ["AI", "Tools"],
  "motionsites.ai": ["Design"],
  "floci.io": ["Systems"],
  "skillbuilder.aws": ["Learning", "Courses"],
  "nvidia.com": ["AI", "Tools"],
  "bbycroft.net": ["AI", "Learn"],
  "ml-visualized.com": ["Math"],
  "brown.edu": ["Math"],
};

/** @type {Record<string, string[]>} */
const MANUAL_PATHS = {
  "https://www.englisch-hilfen.de/": ["Learning", "Languages"],
  "https://www.englisch-hilfen.de/en": ["Learning", "Languages"],
  "https://github.com/microg/android_packages_apps_UnifiedNlp/releases": ["Systems"],
};

/** @type {Record<string, string>} */
const BRAND_ALIASES = {
  "chatgpt.com": "chatgpt",
  "openai.com": "openai",
  "google.com": "google",
  "gemini.google.com": "gemini",
  "huggingface.co": "huggingface",
  "github.com": "github",
  "youtube.com": "youtube",
  "notion.so": "notion",
  "obsidian.md": "obsidian",
  "raindrop.io": "raindrop",
  "freecodecamp.org": "freecodecamp",
  "coursera.org": "coursera",
  "udemy.com": "udemy",
  "duolingo.com": "duolingo",
  "reddit.com": "reddit",
  "medium.com": "medium",
  "arxiv.org": "arxiv",
  "stackoverflow.com": "stackoverflow",
  "npmjs.com": "npm",
  "docker.com": "docker",
  "anthropic.com": "anthropic",
  "claude.ai": "claude",
  "perplexity.ai": "perplexity",
  "deepseek.com": "deepseek",
  "grok.com": "grok",
  "langchain.com": "langchain",
  "nvidia.com": "nvidia",
  "aws.amazon.com": "aws",
  "skillbuilder.aws": "aws",
};

function decodeHtml(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

function escapeAttr(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeText(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function hostFromUrl(href) {
  try {
    let h = new URL(href).hostname.toLowerCase();
    if (h.startsWith("www.")) h = h.slice(4);
    return h;
  } catch {
    return "";
  }
}

function brandFromUrl(href) {
  const host = hostFromUrl(href);
  if (!host) return "";
  if (BRAND_ALIASES[host]) return BRAND_ALIASES[host];
  for (const [domain, brand] of Object.entries(BRAND_ALIASES)) {
    if (host === domain || host.endsWith("." + domain)) return brand;
  }
  const parts = host.split(".");
  const base = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
  if (base.length < 4 || base.length > 20) return "";
  if (/^(blog|docs|app|mail|cdn)$/.test(base)) return "";
  return base;
}

function normalizeTop(segment) {
  const s = decodeHtml(segment).trim();
  const map = {
    "AI & ML": "AI",
    "Linux & Systems": "Systems",
    "Career & Jobs": "Career",
    Mathematics: "Math",
    "Data Science": "Math",
  };
  return map[s] || s;
}

function mapAiSub(sub) {
  if (!sub) return null;
  const s = sub.toLowerCase();
  if (["chatbots", "prompts"].includes(s)) return "Chat";
  if (["learning", "llms", "benchmarking", "repositories"].includes(s)) return "Learn";
  if (
    [
      "tools",
      "platforms",
      "automation",
      "speech",
      "video",
      "directory",
      "marketing",
      "productivity",
      "research",
    ].includes(s)
  ) {
    return s === "research" ? "Learn" : "Tools";
  }
  return "Tools";
}

function mapLearningSub(sub) {
  if (!sub) return null;
  const courses = new Set([
    "Courses & Platforms",
    "Educational Content",
    "Institutions",
    "Talks",
    "Tech Blog",
    "Tech Guides",
    "Tech News",
    "Video & Channels",
    "Summaries",
  ]);
  const languages = new Set(["Language Docs"]);
  const practice = new Set([
    "Coding Practice",
    "Git",
    "Flashcards",
    "DIY",
    "Projects",
    "Events",
  ]);
  const reference = new Set([
    "Articles & Blogs",
    "Books",
    "Critical Thinking",
    "Q&A",
    "Quotes",
    "Reading",
    "Science",
    "Study Aids",
  ]);
  if (courses.has(sub)) return "Courses";
  if (languages.has(sub)) return "Languages";
  if (practice.has(sub)) return "Practice";
  if (reference.has(sub)) return "Reference";
  return null;
}

const FLAT_TOPS = new Set([
  "Archive",
  "Productivity",
  "Systems",
  "Design",
  "Career",
  "Research",
  "Math",
]);

function suggestPathForUnsorted(href, title) {
  if (MANUAL_PATHS[href]) return [...MANUAL_PATHS[href]];

  const host = hostFromUrl(href);
  for (const [domain, path] of Object.entries(DOMAIN_HINTS)) {
    if (host === domain || host.endsWith("." + domain)) return [...path];
  }

  const hay = `${title} ${href}`.toLowerCase();
  if (/langchain|llm|hugging|gemini|openai|chatgpt|agent|adk|nvidia|\/ai\b/.test(hay)) {
    if (/course|learn|academy|codelab|tutorial/.test(hay)) return ["AI", "Learn"];
    return ["AI", "Tools"];
  }
  if (/course|udemy|coursera|academy|skill/.test(hay)) return ["Learning", "Courses"];
  if (/english|language|duolingo|ielts/.test(hay)) return ["Learning", "Languages"];
  if (/design|figma|ui|ux|motion/.test(hay)) return ["Design"];
  if (/linux|docker|android|driver/.test(hay)) return ["Systems"];
  if (/math|statistic|probability/.test(hay)) return ["Math"];
  return ["Learning"];
}

/** @returns {string[]} 1–2 folder segments */
function simplifyPath(rawPath) {
  if (MANUAL_PATHS[rawPath.join("|")]) return MANUAL_PATHS[rawPath.join("|")];

  let path = rawPath.map(decodeHtml);
  if (path.length === 1 && path[0].toLowerCase() === "unsorted") {
    return ["Learning"];
  }
  if (path.length === 1 && LEARNING_ORPHAN_TOPS.has(path[0])) {
    path = ["Learning", path[0]];
  }

  if (MANUAL_PATHS[path.join("::")]) return MANUAL_PATHS[path.join("::")];

  const top = normalizeTop(path[0]);
  const sub = path[1] ? decodeHtml(path[1]) : "";

  if (FLAT_TOPS.has(top)) return [top];

  if (top === "AI") {
    const aiSub = mapAiSub(sub);
    return aiSub ? ["AI", aiSub] : ["AI"];
  }

  if (top === "Learning") {
    const learnSub = mapLearningSub(sub);
    return learnSub ? ["Learning", learnSub] : ["Learning"];
  }

  if (top === "Unsorted") return suggestPathForUnsorted("", "");

  return [top];
}

function kindTag(path, href, title) {
  const top = path[0];
  const sub = path[1] || "";
  const hay = `${title} ${href}`.toLowerCase();

  if (top === "AI") {
    if (sub === "Chat") return "chat";
    if (sub === "Learn") return "course";
    if (sub === "Tools") return "tool";
    if (/chatgpt|gemini|claude|grok|deepseek|bard|chat\.|bot/.test(hay)) return "chat";
    if (/course|academy|codelab|learn|tutorial/.test(hay)) return "course";
    return "tool";
  }
  if (top === "Learning") {
    if (sub === "Courses") return "course";
    if (sub === "Languages") return "language";
    if (sub === "Practice") return "practice";
    if (sub === "Reference") return "reference";
    if (/duolingo|english|ielts|language/.test(hay)) return "language";
    if (/coursera|udemy|academy|course/.test(hay)) return "course";
    return "reference";
  }
  if (top === "Archive") return "archive";
  if (top === "Career") return "career";
  if (top === "Research") return "paper";
  if (top === "Math") return "math";
  if (top === "Design") return "design";
  if (top === "Systems") return "devops";
  if (top === "Productivity") return "workflow";
  return "";
}

function areaTag(top) {
  const map = {
    AI: "ai",
    Learning: "learn",
    Productivity: "work",
    Archive: "archive",
    Systems: "systems",
    Design: "design",
    Career: "career",
    Research: "research",
    Math: "math",
  };
  return map[top] || "misc";
}

function conciseTags(path, href, title) {
  const top = path[0];
  const tags = [areaTag(top)];
  const kind = kindTag(path, href, title);
  if (kind && kind !== tags[0]) tags.push(kind);
  const brand = brandFromUrl(href);
  if (brand && !tags.includes(brand) && brand !== kind) tags.push(brand);
  return tags.slice(0, MAX_TAGS);
}

function parseAttrs(attrStr) {
  const attrs = {};
  const re = /([A-Z0-9_-]+)="([^"]*)"/gi;
  let m;
  while ((m = re.exec(attrStr))) {
    attrs[m[1].toUpperCase()] = m[2];
  }
  return attrs;
}

function parseExport(html) {
  const lines = html.split(/\r?\n/);
  const stack = [];
  const items = [];

  for (const line of lines) {
    const h3 = line.match(/^(\t*)<DT><H3[^>]*>([^<]*)<\/H3>/i);
    if (h3) {
      const depth = h3[1].length;
      const name = decodeHtml(h3[2].trim());
      stack.length = Math.max(0, depth - 1);
      stack[depth - 1] = name;
      continue;
    }

    const a = line.match(/^(\t*)<DT><A HREF="([^"]*)"([^>]*)>([^<]*)<\/A>/i);
    if (a) {
      const path = stack.filter(Boolean).map((s) => decodeHtml(s));
      const href = decodeHtml(a[2].trim());
      const attrs = parseAttrs(a[3]);
      const title = decodeHtml(a[4].trim());
      if (!href || href.toLowerCase().startsWith("javascript:")) continue;
      items.push({ path, href, title, attrs });
    }
  }
  return items;
}

function reorganize(items) {
  let movedUnsorted = 0;
  for (const item of items) {
    const wasUnsorted =
      item.path.length === 1 && item.path[0].toLowerCase() === "unsorted";

    if (MANUAL_PATHS[item.href]) {
      item.path = [...MANUAL_PATHS[item.href]];
    } else if (wasUnsorted) {
      item.path = suggestPathForUnsorted(item.href, item.title);
      movedUnsorted++;
    } else {
      item.path = simplifyPath(item.path);
    }

    item.attrs.TAGS = conciseTags(item.path, item.href, item.title).join(",");
  }
  return { items, movedUnsorted };
}

function buildTree(items) {
  const root = { name: "", children: new Map(), items: [] };

  for (const item of items) {
    let node = root;
    for (const seg of item.path) {
      if (!node.children.has(seg)) {
        node.children.set(seg, { name: seg, children: new Map(), items: [] });
      }
      node = node.children.get(seg);
    }
    node.items.push(item);
  }
  return root;
}

function renderNode(node, depth) {
  const indent = "\t".repeat(depth);
  let out = "";
  const now = Math.floor(Date.now() / 1000);

  const children = [...node.children.entries()].sort((a, b) =>
    a[0].localeCompare(b[0], undefined, { sensitivity: "base" })
  );

  for (const [, child] of children) {
    if (
      child.name.toLowerCase() === "unsorted" &&
      child.items.length === 0 &&
      child.children.size === 0
    ) {
      continue;
    }
    out += `${indent}<DT><H3 ADD_DATE="${now}" LAST_MODIFIED="${now}">${escapeText(child.name)}</H3>\n`;
    out += `${indent}<DL><p>\n`;
    out += renderNode(child, depth + 1);
    for (const item of child.items.sort((a, b) => a.title.localeCompare(b.title))) {
      const add = item.attrs.ADD_DATE || String(now);
      const mod = item.attrs.LAST_MODIFIED || add;
      const tags = item.attrs.TAGS || "";
      const cover = item.attrs["DATA-COVER"] || "";
      const important = item.attrs["DATA-IMPORTANT"] || "false";
      const ti = depth + 1;
      out +=
        `${"\t".repeat(ti)}<DT><A HREF="${escapeAttr(item.href)}"` +
        ` ADD_DATE="${add}" LAST_MODIFIED="${mod}"` +
        ` TAGS="${escapeAttr(tags)}"` +
        (cover ? ` DATA-COVER="${escapeAttr(cover)}"` : ` DATA-COVER=""`) +
        ` DATA-IMPORTANT="${important}">${escapeText(item.title)}</A>\n`;
    }
    out += `${indent}</DL><p>\n`;
  }
  return out;
}

function countFolders(node) {
  let n = 0;
  for (const child of node.children.values()) {
    n += 1 + countFolders(child);
  }
  return n;
}

const html = readFileSync(inputPath, "utf8");
const headerMatch = html.match(/^[\s\S]*?<DL><p>\s*/i);
const header = headerMatch
  ? headerMatch[0].replace(/<DL><p>\s*$/i, "<DL><p>\n")
  : `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Raindrop.io Bookmarks</TITLE>
<H1>Raindrop.io Bookmarks</H1>
<DL><p>
`;

const parsed = parseExport(html);
const { items, movedUnsorted } = reorganize(parsed);
const tree = buildTree(items);
let body = renderNode(tree, 1);
body = body.replace(/\t<DT><H3[^>]*>Unsorted<\/H3>\s*\t<DL><p>\s*\t<\/DL><p>\s*/gi, "");

writeFileSync(outputPath, header + body + `</DL><p>\n`, "utf8");

const folderCount = countFolders(tree);
let tagCount = 0;
const byTop = new Map();
const byPath = new Map();
for (const it of items) {
  const n = (it.attrs.TAGS || "").split(",").filter(Boolean).length;
  tagCount += n;
  byTop.set(it.path[0], (byTop.get(it.path[0]) || 0) + 1);
  const pk = it.path.join(" > ");
  byPath.set(pk, (byPath.get(pk) || 0) + 1);
}

console.log(`Wrote ${outputPath}`);
console.log(`Bookmarks: ${items.length}`);
console.log(`Folders: ${folderCount} (was ~160)`);
console.log(`Tags: ${tagCount} (max ${MAX_TAGS} each, ~${Math.round(tagCount / items.length * 10) / 10}/bookmark)`);
console.log(`Moved from Unsorted: ${movedUnsorted}`);
console.log("Collections:");
for (const [k, n] of [...byPath.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${n}\t${k}`);
}
