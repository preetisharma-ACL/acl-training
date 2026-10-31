// Training materials (admin): CRUD, publication, level targeting, PDF
// uploads, version history and the re-completion policy.

import { prisma } from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";
import { levelsFromApi, levelsToApi, levelPlural, LEVELS } from "../utils/levels.js";
import { manualContent, structuredContent, mediaContent } from "../validators/material.validator.js";
import { materialBaseOut, materialFileUrl, materialTypeEnum } from "./serializers.js";
import { reaches, isComplete, orgOf } from "./assignment.service.js";
import * as storage from "./storage.service.js";
import { audit } from "./audit.service.js";

const CONTENT_SCHEMA = { MANUAL: manualContent, STRUCTURED_GUIDE: structuredContent, MEDIA: mediaContent };

function checkContent(type, content) {
  const schema = CONTENT_SCHEMA[type];
  if (!schema) return null; // PDFs carry no JSON content
  const r = schema.safeParse(content);
  if (!r.success) throw new ApiError(422, r.error.issues[0].message, { code: "VALIDATION_ERROR", details: r.error.issues });
  return r.data;
}

const levelsLabel = (enums) => (enums.length >= LEVELS.length ? "All levels" : LEVELS.filter((l) => enums.includes(l.enum)).map((l) => levelPlural(l.enum)).join(", "));

const bump = (v = "1.0") => {
  const [a, b] = String(v).split(".").map(Number);
  return `${a || 1}.${(b || 0) + 1}`;
};

export function adminMaterialOut(m, extra = {}) {
  const enums = m.levels.map((l) => l.level);
  return {
    ...materialBaseOut(m),
    levels: levelsToApi(enums),
    levelsLabel: levelsLabel(enums),
    departmentName: m.departmentId ? m.department?.name ?? "—" : "All departments",
    revision: m.revision,
    requiredRevision: m.requiredRevision,
    fileUrl: materialFileUrl(m),
    createdAt: m.createdAt,
    sections: m.type === "STRUCTURED_GUIDE" ? m.content?.sections?.length ?? 0 : m.type === "MANUAL" ? m.content?.chapters?.length ?? 0 : null,
    ...extra,
  };
}

const INCLUDE = { levels: true, department: { select: { name: true } } };

export async function list(filters = {}) {
  const where = {};
  if (filters.departmentId) where.departmentId = filters.departmentId === "company" ? null : filters.departmentId;
  if (filters.type) where.type = materialTypeEnum(filters.type);
  where.status = filters.status ? filters.status.toUpperCase() : { not: "ARCHIVED" };
  if (filters.q) where.title = { contains: filters.q, mode: "insensitive" };

  const [materials, employees, progress] = await Promise.all([
    prisma.material.findMany({ where, include: INCLUDE, orderBy: { updatedAt: "desc" } }),
    prisma.user.findMany({ where: { role: "EMPLOYEE", status: "ACTIVE" }, include: { designation: { include: { department: true } } } }),
    prisma.materialProgress.findMany({ where: { completed: true }, select: { userId: true, materialId: true, completed: true, completedRevision: true } }),
  ]);
  const orgs = employees.map((u) => ({ id: u.id, org: orgOf(u) }));
  const done = new Map();
  for (const p of progress) done.set(`${p.userId}:${p.materialId}`, p);

  return materials.map(({ content, ...m }) => {
    // Audience as if published, so drafts show who they will reach.
    const asPublished = { ...m, status: "PUBLISHED" };
    const audience = orgs.filter((o) => reaches(asPublished, o.org));
    const completed = audience.filter((o) => isComplete(done.get(`${o.id}:${m.id}`), m)).length;
    return adminMaterialOut({ ...m, content }, { audience: audience.length, completed });
  });
}

export async function get(id) {
  const m = await prisma.material.findUnique({ where: { id }, include: { ...INCLUDE, versions: { orderBy: { revision: "desc" }, select: { revision: true, version: true, title: true, createdAt: true, fileName: true } } } });
  if (!m) throw ApiError.notFound("Material not found.");
  return { ...adminMaterialOut(m), content: m.content, versions: m.versions };
}

async function checkDepartment(departmentId) {
  if (departmentId && !(await prisma.department.findUnique({ where: { id: departmentId } }))) throw ApiError.badRequest("Choose a valid department.");
}

// → { key, meta: { fileName, sizeBytes, pages } } for a pending upload.
async function claimUpload(uploadId) {
  const key = `pending/${uploadId}.pdf`;
  if (!storage.isPendingKey(key) || !(await storage.exists(key))) throw ApiError.badRequest("The uploaded file was not found. Please upload it again.", { code: "UPLOAD_MISSING" });
  return { key, meta: await storage.readPendingMeta(key) };
}

const versionRow = (m, createdById) => ({
  revision: m.revision,
  version: m.version,
  title: m.title,
  description: m.description,
  type: m.type,
  content: m.content ?? undefined,
  fileKey: m.fileKey,
  fileName: m.fileName,
  fileSize: m.fileSize,
  createdById,
});

