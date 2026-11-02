// Video courses ("Study Materials"): admin CRUD, the employee course list
// and player, per-video progress and the course-completion rule used by the
// assessment gate.
//
// Progress is credited by the server. The player reports which parts were
// watched; the server adds at most (time since the last heartbeat, capped)
// × 2 seconds of new coverage per heartbeat, so watching can't be claimed
// faster than real time at 2× speed. A video is complete at 90% watched; a
// course when every video is.

import { prisma } from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";
import { levelsFromApi, levelsToApi, levelPlural, LEVELS } from "../utils/levels.js";
import { addWatched, covered, mergeRanges } from "../utils/ranges.js";
import { orgOf, reaches } from "./assignment.service.js";
import { USER_ORG_INCLUDE } from "./serializers.js";
import { audit } from "./audit.service.js";

export const COMPLETE_AT = 0.9;
const PING_CAP = 40; // seconds credited per heartbeat gap at most
const MAX_RATE = 2; // fastest YouTube playback speed we credit
const SLACK = 3;

const STRUCTURE = {
  levels: true,
  department: { select: { name: true } },
  sections: { orderBy: { position: "asc" }, include: { lessons: { orderBy: { position: "asc" } } } },
};

const apiStatus = (s) => s.toLowerCase();
const levelsLabel = (enums) => (enums.length >= LEVELS.length ? "All levels" : LEVELS.filter((l) => enums.includes(l.enum)).map((l) => levelPlural(l.enum)).join(", "));
const lessonsOf = (c) => c.sections.flatMap((s) => s.lessons);

// Prisma `where` for the courses an employee may see.
export function courseWhereFor(org) {
  if (!org) return { status: "PUBLISHED", departmentId: null };
  return { status: "PUBLISHED", OR: [{ departmentId: null }, { departmentId: org.departmentId }], levels: { some: { level: org.level } } };
}

const lessonOut = (l, p) => ({
  id: l.id,
  title: l.title,
  description: l.description,
  youtubeId: l.youtubeId,
  durationSeconds: l.durationSeconds,
  ...(p !== undefined
    ? {
        progress: {
          opened: !!p,
          completed: !!p?.completed,
          watchedSeconds: p ? Math.min(l.durationSeconds, Math.round(p.watchedSeconds)) : 0,
          percent: p ? (p.completed ? 100 : Math.min(99, Math.floor((p.watchedSeconds / l.durationSeconds) * 100))) : 0,
          position: p?.position ?? 0,
          lastWatchedAt: p?.lastPingAt ?? null,
        },
      }
    : {}),
});

function summary(c, progressBy) {
  const lessons = lessonsOf(c);
  const done = lessons.filter((l) => progressBy?.get(l.id)?.completed).length;
  const watched = lessons.reduce((t, l) => t + Math.min(l.durationSeconds, progressBy?.get(l.id)?.watchedSeconds ?? 0), 0);
  const total = lessons.reduce((t, l) => t + l.durationSeconds, 0);
  return {
    lessonsTotal: lessons.length,
    lessonsCompleted: done,
    durationSeconds: total,
    // Course % = share of videos completed (as on Udemy).
    percent: lessons.length ? Math.round((done / lessons.length) * 100) : 0,
    watchedSeconds: Math.round(watched),
    completed: lessons.length > 0 && done === lessons.length,
  };
}

const courseBase = (c) => ({
  id: c.id,
  title: c.title,
  description: c.description,
  departmentId: c.departmentId,
  departmentName: c.departmentId ? c.department?.name ?? "—" : "All departments",
  scope: c.departmentId ? "department" : "company",
  required: c.required,
  status: apiStatus(c.status),
  levels: levelsToApi(c.levels.map((l) => l.level)),
  levelsLabel: levelsLabel(c.levels.map((l) => l.level)),
  author: c.author,
  updatedAt: c.updatedAt,
  sectionsCount: c.sections.length,
  thumbnail: lessonsOf(c)[0]?.youtubeId ?? null,
});

// ── Completion (assessment gate, admin tables) ──────────────────────────────

