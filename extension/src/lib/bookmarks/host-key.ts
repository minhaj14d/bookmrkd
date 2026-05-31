export function hostKey(href: string): string {
  try {
    let h = (new URL(href).hostname || "").toLowerCase();
    if (h.startsWith("www.")) h = h.slice(4);
    return h;
  } catch {
    return "";
  }
}
