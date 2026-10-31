// Admin endpoints. Thin: validation happens in routes, logic in services.

import * as overviewSvc from "../services/overview.service.js";
import * as users from "../services/adminUser.service.js";
import * as departments from "../services/department.service.js";
import * as designations from "../services/designation.service.js";
import * as locations from "../services/location.service.js";
import * as materials from "../services/material.service.js";
import * as assessments from "../services/assessmentAdmin.service.js";
import * as announcements from "../services/announcement.service.js";
import * as results from "../services/results.service.js";
import { certificateFor } from "../services/certificate.service.js";
import { disposition } from "./training.controller.js";
import { prisma } from "../config/db.js";
import { ok, created } from "../utils/ApiResponse.js";

const pid = (req) => req.validParams?.id ?? req.params.id;

// Overview
export const overview = async (req, res) => ok(res, await overviewSvc.overview());

// Users
export const listUsers = async (req, res) => ok(res, await users.list(req.validQuery));
export const getUser = async (req, res) => ok(res, await users.get(req, pid(req)));
export const createUser = async (req, res) => created(res, await users.create(req, req.body));
export const updateUser = async (req, res) => ok(res, await users.update(req, pid(req), req.body));
export const deleteUser = async (req, res) => ok(res, await users.remove(req, pid(req)));
export const setUserStatus = async (req, res) => ok(res, await users.setStatus(req, pid(req), req.body.status));
export const resetUserPassword = async (req, res) => ok(res, await users.resetPassword(req, pid(req)));
export const resetUserAttempts = async (req, res) => ok(res, await users.resetAttempts(req, pid(req), req.body));

// Departments
export const listDepartments = async (req, res) => ok(res, await departments.list());
export const createDepartment = async (req, res) => created(res, await departments.create(req, req.body));
export const updateDepartment = async (req, res) => ok(res, await departments.update(req, pid(req), req.body));
export const deleteDepartment = async (req, res) => ok(res, await departments.remove(req, pid(req)));

// Designations
export const listDesignations = async (req, res) => ok(res, await designations.list(req.query));
export const getDesignation = async (req, res) => ok(res, await designations.get(pid(req)));
export const createDesignation = async (req, res) => created(res, await designations.create(req, req.body));
export const updateDesignation = async (req, res) => ok(res, await designations.update(req, pid(req), req.body));
export const deleteDesignation = async (req, res) => ok(res, await designations.remove(req, pid(req)));

// Materials
export const listMaterials = async (req, res) => ok(res, await materials.list(req.validQuery));
export const getMaterial = async (req, res) => ok(res, await materials.get(pid(req)));
export const createMaterial = async (req, res) => created(res, await materials.create(req, req.body));
export const updateMaterial = async (req, res) => ok(res, await materials.update(req, pid(req), req.body));
export const deleteMaterial = async (req, res) => ok(res, await materials.remove(req, pid(req)));
export const uploadMaterialFile = async (req, res) => created(res, await materials.upload(req, req.file));

// Assessments & questions
export const listAssessments = async (req, res) => ok(res, await assessments.list(req.query));
export const createAssessment = async (req, res) => created(res, await assessments.create(req, req.body));
export const updateAssessment = async (req, res) => ok(res, await assessments.update(req, pid(req), req.body));
export const deleteAssessment = async (req, res) => ok(res, await assessments.remove(req, pid(req)));
export const listQuestions = async (req, res) => ok(res, await assessments.listQuestions(pid(req), req.validQuery));
export const createQuestion = async (req, res) => created(res, await assessments.createQuestion(req, pid(req), req.body));
export const updateQuestion = async (req, res) => ok(res, await assessments.updateQuestion(req, pid(req), req.body));
export const deleteQuestion = async (req, res) => ok(res, await assessments.removeQuestion(req, pid(req)));

// Locations
export const listLocations = async (req, res) => ok(res, await locations.list());
export const createLocation = async (req, res) => created(res, await locations.create(req, req.body));
export const updateLocation = async (req, res) => ok(res, await locations.update(req, pid(req), req.body));
export const deleteLocation = async (req, res) => ok(res, await locations.remove(req, pid(req)));

// Results
export const listResults = async (req, res) => ok(res, await results.list(req, req.validQuery));
export const getResult = async (req, res) => ok(res, await results.get(req, pid(req)));
export const deleteResult = async (req, res) => ok(res, await results.remove(req, pid(req)));
export async function exportResults(req, res) {
  const csv = await results.exportCsv(req, req.validQuery);
  res.set({ "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": disposition("attachment", `aajneeti-results-${new Date().toISOString().slice(0, 10)}.csv`) });
  res.send(csv);
}
export async function resultCertificate(req, res) {
  const c = await certificateFor(req.user, pid(req), { admin: true });
  res.set({ "Content-Type": "application/pdf", "Content-Disposition": disposition("attachment", c.fileName) });
  res.send(c.pdf);
}

// Announcements
export const listAnnouncements = async (req, res) => ok(res, await announcements.listAll());
export const createAnnouncement = async (req, res) => created(res, await announcements.create(req, req.body));
export const updateAnnouncement = async (req, res) => ok(res, await announcements.update(req, pid(req), req.body));
export const deleteAnnouncement = async (req, res) => ok(res, await announcements.remove(req, pid(req)));

// Audit log (latest first)
export async function listAuditLogs(req, res) {
  const take = Math.min(Number(req.query.limit) || 100, 500);
  const rows = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take, include: { actor: { select: { name: true, email: true } } } });
  ok(res, rows.map(({ actor, ...r }) => ({ ...r, actorName: actor?.name ?? null, actorEmail: actor?.email ?? null })));
}