// For many users at once: (userId, course) → completed?
export async function courseCompletion(userIds, courses, db = prisma) {
  const lessonIds = courses.flatMap(lessonsOf).map((l) => l.id);
  const rows = lessonIds.length && userIds.length ? await db.lessonProgress.findMany({ where: { userId: { in: userIds }, lessonId: { in: lessonIds }, completed: true }, select: { userId: true, lessonId: true } }) : [];
  const done = new Set(rows.map((r) => `${r.userId}:${r.lessonId}`));
  return (userId, course) => {
    const lessons = lessonsOf(course);
    return lessons.length > 0 && lessons.every((l) => done.has(`${userId}:${l.id}`));
  };
}

// Required, published courses (with structure) — filter with reaches().
export const requiredCourses = (db = prisma) => db.course.findMany({ where: { status: "PUBLISHED", required: true }, include: { levels: true, sections: { include: { lessons: { select: { id: true } } } } } });

// ── Admin ───────────────────────────────────────────────────────────────────

async function checkDepartment(departmentId) {
  if (departmentId && !(await prisma.department.findUnique({ where: { id: departmentId } }))) throw ApiError.badRequest("Choose a valid department.");
}

export async function list() {
  const [courses, employees] = await Promise.all([
    prisma.course.findMany({ where: { status: { not: "ARCHIVED" } }, include: STRUCTURE, orderBy: { updatedAt: "desc" } }),
    prisma.user.findMany({ where: { role: "EMPLOYEE", status: "ACTIVE" }, include: USER_ORG_INCLUDE }),
  ]);
  const orgs = employees.map((u) => ({ id: u.id, org: orgOf(u) }));
  const isDone = await courseCompletion(orgs.map((o) => o.id), courses);
  return courses.map((c) => {
    const audience = orgs.filter((o) => reaches({ ...c, status: "PUBLISHED" }, o.org));
    const lessons = lessonsOf(c);
    return {
      ...courseBase(c),
      lessonsCount: lessons.length,
      durationSeconds: lessons.reduce((t, l) => t + l.durationSeconds, 0),
      audience: audience.length,
      completed: audience.filter((o) => isDone(o.id, c)).length,
    };
  });
}

export async function get(id) {
  const c = await prisma.course.findUnique({ where: { id }, include: STRUCTURE });
  if (!c) throw ApiError.notFound("Course not found.");
  return { ...courseBase(c), sections: c.sections.map((s) => ({ id: s.id, title: s.title, lessons: s.lessons.map((l) => lessonOut(l)) })) };
}

// Writes the section/lesson tree. Existing ids (within this course) are
// updated in place so progress stays attached; the rest is created; what's
// no longer listed is deleted (with its progress).
async function writeStructure(tx, courseId, sections) {
  const existing = await tx.courseSection.findMany({ where: { courseId }, include: { lessons: { select: { id: true } } } });
  const sectionIds = new Set(existing.map((s) => s.id));
  const lessonIds = new Set(existing.flatMap((s) => s.lessons.map((l) => l.id)));
  const keptSections = new Set();
  const keptLessons = new Set();

  for (const [si, s] of sections.entries()) {
    const sec = s.id && sectionIds.has(s.id)
      ? await tx.courseSection.update({ where: { id: s.id }, data: { title: s.title, position: si } })
      : await tx.courseSection.create({ data: { courseId, title: s.title, position: si } });
    keptSections.add(sec.id);
    for (const [li, l] of s.lessons.entries()) {
      const data = { sectionId: sec.id, title: l.title, description: l.description, youtubeId: l.video, durationSeconds: l.durationSeconds, position: li };
      const row = l.id && lessonIds.has(l.id) ? await tx.courseLesson.update({ where: { id: l.id }, data }) : await tx.courseLesson.create({ data });
      keptLessons.add(row.id);
    }
  }
  await tx.courseLesson.deleteMany({ where: { section: { courseId }, id: { notIn: [...keptLessons] } } });
  await tx.courseSection.deleteMany({ where: { courseId, id: { notIn: [...keptSections] } } });
}

