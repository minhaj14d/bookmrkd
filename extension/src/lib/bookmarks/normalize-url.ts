const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "gws_rd",
  "ei",
]);

export function normalizeBookmarkUrl(url: string): string {
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
