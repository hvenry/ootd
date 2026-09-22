/**
 * Subsequence fuzzy match. "lvs" finds "Levis", "crgo sh" finds "Cargo
 * Shorts". Returns a score (higher is better) or null for no match. Kept
 * dependency-free: the closet is a few hundred rows, not a search index.
 */
export function fuzzyScore(query: string, text: string): number | null {
  const q = query.toLowerCase().replace(/\s+/g, "");
  const t = text.toLowerCase();
  if (q.length === 0) return 0;

  // A plain substring is the strongest kind of match.
  const direct = t.indexOf(q);
  if (direct !== -1) return 1000 - direct;

  let score = 0;
  let ti = 0;
  let lastHit = -1;
  for (const ch of q) {
    const hit = t.indexOf(ch, ti);
    if (hit === -1) return null;
    // Consecutive hits and hits at word starts count for more.
    if (hit === lastHit + 1) score += 3;
    if (hit === 0 || /\s/.test(t[hit - 1] ?? "")) score += 2;
    score += 1;
    lastHit = hit;
    ti = hit + 1;
  }
  return score;
}
