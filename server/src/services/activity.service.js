// Activity log (admin): the audit trail, filtered and paged, newest first.
// Each row says who did what to which record; edits carry the field
// changes recorded at the time (see audit.service.js).

import { prisma } from "../config/db.js";
import { Prisma } from "@prisma/client";

const VIEW_ACTIONS = ["USER_VIEWED", "RESULT_VIEWED", "RESULTS_LISTED", "RESULTS_EXPORTED", "COURSE_PROGRESS_VIEWED"];
const ACCESS_ACTIONS = ["LOGIN_SUCCEEDED", "LOGIN_FAILED", "LOGOUT", "PASSWORD_CHANGED", "PASSWORD_RESET_REQUESTED", "PASSWORD_RESET_COMPLETED", "USER_PASSWORD_RESET"];
const TEST_ACTIONS = ["ATTEMPT_STARTED", "ATTEMPT_SUBMITTED", "USER_ATTEMPTS_RESET", "RESULT_DELETED"];

// kind → which actions it covers (a Prisma `where` on action).
const suffix = (...ends) => ({ OR: ends.map((endsWith) => ({ action: { endsWith } })) });
const KINDS = {
  created: suffix("_CREATED", "_UPLOADED"),
  updated: { AND: [suffix("_UPDATED", "_STATUS_CHANGED"), { action: { notIn: TEST_ACTIONS } }] },
  deleted: { AND: [suffix("_DELETED", "_ARCHIVED"), { action: { notIn: TEST_ACTIONS } }] },
  access: { action: { in: ACCESS_ACTIONS } },
  tests: { action: { in: TEST_ACTIONS } },
  views: { action: { in: VIEW_ACTIONS } },
};

export function kindOf(action) {
  if (VIEW_ACTIONS.includes(action)) return "views";
  if (ACCESS_ACTIONS.includes(action)) return "access";
  if (TEST_ACTIONS.includes(action)) return "tests";
  if (/_(CREATED|UPLOADED)$/.test(action)) return "created";
  if (/_(DELETED|ARCHIVED)$/.test(action)) return "deleted";
  return "updated";
}

// Ids of entries whose record name or actor matches q (case-insensitive).
async function searchIds(q) {
  const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const rows = await prisma.$queryRaw(Prisma.sql`
    SELECT id FROM "AuditLog"
    WHERE meta->>'label' ILIKE ${like} OR meta->>'email' ILIKE ${like}
       OR meta->'actor'->>'name' ILIKE ${like} OR meta->'actor'->>'email' ILIKE ${like}
    ORDER BY "createdAt" DESC LIMIT 5000`);
  return rows.map((r) => r.id);
}

// Current names for entries written before labels were recorded.
const NAME_LOOKUP = {
  User: (ids) => prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }).then((r) => r.map((x) => [x.id, x.name])),
  Department: (ids) => prisma.department.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }).then((r) => r.map((x) => [x.id, x.name])),
  Designation: (ids) => prisma.designation.findMany({ where: { id: { in: ids } }, select: { id: true, title: true } }).then((r) => r.map((x) => [x.id, x.title])),
  Location: (ids) => prisma.location.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }).then((r) => r.map((x) => [x.id, x.name])),
  Material: (ids) => prisma.material.findMany({ where: { id: { in: ids } }, select: { id: true, title: true } }).then((r) => r.map((x) => [x.id, x.title])),
  Course: (ids) => prisma.course.findMany({ where: { id: { in: ids } }, select: { id: true, title: true } }).then((r) => r.map((x) => [x.id, x.title])),
  Assessment: (ids) => prisma.assessment.findMany({ where: { id: { in: ids } }, select: { id: true, title: true } }).then((r) => r.map((x) => [x.id, x.title])),
  Question: (ids) => prisma.question.findMany({ where: { id: { in: ids } }, select: { id: true, text: true } }).then((r) => r.map((x) => [x.id, x.text.length > 90 ? `${x.text.slice(0, 90)}…` : x.text])),
  Announcement: (ids) => prisma.announcement.findMany({ where: { id: { in: ids } }, select: { id: true, title: true } }).then((r) => r.map((x) => [x.id, x.title])),
};

