// /training — the employee's module, materials and assessment.

import { Router } from "express";
import * as c from "../controllers/training.controller.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireEmployee } from "../middleware/requireAdmin.js";
import { assessmentLock } from "../middleware/assessmentLock.js";
import { validate } from "../middleware/validate.js";
import { idParams } from "../validators/common.js";
import { progressSchema, submitSchema, saveAnswersSchema } from "../validators/training.validator.js";
import { asyncHandler as h } from "../utils/asyncHandler.js";

const router = Router();
router.use(h(requireAuth));

const byId = validate({ params: idParams });
const lock = h(assessmentLock);

router.get("/module", h(c.getModule));

// Materials (admins may open any; employees only assigned ones)
router.get("/materials/:id", byId, lock, h(c.getMaterial));
router.get("/materials/:id/file", byId, lock, h(c.materialFile));
router.post("/materials/:id/progress", byId, lock, validate({ body: progressSchema }), h(c.updateProgress));

// Assessment
router.post("/attempts", requireEmployee, h(c.startAttempt));
router.get("/attempts/active", requireEmployee, h(c.activeAttempt));
router.get("/attempts/mine", requireEmployee, h(c.listMine));
router.get("/attempts/:id", byId, requireEmployee, lock, h(c.getAttempt));
router.put("/attempts/:id/answers", byId, requireEmployee, validate({ body: saveAnswersSchema }), h(c.saveAnswers));
router.post("/attempts/:id/submit", byId, requireEmployee, validate({ body: submitSchema }), h(c.submitAttempt));
router.get("/attempts/:id/certificate", byId, requireEmployee, lock, h(c.certificate));

export default router;
