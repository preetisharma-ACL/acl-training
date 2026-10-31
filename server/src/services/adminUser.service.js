// Users (admin). Admins set the initial password, reset it to a temporary
// one (forcing a change at next sign-in), activate/deactivate accounts and
// void attempts. Only a super admin may create or modify admin accounts.

import { prisma } from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";
import { hashPassword, temporaryPassword } from "../utils/password.js";
import { levelKey } from "../utils/levels.js";
import { USER_ORG_INCLUDE, apiRole, apiStatus, attemptSummaryOut } from "./serializers.js";
import { orgOf, reaches, isComplete, GRADED_ATTEMPT } from "./assignment.service.js";
import { revokeSessions } from "./auth.service.js";
import { audit } from "./audit.service.js";
import { resolve as resolveLocation } from "./location.service.js";

const isAdminRole = (r) => r === "ADMIN" || r === "SUPER_ADMIN";
const ROLE_FROM_API = { employee: "EMPLOYEE", admin: "ADMIN", super_admin: "SUPER_ADMIN" };

// Training state for many users at once (few queries, computed in memory).
export async function trainingSnapshot(users) {
  const ids = users.map((u) => u.id);
  const [materials, progress, attempts, resetRequests] = await Promise.all([
    prisma.material.findMany({ where: { status: "PUBLISHED", required: true }, include: { levels: true } }),
    prisma.materialProgress.findMany({ where: { userId: { in: ids }, completed: true } }),
    prisma.attempt.findMany({ where: { userId: { in: ids }, ...GRADED_ATTEMPT }, orderBy: { submittedAt: "desc" } }),
    prisma.passwordResetRequest.findMany({ where: { userId: { in: ids }, resolvedAt: null }, select: { userId: true, createdAt: true } }),
  ]);
  const progressBy = new Map();
  for (const p of progress) progressBy.set(`${p.userId}:${p.materialId}`, p);
  const attemptsBy = new Map();
  for (const a of attempts) attemptsBy.set(a.userId, [...(attemptsBy.get(a.userId) ?? []), a]);
  const resetBy = new Map(resetRequests.map((r) => [r.userId, r.createdAt]));

  return (u) => {
    const org = orgOf(u);
    const mine = attemptsBy.get(u.id) ?? [];
    // Training only counts for the employee's current assessment.
    const required = u.role === "EMPLOYEE" ? materials.filter((m) => reaches(m, org)) : [];
    const done = required.filter((m) => isComplete(progressBy.get(`${u.id}:${m.id}`), m)).length;
    const passed = mine.some((a) => a.passed);
    return {
      org,
      attempts: mine,
      materialsDone: done,
      materialsRequired: required.length,
      passed,
      resetRequestedAt: resetBy.get(u.id) ?? null,
      trainingStatus: !org ? "unassigned" : passed ? "certified" : mine.length ? "retake" : done === required.length ? "ready" : done ? "in-progress" : "not-started",
    };
  };
}

export function userRowOut(u, t) {
  const org = t.org;
  return {
    id: u.id,
    role: apiRole(u.role),
    isSuperAdmin: u.role === "SUPER_ADMIN",
    adminTitle: isAdminRole(u.role) ? u.adminTitle : null,
    name: u.name,
    email: u.email,
    phone: u.phone,
    code: u.employeeCode,
    location: u.location,
    bio: u.bio,
    joinedAt: u.joinedAt,
    status: apiStatus(u.status),
    lastActiveAt: u.lastActiveAt,
    lastLoginAt: u.lastLoginAt,
    mustChangePassword: u.mustChangePassword,
    resetRequestedAt: t.resetRequestedAt,
    designationId: u.designationId,
    designation: u.designation?.title ?? null,
    // Even when the department is inactive, show where the designation maps.
    departmentId: u.designation?.departmentId ?? null,
    departmentName: u.designation?.department?.name ?? null,
    level: u.designation ? levelKey(u.designation.level) : null,
    attempts: t.attempts.length,
    bestScore: t.attempts.length ? Math.max(...t.attempts.map((a) => a.percentage ?? 0)) : null,
    passed: t.passed,
    lastAttemptAt: t.attempts[0]?.submittedAt ?? null,
    materialsDone: t.materialsDone,
    materialsRequired: t.materialsRequired,
    trainingStatus: u.role === "EMPLOYEE" ? t.trainingStatus : null,
  };
}

