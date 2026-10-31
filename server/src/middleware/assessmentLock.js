// While an employee has a running assessment, training content and past
// answer reviews are off-limits (the UI also redirects every page to the
// test, but this is the enforcement). Use after requireAuth.

import { activeAttemptId } from "../services/assessment.service.js";
import { ApiError } from "../utils/ApiError.js";

export async function assessmentLock(req, res, next) {
  if (req.user?.role !== "EMPLOYEE") return next();
  const active = await activeAttemptId(req.user.id);
  if (active) {
    return next(ApiError.forbidden("Finish your running assessment first.", { code: "ASSESSMENT_IN_PROGRESS", details: { attemptId: active } }));
  }
  next();
}
