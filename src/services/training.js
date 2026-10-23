// ─── Training & Assessment service (employee side) ──────────────────────────
// FRONTEND-ONLY MOCK. Every function is async and returns the shape the UI
// expects, so swapping a body for a fetch is the whole migration. Contract
// (see README.md):
//
//   GET  /training/module/                 → Module (getMyModule)
//   GET  /training/materials/{id}/         → Material incl. content / fileUrl
//   POST /training/materials/{id}/progress/ { percent?, completed? }
//   POST /training/attempts/               → Attempt; questions carry NO answers.
//        403 unless every required material is complete and attempts remain.
//   POST /training/attempts/{id}/submit/   { answers: { [questionId]: optionId },
//        time_taken_seconds, focus_violations, auto_submitted } → Result,
//        graded on the server.
//   GET  /training/attempts/mine/          → Result summaries
//   GET  /training/attempts/{id}/          → Result incl. review + standing
//   GET  /announcements/
//
// Until then everything runs against mockDb.js. The answer key is in the
// bundle, which is fine for a mock and NOT for production.

import { db, commit, delay, clone } from "./mockDb";
import { makePdf } from "../lib/pdf";

// ── Helpers ─────────────────────────────────────────────────────────────────

const deptFor = (me) => (me?.department ? db().departments.find((d) => d.id === me.department.id && d.active) : null);

const visibleTo = (me, m) => !m.departmentId || m.departmentId === me?.department?.id;

const progressOf = (userId) => {
  const s = db();
  s.progress[userId] ??= {};
  return s.progress[userId];
};

// End of the current month: the training cycle deadline.
const cycleDue = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59).toISOString();
};

const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const summarize = (m, p) => ({
  id: m.id,
  title: m.title,
  type: m.type,
  departmentId: m.departmentId,
  scope: m.departmentId ? "department" : "company",
  required: m.required,
  description: m.description,
  estMinutes: m.estMinutes,
  version: m.version,
  author: m.author,
  updatedAt: m.updatedAt,
  progress: {
    opened: !!p?.opened,
    completed: !!p?.completed,
    percent: p?.completed ? 100 : p?.percent ?? 0,
    lastOpenedAt: p?.lastOpenedAt ?? null,
    completedAt: p?.completedAt ?? null,
  },
});

// ── Module ──────────────────────────────────────────────────────────────────

export async function getMyModule(me) {
  await delay();
  const s = db();
  const dept = deptFor(me);
  const prog = progressOf(me.id);
  const materials = s.materials
    .filter((m) => visibleTo(me, m))
    .map((m) => summarize(m, prog[m.id]))
    // Department material first, then company-wide; required before optional.
    .sort((a, b) => (a.scope === b.scope ? Number(b.required) - Number(a.required) : a.scope === "department" ? -1 : 1));

  const required = materials.filter((m) => m.required);
  const completedRequired = required.filter((m) => m.progress.completed).length;
  const attempts = s.attempts.filter((a) => a.userId === me.id && a.departmentId === dept?.id);
  const questionCount = dept ? (s.questions[dept.id] || []).length : 0;
  const attemptsLeft = dept ? Math.max(0, dept.maxAttempts - attempts.length) : 0;
  const passed = attempts.some((a) => a.passed);
  const best = attempts.reduce((m, a) => (m && m.percentage >= a.percentage ? m : a), null);

  const conditions = dept
    ? [
        {
          id: "materials",
          label: "Complete all required materials",
          detail: `${completedRequired} of ${required.length} complete`,
          met: completedRequired === required.length,
        },
        {
          id: "attempts",
          label: "Have an attempt remaining",
          detail: `${attemptsLeft} of ${dept.maxAttempts} left`,
          met: attemptsLeft > 0,
        },
        {
          id: "questions",
          label: "Assessment is published",
          detail: questionCount ? `${questionCount} questions ready` : "No questions yet",
          met: questionCount > 0,
        },
      ]
    : [];

  return {
    department: dept ? clone(dept) : null,
    assessment: dept
      ? {
          questionCount,
          durationMinutes: dept.durationMinutes,
          passPercent: dept.passPercent,
          maxAttempts: dept.maxAttempts,
          attemptsUsed: attempts.length,
          attemptsLeft,
        }
      : null,
    materials,
    requiredCount: required.length,
    completedRequired,
    completedTotal: materials.filter((m) => m.progress.completed).length,
    readingMinutesLeft: materials.filter((m) => !m.progress.completed).reduce((t, m) => t + m.estMinutes, 0),
    conditions,
    eligible: !!dept && conditions.every((c) => c.met),
    passed,
    best: best ? clone(best) : null,
    lastAttempt: attempts[0] ? clone(attempts[0]) : null,
    stage: !dept ? "unassigned" : passed ? "done" : completedRequired === required.length ? "assess" : "learn",
    dueAt: cycleDue(),
  };
}

