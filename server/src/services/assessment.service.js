// The assessment engine. Eligibility, question selection, the timer,
// grading and results all happen here — the browser only displays them.
//
// Timer: expiresAt = startedAt + duration, fixed at start. The clock keeps
// running while the candidate is away. A short grace period absorbs network
// latency; after it, the attempt is graded with the answers autosaved before
// the deadline and flagged auto-submitted — whether the browser submits late,
// or never comes back (finalised lazily on the user's next request).

import { prisma } from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";
import { levelKey } from "../utils/levels.js";
import { attemptSummaryOut } from "./serializers.js";
import { moduleState, activeQuestionWhere } from "./training.service.js";
import { pickQuestions, recencyMap } from "./questionPicker.service.js";
import { grade, validateAnswers } from "./scoring.service.js";
import { departmentStanding } from "./ranking.service.js";
import { COUNTED_ATTEMPT } from "./assignment.service.js";

export const GRACE_SECONDS = 30;

// Why a test can't start, per blocking condition (code and
// details.condition stay as they are for the frontend).
export const NOT_ELIGIBLE_MESSAGE = {
  materials: "Finish your required training first.",
  attempts: "You've used all your attempts. Your training admin can give you another one.",
  questions: "This test isn't ready yet. Ask your training admin.",
};

const graceEnd = (a) => new Date(a.expiresAt.getTime() + GRACE_SECONDS * 1000);
const isLate = (a, now = new Date()) => now > graceEnd(a);

const WITH_QUESTIONS = { questions: { orderBy: { position: "asc" } }, answers: true };

// ── Payloads ────────────────────────────────────────────────────────────────

// A running attempt for the candidate. No answer key, no explanations.
function runningOut(a, user) {
  const c = a.config;
  const now = new Date();
  const saved = {};
  for (const ans of a.answers) if (ans.selectedOptionId) saved[ans.attemptQuestionId] = ans.selectedOptionId;
  return {
    attemptId: a.id,
    id: a.id,
    status: "in_progress",
    userId: a.userId,
    name: user.name,
    designation: c.designation,
    departmentId: c.departmentId,
    departmentName: c.departmentName,
    assessmentId: a.assessmentId,
    assessmentTitle: c.title,
    level: c.level,
    durationSeconds: c.durationSeconds,
    passPercent: c.passPercent,
    marksPerQuestion: c.marksPerQuestion,
    attemptNumber: c.displayNumber ?? a.attemptNumber,
    maxAttempts: c.maxAttempts,
    startedAt: a.startedAt,
    expiresAt: a.expiresAt,
    serverNow: now,
    remainingSeconds: Math.max(0, Math.round((a.expiresAt - now) / 1000)),
    focusViolations: a.focusViolations,
    answers: saved,
    questions: a.questions.map((q) => ({ id: q.id, text: q.text, options: q.options.map((o) => ({ id: o.id, text: o.text })) })),
  };
}

// ── Grading (shared by submit and auto-finalise) ────────────────────────────

// Grades and closes an IN_PROGRESS attempt exactly once. The conditional
// update is the claim: a concurrent second call updates 0 rows and does nothing.
async function finalize(tx, attempt, answers, { focusViolations, autoSubmitted }) {
  const now = new Date();
  const claimed = await tx.attempt.updateMany({ where: { id: attempt.id, status: "IN_PROGRESS" }, data: { status: "SUBMITTED", submittedAt: now } });
  if (claimed.count !== 1) return false;

  const c = attempt.config;
  const result = grade({ questions: attempt.questions, answers, marksPerQuestion: c.marksPerQuestion, passPercent: c.passPercent });
  await tx.attemptAnswer.deleteMany({ where: { attemptId: attempt.id } });
  await tx.attemptAnswer.createMany({
    data: result.perQuestion
      .filter((p) => p.selectedOptionId !== null)
      .map((p) => ({ attemptId: attempt.id, attemptQuestionId: p.attemptQuestionId, selectedOptionId: p.selectedOptionId, isCorrect: p.isCorrect, answeredAt: now })),
  });
  const end = now < attempt.expiresAt ? now : attempt.expiresAt;
  await tx.attempt.update({
    where: { id: attempt.id },
    data: {
      timeTakenSeconds: Math.max(0, Math.round((end - attempt.startedAt) / 1000)),
      focusViolations: Math.max(attempt.focusViolations, focusViolations ?? 0),
      autoSubmitted,
      marks: result.marks,
      totalMarks: result.totalMarks,
      correctCount: result.correct,
      incorrectCount: result.incorrect,
      unansweredCount: result.unanswered,
      percentage: result.percentage,
      passed: result.passed,
    },
  });
  return true;
}

const savedAnswers = (a) => Object.fromEntries(a.answers.filter((x) => x.selectedOptionId).map((x) => [x.attemptQuestionId, x.selectedOptionId]));

