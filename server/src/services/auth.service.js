// Authentication, sessions, passwords and the employee's own profile.

import crypto from "node:crypto";
import { prisma } from "../config/db.js";
import { env } from "../config/env.js";
import { pgPool } from "../config/session.js";
import { ApiError } from "../utils/ApiError.js";
import { hashPassword, verifyPassword, burnPasswordCheck } from "../utils/password.js";
import { USER_ORG_INCLUDE, meOut } from "./serializers.js";
import { audit } from "./audit.service.js";
import { resolve as resolveLocation } from "./location.service.js";

const BAD_CREDENTIALS = "That email and password don't match our records.";
const RESET_TOKEN_MINUTES = 30;

// ── Session helpers ─────────────────────────────────────────────────────────

const regenerate = (req) => new Promise((res, rej) => req.session.regenerate((e) => (e ? rej(e) : res())));
const saveSession = (req) => new Promise((res, rej) => req.session.save((e) => (e ? rej(e) : res())));
const destroySession = (req) => new Promise((res) => (req.session ? req.session.destroy(() => res()) : res()));

// Remove every stored session of a user, optionally keeping one.
export async function revokeSessions(userId, exceptSid = null) {
  await pgPool.query(`DELETE FROM "session" WHERE sess->>'userId' = $1 AND ($2::text IS NULL OR sid <> $2)`, [userId, exceptSid]);
}

// ── Login / logout ──────────────────────────────────────────────────────────

export async function login(req, { email, password, remember }) {
  const user = await prisma.user.findUnique({ where: { email }, include: USER_ORG_INCLUDE });

  if (!user) {
    await burnPasswordCheck(password); // same timing as a wrong password
    throw ApiError.unauthorized(BAD_CREDENTIALS, { code: "INVALID_CREDENTIALS" });
  }
  // Verify the password before revealing anything about the account state.
  if (!(await verifyPassword(user.passwordHash, password))) {
    await audit(req, "LOGIN_FAILED", "User", user.id);
    throw ApiError.unauthorized(BAD_CREDENTIALS, { code: "INVALID_CREDENTIALS" });
  }
  if (user.status !== "ACTIVE") {
    throw ApiError.forbidden("Your account is inactive. Please contact an administrator.", { code: "ACCOUNT_INACTIVE" });
  }

  // New session id on every login (prevents session fixation).
  await regenerate(req);
  req.session.userId = user.id;
  req.session.authVersion = user.authVersion;
  req.session.cookie.maxAge = remember ? env.REMEMBER_ME_DAYS * 86400000 : null;
  await saveSession(req);

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), lastActiveAt: new Date() },
    include: USER_ORG_INCLUDE,
  });
  return meOut(updated);
}

export async function logout(req) {
  await destroySession(req);
}

// ── Profile ─────────────────────────────────────────────────────────────────

export async function updateProfile(user, patch) {
  const data = {};
  for (const k of ["phone", "location", "bio"]) if (k in patch) data[k] = patch[k];
  if ("location" in patch) data.location = await resolveLocation(patch.location);
  if (patch.preferences) data.preferences = { ...(user.preferences ?? {}), ...patch.preferences };
  const updated = await prisma.user.update({ where: { id: user.id }, data, include: USER_ORG_INCLUDE });
  return meOut(updated);
}

// ── Passwords ───────────────────────────────────────────────────────────────

// Verifies the current password, stores the new hash, signs out every other
// session and keeps this one alive.
export async function changePassword(req, { current_password, new_password }) {
  const user = req.user;
  if (!(await verifyPassword(user.passwordHash, current_password))) {
    throw ApiError.badRequest("Your current password is incorrect.", { code: "WRONG_PASSWORD" });
  }
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(new_password), mustChangePassword: false, authVersion: { increment: 1 } },
    include: USER_ORG_INCLUDE,
  });
  req.session.authVersion = updated.authVersion;
  await saveSession(req);
  await revokeSessions(user.id, req.sessionID);
  await audit(req, "PASSWORD_CHANGED", "User", user.id);
  return meOut(updated);
}

// "Forgot password". No email transport yet, so the request is queued for
// the admins (who reset the password and share it directly). Always the
// same answer, whether or not the account exists.
export async function requestPasswordReset(req, { email }) {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, status: true } });
  if (user && user.status === "ACTIVE") {
    const recent = await prisma.passwordResetRequest.findFirst({
      where: { userId: user.id, resolvedAt: null, createdAt: { gt: new Date(Date.now() - 86400000) } },
    });
    if (!recent) {
      await prisma.passwordResetRequest.create({ data: { userId: user.id } });
      await audit(req, "PASSWORD_RESET_REQUESTED", "User", user.id);
    }
  }
  return { ok: true };
}

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

// Single-use reset token (for when an email transport is added). Returns the
// raw token once; only its hash is stored.
export async function issueResetToken(userId) {
  const token = crypto.randomBytes(32).toString("base64url");
  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } }),
    prisma.passwordResetToken.create({
      data: { userId, tokenHash: sha256(token), expiresAt: new Date(Date.now() + RESET_TOKEN_MINUTES * 60000) },
    }),
  ]);
  return token;
}

export async function confirmPasswordReset(req, { token, new_password }) {
  const invalid = ApiError.badRequest("This reset link is invalid or has expired.", { code: "INVALID_TOKEN" });
  const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row || row.usedAt || row.expiresAt < new Date()) throw invalid;

  const passwordHash = await hashPassword(new_password);
  await prisma.$transaction(async (tx) => {
    // Claim the token atomically: a concurrent second use updates 0 rows.
    const claimed = await tx.passwordResetToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
    if (claimed.count !== 1) throw invalid;
    await tx.user.update({ where: { id: row.userId }, data: { passwordHash, mustChangePassword: false, authVersion: { increment: 1 } } });
    await tx.passwordResetRequest.updateMany({ where: { userId: row.userId, resolvedAt: null }, data: { resolvedAt: new Date() } });
  });
  await revokeSessions(row.userId);
  await audit(req, "PASSWORD_RESET_COMPLETED", "User", row.userId);
  return { ok: true };
}
