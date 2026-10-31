// ─── Admin service ──────────────────────────────────────────────────────────
// Backed by /api/v1/admin (every endpoint is admin-only on the server). Same
// function names and shapes as the mock, so the admin pages are unchanged.
//
// Mock mode (VITE_USE_MOCK=true) swaps this file for services/mock/admin.js.

import { get, post, patch, del, upload } from "./api";
import { parseManual, manualToText } from "../lib/manual";

export { parseManual, manualToText };

const enc = encodeURIComponent;
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));

// ── Overview ──
export const getOverview = () => get("/admin/overview");

// ── Users ──
export const listUsers = (filters) => get("/admin/users", filters);
export const getUser = (id) => get(`/admin/users/${enc(id)}`);

// → { user, temporaryPassword? }
export function saveUser(input) {
  const isAdmin = input.role === "admin" || input.role === "super_admin";
  const body = {
    ...pick(input, ["name", "phone", "location", "role", "status", "code", "joinedAt"]),
    email: input.email?.trim(),
    designationId: isAdmin ? null : input.designationId || null,
    ...(isAdmin ? { adminTitle: input.adminTitle } : {}),
    ...(input.password ? { password: input.password } : {}),
  };
  if (typeof body.name === "string") body.name = body.name.trim();
  return input.id ? patch(`/admin/users/${enc(input.id)}`, body) : post("/admin/users", body);
}

export const setUserStatus = (id, status) => patch(`/admin/users/${enc(id)}/status`, { status });

// → { email, temporaryPassword } — shown once to the admin.
export const resetUserPassword = (id) => post(`/admin/users/${enc(id)}/reset-password`);

export const resetUserAttempts = (id, assessmentId) => post(`/admin/users/${enc(id)}/reset-attempts`, assessmentId ? { assessmentId } : {});

export const deleteUser = (id) => del(`/admin/users/${enc(id)}`);

// ── Departments ──
export const listDepartments = () => get("/admin/departments");

export function saveDepartment(input) {
  const body = pick(input, ["name", "description", "head", "location", "active"]);
  if (typeof body.name === "string") body.name = body.name.trim();
  return input.id ? patch(`/admin/departments/${enc(input.id)}`, body) : post("/admin/departments", body);
}

export const deleteDepartment = (id) => del(`/admin/departments/${enc(id)}`);

// ── Designations ──
export const listDesignations = () => get("/admin/designations");

export function saveDesignation(input) {
  const body = { title: input.title?.trim(), level: input.level, departmentId: input.departmentId || undefined };
  return input.id ? patch(`/admin/designations/${enc(input.id)}`, body) : post("/admin/designations", body);
}

export const deleteDesignation = (id) => del(`/admin/designations/${enc(id)}`);

// ── Locations ── → [{ id, name, users, departments }]
export const listLocations = () => get("/admin/locations");

export function saveLocation(input) {
  const body = { name: input.name?.trim() };
  return input.id ? patch(`/admin/locations/${enc(input.id)}`, body) : post("/admin/locations", body);
}

export const deleteLocation = (id) => del(`/admin/locations/${enc(id)}`);

// ── Materials ──
export const listMaterials = (filters) => get("/admin/materials", filters);
export const getMaterialForAdmin = (id) => get(`/admin/materials/${enc(id)}`);

// input: { id?, title, type, departmentId, required, description, estMinutes,
//          levels, manualText? (manual), mediaUrl/mediaKind (media),
//          file? (pdf: a File), requireRecompletion? }
export async function saveMaterial(input) {
  let uploadId;
  if (input.type === "pdf" && input.file) {
    const form = new FormData();
    form.append("file", input.file, input.file.name);
    uploadId = (await upload("/admin/materials/upload", form)).uploadId;
  }
  // departmentId: null = company-wide; levels: the chosen level keys.
  // The server requires both (and required) explicitly for new materials.
  const body = {
    title: input.title?.trim(),
    description: input.description?.trim() ?? "",
    departmentId: input.departmentId || null,
    required: !!input.required,
    estMinutes: Number(input.estMinutes) || 5,
    levels: input.levels ?? [],
    ...(input.status ? { status: input.status } : {}),
    ...(input.author && !input.id ? { author: input.author } : {}),
    ...(uploadId ? { uploadId } : {}),
  };
  if (input.type === "manual" && input.manualText != null) body.content = parseManual(input.manualText);
  if (input.type === "structured" && input.guide) body.content = input.guide;
  if (input.type === "media" && input.mediaUrl) body.content = { url: input.mediaUrl.trim(), kind: input.mediaKind || "video" };
  if (input.id) {
    if (input.requireRecompletion) body.requireRecompletion = true;
    return patch(`/admin/materials/${enc(input.id)}`, body);
  }
  return post("/admin/materials", { ...body, type: input.type });
}

export const setMaterialRequired = (id, required) => patch(`/admin/materials/${enc(id)}`, { required: !!required });
export const setMaterialStatus = (id, status) => patch(`/admin/materials/${enc(id)}`, { status });
export const deleteMaterial = (id) => del(`/admin/materials/${enc(id)}`);

// ── Assessments & question bank ──
export const listAssessments = () => get("/admin/assessments");

export const saveAssessmentSettings = (id, p) =>
  patch(`/admin/assessments/${enc(id)}`, {
    ...pick(p, ["title", "description", "shuffle", "active"]),
    ...Object.fromEntries(["durationMinutes", "passPercent", "marksPerQuestion", "maxAttempts", "questionsPerAttempt"].filter((k) => p[k] !== undefined && p[k] !== "").map((k) => [k, Number(p[k])])),
  });

export const listQuestions = (assessmentId, filters) => get(`/admin/assessments/${enc(assessmentId)}/questions`, filters);

export function saveQuestion(assessmentId, q) {
  const body = { text: q.text.trim(), options: q.options.map((o) => o.trim()), answer: Number(q.answer), ...pick(q, ["explanation", "difficulty", "active"]) };
  return q.id ? patch(`/admin/questions/${enc(q.id)}`, body) : post(`/admin/assessments/${enc(assessmentId)}/questions`, body);
}

export const deleteQuestion = (assessmentId, id) => del(`/admin/questions/${enc(id)}`);

// ── Results ──
export const listResults = (filters) => get("/admin/results", filters);
export const getResult = (id) => get(`/admin/results/${enc(id)}`);
export const deleteResult = (id) => del(`/admin/results/${enc(id)}`);

// ── Announcements ──
export const listAnnouncements = () => get("/admin/announcements");
export const postAnnouncement = ({ title, body, author, departmentIds, tone }) => post("/admin/announcements", pick({ title, body, author, departmentIds, tone }, ["title", "body", "author", "departmentIds", "tone"]));
export const updateAnnouncement = (id, p) => patch(`/admin/announcements/${enc(id)}`, p);
export const deleteAnnouncement = (id) => del(`/admin/announcements/${enc(id)}`);

// Demo data only exists in mock mode.
export const resetDemoData = async () => {};
