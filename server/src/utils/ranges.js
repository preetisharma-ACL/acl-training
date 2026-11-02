// Watched parts of a video as sorted, non-overlapping [start, end] ranges
// (seconds). Used to credit video progress on the server.

const round = (n) => Math.round(n * 10) / 10;

// Clamps to [0, max], drops empty ranges, sorts and merges touching ones.
export function mergeRanges(ranges, max = Infinity) {
  const list = (ranges ?? [])
    .map(([a, b]) => [Math.max(0, Math.min(a, b)), Math.min(max, Math.max(a, b))])
    .filter(([a, b]) => b - a > 0)
    .sort((x, y) => x[0] - y[0]);
  const out = [];
  for (const [a, b] of list) {
    const last = out[out.length - 1];
    if (last && a <= last[1] + 0.5) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out.map(([a, b]) => [round(a), round(b)]);
}

export const covered = (ranges) => round((ranges ?? []).reduce((t, [a, b]) => t + (b - a), 0));

// Adds `incoming` to `known` (both merged), crediting at most `allowance`
// seconds of NEW coverage, earliest parts first. → merged ranges.
export function addWatched(known, incoming, allowance, max = Infinity) {
  const base = mergeRanges(known, max);
  let budget = Math.max(0, allowance);
  const fresh = [];
  for (const [a, b] of mergeRanges(incoming, max)) {
    // Parts of [a, b] not already in `base`.
    let cur = a;
    for (const [x, y] of base) {
      if (y <= cur || x >= b) continue;
      if (x > cur) fresh.push([cur, x]);
      cur = Math.max(cur, y);
    }
    if (cur < b) fresh.push([cur, b]);
  }
  const taken = [];
  for (const [a, b] of fresh) {
    if (budget <= 0) break;
    const end = Math.min(b, a + budget);
    taken.push([a, end]);
    budget -= end - a;
  }
  return mergeRanges([...base, ...taken], max);
}
