// Designations: the designation → (department, level) mapping. Employees'
// department and level are always derived from it, so changing a
// designation re-maps every employee who holds it.

import { prisma } from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";
import { levelKey, levelLabel } from "../utils/levels.js";
import { audit } from "./audit.service.js";

const out = (d) => ({
  id: d.id,
  title: d.title,
  departmentId: d.departmentId,
  departmentName: d.department?.name ?? null,
  level: levelLabel(d.level),
  levelKey: levelKey(d.level),
  description: d.description,
  employees: d._count?.users ?? 0,
  createdAt: d.createdAt,
  updatedAt: d.updatedAt,
});

const INCLUDE = { department: { select: { name: true } }, _count: { select: { users: true } } };

export async function list({ departmentId } = {}) {
  const rows = await prisma.designation.findMany({ where: departmentId ? { departmentId } : {}, include: INCLUDE, orderBy: [{ departmentId: "asc" }, { title: "asc" }] });
  return rows.map(out);
}

export async function get(id) {
  const d = await prisma.designation.findUnique({
    where: { id },
    include: { ...INCLUDE, users: { select: { id: true, name: true, email: true, employeeCode: true, status: true }, orderBy: { name: "asc" } } },
  });
  if (!d) throw ApiError.notFound("Designation not found.");
  return { ...out(d), users: d.users.map((u) => ({ ...u, code: u.employeeCode, status: u.status.toLowerCase() })) };
}

async function checkUnique(title, exceptId) {
  const clash = await prisma.designation.findFirst({ where: { title: { equals: title, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) } });
  if (clash) throw ApiError.conflict("This designation already exists.");
}

async function checkDepartment(departmentId) {
  if (!(await prisma.department.findUnique({ where: { id: departmentId } }))) throw ApiError.badRequest("Choose a valid department.");
}

export async function create(req, input) {
  await checkUnique(input.title);
  await checkDepartment(input.departmentId);
  const d = await prisma.designation.create({ data: input, include: INCLUDE });
  await audit(req, "DESIGNATION_CREATED", "Designation", d.id, input);
  return out(d);
}

export async function update(req, id, patch) {
  const before = await prisma.designation.findUnique({ where: { id } });
  if (!before) throw ApiError.notFound("Designation not found.");
  if (patch.title) await checkUnique(patch.title, id);
  if (patch.departmentId) await checkDepartment(patch.departmentId);
  const d = await prisma.designation.update({ where: { id }, data: patch, include: INCLUDE });
  const remapped = (patch.departmentId && patch.departmentId !== before.departmentId) || (patch.level && patch.level !== before.level);
  await audit(req, "DESIGNATION_UPDATED", "Designation", id, { before: { departmentId: before.departmentId, level: before.level, title: before.title }, patch, employeesRemapped: remapped ? d._count.users : 0 });
  return out(d);
}

export async function remove(req, id) {
  const d = await prisma.designation.findUnique({ where: { id }, include: { _count: { select: { users: true } } } });
  if (!d) throw ApiError.notFound("Designation not found.");
  if (d._count.users) throw ApiError.conflict("Reassign the employees with this designation first.");
  await prisma.designation.delete({ where: { id } });
  await audit(req, "DESIGNATION_DELETED", "Designation", id, { title: d.title });
}