// Upload step: store privately under pending/ and return a handle the
// create/update call attaches. Unattached uploads are swept after 24h.
export async function upload(req, file) {
  const key = storage.newPendingKey();
  const meta = { fileName: file.safeName, sizeBytes: file.size, pages: file.pages };
  await storage.put(key, file.buffer);
  await storage.writePendingMeta(key, meta);
  await audit(req, "MATERIAL_FILE_UPLOADED", "Material", null, meta);
  return { uploadId: key.slice("pending/".length, -".pdf".length), ...meta };
}

export async function create(req, input) {
  const type = materialTypeEnum(input.type);
  await checkDepartment(input.departmentId);
  const content = checkContent(type, input.content);
  if (type === "PDF" && !input.uploadId) throw ApiError.badRequest("Upload the PDF file first.", { code: "NO_FILE" });
  const pending = type === "PDF" ? await claimUpload(input.uploadId) : null;

  const m = await prisma.material.create({
    data: {
      title: input.title,
      description: input.description,
      type,
      departmentId: input.departmentId,
      content: content ?? undefined,
      required: input.required,
      estMinutes: input.estMinutes,
      status: input.status.toUpperCase(),
      author: input.author || req.user.name,
      createdById: req.user.id,
      levels: { create: levelsFromApi(input.levels).map((level) => ({ level })) },
    },
  });
  let final = m;
  if (pending) {
    const key = await storage.move(pending.key, `materials/${m.id}/r1.pdf`);
    final = await prisma.material.update({
      where: { id: m.id },
      data: { fileKey: key, fileName: pending.meta.fileName, fileMime: "application/pdf", fileSize: pending.meta.sizeBytes, filePages: pending.meta.pages },
    });
  }
  await prisma.materialVersion.create({ data: { materialId: m.id, ...versionRow(final, req.user.id) } });
  await audit(req, "MATERIAL_CREATED", "Material", m.id, { title: m.title, type });
  return get(m.id);
}

// Content, file or title changes create a new version. With
// requireRecompletion, earlier completions stop counting.
export async function update(req, id, patch) {
  const m = await prisma.material.findUnique({ where: { id }, include: { levels: true } });
  if (!m) throw ApiError.notFound("Material not found.");
  if ("departmentId" in patch) await checkDepartment(patch.departmentId);

  const data = {};
  for (const k of ["title", "description", "departmentId", "required", "estMinutes", "author"]) if (k in patch) data[k] = patch[k];
  if (patch.status) data.status = patch.status.toUpperCase();
  if ("content" in patch && m.type !== "PDF") data.content = checkContent(m.type, patch.content);

  let newFileKey = null;
  if (patch.uploadId) {
    if (m.type !== "PDF") throw ApiError.badRequest("Only PDF materials take a file.");
    const pending = await claimUpload(patch.uploadId);
    newFileKey = await storage.move(pending.key, `materials/${m.id}/r${m.revision + 1}.pdf`);
    Object.assign(data, { fileKey: newFileKey, fileName: pending.meta.fileName, fileSize: pending.meta.sizeBytes, filePages: pending.meta.pages, fileMime: "application/pdf" });
  }

  const contentChanged =
    !!newFileKey || ("content" in data && JSON.stringify(data.content) !== JSON.stringify(m.content)) || ("title" in data && data.title !== m.title) || ("description" in data && data.description !== m.description);
  if (contentChanged) {
    data.revision = m.revision + 1;
    data.version = bump(m.version);
    if (patch.requireRecompletion) data.requiredRevision = data.revision;
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (patch.levels) {
      await tx.materialLevel.deleteMany({ where: { materialId: id } });
      await tx.materialLevel.createMany({ data: levelsFromApi(patch.levels).map((level) => ({ materialId: id, level })) });
    }
    const u = await tx.material.update({ where: { id }, data });
    if (contentChanged) await tx.materialVersion.create({ data: { materialId: id, ...versionRow(u, req.user.id) } });
    return u;
  });
  await audit(req, "MATERIAL_UPDATED", "Material", id, {
    fields: Object.keys(patch).filter((k) => k !== "content"),
    newVersion: contentChanged ? updated.version : null,
    requireRecompletion: !!(contentChanged && patch.requireRecompletion),
  });
  return get(id);
}

// Materials someone has started are archived (history kept); untouched ones
// are deleted with their files.
export async function remove(req, id) {
  const m = await prisma.material.findUnique({ where: { id }, include: { versions: { select: { fileKey: true } } } });
  if (!m) throw ApiError.notFound("Material not found.");
  const used = await prisma.materialProgress.count({ where: { materialId: id } });
  if (used) {
    await prisma.material.update({ where: { id }, data: { status: "ARCHIVED" } });
    await audit(req, "MATERIAL_ARCHIVED", "Material", id, { title: m.title });
    return { archived: true };
  }
  await prisma.material.delete({ where: { id } });
  const keys = new Set([m.fileKey, ...m.versions.map((v) => v.fileKey)].filter(Boolean));
  for (const k of keys) await storage.remove(k).catch(() => {});
  await audit(req, "MATERIAL_DELETED", "Material", id, { title: m.title });
  return { deleted: true };
}