// Auto-submit any of this user's attempts whose time (plus grace) is up.
export async function finalizeExpired(userId, db = prisma) {
  const expired = await db.attempt.findMany({
    where: { userId, status: "IN_PROGRESS", expiresAt: { lt: new Date(Date.now() - GRACE_SECONDS * 1000) } },
    include: WITH_QUESTIONS,
  });
  for (const a of expired) {
    const run = (tx) => finalize(tx, a, savedAnswers(a), { autoSubmitted: true });
    if (db === prisma) await prisma.$transaction(run);
    else await run(db);
  }
  return expired.length;
}

// ── Start / resume ──────────────────────────────────────────────────────────

export async function start(user) {
  if (user.role !== "EMPLOYEE") throw ApiError.forbidden("Only employees take assessments.");

  return prisma.$transaction(
    async (tx) => {
      // One start at a time per user: double clicks / parallel tabs can't
      // create two attempts or exceed the attempt limit.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${user.id}))`;
      await finalizeExpired(user.id, tx);

      const s = await moduleState(user, tx);
      if (s.inProgress) {
        const running = await tx.attempt.findUnique({ where: { id: s.inProgress.id }, include: WITH_QUESTIONS });
        return { ...runningOut(running, user), resumed: true };
      }
      if (!s.org) throw ApiError.forbidden("No test is assigned to your designation.", { code: "NOT_ASSIGNED" });
      if (!s.eligible) {
        throw ApiError.forbidden(NOT_ELIGIBLE_MESSAGE[s.blocker] ?? "You can't start the test yet.", { code: "NOT_ELIGIBLE", details: { condition: s.blocker } });
      }

      const a = s.assessment;
      const [bank, past, allTime] = await Promise.all([
        tx.question.findMany({ where: activeQuestionWhere(a.id), include: { options: true }, orderBy: { createdAt: "asc" } }),
        tx.attempt.findMany({ where: { userId: user.id, assessmentId: a.id }, orderBy: { startedAt: "desc" }, select: { questions: { select: { questionId: true } } } }),
        tx.attempt.count({ where: { userId: user.id, assessmentId: a.id } }),
      ]);
      const picked = pickQuestions({
        bank,
        lastSeen: recencyMap(past.map((p) => ({ questionIds: p.questions.map((q) => q.questionId) }))),
        count: s.questionCount,
        shuffle: a.shuffle,
      });
      if (!picked.length) throw ApiError.forbidden("Your test has no usable questions yet.", { code: "NOT_ELIGIBLE" });

      const now = new Date();
      const created = await tx.attempt.create({
        data: {
          userId: user.id,
          assessmentId: a.id,
          attemptNumber: allTime + 1,
          startedAt: now,
          expiresAt: new Date(now.getTime() + a.durationSeconds * 1000),
          totalQuestions: picked.length,
          config: {
            title: a.title,
            departmentId: s.org.departmentId,
            departmentName: s.org.department.name,
            level: levelKey(a.level),
            designation: s.org.designation.title,
            durationSeconds: a.durationSeconds,
            passPercent: a.passPercent,
            marksPerQuestion: a.marksPerQuestion,
            maxAttempts: a.maxAttempts,
            questionsPerAttempt: a.questionsPerAttempt,
            shuffle: a.shuffle,
            displayNumber: s.attempts.length + 1,
          },
          questions: {
            create: picked.map((q, position) => ({
              questionId: q.questionId,
              position,
              text: q.text,
              explanation: q.explanation,
              options: q.options,
              correctOptionId: q.correctOptionId,
            })),
          },
        },
        include: WITH_QUESTIONS,
      });
      return runningOut(created, user);
    },
    { timeout: 15000 },
  );
}

// The running attempt (after a reload), or null.
export async function getActive(user) {
  await finalizeExpired(user.id);
  const a = await prisma.attempt.findFirst({ where: { userId: user.id, status: "IN_PROGRESS", ...COUNTED_ATTEMPT }, include: WITH_QUESTIONS });
  return a ? runningOut(a, user) : null;
}

export async function activeAttemptId(userId) {
  await finalizeExpired(userId);
  const a = await prisma.attempt.findFirst({ where: { userId, status: "IN_PROGRESS", ...COUNTED_ATTEMPT }, select: { id: true } });
  return a?.id ?? null;
}

async function ownAttempt(user, id) {
  const a = await prisma.attempt.findUnique({ where: { id }, include: WITH_QUESTIONS });
  // Someone else's attempt is indistinguishable from a missing one.
  if (!a || a.userId !== user.id) throw ApiError.notFound("Attempt not found.");
  return a;
}

// ── Autosave ────────────────────────────────────────────────────────────────

