// Departments (admin). Creating one also creates its three assessments.

import { prisma } from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";
import { LEVELS, levelPlural } from "../utils/levels.js";
import { audit } from "./audit.service.js";
import { resolve as resolveLocation } from "./location.service.js";

const DEFAULT_PASS = { TEAM_HEAD: 80, SENIOR: 75, JUNIOR: 70 };

export const defaultAssessment = (dept, level) => ({
  id: `asm-${dept.id}-${LEVELS.find((l) => l.enum === level).key}`,
  departmentId: dept.id,
  level,
  title: `${dept.name} · ${levelPlural(level)}`,
  durationSeconds: 600,
  passPercent: DEFAULT_PASS[level],
  marksPerQuestion: 1,
  maxAttempts: 3,
  questionsPerAttempt: 5,
});

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "").slice(0, 40);

export async function list() {
  const rows = await prisma.department.findMany({
    orderBy: { name: "asc" },
    include: {
      designations: { select: { title: true, _count: { select: { users: { where: { role: "EMPLOYEE" } } } } } },
      _count: { select: { materials: { where: { status: { not: "ARCHIVED" } } } } },
      assessments: { select: { _count: { select: { questions: { where: { archivedAt: null } } } } } },
    },
  });
  return rows.map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    head: d.head,
    location: d.location,
    active: d.active,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    designations: d.designations.map((x) => x.title),
    employees: d.designations.reduce((t, x) => t + x._count.users, 0),
    materials: d._count.materials,
    questions: d.assessments.reduce((t, a) => t + a._count.questions, 0),
  }));
}

export async function create(req, input) {
  let id = slug(input.name) || undefined;
  if (id && (await prisma.department.findUnique({ where: { id } }))) id = undefined;
  if (await prisma.department.findFirst({ where: { name: { equals: input.name, mode: "insensitive" } } })) {
    throw ApiError.conflict("A department with this name already exists.");
  }
  input = { ...input, location: await resolveLocation(input.location) };
  const dept = await prisma.$transaction(async (tx) => {
    const d = await tx.department.create({ data: { id, ...input } });
    for (const lv of LEVELS) {
      const a = defaultAssessment(d, lv.enum);
      // Ids are readable when free, generated otherwise.
      if (await tx.assessment.findUnique({ where: { id: a.id } })) delete a.id;
      await tx.assessment.create({ data: a });
    }
    return d;
  });
  await audit(req, "DEPARTMENT_CREATED", "Department", dept.id, { name: dept.name });
  return dept;
}

export async function update(req, id, patch) {
  await getOr404(id);
  if (patch.name && (await prisma.department.findFirst({ where: { id: { not: id }, name: { equals: patch.name, mode: "insensitive" } } }))) {
    throw ApiError.conflict("A department with this name already exists.");
  }
  if ("location" in patch) patch = { ...patch, location: await resolveLocation(patch.location) };
  const dept = await prisma.department.update({ where: { id }, data: patch });
  await audit(req, "DEPARTMENT_UPDATED", "Department", id, patch);
  return dept;
}

// Only an empty department can be deleted; otherwise deactivate it.
export async function remove(req, id) {
  await getOr404(id);
  const [designations, materials, attempts, announcements] = await Promise.all([
    prisma.designation.count({ where: { departmentId: id } }),
    prisma.material.count({ where: { departmentId: id } }),
    prisma.attempt.count({ where: { assessment: { departmentId: id } } }),
    prisma.announcementDepartment.count({ where: { departmentId: id } }),
  ]);
  if (designations) throw ApiError.conflict("Move or delete this department's designations first.");
  if (materials) throw ApiError.conflict("This department still has training materials. Move or delete them first.");
  if (attempts) throw ApiError.conflict("This department has assessment history. Deactivate it instead of deleting it.");
  await prisma.$transaction([
    prisma.questionOption.deleteMany({ where: { question: { assessment: { departmentId: id } } } }),
    prisma.question.deleteMany({ where: { assessment: { departmentId: id } } }),
    prisma.assessment.deleteMany({ where: { departmentId: id } }),
    prisma.department.delete({ where: { id } }),
  ]);
  await audit(req, "DEPARTMENT_DELETED", "Department", id, { announcementsDetached: announcements });
}

async function getOr404(id) {
  const d = await prisma.department.findUnique({ where: { id } });
  if (!d) throw ApiError.notFound("Department not found.");
  return d;
}
