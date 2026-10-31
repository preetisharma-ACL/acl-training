// Grades an attempt against its private answer-key snapshot. Pure: the
// frontend's own score or pass/fail is never an input.

import { ApiError } from "../utils/ApiError.js";

// Rejects answers for questions not in the attempt, or options that don't
// belong to their question. Returns a clean { [attemptQuestionId]: optionId | null }.
export function validateAnswers(questions, answers = {}) {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const clean = {};
  for (const [qid, optionId] of Object.entries(answers)) {
    const q = byId.get(qid);
    if (!q) throw ApiError.badRequest("An answer refers to a question that isn't part of this attempt.", { code: "INVALID_QUESTION" });
    if (optionId == null) continue;
    if (!q.options.some((o) => o.id === optionId)) throw ApiError.badRequest("An answer refers to an option that isn't part of its question.", { code: "INVALID_OPTION" });
    clean[qid] = optionId;
  }
  return clean;
}

// questions: [{ id, correctOptionId, options: [{ id }] }]  (attempt snapshot)
export function grade({ questions, answers, marksPerQuestion = 1, passPercent }) {
  const clean = validateAnswers(questions, answers);
  let correct = 0;
  let incorrect = 0;
  const perQuestion = questions.map((q) => {
    const selected = clean[q.id] ?? null;
    const isCorrect = selected !== null && selected === q.correctOptionId;
    if (isCorrect) correct++;
    else if (selected !== null) incorrect++;
    return { attemptQuestionId: q.id, selectedOptionId: selected, isCorrect: selected === null ? null : isCorrect };
  });
  const total = questions.length;
  const totalMarks = total * marksPerQuestion;
  const marks = correct * marksPerQuestion;
  // One decimal place, e.g. 66.7
  const percentage = totalMarks ? Math.round((marks / totalMarks) * 1000) / 10 : 0;
  return {
    totalQuestions: total,
    correct,
    incorrect,
    unanswered: total - correct - incorrect,
    marks,
    totalMarks,
    percentage,
    passed: total > 0 && percentage >= passPercent,
    perQuestion,
  };
}
