// Employee training: the personalised module (dashboard data), material
// access and reading progress. Everything is derived from the signed-in
// user — the employee never tells the API their department or level.

import { prisma } from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";
import { levelKey, levelPlural } from "../utils/levels.js";
import { materialBaseOut, materialFileUrl, attemptSummaryOut, departmentOut } from "./serializers.js";
import { orgOf, materialWhereFor, reaches, isComplete, assessmentFor, COUNTED_ATTEMPT, GRADED_ATTEMPT } from "./assignment.service.js";
import * as storage from "./storage.service.js";

// End of the current month: the training cycle deadline.
const cycleDue = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59).toISOString();
};

// ── Completion evidence ─────────────────────────────────────────────────────
// A material can only be completed once the server has seen enough of it:
//   • reading time — at least 40% of its estimated minutes (20 s – 10 min),
//     measured by the server from heartbeats; each gap counts for at most
//     PING_CAP seconds, so an idle or closed tab adds nothing and the total
//     can never exceed real time.
//   • manuals / guides — every chapter / section id seen (checked against
//     the material's actual content).
//   • PDFs — the file itself was streamed to this employee.
const PING_CAP = 45;
export const minReadSeconds = (m) => Math.min(600, Math.max(20, Math.round((m.estMinutes ?? 5) * 60 * 0.4)));
const sectionIds = (m) =>
  m.type === "MANUAL" ? (m.content?.chapters ?? []).map((c) => c.id) : m.type === "STRUCTURED_GUIDE" ? (m.content?.sections ?? []).map((s) => s.id) : [];
const AUTO_COMPLETE = ["MANUAL", "STRUCTURED_GUIDE"];

function evidence(p, m) {
  const fresh = !!p && p.trackedRevision === m.revision;
  const ids = sectionIds(m);
  const seen = new Set(fresh && Array.isArray(p.seenSections) ? p.seenSections : []);
  const sectionsSeen = ids.filter((id) => seen.has(id)).length;
  const minSeconds = minReadSeconds(m);
  const activeSeconds = fresh ? p.activeSeconds : 0;
  const fileOpened = m.type !== "PDF" || (fresh && !!p.fileOpenedAt);
  return {
    minSeconds,
    activeSeconds: Math.min(activeSeconds, minSeconds),
    secondsLeft: Math.max(0, minSeconds - activeSeconds),
    sectionsTotal: ids.length,
    sectionsSeen,
    fileOpened,
    met: activeSeconds >= minSeconds && sectionsSeen === ids.length && fileOpened,
  };
}

function notReadMessage(e, m) {
  if (!e.fileOpened) return "Open the PDF and read it before marking it complete.";
  const parts = [];
  if (e.sectionsSeen < e.sectionsTotal) {
    const left = e.sectionsTotal - e.sectionsSeen;
    parts.push(`${left} ${m.type === "MANUAL" ? "chapter" : "section"}${left === 1 ? "" : "s"} still to read`);
  }
  if (e.secondsLeft > 0) parts.push(e.secondsLeft >= 90 ? `about ${Math.ceil(e.secondsLeft / 60)} more minutes of reading` : "a little more reading time");
  return `Not quite done yet: ${parts.join(" and ")}.`;
}

const progressOut = (p, m) => {
  const complete = isComplete(p, m);
  const e = evidence(p, m);
  return {
    opened: !!p,
    completed: complete,
    // Completed an older version that must be read again.
    outdated: !!p?.completed && !complete,
    percent: complete ? 100 : p?.completed ? 0 : p?.percent ?? 0,
    lastOpenedAt: p?.lastOpenedAt ?? null,
    completedAt: complete ? p.completedAt : null,
    completedVersion: p?.completedVersion ?? null,
    canComplete: complete || e.met,
    requirement: { minSeconds: e.minSeconds, activeSeconds: e.activeSeconds, sectionsTotal: e.sectionsTotal, sectionsSeen: e.sectionsSeen, fileOpened: e.fileOpened },
  };
};

// Evidence belongs to one revision: a newer revision (not yet completed)
// starts the count again.
const restartTracking = (m, now) => ({ trackedRevision: m.revision, activeSeconds: 0, seenSections: [], fileOpenedAt: null, lastPingAt: now });

// Recorded by the server whenever an employee loads a material (and, for
// PDFs, when the file itself is streamed).
async function recordOpen(user, m, { file = false } = {}) {
  if (user.role !== "EMPLOYEE") return null;
  const now = new Date();
  const where = { userId_materialId: { userId: user.id, materialId: m.id } };
  const cur = await prisma.materialProgress.findUnique({ where });
  if (!cur) {
    return prisma.materialProgress.create({ data: { userId: user.id, materialId: m.id, lastOpenedAt: now, ...restartTracking(m, now), ...(file ? { fileOpenedAt: now } : {}) } });
  }
  // Re-opening the page starts a new timing window; a file request from the
  // already-open viewer doesn't.
  const data = file ? { lastOpenedAt: now } : { lastOpenedAt: now, lastPingAt: now };
  const restart = cur.trackedRevision !== m.revision && !isComplete(cur, m);
  if (restart) Object.assign(data, restartTracking(m, now));
  if (file && (restart || !cur.fileOpenedAt)) data.fileOpenedAt = now;
  return prisma.materialProgress.update({ where, data });
}

