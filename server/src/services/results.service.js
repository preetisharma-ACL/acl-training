// Results (admin): filtered lists, attempt detail with answers, CSV export.
// Every access is written to the audit log.

import { prisma } from "../config/db.js";
import { attemptSummaryOut } from "./serializers.js";
import { getResult } from "./assessment.service.js";
import { audit } from "./audit.service.js";
import { ApiError } from "../utils/ApiError.js";

function whereFrom(f = {}) {
  const where = { status: "SUBMITTED" };
  if (!f.includeVoided) where.voidedAt = null;
  if (f.assessmentId) where.assessmentId = f.assessmentId;
  if (f.userId) where.userId = f.userId;
  if (f.passed !== undefined) where.passed = f.passed;
  if (f.from || f.to) where.submittedAt = { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lte: f.to } : {}) };
  const and = [];
  if (f.departmentId) and.push({ config: { path: ["departmentId"], equals: f.departmentId } });
  if (f.designation) and.push({ config: { path: ["designation"], equals: f.designation } });
  if (f.level) and.push({ config: { path: ["level"], equals: f.level } });
  if (f.q) {
    and.push({
      user: {
        OR: [
          { name: { contains: f.q, mode: "insensitive" } },
          { email: { contains: f.q, mode: "insensitive" } },
          { employeeCode: { contains: f.q, mode: "insensitive" } },
        ],
      },
    });
  }
  if (and.length) where.AND = and;
  return where;
}

const rowOut = (a) => ({ ...attemptSummaryOut(a), userName: a.user.name, userEmail: a.user.email, userCode: a.user.employeeCode });

export async function list(req, filters) {
  const rows = await prisma.attempt.findMany({
    where: whereFrom(filters),
    include: { user: { select: { name: true, email: true, employeeCode: true } } },
    orderBy: { submittedAt: "desc" },
    take: 5000,
  });
  await audit(req, "RESULTS_LISTED", "Attempt", null, { filters, count: rows.length });
  return rows.map(rowOut);
}

export async function get(req, id) {
  const r = await getResult(req.user, id, { admin: true });
  await audit(req, "RESULT_VIEWED", "Attempt", id, { userId: r.userId });
  return r;
}

// Permanently deletes one attempt and its answers. The employee's standing,
// best score and remaining attempts are recalculated from what's left.
export async function remove(req, id) {
  const a = await prisma.attempt.findUnique({ where: { id }, include: { user: { select: { email: true } } } });
  if (!a) throw ApiError.notFound("Result not found.");
  await prisma.attempt.delete({ where: { id } });
  await audit(req, "RESULT_DELETED", "Attempt", id, {
    userId: a.userId,
    email: a.user.email,
    assessmentId: a.assessmentId,
    status: a.status,
    percentage: a.percentage,
    passed: a.passed,
    submittedAt: a.submittedAt,
  });
}

// Cells starting with = + - @ (or tab/CR) are prefixed so spreadsheet apps
// don't execute them as formulas (CSV injection).
export function csvCell(v) {
  if (v == null) return "";
  let s = v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const COLUMNS = [
  ["Employee", (r) => r.userName],
  ["Email", (r) => r.userEmail],
  ["Employee code", (r) => r.userCode],
  ["Department", (r) => r.departmentName],
  ["Designation", (r) => r.designation],
  ["Level", (r) => r.level],
  ["Assessment", (r) => r.assessmentTitle],
  ["Attempt", (r) => r.attemptNumber],
  ["Score %", (r) => r.percentage],
  ["Marks", (r) => `${r.marks}/${r.totalMarks}`],
  ["Correct", (r) => r.correct],
  ["Incorrect", (r) => r.incorrect],
  ["Unanswered", (r) => r.unanswered],
  ["Pass mark %", (r) => r.passPercent],
  ["Result", (r) => (r.passed ? "Pass" : "Fail")],
  ["Time taken (s)", (r) => r.timeTakenSeconds],
  ["Focus warnings", (r) => r.focusViolations],
  ["Auto-submitted", (r) => (r.autoSubmitted ? "Yes" : "No")],
  ["Voided", (r) => (r.voided ? "Yes" : "No")],
  ["Submitted at", (r) => r.submittedAt],
];

export async function exportCsv(req, filters) {
  const rows = (await prisma.attempt.findMany({ where: whereFrom(filters), include: { user: { select: { name: true, email: true, employeeCode: true } } }, orderBy: { submittedAt: "desc" } })).map(rowOut);
  await audit(req, "RESULTS_EXPORTED", "Attempt", null, { filters, count: rows.length });
  const lines = [COLUMNS.map(([h]) => csvCell(h)).join(","), ...rows.map((r) => COLUMNS.map(([, f]) => csvCell(f(r))).join(","))];
  // BOM so Excel opens UTF-8 names correctly.
  return "﻿" + lines.join("\r\n") + "\r\n";
}
