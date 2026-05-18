/**
 * Title similarity ratio (0–1), aligned with Python SequenceMatcher-style LCS ratio.
 * @param {string} a
 * @param {string} b
 */
export function titleSimilarity(a, b) {
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

/**
 * @param {string} s1
 * @param {string} s2
 */
function lcsLength(s1, s2) {
  const m = s1.length;
  const n = s2.length;
  if (m === 0 || n === 0) return 0;
  /** @type {number[]} */
  let prev = new Array(n + 1).fill(0);
  /** @type {number[]} */
  let curr = new Array(n + 1).fill(0);
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
