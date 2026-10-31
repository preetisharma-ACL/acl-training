// Pure unit tests: scoring, question picking, ranking, CSV escaping.

import { describe, it, expect } from "vitest";
import { grade, validateAnswers } from "../src/services/scoring.service.js";
import { pickQuestions, recencyMap, isUsable } from "../src/services/questionPicker.service.js";
import { rankOf, bestScores } from "../src/services/ranking.service.js";
import { csvCell } from "../src/services/results.service.js";

// Attempt snapshot: 4 questions, options shuffled, correct is "<q>-c".
const Q = (id) => ({ id, correctOptionId: `${id}-c`, options: [{ id: `${id}-x` }, { id: `${id}-c` }, { id: `${id}-y` }, { id: `${id}-z` }] });
const questions = ["q1", "q2", "q3", "q4"].map(Q);
const g = (answers, extra = {}) => grade({ questions, answers, marksPerQuestion: 1, passPercent: 70, ...extra });

describe("grade", () => {
  it("all correct", () => {
    expect(g({ q1: "q1-c", q2: "q2-c", q3: "q3-c", q4: "q4-c" })).toMatchObject({ correct: 4, incorrect: 0, unanswered: 0, marks: 4, totalMarks: 4, percentage: 100, passed: true });
  });

  it("all incorrect", () => {
    expect(g({ q1: "q1-x", q2: "q2-y", q3: "q3-z", q4: "q4-x" })).toMatchObject({ correct: 0, incorrect: 4, unanswered: 0, percentage: 0, passed: false });
  });

  it("partially correct", () => {
    expect(g({ q1: "q1-c", q2: "q2-c", q3: "q3-x" })).toMatchObject({ correct: 2, incorrect: 1, unanswered: 1, percentage: 50, passed: false });
  });

  it("nothing answered", () => {
    const r = g({});
    expect(r).toMatchObject({ correct: 0, incorrect: 0, unanswered: 4, percentage: 0, passed: false });
    expect(r.perQuestion.every((p) => p.selectedOptionId === null && p.isCorrect === null)).toBe(true);
  });

  it("explicit nulls count as unanswered", () => {
    expect(g({ q1: null, q2: "q2-c" })).toMatchObject({ correct: 1, unanswered: 3 });
  });

  it("pass exactly at the pass mark", () => {
    const r = grade({ questions: [Q("a"), Q("b"), Q("c"), Q("d"), Q("e"), Q("f"), Q("g"), Q("h"), Q("i"), Q("j")], answers: Object.fromEntries("abcdefg".split("").map((k) => [k, `${k}-c`])), passPercent: 70 });
    expect(r).toMatchObject({ percentage: 70, passed: true });
  });

  it("rounds percentages to one decimal", () => {
    const three = [Q("a"), Q("b"), Q("c")];
    expect(grade({ questions: three, answers: { a: "a-c", b: "b-c" }, passPercent: 60 }).percentage).toBe(66.7);
  });

  it("applies marks per question", () => {
    expect(g({ q1: "q1-c" }, { marksPerQuestion: 5 })).toMatchObject({ marks: 5, totalMarks: 20, percentage: 25 });
  });

  it("an empty attempt never passes", () => {
    expect(grade({ questions: [], answers: {}, passPercent: 0 })).toMatchObject({ percentage: 0, passed: false });
  });

  it("rejects unknown question ids", () => {
    expect(() => g({ nope: "q1-c" })).toThrow(/isn't part of this attempt/);
  });

  it("rejects options from another question", () => {
    expect(() => g({ q1: "q2-c" })).toThrow(/isn't part of its question/);
    expect(() => validateAnswers(questions, { q1: "made-up" })).toThrow();
  });
});

// Bank question with option ids `${id}-o0..3`, correct at position `correct`.
const bankQ = (id, correct = 0) => ({ id, text: id, options: [0, 1, 2, 3].map((p) => ({ id: `${id}-o${p}`, text: `${id} ${p}`, position: p, isCorrect: p === correct })) });
const bank = Array.from({ length: 10 }, (_, i) => bankQ(`b${i}`, i % 4));

describe("pickQuestions", () => {
  it("respects the count, never repeats, keeps the answer key through option shuffling", () => {
    const picked = pickQuestions({ bank, count: 6 });
    expect(picked).toHaveLength(6);
    expect(new Set(picked.map((p) => p.questionId)).size).toBe(6);
    for (const p of picked) {
      const src = bank.find((b) => b.id === p.questionId);
      expect(p.correctOptionId).toBe(src.options.find((o) => o.isCorrect).id);
      expect(p.options.map((o) => o.id).sort()).toEqual(src.options.map((o) => o.id).sort());
      expect(p.options).toHaveLength(4);
      expect(p.options[0]).not.toHaveProperty("isCorrect");
    }
  });

  it("caps at the bank size", () => {
    expect(pickQuestions({ bank: bank.slice(0, 3), count: 10 })).toHaveLength(3);
  });

  it("takes unseen questions first", () => {
    const seen = new Map(bank.slice(0, 6).map((q) => [q.id, 0]));
    for (let i = 0; i < 20; i++) {
      const ids = pickQuestions({ bank, lastSeen: seen, count: 4 }).map((p) => p.questionId);
      expect(ids.sort()).toEqual(["b6", "b7", "b8", "b9"]);
    }
  });

  it("falls back to the least recently seen questions", () => {
    // b0–b3 seen in the latest attempt (0), b4–b7 one attempt earlier (1), b8–b9 unseen.
    const seen = new Map([...bank.slice(0, 4).map((q) => [q.id, 0]), ...bank.slice(4, 8).map((q) => [q.id, 1])]);
    for (let i = 0; i < 20; i++) {
      const ids = pickQuestions({ bank, lastSeen: seen, count: 6 }).map((p) => p.questionId).sort();
      expect(ids).toEqual(["b4", "b5", "b6", "b7", "b8", "b9"]);
    }
  });

  it("randomises question and option order when shuffle is on", () => {
    const orders = new Set();
    const optionOrders = new Set();
    for (let i = 0; i < 30; i++) {
      const p = pickQuestions({ bank, count: 10 });
      orders.add(p.map((x) => x.questionId).join());
      optionOrders.add(p[0].options.map((o) => o.id.slice(-1)).join());
    }
    expect(orders.size).toBeGreaterThan(1);
    expect(optionOrders.size).toBeGreaterThan(1);
  });

  it("keeps bank order and option order when shuffle is off", () => {
    const p = pickQuestions({ bank, count: 10, shuffle: false });
    expect(p.map((x) => x.questionId)).toEqual(bank.map((b) => b.id));
    expect(p[0].options.map((o) => o.id)).toEqual(["b0-o0", "b0-o1", "b0-o2", "b0-o3"]);
  });

  it("skips questions without exactly four options and one correct answer", () => {
    const broken = [{ ...bankQ("x"), options: bankQ("x").options.slice(0, 3) }, { ...bankQ("y"), options: bankQ("y").options.map((o) => ({ ...o, isCorrect: true })) }];
    expect(broken.some(isUsable)).toBe(false);
    expect(pickQuestions({ bank: [...broken, bankQ("ok")], count: 5 }).map((p) => p.questionId)).toEqual(["ok"]);
  });

  it("recencyMap keeps the most recent sighting", () => {
    const m = recencyMap([{ questionIds: ["a", "b"] }, { questionIds: ["b", "c"] }]);
    expect(Object.fromEntries(m)).toEqual({ a: 0, b: 0, c: 1 });
  });
});

describe("ranking", () => {
  it("uses each person's best score with competition ranking", () => {
    const scores = bestScores([
      { userId: "a", percentage: 95 },
      { userId: "b", percentage: 90 },
      { userId: "b", percentage: 60 },
      { userId: "c", percentage: 90 },
      { userId: "d", percentage: 80 },
    ]);
    expect(rankOf(scores, "a")).toBe(1);
    expect(rankOf(scores, "b")).toBe(2);
    expect(rankOf(scores, "c")).toBe(2);
    expect(rankOf(scores, "d")).toBe(4);
    expect(rankOf(scores, "nobody")).toBeNull();
  });
});

describe("csvCell", () => {
  it("neutralises formulas and quotes special characters", () => {
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("@cmd")).toBe("'@cmd");
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell(null)).toBe("");
    expect(csvCell(42)).toBe("42");
  });
});
