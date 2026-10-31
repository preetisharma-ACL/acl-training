// /api/v1 router.

import { Router } from "express";
import { prisma } from "../config/db.js";
import { ok } from "../utils/ApiResponse.js";
import { apiLimiter } from "../middleware/rateLimit.js";
import authRoutes from "./auth.routes.js";
import userRoutes from "./user.routes.js";
import announcementRoutes from "./announcement.routes.js";
import adminRoutes from "./admin.routes.js";
import trainingRoutes from "./training.routes.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as locations from "../services/location.service.js";

const router = Router();

router.get("/health", async (req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  ok(res, { status: "ok", time: new Date().toISOString() });
});

router.use(apiLimiter);
router.use("/auth", authRoutes);
router.use("/me", userRoutes);
router.use("/training", trainingRoutes);
router.use("/announcements", announcementRoutes);
router.use("/admin", adminRoutes);

// Office locations, for the profile form.
router.get("/locations", asyncHandler(requireAuth), async (req, res) => ok(res, await locations.names()));

export default router;
