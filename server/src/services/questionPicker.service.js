// Chooses and orders the questions for one attempt. Pure (no database), so
// it is unit-tested directly.
//
// Selection policy
//   1. Only usable questions: active, exactly four options, exactly one correct.
//   2. Questions this employee has never seen come first (random order).
//   3. If unseen ones run out, fill up with previously seen questions,
//      least-recently-seen first (seen in their oldest attempt before seen in
//      their latest); ties are broken randomly.
//   4. No question appears twice in one attempt.
//   5. With shuffle on, question order and each question's option order are
//      randomised. Options keep their own ids, so the answer key (the correct
//      option id) is unaffected by display order.

import crypto from "node:crypto";

const rand = (n) => crypto.randomInt(n);

export function shuffle(arr, rnd = rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const isUsable = (q) => q.options?.length === 4 && q.options.filter((o) => o.isCorrect).length === 1;

// bank:     [{ id, text, explanation, options: [{ id, text, isCorrect, position }] }]
// lastSeen: Map questionId → recency (0 = seen in the latest attempt, 1 = the one before, …)
// → [{ questionId, text, explanation, options: [{ id, text }], correctOptionId }]
export function pickQuestions({ bank, lastSeen = new Map(), count, shuffle: doShuffle = true, rnd = rand }) {
  const usable = bank.filter(isUsable);
  const n = Math.min(count, usable.length);

  const unseen = shuffle(usable.filter((q) => !lastSeen.has(q.id)), rnd);
  // Higher recency number = seen longer ago = preferred.
  const seen = shuffle(usable.filter((q) => lastSeen.has(q.id)), rnd).sort((a, b) => lastSeen.get(b.id) - lastSeen.get(a.id));
  const picked = [...unseen, ...seen].slice(0, n);

  const bankOrder = new Map(usable.map((q, i) => [q.id, i]));
  const ordered = doShuffle ? shuffle(picked, rnd) : picked.sort((a, b) => bankOrder.get(a.id) - bankOrder.get(b.id));

  return ordered.map((q) => {
    const byPosition = [...q.options].sort((a, b) => a.position - b.position);
    const options = doShuffle ? shuffle(byPosition, rnd) : byPosition;
    return {
      questionId: q.id,
      text: q.text,
      explanation: q.explanation ?? "",
      options: options.map((o) => ({ id: o.id, text: o.text })),
      correctOptionId: options.find((o) => o.isCorrect).id,
    };
  });
}

// From past attempts (newest first) of this user on this assessment.
export function recencyMap(pastAttempts) {
  const m = new Map();
  pastAttempts.forEach((a, i) => {
    for (const qid of a.questionIds) if (qid && !m.has(qid)) m.set(qid, i);
  });
  return m;
}
