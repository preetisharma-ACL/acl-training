// Who gets what. One place for the rules shared by the employee module, the
// admin tables and the assessment gate:
//
//   • An employee's department and level come from their designation. A
//     designation in an inactive department counts as unassigned.
//   • A material reaches an employee when it is published, belongs to their
//     department or is company-wide, and is assigned to their level.
//   • Unassigned employees only see company-wide material and have no test.
//   • A material is complete only if it was completed at or after the
//     revision the admin last required (re-completion policy).

import { prisma } from "../config/db.js";

// { departmentId, level, department, designation } or null.
export function orgOf(user) {
  const des = user?.designation;
  const dept = des?.department;
  if (user?.role !== "EMPLOYEE" || !des || !dept || !dept.active) return null;
  return { departmentId: dept.id, level: des.level, department: dept, designation: des };
}

// Prisma `where` for the materials an employee may see.
export function materialWhereFor(org) {
  if (!org) return { status: "PUBLISHED", departmentId: null };
  return {
    status: "PUBLISHED",
    OR: [{ departmentId: null }, { departmentId: org.departmentId }],
    levels: { some: { level: org.level } },
  };
}

// Same rule in memory (material must include `levels`).
export function reaches(material, org) {
  if (material.status !== "PUBLISHED") return false;
  if (!org) return material.departmentId === null;
  return (material.departmentId === null || material.departmentId === org.departmentId) && material.levels.some((l) => l.level === org.level);
}

export const isComplete = (progress, material) =>
  !!progress?.completed && (progress.completedRevision ?? 0) >= (material.requiredRevision ?? 1);

// The assessment for an employee's department + level (active or not).
export function assessmentFor(org, db = prisma) {
  if (!org) return null;
  return db.assessment.findUnique({ where: { departmentId_level: { departmentId: org.departmentId, level: org.level } } });
}

// Counts that only include real, counted attempts.
export const COUNTED_ATTEMPT = { voidedAt: null };
export const GRADED_ATTEMPT = { voidedAt: null, status: "SUBMITTED" };
