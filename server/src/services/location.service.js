// Office locations (admin-managed). People and departments store the name;
// a rename updates them, and a location in use can't be deleted.

import { prisma } from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";
import { audit } from "./audit.service.js";

const byName = { orderBy: { name: "asc" } };

// For any signed-in user (profile form).
export async function names() {
  return (await prisma.location.findMany({ ...byName, select: { id: true, name: true } })).map((l) => ({ id: l.id, name: l.name }));
}

// Admin list with how many people and departments use each location.
export async function list() {
  const [rows, users, departments] = await Promise.all([
    prisma.location.findMany(byName),
    prisma.user.groupBy({ by: ["location"], _count: { _all: true } }),
    prisma.department.groupBy({ by: ["location"], _count: { _all: true } }),
  ]);
  const count = (groups, name) => groups.find((g) => g.location === name)?._count._all ?? 0;
  return rows.map((l) => ({ id: l.id, name: l.name, createdAt: l.createdAt, updatedAt: l.updatedAt, users: count(users, l.name), departments: count(departments, l.name) }));
}

// "" means "not set". Anything else must be a known location; returns its
// stored spelling.
export async function resolve(name) {
  if (name == null || name === "") return name;
  const l = await prisma.location.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
  if (!l) throw ApiError.badRequest("Choose one of the office locations.", { code: "UNKNOWN_LOCATION" });
  return l.name;
}

async function checkNameFree(name, exceptId) {
  const clash = await prisma.location.findFirst({ where: { name: { equals: name, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) } });
  if (clash) throw ApiError.conflict("A location with this name already exists.");
}

export async function create(req, { name }) {
  await checkNameFree(name);
  const l = await prisma.location.create({ data: { name } });
  await audit(req, "LOCATION_CREATED", "Location", l.id, { name });
  return l;
}

export async function update(req, id, { name }) {
  const current = await getOr404(id);
  await checkNameFree(name, id);
  const [l, users, departments] = await prisma.$transaction([
    prisma.location.update({ where: { id }, data: { name } }),
    prisma.user.updateMany({ where: { location: current.name }, data: { location: name } }),
    prisma.department.updateMany({ where: { location: current.name }, data: { location: name } }),
  ]);
  await audit(req, "LOCATION_UPDATED", "Location", id, { from: current.name, to: name, users: users.count, departments: departments.count });
  return l;
}

export async function remove(req, id) {
  const l = await getOr404(id);
  const [users, departments] = await Promise.all([prisma.user.count({ where: { location: l.name } }), prisma.department.count({ where: { location: l.name } })]);
  if (users || departments) {
    const parts = [users && `${users} ${users === 1 ? "person" : "people"}`, departments && `${departments} department${departments === 1 ? "" : "s"}`].filter(Boolean);
    throw ApiError.conflict(`${l.name} is still used by ${parts.join(" and ")}. Move them to another location first.`);
  }
  await prisma.location.delete({ where: { id } });
  await audit(req, "LOCATION_DELETED", "Location", id, { name: l.name });
}

async function getOr404(id) {
  const l = await prisma.location.findUnique({ where: { id } });
  if (!l) throw ApiError.notFound("Location not found.");
  return l;
}
