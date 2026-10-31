// Admin audit trail. Never throws: a logging failure must not break the
// action being logged.

import { prisma } from "../config/db.js";

export async function audit(req, action, entityType, entityId = null, meta = {}, db = prisma) {
  try {
    await db.auditLog.create({
      data: {
        actorId: req?.user?.id ?? null,
        action,
        entityType,
        entityId,
        meta,
        ip: req?.ip ?? null,
        userAgent: req?.get?.("user-agent")?.slice(0, 300) ?? null,
      },
    });
  } catch (e) {
    console.error("audit log failed", action, e);
  }
}
