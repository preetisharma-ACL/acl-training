// Assessments and question banks (admin). The only place answer keys are
// read for display — employee-facing code never selects isCorrect.

import { prisma } from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";
import { levelKey, levelPlural, toLevelEnum } from "../utils/levels.js";
import { GRADED_ATTEMPT } from "./assignment.service.js";
import { defaultAssessment } from "./department.service.js";
import { audit } from "./audit.service.js";

export function assessmentSettingsOut(a) {
  return {
    id: a.id,
    departmentId: a.departmentId,
    level: levelKey(a.level),
    title: a.title,
    description: a.description,
    durationSeconds: a.durationSeconds,
    durationMinutes: Math.round(a.durationSeconds / 60),
    passPercent: a.passPercent,
    marksPerQuestion: a.marksPerQuestion,
    maxAttempts: a.maxAttempts,
    questionsPerAttempt: a.questionsPerAttempt,
    shuffle: a.shuffle,
    active: a.active,
    updatedAt: a.updatedAt,
  };
}

export async function list({ departmentId } = {}) {
  const [assessments, designations, employees, attempts] = await Promise.all([
    prisma.assessment.findMany({
      where: departmentId ? { departmentId } : {},
      include: { department: { select: { name: true } }, _count: { select: { questions: { where: { archivedAt: null, active: true } } } } },
      orderBy: [{ department: { name: "asc" } }, { level: "asc" }],
    }),
    prisma.designation.findMany({ select: { title: true, departmentId: true, level: true } }),
    prisma.user.findMany({ where: { role: "EMPLOYEE", designationId: { not: null } }, select: { designation: { select: { departmentId: true, level: true } } } }),
    prisma.attempt.groupBy({ by: ["assessmentId"], where: GRADED_ATTEMPT, _count: { _all: true }, _avg: { percentage: true } }),
  ]);
  const passed = await prisma.attempt.groupBy({ by: ["assessmentId"], where: { ...GRADED_ATTEMPT, passed: true }, _count: { _all: true } });
  const statsBy = new Map(attempts.map((s) => [s.assessmentId, s]));
  const passedBy = new Map(passed.map((s) => [s.assessmentId, s._count._all]));

  return assessments.map((a) => {
    const s = statsBy.get(a.id);
    const n = s?._count._all ?? 0;
    return {
      ...assessmentSettingsOut(a),
      name: `${a.department.name} · ${levelPlural(a.level)}`,
      departmentName: a.department.name,
      levelLabel: levelPlural(a.level),
      designations: designations.filter((d) => d.departmentId === a.departmentId && d.level === a.level).map((d) => d.title),
      employees: employees.filter((u) => u.designation.departmentId === a.departmentId && u.designation.level === a.level).length,
      questions: a._count.questions,
      attempts: n,
      avgScore: n ? Math.round(s._avg.percentage) : null,
      passRate: n ? Math.round(((passedBy.get(a.id) ?? 0) / n) * 100) : null,
    };
  });
}

const toData = (input) => {
  const data = {};
  for (const k of ["title", "description", "passPercent", "marksPerQuestion", "maxAttempts", "questionsPerAttempt", "shuffle", "active"]) if (k in input) data[k] = input[k];
  if ("durationSeconds" in input) data.durationSeconds = input.durationSeconds;
  else if ("durationMinutes" in input) data.durationSeconds = input.durationMinutes * 60;
  return data;
};

export async function create(req, input) {
  const dept = await prisma.department.findUnique({ where: { id: input.departmentId } });
  if (!dept) throw ApiError.badRequest("Choose a valid department.");
  const level = toLevelEnum(input.level);
  if (await prisma.assessment.findUnique({ where: { departmentId_level: { departmentId: dept.id, level } } })) {
    throw ApiError.conflict("This department already has an assessment for that level.");
  }
  const base = defaultAssessment(dept, level);
  if (await prisma.assessment.findUnique({ where: { id: base.id } })) delete base.id;
  const a = await prisma.assessment.create({ data: { ...base, ...toData(input) } });
  await audit(req, "ASSESSMENT_CREATED", "Assessment", a.id, { departmentId: dept.id, level });
  return assessmentSettingsOut(a);
}

// Settings changes apply to new attempts only: running and past attempts
// keep the snapshot they started with.
export async function update(req, id, patch) {
  const before = await prisma.assessment.findUnique({ where: { id } });
  if (!before) throw ApiError.notFound("Assessment not found.");
  const a = await prisma.assessment.update({ where: { id }, data: toData(patch) });
  await audit(req, "ASSESSMENT_UPDATED", "Assessment", id, { before: assessmentSettingsOut(before), patch });
  return assessmentSettingsOut(a);
}

