// Department standing.
//
// Rules
//   • Scope: everyone whose graded attempt belongs to the same department
//     (from the attempt's snapshot), across levels.
//   • Each person counts once, with their BEST percentage (voided attempts
//     excluded).
//   • Standard competition ranking: equal best scores share a rank and the
//     next rank is skipped (95, 90, 90, 80 → 1, 2, 2, 4).
//   • Department average = mean of those best scores (one decimal).
//   • No names are returned — only numbers.

import { prisma } from "../config/db.js";
import { GRADED_ATTEMPT } from "./assignment.service.js";

// scores: Map userId → best percentage
export function rankOf(scores, userId) {
  const mine = scores.get(userId);
  if (mine == null) return null;
  let higher = 0;
  for (const s of scores.values()) if (s > mine) higher++;
  return higher + 1;
}

export function bestScores(attempts) {
  const best = new Map();
  for (const a of attempts) best.set(a.userId, Math.max(best.get(a.userId) ?? -1, a.percentage ?? 0));
  return best;
}

export async function departmentStanding(departmentId, userId) {
  if (!departmentId) return null;
  const [attempts, totalEligible] = await Promise.all([
    prisma.attempt.findMany({
      where: { ...GRADED_ATTEMPT, config: { path: ["departmentId"], equals: departmentId } },
      select: { userId: true, percentage: true, passed: true },
    }),
    prisma.user.count({ where: { role: "EMPLOYEE", status: "ACTIVE", designation: { departmentId } } }),
  ]);
  const scores = bestScores(attempts);
  const values = [...scores.values()];
  const passedUsers = new Set(attempts.filter((a) => a.passed).map((a) => a.userId));
  return {
    rank: rankOf(scores, userId),
    of: scores.size,
    totalEligible,
    departmentAverage: values.length ? Math.round((values.reduce((t, x) => t + x, 0) / values.length) * 10) / 10 : null,
    best: scores.get(userId) ?? null,
    passedCount: passedUsers.size,
  };
}