export async function list(filters = {}) {
  const where = {};
  if (filters.q) {
    where.OR = [
      { name: { contains: filters.q, mode: "insensitive" } },
      { email: { contains: filters.q, mode: "insensitive" } },
      { employeeCode: { contains: filters.q, mode: "insensitive" } },
    ];
  }
  if (filters.role) where.role = filters.role === "admin" ? { in: ["ADMIN", "SUPER_ADMIN"] } : "EMPLOYEE";
  if (filters.status) where.status = filters.status.toUpperCase();
  if (filters.designationId) where.designationId = filters.designationId;
  const des = {};
  if (filters.departmentId) des.departmentId = filters.departmentId;
  if (filters.level) des.level = filters.level;
  if (Object.keys(des).length) where.designation = des;

  const users = await prisma.user.findMany({ where, include: USER_ORG_INCLUDE, orderBy: [{ role: "desc" }, { name: "asc" }] });
  const snap = await trainingSnapshot(users);
  return users.map((u) => userRowOut(u, snap(u)));
}

async function getUserOr404(id) {
  const u = await prisma.user.findUnique({ where: { id }, include: USER_ORG_INCLUDE });
  if (!u) throw ApiError.notFound("User not found.");
  return u;
}

export async function get(req, id) {
  const u = await getUserOr404(id);
  const t = (await trainingSnapshot([u]))(u);
  const history = await prisma.attempt.findMany({ where: { userId: id, status: "SUBMITTED" }, orderBy: { submittedAt: "desc" } });
  await audit(req, "USER_VIEWED", "User", id);
  return { ...userRowOut(u, t), history: history.map(attemptSummaryOut) };
}

// Admin accounts may only be created or edited by a super admin.
function guardAdminChange(req, target, nextRole) {
  const touchesAdmin = isAdminRole(nextRole) || (target && isAdminRole(target.role));
  if (touchesAdmin && req.user.role !== "SUPER_ADMIN") throw ApiError.forbidden("Only a super admin can create or change admin accounts.");
}

async function checkEmailFree(email, exceptId) {
  const clash = await prisma.user.findFirst({ where: { email, ...(exceptId ? { id: { not: exceptId } } : {}) } });
  if (clash) throw ApiError.conflict("Another user already has this email address.");
}

async function checkDesignation(designationId) {
  if (designationId && !(await prisma.designation.findUnique({ where: { id: designationId } }))) throw ApiError.badRequest("Choose a valid designation.");
}

async function nextEmployeeCode() {
  const n = await prisma.user.count();
  for (let i = 0; ; i++) {
    const code = `AJN-${String(1100 + n + i).padStart(4, "0")}`;
    if (!(await prisma.user.findUnique({ where: { employeeCode: code } }))) return code;
  }
}

export async function create(req, input) {
  const role = ROLE_FROM_API[input.role ?? "employee"];
  guardAdminChange(req, null, role);
  await checkEmailFree(input.email);
  if (role === "EMPLOYEE" && !input.designationId) throw ApiError.badRequest("Choose a designation for this employee.", { code: "DESIGNATION_REQUIRED" });
  await checkDesignation(input.designationId);
  if (input.code && (await prisma.user.findUnique({ where: { employeeCode: input.code } }))) throw ApiError.conflict("This employee code is already in use.");

  const generated = !input.password;
  const password = input.password || temporaryPassword();
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone ?? "",
      location: (await resolveLocation(input.location)) ?? "",
      employeeCode: input.code || (await nextEmployeeCode()),
      joinedAt: input.joinedAt ?? new Date(),
      role,
      adminTitle: isAdminRole(role) ? input.adminTitle || "Admin" : null,
      designationId: isAdminRole(role) ? null : input.designationId ?? null,
      status: (input.status ?? "active").toUpperCase(),
      passwordHash: await hashPassword(password),
      // The admin shares this password and the employee can keep using it
      // (they can change it any time under Profile settings).
      mustChangePassword: input.mustChangePassword ?? false,
      preferences: { emailReminders: true, resultEmails: true, weeklyDigest: false },
    },
    include: USER_ORG_INCLUDE,
  });
  await audit(req, "USER_CREATED", "User", user.id, { email: user.email, role, designationId: user.designationId });
  const row = userRowOut(user, (await trainingSnapshot([user]))(user));
  return { user: row, ...(generated ? { temporaryPassword: password } : {}) };
}