const materialSummary = (m, p) => ({ ...materialBaseOut(m), progress: progressOut(p, m) });

// Number of questions one attempt uses.
export const perAttempt = (assessment, bankSize) => Math.max(0, Math.min(bankSize, assessment?.questionsPerAttempt ?? bankSize));

export const activeQuestionWhere = (assessmentId) => ({ assessmentId, active: true, archivedAt: null });

const BLOCK_ORDER = ["materials", "questions", "attempts"];

// Everything the gate and the dashboard need, computed once.
export async function moduleState(user, db = prisma) {
  const org = orgOf(user);
  const [materials, progress, assessment] = await Promise.all([
    db.material.findMany({ where: materialWhereFor(org), include: { levels: true } }),
    db.materialProgress.findMany({ where: { userId: user.id } }),
    assessmentFor(org, db),
  ]);
  const progressBy = new Map(progress.map((p) => [p.materialId, p]));
  const required = materials.filter((m) => m.required);
  const completedRequired = required.filter((m) => isComplete(progressBy.get(m.id), m)).length;

  let attempts = [];
  let bankSize = 0;
  if (assessment) {
    [attempts, bankSize] = await Promise.all([
      db.attempt.findMany({ where: { userId: user.id, assessmentId: assessment.id, ...COUNTED_ATTEMPT }, orderBy: { startedAt: "desc" } }),
      db.question.count({ where: activeQuestionWhere(assessment.id) }),
    ]);
  }
  const graded = attempts.filter((a) => a.status === "SUBMITTED");
  const inProgress = attempts.find((a) => a.status === "IN_PROGRESS") ?? null;
  const maxAttempts = assessment?.maxAttempts ?? 0;
  const attemptsLeft = Math.max(0, maxAttempts - attempts.length);
  const questionCount = perAttempt(assessment, bankSize);

  const conditions = org
    ? [
        { id: "materials", label: "Finish your required training", detail: `${completedRequired} of ${required.length} complete`, met: completedRequired === required.length },
        { id: "attempts", label: "Have an attempt remaining", detail: assessment ? `${attemptsLeft} of ${maxAttempts} left` : "No test yet", met: attemptsLeft > 0 },
        {
          id: "questions",
          label: "Your test is ready",
          detail: !assessment ? "No test for your level yet" : !assessment.active ? "Your test isn't open yet" : bankSize ? `${questionCount} of ${bankSize} questions per attempt` : "No questions yet",
          met: !!assessment?.active && bankSize > 0,
        },
      ]
    : [];

  // The condition that blocks the test, by priority: training first, then
  // whether a test exists and is open, then attempts. (Without a test there
  // are also "0 attempts left", but that isn't the reason.)
  const blocker = BLOCK_ORDER.map((id) => conditions.find((c) => c.id === id)).find((c) => c && !c.met)?.id ?? null;

  return { org, materials, progressBy, required, completedRequired, assessment, attempts, graded, inProgress, maxAttempts, attemptsLeft, bankSize, questionCount, conditions, blocker, eligible: !!org && conditions.every((c) => c.met) };
}

export async function getModule(user) {
  const s = await moduleState(user);
  const { org, assessment } = s;

  const materials = s.materials
    .map((m) => materialSummary(m, s.progressBy.get(m.id)))
    // Department material first, then company-wide; required before optional.
    .sort((a, b) => (a.scope === b.scope ? Number(b.required) - Number(a.required) || a.title.localeCompare(b.title) : a.scope === "department" ? -1 : 1));

  const passed = s.graded.some((a) => a.passed);
  const best = s.graded.reduce((m, a) => (m && (m.percentage ?? 0) >= (a.percentage ?? 0) ? m : a), null);
  // Announcements are served by GET /announcements (fetched once by the app).
  const recent = await prisma.attempt.findMany({ where: { userId: user.id, ...GRADED_ATTEMPT }, orderBy: { submittedAt: "desc" }, take: 5 });

  return {
    department: org ? departmentOut(org.department) : null,
    designation: org ? { id: org.designation.id, title: org.designation.title, level: levelKey(org.level) } : null,
    level: org ? levelKey(org.level) : null,
    assessment: org
      ? {
          id: assessment?.id ?? null,
          level: levelKey(org.level),
          title: assessment?.title ?? `${org.department.name} · ${levelPlural(org.level)}`,
          description: assessment?.description ?? "",
          active: !!assessment?.active,
          questionCount: s.questionCount,
          bankSize: s.bankSize,
          durationSeconds: assessment?.durationSeconds ?? 0,
          durationMinutes: Math.round((assessment?.durationSeconds ?? 0) / 60),
          passPercent: assessment?.passPercent ?? null,
          maxAttempts: s.maxAttempts,
          attemptsUsed: s.attempts.length,
          attemptsLeft: s.attemptsLeft,
        }
      : null,
    materials,
    requiredCount: s.required.length,
    completedRequired: s.completedRequired,
    completedTotal: materials.filter((m) => m.progress.completed).length,
    readingMinutesLeft: materials.filter((m) => !m.progress.completed).reduce((t, m) => t + m.estMinutes, 0),
    conditions: s.conditions,
    blocker: s.blocker,
    eligible: s.eligible && !s.inProgress,
    passed,
    best: best ? attemptSummaryOut(best) : null,
    lastAttempt: s.graded[0] ? attemptSummaryOut(s.graded[0]) : null,
    activeAttempt: s.inProgress ? { id: s.inProgress.id, expiresAt: s.inProgress.expiresAt } : null,
    stage: !org ? "unassigned" : passed ? "done" : s.completedRequired === s.required.length ? "assess" : "learn",
    dueAt: cycleDue(),
    recentResults: recent.map(attemptSummaryOut),
  };
}