async function currentNames(rows) {
  const want = {};
  for (const r of rows) if (!r.meta?.label && r.entityId && NAME_LOOKUP[r.entityType]) (want[r.entityType] ??= new Set()).add(r.entityId);
  const names = new Map();
  await Promise.all(
    Object.entries(want).map(async ([type, ids]) => {
      for (const [id, name] of await NAME_LOOKUP[type]([...ids])) names.set(`${type}:${id}`, name);
    }),
  );
  return names;
}

const DEVICE = [
  [/Edg\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/Chrome\//, "Chrome"],
  [/Firefox\//, "Firefox"],
  [/Safari\//, "Safari"],
];
const OS = [
  [/Windows/, "Windows"],
  [/Android/, "Android"],
  [/iPhone|iPad/, "iOS"],
  [/Mac OS X/, "macOS"],
  [/Linux/, "Linux"],
];
const pick = (list, ua) => list.find(([re]) => re.test(ua))?.[1];
export function deviceOf(ua) {
  if (!ua) return null;
  const b = pick(DEVICE, ua);
  const o = pick(OS, ua);
  return b || o ? [b, o].filter(Boolean).join(" on ") : ua.slice(0, 60);
}

export async function list(filters = {}) {
  const limit = Math.min(filters.limit ?? 50, 200);
  const and = [];
  if (filters.actorId) and.push({ actorId: filters.actorId });
  if (filters.entityType) and.push({ entityType: filters.entityType });
  if (filters.entityId) and.push({ entityId: filters.entityId });
  if (filters.kind) and.push(KINDS[filters.kind]);
  // Page views are noise in the default view; ask for them explicitly.
  else if (!filters.views) and.push({ action: { notIn: VIEW_ACTIONS } });
  if (filters.from) and.push({ createdAt: { gte: filters.from } });
  if (filters.to) and.push({ createdAt: { lt: new Date(filters.to.getTime() + 86400000) } }); // whole day
  if (filters.q) {
    and.push({
      OR: [
        { id: { in: await searchIds(filters.q) } },
        { actor: { name: { contains: filters.q, mode: "insensitive" } } },
        { actor: { email: { contains: filters.q, mode: "insensitive" } } },
      ],
    });
  }

  const rows = await prisma.auditLog.findMany({
    where: and.length ? { AND: and } : {},
    include: { actor: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
  });
  const page = rows.slice(0, limit);
  const names = await currentNames(page);

  return {
    items: page.map((r) => {
      const { actor: actorSnap, label, changes, ...meta } = r.meta ?? {};
      const actor = r.actor
        ? { id: r.actor.id, name: r.actor.name, email: r.actor.email, role: r.actor.role === "EMPLOYEE" ? "employee" : "admin" }
        : actorSnap
          ? { id: null, name: actorSnap.name, email: actorSnap.email, role: null, deleted: true }
          : null;
      return {
        id: r.id,
        at: r.createdAt,
        action: r.action,
        kind: kindOf(r.action),
        entityType: r.entityType,
        entityId: r.entityId,
        label: label ?? meta.title ?? meta.name ?? names.get(`${r.entityType}:${r.entityId}`) ?? meta.email ?? null,
        actor,
        changes: changes && Object.keys(changes).length ? changes : null,
        meta,
        ip: r.ip,
        device: deviceOf(r.userAgent),
      };
    }),
    nextCursor: rows.length > limit ? page[page.length - 1].id : null,
  };
}

// Everyone who appears in the log, for the "Who" filter.
export async function actors() {
  const ids = (await prisma.auditLog.groupBy({ by: ["actorId"], where: { actorId: { not: null } } })).map((r) => r.actorId);
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true, role: true }, orderBy: { name: "asc" } });
  return users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role === "EMPLOYEE" ? "employee" : "admin" }));
}
