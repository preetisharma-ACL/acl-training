// Loads the signed-in user from the session on every request. A session is
// only honoured while the account is ACTIVE and its authVersion still
// matches (password change / admin reset / deactivation bump it).

import { prisma } from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";
import { USER_ORG_INCLUDE } from "../services/serializers.js";

const ACTIVE_TOUCH_MS = 5 * 60 * 1000;

// Routes a user with a temporary password may still reach.
const PASSWORD_CHANGE_ALLOWED = new Set(["GET /api/v1/me", "POST /api/v1/me/password", "POST /api/v1/auth/logout"]);

export async function requireAuth(req, res, next) {
  const { userId, authVersion } = req.session ?? {};
  if (!userId) return next(ApiError.unauthorized());

  const user = await prisma.user.findUnique({ where: { id: userId }, include: USER_ORG_INCLUDE });
  if (!user || user.status !== "ACTIVE" || user.authVersion !== authVersion) {
    await new Promise((r) => req.session.destroy(() => r()));
    return next(ApiError.unauthorized("Your session has expired. Please sign in again.", { code: "SESSION_EXPIRED" }));
  }

  if (user.mustChangePassword && !PASSWORD_CHANGE_ALLOWED.has(`${req.method} ${req.baseUrl}${req.path}`.replace(/\/$/, ""))) {
    return next(ApiError.forbidden("Please set a new password to continue.", { code: "PASSWORD_CHANGE_REQUIRED" }));
  }

  req.user = user;

  if (!user.lastActiveAt || Date.now() - user.lastActiveAt.getTime() > ACTIVE_TOUCH_MS) {
    prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } }).catch(() => {});
  }
  next();
}
