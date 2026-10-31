// DB rows → the exact JSON shapes the frontend services already return.
// Nothing here ever includes password hashes or answer keys.

import { levelKey, levelLabel } from "../utils/levels.js";

// Prisma include that resolves a user's designation → department.
export const USER_ORG_INCLUDE = { designation: { include: { department: true } } };

export const apiRole = (role) => (role === "EMPLOYEE" ? "employee" : "admin");
export const apiStatus = (s) => String(s).toLowerCase();

export const departmentOut = (d) =>
  d ? { id: d.id, name: d.name, description: d.description, head: d.head, location: d.location, active: d.active } : null;

// ── Materials ───────────────────────────────────────────────────────────────

const TYPE_TO_API = { PDF: "pdf", MANUAL: "manual", STRUCTURED_GUIDE: "structured", MEDIA: "media" };
const TYPE_FROM_API = Object.fromEntries(Object.entries(TYPE_TO_API).map(([k, v]) => [v, k]));
export const materialTypeApi = (t) => TYPE_TO_API[t];
export const materialTypeEnum = (t) => TYPE_FROM_API[t] ?? (TYPE_TO_API[t] ? t : null);

// Authorised download route — never a storage path.
export const materialFileUrl = (m) => (m.fileKey ? `/api/v1/training/materials/${m.id}/file` : null);

// Fields both the admin list and the employee module show.
export function materialBaseOut(m) {
  return {
    id: m.id,
    title: m.title,
    type: materialTypeApi(m.type),
    departmentId: m.departmentId,
    scope: m.departmentId ? "department" : "company",
    required: m.required,
    description: m.description,
    estMinutes: m.estMinutes,
    version: m.version,
    author: m.author,
    updatedAt: m.updatedAt,
    status: apiStatus(m.status),
    fileName: m.fileName ?? null,
    sizeBytes: m.fileSize ?? null,
    pages: m.filePages ?? null,
    mediaKind: m.type === "MEDIA" ? m.content?.kind ?? "video" : null,
    mediaUrl: m.type === "MEDIA" ? m.content?.url ?? null : null,
  };
}

// ── Attempts / results ──────────────────────────────────────────────────────

// Result summary, read from the attempt's own snapshot (config), so it stays
// correct after departments, designations or settings change.
export function attemptSummaryOut(a) {
  const c = a.config ?? {};
  return {
    id: a.id,
    userId: a.userId,
    status: a.status === "SUBMITTED" ? "submitted" : "in_progress",
    departmentId: c.departmentId ?? null,
    departmentName: c.departmentName ?? null,
    assessmentId: a.assessmentId,
    assessmentTitle: c.title ?? null,
    level: c.level ?? null,
    designation: c.designation ?? null,
    attemptNumber: a.attemptNumber,
    totalQuestions: a.totalQuestions,
    correct: a.correctCount,
    incorrect: a.incorrectCount,
    unanswered: a.unansweredCount,
    marks: a.marks,
    totalMarks: a.totalMarks,
    percentage: a.percentage,
    passPercent: c.passPercent ?? null,
    passed: a.passed,
    timeTakenSeconds: a.timeTakenSeconds,
    durationSeconds: c.durationSeconds ?? null,
    focusViolations: a.focusViolations,
    autoSubmitted: a.autoSubmitted,
    startedAt: a.startedAt,
    submittedAt: a.submittedAt,
    voided: !!a.voidedAt,
    hasReview: a.status === "SUBMITTED",
  };
}

// The signed-in user ("Me").
export function meOut(u) {
  const des = u.designation ?? null;
  const dept = des?.department ?? null;
  return {
    id: u.id,
    role: apiRole(u.role),
    isSuperAdmin: u.role === "SUPER_ADMIN",
    name: u.name,
    email: u.email,
    phone: u.phone,
    code: u.employeeCode,
    location: u.location,
    joinedAt: u.joinedAt,
    bio: u.bio,
    adminTitle: u.role === "EMPLOYEE" ? null : u.adminTitle,
    preferences: { ...(u.preferences ?? {}) },
    mustChangePassword: u.mustChangePassword,
    // `level` is the label ("Team head") — what the UI already reads.
    designation: des ? { id: des.id, title: des.title, level: levelLabel(des.level), levelKey: levelKey(des.level) } : null,
    department: departmentOut(dept),
    level: des ? levelKey(des.level) : null,
  };
}