export async function saveAnswers(user, id, { answers, focus_violations }) {
  const a = await ownAttempt(user, id);
  if (a.status !== "IN_PROGRESS" || a.voidedAt) throw ApiError.conflict("This attempt is no longer running.", { code: "ATTEMPT_CLOSED" });
  if (isLate(a)) {
    await finalizeExpired(user.id);
    throw ApiError.conflict("Time is up — your test has been submitted.", { code: "TIME_UP" });
  }
  const clean = validateAnswers(a.questions, answers);
  const now = new Date();
  await prisma.$transaction([
    ...Object.entries(answers)
      .filter(([, v]) => v == null)
      .map(([qid]) => prisma.attemptAnswer.deleteMany({ where: { attemptId: id, attemptQuestionId: qid } })),
    ...Object.entries(clean).map(([qid, optionId]) =>
      prisma.attemptAnswer.upsert({
        where: { attemptQuestionId: qid },
        create: { attemptId: id, attemptQuestionId: qid, selectedOptionId: optionId, answeredAt: now },
        update: { selectedOptionId: optionId, answeredAt: now },
      }),
    ),
    prisma.attempt.update({ where: { id }, data: { focusViolations: Math.max(a.focusViolations, focus_violations ?? 0) } }),
  ]);
  return { saved: Object.keys(clean).length, remainingSeconds: Math.max(0, Math.round((a.expiresAt - now) / 1000)) };
}

// ── Submit ──────────────────────────────────────────────────────────────────

export async function submit(user, id, body) {
  const a = await ownAttempt(user, id);
  if (a.voidedAt) throw ApiError.conflict("This attempt was reset by an administrator.", { code: "ATTEMPT_VOIDED" });
  if (a.status === "SUBMITTED") return { ...(await getResult(user, id)), alreadySubmitted: true };

  validateAnswers(a.questions, body.answers); // reject bad ids before claiming
  const late = isLate(a);
  // On time: the submitted answers (over anything autosaved). Late: only
  // what was saved before the deadline counts.
  const answers = late ? savedAnswers(a) : { ...savedAnswers(a), ...body.answers };
  const graded = await prisma.$transaction((tx) =>
    finalize(tx, a, answers, { focusViolations: body.focus_violations, autoSubmitted: late || !!body.auto_submitted }),
  );
  const result = await getResult(user, id);
  return graded ? result : { ...result, alreadySubmitted: true };
}

// ── Results ─────────────────────────────────────────────────────────────────

function reviewOut(a) {
  const chosenBy = new Map(a.answers.map((x) => [x.attemptQuestionId, x.selectedOptionId]));
  return a.questions.map((q) => {
    const chosenId = chosenBy.get(q.id) ?? null;
    const chosen = chosenId ? q.options.findIndex((o) => o.id === chosenId) : -1;
    const correctIndex = q.options.findIndex((o) => o.id === q.correctOptionId);
    return {
      id: q.id,
      questionId: q.questionId,
      text: q.text,
      options: q.options.map((o) => o.text),
      chosen: chosen >= 0 ? chosen : null,
      correctIndex,
      isCorrect: chosen >= 0 && chosen === correctIndex,
      explanation: q.explanation,
    };
  });
}

// viewer: the owner, or an admin (opts.admin).
export async function getResult(viewer, id, { admin = false } = {}) {
  const a = await prisma.attempt.findUnique({ where: { id }, include: { ...WITH_QUESTIONS, user: { select: { name: true, email: true, employeeCode: true } } } });
  if (!a || (!admin && a.userId !== viewer.id)) throw ApiError.notFound("Result not found.");
  if (a.status !== "SUBMITTED") throw ApiError.conflict("This attempt is still running.", { code: "ATTEMPT_RUNNING" });

  const [standing, history] = await Promise.all([
    departmentStanding(a.config?.departmentId, a.userId),
    prisma.attempt.findMany({ where: { userId: a.userId, assessmentId: a.assessmentId, status: "SUBMITTED", ...(admin ? {} : COUNTED_ATTEMPT) }, orderBy: { submittedAt: "desc" } }),
  ]);
  return {
    ...attemptSummaryOut(a),
    questionIds: a.questions.map((q) => q.id),
    review: reviewOut(a),
    standing,
    history: history.map(attemptSummaryOut),
    certificate: a.passed && !a.voidedAt ? { available: true, url: `/api/v1/training/attempts/${a.id}/certificate` } : { available: false, url: null },
    ...(admin ? { userName: a.user.name, userEmail: a.user.email, userCode: a.user.employeeCode } : {}),
  };
}

export async function listMine(user) {
  await finalizeExpired(user.id);
  const rows = await prisma.attempt.findMany({ where: { userId: user.id, status: "SUBMITTED", ...COUNTED_ATTEMPT }, orderBy: { submittedAt: "desc" } });
  return rows.map(attemptSummaryOut);
}
