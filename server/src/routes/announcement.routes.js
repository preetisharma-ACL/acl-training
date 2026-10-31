// GET /announcements — what the signed-in user should see.

import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { listFor } from "../services/announcement.service.js";
import { ok } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get(
  "/",
  asyncHandler(requireAuth),
  asyncHandler(async (req, res) => ok(res, await listFor(req.user))),
);

export default router;
