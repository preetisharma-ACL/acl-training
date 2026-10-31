// Role guards. Use after requireAuth.

import { ApiError } from "../utils/ApiError.js";

export function requireAdmin(req, res, next) {
  if (req.user?.role === "ADMIN" || req.user?.role === "SUPER_ADMIN") return next();
  next(ApiError.forbidden("This area is for administrators only."));
}

export function requireSuperAdmin(req, res, next) {
  if (req.user?.role === "SUPER_ADMIN") return next();
  next(ApiError.forbidden("Only a super admin can do this."));
}

export function requireEmployee(req, res, next) {
  if (req.user?.role === "EMPLOYEE") return next();
  next(ApiError.forbidden("This area is for employees."));
}
