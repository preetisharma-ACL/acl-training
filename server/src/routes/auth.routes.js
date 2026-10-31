import { Router } from "express";
import * as c from "../controllers/auth.controller.js";
import { validate } from "../middleware/validate.js";
import { loginLimiter, passwordResetLimiter } from "../middleware/rateLimit.js";
import { loginSchema, passwordResetSchema, passwordResetConfirmSchema } from "../validators/auth.validator.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.post("/login", loginLimiter, validate({ body: loginSchema }), asyncHandler(c.login));
router.post("/logout", asyncHandler(c.logout));
router.post("/password-reset", passwordResetLimiter, validate({ body: passwordResetSchema }), asyncHandler(c.requestPasswordReset));
router.post("/password-reset/confirm", passwordResetLimiter, validate({ body: passwordResetConfirmSchema }), asyncHandler(c.confirmPasswordReset));

export default router;
