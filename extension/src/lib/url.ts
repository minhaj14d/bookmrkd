const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "gws_rd",
  "ei",
]);

export function normalizeUrl(url: string): string {
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

export function domainFromUrl(url: string): string {
  try {
    let h = (new URL(url).hostname || "").toLowerCase();
    if (h.startsWith("www.")) h = h.slice(4);
    return h;
  } catch {
    return "";
  }
}

export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const t = raw.trim().toLowerCase().replace(/\s+/g, "-");
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}