// ── Materials ───────────────────────────────────────────────────────────────

// The material if this user may open it: admins see everything, employees
// only what is assigned to them (403 otherwise — not 404, so the UI can
// explain).
export async function getAccessibleMaterial(user, id) {
  const m = await prisma.material.findUnique({ where: { id }, include: { levels: true, department: { select: { name: true } } } });
  if (!m || (m.status === "ARCHIVED" && user.role === "EMPLOYEE")) throw ApiError.notFound("Material not found.");
  if (user.role !== "EMPLOYEE") return m;
  if (!reaches(m, orgOf(user))) throw ApiError.forbidden("This material isn't part of your training module.", { code: "NOT_ASSIGNED" });
  return m;
}

export async function getMaterial(user, id) {
  const m = await getAccessibleMaterial(user, id);
  const p = await recordOpen(user, m);
  return {
    ...materialSummary(m, p),
    departmentName: m.department?.name ?? null,
    content: m.type === "PDF" ? null : m.content,
    fileUrl: materialFileUrl(m),
    fileName: m.fileName ?? null,
  };
}

export async function openMaterialFile(user, id) {
  const m = await getAccessibleMaterial(user, id);
  if (!m.fileKey || !(await storage.exists(m.fileKey))) throw ApiError.notFound("This material has no file.");
  await recordOpen(user, m, { file: true });
  return { stream: storage.readStream(m.fileKey), fileName: m.fileName || "document.pdf", size: m.fileSize, mime: m.fileMime || "application/pdf" };
}

// A heartbeat from the open viewer: { percent?, seen?, completed? } (an
// empty body is a plain heartbeat). Percent only ever goes up. Completion
// is granted only on server-side evidence (see evidence()): manuals and
// guides complete themselves once it is met; PDFs and media when the
// employee asks and it is met.
export async function updateProgress(user, id, { percent, seen, completed }) {
  if (user.role !== "EMPLOYEE") throw ApiError.forbidden("Only employees track training progress.");
  const m = await getAccessibleMaterial(user, id);
  const now = new Date();
  const where = { userId_materialId: { userId: user.id, materialId: id } };
  const cur = await prisma.materialProgress.findUnique({ where });
  if (!cur) throw ApiError.conflict("Open the material before recording progress.", { code: "NOT_OPENED" });
  if (isComplete(cur, m)) return progressOut(cur, m);

  const outdated = cur.completed; // completed an older revision that must be read again
  const restart = cur.trackedRevision !== m.revision;
  const base = restart ? { activeSeconds: 0, seenSections: [], lastPingAt: now } : cur;
  const data = restart ? restartTracking(m, now) : {};
  if (outdated) Object.assign(data, { completed: false, completedAt: null, percent: 0 });

  const gap = base.lastPingAt ? (now - base.lastPingAt) / 1000 : 0;
  data.activeSeconds = base.activeSeconds + Math.round(Math.min(PING_CAP, Math.max(0, gap)));
  data.lastPingAt = now;
  data.lastOpenedAt = now;
  if (percent != null) data.percent = Math.max(outdated ? 0 : cur.percent, Math.round(percent));
  if (seen?.length) {
    const valid = new Set(sectionIds(m));
    data.seenSections = [...new Set([...(Array.isArray(base.seenSections) ? base.seenSections : []), ...seen.filter((s) => valid.has(s))])];
  }

  const e = evidence({ ...cur, ...data }, m);
  if (e.met && (completed || AUTO_COMPLETE.includes(m.type))) {
    Object.assign(data, { completed: true, percent: 100, completedAt: now, completedRevision: m.revision, completedVersion: m.version });
  }
  const p = await prisma.materialProgress.update({ where, data });
  if (completed && !p.completed) throw ApiError.conflict(notReadMessage(e, m), { code: "NOT_READ_YET", details: progressOut(p, m) });
  return progressOut(p, m);
}
