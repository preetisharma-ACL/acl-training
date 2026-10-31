// /admin — every route requires a signed-in administrator.

import { Router } from "express";
import * as c from "../controllers/admin.controller.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { validate } from "../middleware/validate.js";
import { uploadPdf } from "../middleware/upload.js";
import { adminResetLimiter } from "../middleware/rateLimit.js";
import { idParams } from "../validators/common.js";
import * as v from "../validators/admin.validator.js";
import { createMaterialSchema, updateMaterialSchema, listMaterialsQuery } from "../validators/material.validator.js";
import { createAssessmentSchema, updateAssessmentSchema, questionSchema, updateQuestionSchema, listQuestionsQuery } from "../validators/assessment.validator.js";
import { asyncHandler as h } from "../utils/asyncHandler.js";

const router = Router();
router.use(h(requireAuth), requireAdmin);

const byId = validate({ params: idParams });
const body = (schema) => validate({ params: idParams.partial(), body: schema });

router.get("/overview", h(c.overview));

router.get("/users", validate({ query: v.listUsersQuery }), h(c.listUsers));
router.post("/users", body(v.createUserSchema), h(c.createUser));
router.get("/users/:id", byId, h(c.getUser));
router.patch("/users/:id", byId, body(v.updateUserSchema), h(c.updateUser));
router.delete("/users/:id", byId, h(c.deleteUser));
router.patch("/users/:id/status", byId, body(v.userStatusSchema), h(c.setUserStatus));
router.post("/users/:id/reset-password", byId, adminResetLimiter, h(c.resetUserPassword));
router.post("/users/:id/reset-attempts", byId, body(v.resetAttemptsSchema), h(c.resetUserAttempts));

router.get("/departments", h(c.listDepartments));
router.post("/departments", body(v.createDepartmentSchema), h(c.createDepartment));
router.patch("/departments/:id", byId, body(v.updateDepartmentSchema), h(c.updateDepartment));
router.delete("/departments/:id", byId, h(c.deleteDepartment));

router.get("/designations", h(c.listDesignations));
router.post("/designations", body(v.createDesignationSchema), h(c.createDesignation));
router.get("/designations/:id", byId, h(c.getDesignation));
router.patch("/designations/:id", byId, body(v.updateDesignationSchema), h(c.updateDesignation));
router.delete("/designations/:id", byId, h(c.deleteDesignation));

router.get("/locations", h(c.listLocations));
router.post("/locations", body(v.locationSchema), h(c.createLocation));
router.patch("/locations/:id", byId, body(v.locationSchema), h(c.updateLocation));
router.delete("/locations/:id", byId, h(c.deleteLocation));

router.get("/materials", validate({ query: listMaterialsQuery }), h(c.listMaterials));
router.post("/materials/upload", uploadPdf, h(c.uploadMaterialFile));
router.post("/materials", body(createMaterialSchema), h(c.createMaterial));
router.get("/materials/:id", byId, h(c.getMaterial));
router.patch("/materials/:id", byId, body(updateMaterialSchema), h(c.updateMaterial));
router.delete("/materials/:id", byId, h(c.deleteMaterial));

router.get("/assessments", h(c.listAssessments));
router.post("/assessments", body(createAssessmentSchema), h(c.createAssessment));
router.patch("/assessments/:id", byId, body(updateAssessmentSchema), h(c.updateAssessment));
router.delete("/assessments/:id", byId, h(c.deleteAssessment));
router.get("/assessments/:id/questions", byId, validate({ query: listQuestionsQuery }), h(c.listQuestions));
router.post("/assessments/:id/questions", byId, body(questionSchema), h(c.createQuestion));
router.patch("/questions/:id", byId, body(updateQuestionSchema), h(c.updateQuestion));
router.delete("/questions/:id", byId, h(c.deleteQuestion));

router.get("/results", validate({ query: v.resultsQuery }), h(c.listResults));
router.get("/results/export", validate({ query: v.resultsQuery }), h(c.exportResults));
router.get("/results/:id", byId, h(c.getResult));
router.delete("/results/:id", byId, h(c.deleteResult));
router.get("/results/:id/certificate", byId, h(c.resultCertificate));

router.get("/announcements", h(c.listAnnouncements));
router.post("/announcements", body(v.createAnnouncementSchema), h(c.createAnnouncement));
router.patch("/announcements/:id", byId, body(v.updateAnnouncementSchema), h(c.updateAnnouncement));
router.delete("/announcements/:id", byId, h(c.deleteAnnouncement));

router.get("/audit-logs", h(c.listAuditLogs));

export default router;
