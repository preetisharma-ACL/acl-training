// /me — the signed-in user's own profile.

import { Router } from "express";
import * as c from "../controllers/user.controller.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { validate } from "../middleware/validate.js";
import { passwordChangeLimiter } from "../middleware/rateLimit.js";
import { updateProfileSchema, changePasswordSchema } from "../validators/user.validator.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(asyncHandler(requireAuth));
router.get("/", c.getMe);
router.patch("/", validate({ body: updateProfileSchema }), asyncHandler(c.updateMe));
router.post("/password", passwordChangeLimiter, validate({ body: changePasswordSchema }), asyncHandler(c.changePassword));

export default router;
