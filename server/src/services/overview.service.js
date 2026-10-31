// Admin overview dashboard — every number comes from database records.

import { prisma } from "../config/db.js";
import { USER_ORG_INCLUDE, attemptSummaryOut } from "./serializers.js";
import { GRADED_ATTEMPT } from "./assignment.service.js";
import { trainingSnapshot, userRowOut } from "./adminUser.service.js";

// An attempt is "focus flagged" at this many warnings (leaving the test
// page). Same threshold as the admin Results page.
export const FOCUS_FLAG_AT = 2;

const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
const avg = (xs) => (xs.length ? xs.reduce((t, x) => t + x, 0) / xs.length : 0);

export async function overview() {
  const [users, departments, designationCount, materialCount, assessmentCount, attempts, resetRequests] = await Promise.all([
    prisma.user.findMany({ where: { role: "EMPLOYEE" }, include: USER_ORG_INCLUDE }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.designation.count(),
    prisma.material.count({ where: { status: { not: "ARCHIVED" } } }),
    prisma.assessment.count(),
    prisma.attempt.findMany({ where: GRADED_ATTEMPT, orderBy: { submittedAt: "desc" }, include: { user: { select: { name: true } } } }),
    // "Forgot password" requests waiting for an admin (active accounts only).
    prisma.passwordResetRequest.findMany({
      where: { resolvedAt: null, user: { status: "ACTIVE" } },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { id: true, name: true, email: true, employeeCode: true, role: true, designation: { select: { title: true } } } } },
    }),
  ]);

  const snap = await trainingSnapshot(users);
  const rows = users.map((u) => userRowOut(u, snap(u)));
  const active = rows.filter((r) => r.status === "active");
  const assigned = active.filter((r) => r.trainingStatus !== "unassigned");
  const certified = assigned.filter((r) => r.passed);
  const scores = attempts.map((a) => a.percentage ?? 0);
  const deptOf = (a) => a.config?.departmentId;

  const perDept = departments.map((d) => {
    const people = assigned.filter((e) => e.departmentId === d.id);
    const da = attempts.filter((a) => deptOf(a) === d.id);
    return {
      id: d.id,
      name: d.name,
      active: d.active,
      employees: people.length,
      certified: people.filter((p) => p.passed).length,
      completion: pct(people.filter((p) => p.passed).length, people.length),
      avgScore: Math.round(avg(da.map((a) => a.percentage ?? 0))),
      passRate: pct(da.filter((a) => a.passed).length, da.length),
      attempts: da.length,
    };
  });

  // Last 8 weeks.
  const now = Date.now();
  const weeks = [];
  for (let w = 7; w >= 0; w--) {
    const end = now - w * 7 * 86400000;
    const start = end - 7 * 86400000;
    const inWeek = attempts.filter((a) => {
      const t = a.submittedAt.getTime();
      return t > start && t <= end;
    });
    weeks.push({
      label: new Date(end).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
      attempts: inWeek.length,
      avgScore: inWeek.length ? Math.round(avg(inWeek.map((a) => a.percentage ?? 0))) : null,
      passed: inWeek.filter((a) => a.passed).length,
    });
  }

  return {
    kpis: {
      totalEmployees: rows.length,
      employees: active.length,
      activeEmployees: active.length,
      inactiveEmployees: rows.length - active.length,
      assigned: assigned.length,
      certified: certified.length,
      completionRate: pct(certified.length, assigned.length),
      departments: departments.length,
      designations: designationCount,
      materials: materialCount,
      assessments: assessmentCount,
      attempts: attempts.length,
      attemptsThisWeek: weeks[7].attempts,
      avgScore: Math.round(avg(scores)),
      passRate: pct(attempts.filter((a) => a.passed).length, attempts.length),
      focusFlags: attempts.filter((a) => a.focusViolations >= FOCUS_FLAG_AT).length,
      focusFlagAt: FOCUS_FLAG_AT,
      pendingResetRequests: resetRequests.length,
    },
    resetRequests: resetRequests.map((r) => ({
      id: r.id,
      requestedAt: r.createdAt,
      userId: r.user.id,
      name: r.user.name,
      email: r.user.email,
      code: r.user.employeeCode,
      role: r.user.role === "EMPLOYEE" ? "employee" : "admin",
      designation: r.user.designation?.title ?? null,
    })),
    departments: perDept,
    weeks,
    statusBreakdown: ["certified", "retake", "ready", "in-progress", "not-started"].map((key) => ({ key, count: assigned.filter((e) => e.trainingStatus === key).length })),
    recent: attempts.slice(0, 7).map((a) => ({ ...attemptSummaryOut(a), userName: a.user.name })),
    topPerformers: assigned.filter((e) => e.bestScore != null).sort((a, b) => b.bestScore - a.bestScore).slice(0, 5),
    attention: assigned.filter((e) => e.trainingStatus === "not-started" || e.trainingStatus === "retake").slice(0, 5),
  };
}
