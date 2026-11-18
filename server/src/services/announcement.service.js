// Announcements: admins publish to everyone or to chosen departments.

import { prisma } from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";
import { orgOf } from "./assignment.service.js";
import { audit, changes } from "./audit.service.js";

const INCLUDE = { departments: { select: { departmentId: true } } };

// What the activity log compares on an edit (department names, not ids).
const AUDIT_INCLUDE = { departments: { select: { department: { select: { name: true } } } } };
const snap = (a) => ({
  title: a.title,
  body: a.body,
  tone: a.tone,
  author: a.authorName,
  published: a.published,
  archived: !!a.archivedAt,
  departments: a.departments.length ? a.departments.map((d) => d.department.name).sort().join(", ") : "Everyone",
});

const out = (a) => ({
  id: a.id,
  title: a.title,
  body: a.body,
  tone: a.tone,
  author: a.authorName,
  createdAt: a.publishedAt ?? a.createdAt,
  published: a.published,
  archived: !!a.archivedAt,
  departmentIds: a.departments.map((d) => d.departmentId),
});

// What one signed-in user sees: published, not archived, for everyone or
// for their department. Admins see everything published.
export async function listFor(user) {
  const where = { published: true, archivedAt: null };
  if (user.role === "EMPLOYEE") {
    const org = orgOf(user);
    where.OR = [{ departments: { none: {} } }, ...(org ? [{ departments: { some: { departmentId: org.departmentId } } }] : [])];
  }
  const rows = await prisma.announcement.findMany({ where, include: INCLUDE, orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }], take: 50 });
  return rows.map(out);
}

export async function listAll() {
  const rows = await prisma.announcement.findMany({ include: INCLUDE, orderBy: { createdAt: "desc" } });
  return rows.map(out);
}

async function checkDepartments(ids = []) {
  if (!ids.length) return;
  const n = await prisma.department.count({ where: { id: { in: ids } } });
  if (n !== new Set(ids).size) throw ApiError.badRequest("Choose valid departments.");
}

export async function create(req, input) {
  await checkDepartments(input.departmentIds);
  const a = await prisma.announcement.create({
    data: {
      title: input.title,
      body: input.body,
      tone: input.tone ?? "lime",
      published: input.published ?? true,
      publishedAt: input.published === false ? null : new Date(),
      authorId: req.user.id,
      authorName: input.author || req.user.name,
      departments: { create: [...new Set(input.departmentIds ?? [])].map((departmentId) => ({ departmentId })) },
    },
    include: INCLUDE,
  });
  await audit(req, "ANNOUNCEMENT_CREATED", "Announcement", a.id, { label: a.title, ...snap(await prisma.announcement.findUnique({ where: { id: a.id }, include: AUDIT_INCLUDE })) });
  return out(a);
}

export async function update(req, id, patch) {
  const before = await prisma.announcement.findUnique({ where: { id }, include: AUDIT_INCLUDE });
  if (!before) throw ApiError.notFound("Announcement not found.");
  await checkDepartments(patch.departmentIds);
  const data = {};
  for (const k of ["title", "body", "tone"]) if (k in patch) data[k] = patch[k];
  if ("author" in patch) data.authorName = patch.author;
  if ("published" in patch) {
    data.published = patch.published;
    if (patch.published && !before.publishedAt) data.publishedAt = new Date();
  }
  if ("archived" in patch) data.archivedAt = patch.archived ? new Date() : null;
  const a = await prisma.$transaction(async (tx) => {
    if (patch.departmentIds) {
      await tx.announcementDepartment.deleteMany({ where: { announcementId: id } });
      await tx.announcementDepartment.createMany({ data: [...new Set(patch.departmentIds)].map((departmentId) => ({ announcementId: id, departmentId })) });
    }
    return tx.announcement.update({ where: { id }, data, include: INCLUDE });
  });
  const after = await prisma.announcement.findUnique({ where: { id }, include: AUDIT_INCLUDE });
  await audit(req, "ANNOUNCEMENT_UPDATED", "Announcement", id, { label: a.title, changes: changes(snap(before), snap(after)) });
  return out(a);
}

export async function remove(req, id) {
  const a = await prisma.announcement.findUnique({ where: { id } });
  if (!a) throw ApiError.notFound("Announcement not found.");
  await prisma.announcement.delete({ where: { id } });
  await audit(req, "ANNOUNCEMENT_DELETED", "Announcement", id, { label: a.title });
}
