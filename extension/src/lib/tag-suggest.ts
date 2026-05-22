import { domainFromUrl } from "./url";

const STOP = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "for",
  "to",
  "of",
  "in",
  "on",
  "with",
  "is",
  "are",
  "was",
  "www",
  "com",
  "org",
  "net",
  "io",
  "dev",
]);

export function suggestTags(url: string, title: string, max = 5): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const add = (t: string) => {
    const tag = t.trim().toLowerCase().replace(/\s+/g, "-");
    if (!tag || tag.length < 2 || STOP.has(tag) || seen.has(tag)) return;
    seen.add(tag);
    out.push(tag);
  };

  const domain = domainFromUrl(url);
  if (domain) {
    const parts = domain.split(".").filter((p) => p.length > 2 && !STOP.has(p));
    for (const p of parts.slice(0, 2)) add(p);
    if (domain.includes("github")) add("github");
    if (domain.includes("stackoverflow")) add("stackoverflow");
    if (domain.endsWith(".dev")) add("docs");
  }

  for (const word of (title || "").split(/[\s|–—\-:,\/]+/)) {
    if (out.length >= max) break;
    const w = word.replace(/[^\w+#]/g, "");
    if (w.length >= 3) add(w);
  }

  return out.slice(0, max);
}
