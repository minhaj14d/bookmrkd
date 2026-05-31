/** Title similarity ratio (0–1), LCS-style. */
export function titleSimilarity(a: string, b: string): number {
  const na = String(a || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  const nb = String(b || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const lcs = lcsLength(na, nb);
  return (2 * lcs) / (na.length + nb.length);
}

function lcsLength(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  if (m === 0 || n === 0) return 0;
  let prev = new Array<number>(n + 1).fill(0);
  let curr = new Array<number>(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) curr[j] = prev[j - 1] + 1;
      else curr[j] = Math.max(prev[j], curr[j - 1]);
    }
    [prev, curr] = [curr, prev];
    curr.fill(0);
  }
  return prev[n];
}
