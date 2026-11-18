// Admin audit trail. Never throws: a logging failure must not break the
// action being logged.
//
// meta conventions (read by the Activity log page):
//   label    the record's name at the time (so deletes still read well)
//   changes  { field: { from, to } } for edits, display values only
//   actor    { name, email } of who did it, kept if that account is deleted

import { prisma } from "../config/db.js";

export async function audit(req, action, entityType, entityId = null, meta = {}, db = prisma) {
  try {
    const u = req?.user;
    await db.auditLog.create({
      data: {
        actorId: u?.id ?? null,
        action,
        entityType,
        entityId,
        meta: { ...meta, ...(u ? { actor: { name: u.name, email: u.email } } : {}) },
        ip: req?.ip ?? null,
        userAgent: req?.get?.("user-agent")?.slice(0, 300) ?? null,
      },
    });
  } catch (e) {
    console.error("audit log failed", action, e);
  }
}

const MAX_TEXT = 300;
const shown = (v) => {
  if (v === undefined || v === "") return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string" && v.length > MAX_TEXT) return `${v.slice(0, MAX_TEXT)}…`;
  return v;
};

// Field-by-field differences between two snapshots of display values
// (names, not ids) → { field: { from, to } }, only the fields that changed.
export function changes(before, after) {
  const out = {};
  for (const k of new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])) {
    const [a, b] = [shown(before?.[k]), shown(after?.[k])];
    if (JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)) out[k] = { from: a ?? null, to: b ?? null };
  }
  return out;
}