// ── Materials ───────────────────────────────────────────────────────────────

export async function getMaterial(me, id) {
  await delay(200);
  const m = db().materials.find((x) => x.id === id);
  if (!m || !visibleTo(me, m)) throw new Error("This material isn't part of your training module.");
  return { ...summarize(m, progressOf(me.id)[id]), content: clone(m.content), fileUrl: m.fileUrl ?? null, fileName: m.fileName ?? null };
}

export async function updateProgress(me, id, patch) {
  const prog = progressOf(me.id);
  const cur = prog[id] || {};
  const next = { ...cur, opened: true, lastOpenedAt: new Date().toISOString() };
  if (patch.percent != null) next.percent = Math.max(cur.percent ?? 0, Math.round(patch.percent));
  if (patch.completed && !cur.completed) {
    next.completed = true;
    next.percent = 100;
    next.completedAt = new Date().toISOString();
  }
  prog[id] = next;
  commit();
  return { ...next };
}

// Turn any material into PDF blocks (for download, and for mock PDF preview).
function toBlocks(m) {
  if (m.type === "pdf") return m.content?.blocks ?? [];
  if (m.type === "structured") {
    const out = [];
    if (m.content.intro) out.push({ type: "p", text: m.content.intro });
    for (const s of m.content.sections) {
      out.push({ type: "h", text: s.title });
      for (const p of s.body) out.push({ type: "p", text: p });
      for (const p of s.points ?? []) out.push({ type: "li", text: p });
      if (s.tip) out.push({ type: "tip", label: "TIP", text: s.tip });
    }
    return out;
  }
  const out = [];
  for (const ch of m.content.chapters) {
    out.push({ type: "h", text: ch.title });
    for (const b of ch.blocks) {
      if (b.type === "p") out.push({ type: "p", text: b.text });
      else if (b.type === "h") out.push({ type: "p", text: b.text.toUpperCase() });
      else if (b.type === "ul") b.items.forEach((t) => out.push({ type: "li", text: t }));
      else if (b.type === "ol") b.items.forEach((t, i) => out.push({ type: "num", n: i + 1, text: t }));
      else if (b.type === "callout") out.push({ type: "tip", label: (b.title || "NOTE").toUpperCase(), text: b.text });
    }
  }
  return out;
}

const fileCache = new Map();

// → { url, pages, sizeBytes, fileName }. Backend PDFs come with a fileUrl;
// in mock mode the file is generated in the browser.
export async function getMaterialFile(material) {
  const fileName = material.fileName || `${material.title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-")}.pdf`;
  const key = `${material.id}:${material.updatedAt}`;
  if (material.fileUrl) {
    // Uploaded in the mock admin as a data: URL. Browsers won't render a
    // data: PDF in an iframe, so hand the viewer a blob: URL instead.
    if (material.fileUrl.startsWith("data:") && !fileCache.has(key)) {
      const blob = await (await fetch(material.fileUrl)).blob();
      fileCache.set(key, { url: URL.createObjectURL(blob), pages: null, sizeBytes: blob.size, fileName });
    }
    return fileCache.get(key) ?? { url: material.fileUrl, pages: material.pages ?? null, sizeBytes: material.sizeBytes ?? null, fileName };
  }
  if (!fileCache.has(key)) {
    const scope = material.departmentId ? db().departments.find((d) => d.id === material.departmentId)?.name : "Company-wide";
    const { blob, pages } = makePdf({
      kicker: `Aajneeti Academy · ${scope}`,
      title: material.title,
      subtitle: material.description,
      meta: `Version ${material.version}  ·  ${material.author}  ·  Updated ${new Date(material.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`,
      blocks: toBlocks(material),
    });
    fileCache.set(key, { url: URL.createObjectURL(blob), pages, sizeBytes: blob.size, fileName });
  }
  return fileCache.get(key);
}

// ── Assessment ──────────────────────────────────────────────────────────────