export async function create(req, input) {
  await checkDepartment(input.departmentId);
  const c = await prisma.$transaction(async (tx) => {
    const course = await tx.course.create({
      data: {
        title: input.title,
        description: input.description,
        departmentId: input.departmentId,
        required: input.required,
        status: input.status.toUpperCase(),
        author: req.user.name,
        createdById: req.user.id,
        levels: { create: levelsFromApi(input.levels).map((level) => ({ level })) },
      },
    });
    await writeStructure(tx, course.id, input.sections);
    return course;
  });
  await audit(req, "COURSE_CREATED", "Course", c.id, { title: c.title, status: input.status });
  return get(c.id);
}

export async function update(req, id, patch) {
  const c = await prisma.course.findUnique({ where: { id } });
  if (!c) throw ApiError.notFound("Course not found.");
  if ("departmentId" in patch) await checkDepartment(patch.departmentId);
  const data = {};
  for (const k of ["title", "description", "departmentId", "required"]) if (k in patch) data[k] = patch[k];
  if (patch.status) data.status = patch.status.toUpperCase();
  await prisma.$transaction(async (tx) => {
    if (patch.levels) {
      await tx.courseLevel.deleteMany({ where: { courseId: id } });
      await tx.courseLevel.createMany({ data: levelsFromApi(patch.levels).map((level) => ({ courseId: id, level })) });
    }
    if (patch.sections) await writeStructure(tx, id, patch.sections);
    await tx.course.update({ where: { id }, data });
  });
  await audit(req, "COURSE_UPDATED", "Course", id, { fields: Object.keys(patch).filter((k) => k !== "sections"), structureChanged: !!patch.sections });
  return get(id);
}

// Courses someone has started are archived (activity kept); untouched ones
// are deleted.
export async function remove(req, id) {
  const c = await prisma.course.findUnique({ where: { id } });
  if (!c) throw ApiError.notFound("Course not found.");
  const used = await prisma.lessonProgress.count({ where: { lesson: { section: { courseId: id } } } });
  if (used) {
    await prisma.course.update({ where: { id }, data: { status: "ARCHIVED" } });
    await audit(req, "COURSE_ARCHIVED", "Course", id, { title: c.title });
    return { archived: true };
  }
  await prisma.course.delete({ where: { id } });
  await audit(req, "COURSE_DELETED", "Course", id, { title: c.title });
  return { deleted: true };
}

// Every employee the course reaches, with each video's activity.
export async function progressReport(req, id) {
  const c = await prisma.course.findUnique({ where: { id }, include: STRUCTURE });
  if (!c) throw ApiError.notFound("Course not found.");
  const lessons = lessonsOf(c);
  const employees = (await prisma.user.findMany({ where: { role: "EMPLOYEE", status: "ACTIVE" }, include: USER_ORG_INCLUDE, orderBy: { name: "asc" } })).filter((u) => reaches({ ...c, status: "PUBLISHED" }, orgOf(u)));
  const rows = await prisma.lessonProgress.findMany({ where: { lessonId: { in: lessons.map((l) => l.id) }, userId: { in: employees.map((u) => u.id) } } });
  const by = new Map(rows.map((r) => [`${r.userId}:${r.lessonId}`, r]));
  await audit(req, "COURSE_PROGRESS_VIEWED", "Course", id);
  return {
    course: { id: c.id, title: c.title, lessonsTotal: lessons.length },
    sections: c.sections.map((s) => ({ id: s.id, title: s.title, lessons: s.lessons.map((l) => ({ id: l.id, title: l.title, durationSeconds: l.durationSeconds })) })),
    employees: employees.map((u) => {
      const mine = new Map(lessons.map((l) => [l.id, by.get(`${u.id}:${l.id}`)]));
      const s = summary(c, mine);
      const last = [...mine.values()].filter(Boolean).sort((a, b) => b.lastPingAt - a.lastPingAt)[0];
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        designation: u.designation?.title ?? null,
        ...s,
        opened: [...mine.values()].filter(Boolean).length,
        lastWatchedAt: last?.lastPingAt ?? null,
        lessons: lessons.map((l) => ({ id: l.id, ...lessonOut(l, mine.get(l.id) ?? null).progress })),
      };
    }),
  };
}