export async function update(req, id, patch) {
  const target = await getUserOr404(id);
  const role = patch.role ? ROLE_FROM_API[patch.role] : target.role;
  guardAdminChange(req, target, role);
  if (id === req.user.id && (role !== target.role || (patch.status && patch.status !== "active"))) {
    throw ApiError.forbidden("You can't change your own role or deactivate your own account.");
  }
  if (target.role === "SUPER_ADMIN" && role !== "SUPER_ADMIN") await ensureAnotherSuperAdmin(id);
  if (patch.email) await checkEmailFree(patch.email, id);
  if (patch.designationId) await checkDesignation(patch.designationId);
  // An employee can't be left (or made) without a designation.
  if (!isAdminRole(role) && !("designationId" in patch ? patch.designationId : target.designationId) && ("designationId" in patch || isAdminRole(target.role))) {
    throw ApiError.badRequest("Choose a designation for this employee.", { code: "DESIGNATION_REQUIRED" });
  }
  if (patch.code && patch.code !== target.employeeCode && (await prisma.user.findUnique({ where: { employeeCode: patch.code } }))) {
    throw ApiError.conflict("This employee code is already in use.");
  }

  const data = {};
  for (const k of ["name", "email", "phone", "location", "joinedAt", "bio"]) if (k in patch) data[k] = patch[k];
  if ("location" in patch) data.location = await resolveLocation(patch.location);
  if ("code" in patch) data.employeeCode = patch.code || null;
  data.role = role;
  if (isAdminRole(role)) {
    data.designationId = null;
    if ("adminTitle" in patch || !isAdminRole(target.role)) data.adminTitle = patch.adminTitle || target.adminTitle || "Admin";
  } else {
    data.adminTitle = null;
    if ("designationId" in patch) data.designationId = patch.designationId ?? null;
  }
  const deactivating = patch.status && patch.status !== "active" && target.status === "ACTIVE";
  if (patch.status) data.status = patch.status.toUpperCase();
  if (patch.password) {
    data.passwordHash = await hashPassword(patch.password);
    data.mustChangePassword = false;
  }
  if (patch.password || deactivating || role !== target.role) data.authVersion = { increment: 1 };

  const user = await prisma.user.update({ where: { id }, data, include: USER_ORG_INCLUDE });
  if (data.authVersion) await revokeSessions(id);
  const changed = Object.keys(data).filter((k) => k !== "passwordHash" && k !== "authVersion");
  await audit(req, "USER_UPDATED", "User", id, { fields: changed, passwordSet: !!patch.password });
  return { user: userRowOut(user, (await trainingSnapshot([user]))(user)) };
}

async function ensureAnotherSuperAdmin(id) {
  const others = await prisma.user.count({ where: { role: "SUPER_ADMIN", status: "ACTIVE", id: { not: id } } });
  if (!others) throw ApiError.conflict("There must always be at least one active super admin.");
}

export async function setStatus(req, id, status) {
  const target = await getUserOr404(id);
  guardAdminChange(req, target, target.role);
  if (id === req.user.id) throw ApiError.forbidden("You can't change the status of your own account.");
  if (target.role === "SUPER_ADMIN" && status !== "active") await ensureAnotherSuperAdmin(id);
  const s = status.toUpperCase();
  await prisma.user.update({ where: { id }, data: { status: s, ...(s !== "ACTIVE" ? { authVersion: { increment: 1 } } : {}) } });
  if (s !== "ACTIVE") await revokeSessions(id);
  await audit(req, "USER_STATUS_CHANGED", "User", id, { from: target.status, to: s });
  return { id, status };
}

// New temporary password, shown once to the admin. All sessions end and the
// user must choose a new password at next sign-in.
export async function resetPassword(req, id) {
  const target = await getUserOr404(id);
  guardAdminChange(req, target, target.role);
  if (id === req.user.id) throw ApiError.forbidden("Use Change password to update your own password.");
  const password = temporaryPassword();
  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(password), mustChangePassword: true, authVersion: { increment: 1 } } }),
    prisma.passwordResetRequest.updateMany({ where: { userId: id, resolvedAt: null }, data: { resolvedAt: new Date() } }),
  ]);
  await revokeSessions(id);
  await audit(req, "USER_PASSWORD_RESET", "User", id, { email: target.email });
  return { email: target.email, temporaryPassword: password };
}

// Voids (keeps, but stops counting) the user's attempts — all, or one assessment's.
export async function resetAttempts(req, id, { assessmentId } = {}) {
  const target = await getUserOr404(id);
  if (target.role !== "EMPLOYEE") throw ApiError.badRequest("Only employees have assessment attempts.");
  const r = await prisma.attempt.updateMany({
    where: { userId: id, voidedAt: null, ...(assessmentId ? { assessmentId } : {}) },
    data: { voidedAt: new Date(), voidedById: req.user.id },
  });
  await audit(req, "USER_ATTEMPTS_RESET", "User", id, { voided: r.count, assessmentId: assessmentId ?? null });
  return { voided: r.count };
}

// Permanent: removes the account together with its assessment attempts
// (answers included), material progress and reset requests. Deactivate
// instead to keep the history. The audit log keeps a record of the delete.
export async function remove(req, id) {
  const target = await getUserOr404(id);
  guardAdminChange(req, target, target.role);
  if (id === req.user.id) throw ApiError.forbidden("You can't delete your own account.");
  if (target.role === "SUPER_ADMIN") await ensureAnotherSuperAdmin(id);
  await revokeSessions(id);
  const [attempts] = await prisma.$transaction([prisma.attempt.deleteMany({ where: { userId: id } }), prisma.user.delete({ where: { id } })]);
  await audit(req, "USER_DELETED", "User", id, { email: target.email, name: target.name, attemptsDeleted: attempts.count });
  return { attemptsDeleted: attempts.count };
}