// Options are shuffled but keep their ORIGINAL index as `id`, so an answer is
// always "question id → original option index" regardless of display order.
export async function startAttempt(me) {
  await delay(450);
  const mod = await getMyModule(me);
  if (!mod.department) throw new Error("No assessment is assigned to your designation.");
  if (!mod.eligible) {
    const missing = mod.conditions.find((c) => !c.met);
    throw new Error(`You can't start yet — ${missing.label.toLowerCase()}.`);
  }
  const d = mod.department;
  const bank = db().questions[d.id] || [];
  const order = d.shuffle ? shuffle(bank) : bank;
  return {
    attemptId: `att-${Date.now()}`,
    userId: me.id,
    name: me.name,
    designation: me.designation?.title ?? "",
    departmentId: d.id,
    departmentName: d.name,
    durationSeconds: d.durationMinutes * 60,
    passPercent: d.passPercent,
    marksPerQuestion: d.marksPerQuestion,
    attemptNumber: mod.assessment.attemptsUsed + 1,
    maxAttempts: d.maxAttempts,
    questions: order.map((q) => ({
      id: q.id,
      text: q.text,
      options: (d.shuffle ? shuffle : (x) => x)(q.options.map((text, id) => ({ id, text }))),
    })),
  };
}

function gradeAttempt({ departmentId, answers, questions, marksPerQuestion, passPercent }) {
  const bank = db().questions[departmentId] || [];
  // Grade exactly the questions the candidate saw, in the order they saw them.
  const ordered = questions.map((q) => bank.find((b) => b.id === q.id)).filter(Boolean);
  let correct = 0;
  let incorrect = 0;
  const review = ordered.map((q) => {
    const chosen = answers[q.id];
    const answered = chosen !== undefined && chosen !== null;
    const isCorrect = answered && chosen === q.answer;
    if (isCorrect) correct++;
    else if (answered) incorrect++;
    return { id: q.id, text: q.text, options: q.options, chosen: answered ? chosen : null, correctIndex: q.answer, isCorrect };
  });
  const total = ordered.length;
  const totalMarks = total * marksPerQuestion;
  const marks = correct * marksPerQuestion;
  const percentage = totalMarks ? Math.round((marks / totalMarks) * 1000) / 10 : 0;
  return {
    totalQuestions: total,
    correct,
    incorrect,
    unanswered: total - correct - incorrect,
    marks,
    totalMarks,
    percentage,
    passPercent,
    passed: percentage >= passPercent,
    review,
  };
}

export async function submitAttempt(attempt) {
  await delay(700);
  const result = {
    id: attempt.attemptId,
    userId: attempt.userId,
    departmentId: attempt.departmentId,
    departmentName: attempt.departmentName,
    designation: attempt.designation,
    ...gradeAttempt(attempt),
    timeTakenSeconds: attempt.timeTakenSeconds,
    durationSeconds: attempt.durationSeconds,
    focusViolations: attempt.focusViolations ?? 0,
    autoSubmitted: !!attempt.autoSubmitted,
    submittedAt: new Date().toISOString(),
  };
  const s = db();
  if (!s.attempts.some((a) => a.id === result.id)) s.attempts.unshift(result);
  commit();
  return clone(result);
}

export async function listMyAttempts(me) {
  await delay(200);
  return clone(
    db()
      .attempts.filter((a) => a.userId === me.id)
      .map(({ review, ...rest }) => ({ ...rest, hasReview: !!review })),
  );
}

// One result with its answer review and the candidate's standing in their
// department (by each person's best score — no names exposed).
export async function getAttempt(me, id) {
  await delay(250);
  const s = db();
  const a = s.attempts.find((x) => x.id === id && x.userId === me.id);
  if (!a) throw new Error("Result not found.");
  const best = new Map();
  for (const x of s.attempts) {
    if (x.departmentId !== a.departmentId) continue;
    best.set(x.userId, Math.max(best.get(x.userId) ?? 0, x.percentage));
  }
  const scores = [...best.values()].sort((p, q) => q - p);
  const mine = best.get(me.id) ?? a.percentage;
  return {
    ...clone(a),
    standing: {
      rank: scores.indexOf(mine) + 1,
      of: scores.length,
      departmentAverage: scores.length ? Math.round(scores.reduce((t, x) => t + x, 0) / scores.length) : null,
    },
  };
}

export async function getAnnouncements() {
  await delay(150);
  return clone(db().announcements);
}