export async function remove(req, id) {
  const a = await prisma.assessment.findUnique({ where: { id } });
  if (!a) throw ApiError.notFound("Assessment not found.");
  if (await prisma.attempt.count({ where: { assessmentId: id } })) throw ApiError.conflict("This assessment has attempts. Deactivate it instead of deleting it.");
  await prisma.$transaction([prisma.question.deleteMany({ where: { assessmentId: id } }), prisma.assessment.delete({ where: { id } })]);
  await audit(req, "ASSESSMENT_DELETED", "Assessment", id, { departmentId: a.departmentId, level: a.level });
}

// ── Question bank ───────────────────────────────────────────────────────────

// Admin shape: { id, text, options: [4 strings], answer: index, … }
export function questionOut(q, stats) {
  const opts = [...q.options].sort((x, y) => x.position - y.position);
  return {
    id: q.id,
    assessmentId: q.assessmentId,
    text: q.text,
    options: opts.map((o) => o.text),
    optionIds: opts.map((o) => o.id),
    answer: opts.findIndex((o) => o.isCorrect),
    explanation: q.explanation,
    difficulty: q.difficulty.toLowerCase(),
    active: q.active,
    archived: !!q.archivedAt,
    updatedAt: q.updatedAt,
    stats: stats ?? null,
  };
}

export async function listQuestions(assessmentId, filters = {}) {
  const a = await prisma.assessment.findUnique({ where: { id: assessmentId }, include: { department: { select: { name: true } } } });
  if (!a) throw ApiError.notFound("Assessment not found.");
  const where = { assessmentId, archivedAt: filters.archived === "true" ? { not: null } : null };
  if (filters.q) where.text = { contains: filters.q, mode: "insensitive" };
  if (filters.difficulty) where.difficulty = filters.difficulty.toUpperCase();
  if (filters.active) where.active = filters.active === "true";

  const questions = await prisma.question.findMany({ where, include: { options: true }, orderBy: { createdAt: "asc" } });
  // How often each question has been answered correctly in graded attempts.
  const rows = await prisma.attemptQuestion.findMany({
    where: { questionId: { in: questions.map((q) => q.id) }, attempt: GRADED_ATTEMPT },
    select: { questionId: true, answer: { select: { isCorrect: true } } },
  });
  const stats = {};
  for (const r of rows) {
    stats[r.questionId] ??= { seen: 0, correct: 0 };
    stats[r.questionId].seen++;
    if (r.answer?.isCorrect) stats[r.questionId].correct++;
  }
  return questions.map((q) => questionOut(q, stats[q.id]));
}

export async function createQuestion(req, assessmentId, input) {
  if (!(await prisma.assessment.findUnique({ where: { id: assessmentId } }))) throw ApiError.notFound("Assessment not found.");
  const q = await prisma.question.create({
    data: {
      assessmentId,
      text: input.text,
      explanation: input.explanation ?? "",
      difficulty: (input.difficulty ?? "medium").toUpperCase(),
      active: input.active ?? true,
      options: { create: input.options.map((text, position) => ({ text, position, isCorrect: position === input.answer })) },
    },
    include: { options: true },
  });
  await audit(req, "QUESTION_CREATED", "Question", q.id, { assessmentId });
  return questionOut(q);
}

// Past attempts hold their own snapshot, so editing is always safe for history.
export async function updateQuestion(req, id, patch) {
  const q = await prisma.question.findUnique({ where: { id }, include: { options: true } });
  if (!q) throw ApiError.notFound("Question not found.");
  const updated = await prisma.$transaction(async (tx) => {
    const data = {};
    if ("text" in patch) data.text = patch.text;
    if ("explanation" in patch) data.explanation = patch.explanation;
    if ("difficulty" in patch) data.difficulty = patch.difficulty.toUpperCase();
    if ("active" in patch) data.active = patch.active;
    await tx.question.update({ where: { id }, data });
    const current = [...q.options].sort((x, y) => x.position - y.position);
    const answer = patch.answer ?? current.findIndex((o) => o.isCorrect);
    for (const o of current) {
      await tx.questionOption.update({
        where: { id: o.id },
        data: { text: patch.options ? patch.options[o.position] : o.text, isCorrect: o.position === answer },
      });
    }
    return tx.question.findUnique({ where: { id }, include: { options: true } });
  });
  await audit(req, "QUESTION_UPDATED", "Question", id, { fields: Object.keys(patch) });
  return questionOut(updated);
}

// Questions that appeared in an attempt are archived; unused ones deleted.
export async function removeQuestion(req, id) {
  const q = await prisma.question.findUnique({ where: { id } });
  if (!q) throw ApiError.notFound("Question not found.");
  if (await prisma.attemptQuestion.count({ where: { questionId: id } })) {
    await prisma.question.update({ where: { id }, data: { archivedAt: new Date(), active: false } });
    await audit(req, "QUESTION_ARCHIVED", "Question", id);
    return { archived: true };
  }
  await prisma.question.delete({ where: { id } });
  await audit(req, "QUESTION_DELETED", "Question", id);
  return { deleted: true };
}
