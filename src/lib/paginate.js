// Client-side pagination. The page is clamped to what exists, so removing
// the last row of the last page (delete, deactivate under a filter) or
// narrowing a filter never leaves an empty page behind.
// → { page, pages, rows, from, to, total } (from/to are 1-based, inclusive)

export function paginate(list, page, size) {
  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const p = Math.min(Math.max(0, page), pages - 1);
  const rows = list.slice(p * size, p * size + size);
  return { page: p, pages, rows, from: total ? p * size + 1 : 0, to: p * size + rows.length, total };
}