// ── Employee ────────────────────────────────────────────────────────────────

async function progressMap(userId, lessonIds) {
  const rows = lessonIds.length ? await prisma.lessonProgress.findMany({ where: { userId, lessonId: { in: lessonIds } } }) : [];
  return new Map(rows.map((r) => [r.lessonId, r]));
}

export async function listForEmployee(user) {
  const courses = await prisma.course.findMany({ where: courseWhereFor(orgOf(user)), include: STRUCTURE, orderBy: [{ required: "desc" }, { title: "asc" }] });
  const progress = await progressMap(user.id, courses.flatMap(lessonsOf).map((l) => l.id));
  return courses.map((c) => {
    const s = summary(c, progress);
    const next = lessonsOf(c).find((l) => !progress.get(l.id)?.completed) ?? lessonsOf(c)[0];
    return { ...courseBase(c), ...s, nextLessonId: next?.id ?? null, started: lessonsOf(c).some((l) => progress.has(l.id)) };
  });
}

async function accessibleCourse(user, id) {
  const c = await prisma.course.findUnique({ where: { id }, include: STRUCTURE });
  if (!c || (c.status !== "PUBLISHED" && user.role === "EMPLOYEE")) throw ApiError.notFound("Course not found.");
  if (user.role === "EMPLOYEE" && !reaches(c, orgOf(user))) throw ApiError.forbidden("This course isn't assigned to you.", { code: "NOT_ASSIGNED" });
  return c;
}

export async function getForEmployee(user, id) {
  const c = await accessibleCourse(user, id);
  const progress = await progressMap(user.id, lessonsOf(c).map((l) => l.id));
  return {
    ...courseBase(c),
    ...summary(c, progress),
    sections: c.sections.map((s) => {
      const ls = s.lessons.map((l) => lessonOut(l, progress.get(l.id) ?? null));
      return { id: s.id, title: s.title, lessons: ls, completed: ls.filter((l) => l.progress.completed).length, durationSeconds: ls.reduce((t, l) => t + l.durationSeconds, 0) };
    }),
  };
}

// Heartbeat from the player for one video: { ranges?, position? }. The
// first call (also with an empty body) records that the video was opened.
export async function recordLessonProgress(user, lessonId, { ranges, position }) {
  if (user.role !== "EMPLOYEE") throw ApiError.forbidden("Only employees track course progress.");
  const lesson = await prisma.courseLesson.findUnique({ where: { id: lessonId }, include: { section: { select: { courseId: true } } } });
  if (!lesson) throw ApiError.notFound("Video not found.");
  const course = await accessibleCourse(user, lesson.section.courseId);
  const now = new Date();
  const where = { userId_lessonId: { userId: user.id, lessonId } };
  const cur = await prisma.lessonProgress.findUnique({ where });
  const max = lesson.durationSeconds;

  let p;
  if (!cur) {
    p = await prisma.lessonProgress.create({ data: { userId: user.id, lessonId, openedAt: now, lastPingAt: now, position: Math.min(max, Math.round(position ?? 0)) } });
  } else {
    const gap = Math.min(PING_CAP, Math.max(0, (now - cur.lastPingAt) / 1000));
    const merged = ranges?.length ? addWatched(cur.watchedRanges, ranges, gap * MAX_RATE + SLACK, max) : mergeRanges(cur.watchedRanges, max);
    const watched = Math.min(max, covered(merged));
    const completed = cur.completed || watched >= max * COMPLETE_AT;
    p = await prisma.lessonProgress.update({
      where,
      data: {
        lastPingAt: now,
        watchedRanges: merged,
        watchedSeconds: Math.round(watched),
        ...(position != null ? { position: Math.min(max, Math.round(position)) } : {}),
        ...(completed && !cur.completed ? { completed: true, completedAt: now } : {}),
      },
    });
  }
  const progress = await progressMap(user.id, lessonsOf(course).map((l) => l.id));
  return { lesson: lessonOut(lesson, p), course: summary(course, progress) };
}
