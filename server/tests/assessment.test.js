// Phase 6: the assessment engine end to end.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { signedIn, resetDb, closeDb, prisma, makeUser, makeAdmin, makeTrack, correctAnswers, wrongAnswers, agent, readMaterial } from "./helpers.js";

beforeAll(resetDb);
afterAll(closeDb);

// An employee on a fresh track who has completed the required material.
async function ready(opts) {
  const track = await makeTrack(opts);
  const user = await makeUser({ designationId: track.designation.id });
  const a = await signedIn(user);
  await readMaterial(a, user.id, track.material.id);
  return { track, user, a };
}

const start = (a) => a.post("/api/v1/training/attempts");
const submit = (a, id, body) => a.post(`/api/v1/training/attempts/${id}/submit`).send(body);

describe("starting", () => {
  it("refuses until the required training is complete", async () => {
    const track = await makeTrack();
    const a = await signedIn(await makeUser({ designationId: track.designation.id }));
    const r = await start(a);
    expect(r.status).toBe(403);
    expect(r.body.error).toMatchObject({ code: "NOT_ELIGIBLE", details: { condition: "materials" } });
  });

  it("refuses employees without a designation, and admins", async () => {
    expect((await start(await signedIn(await makeUser()))).body.error.code).toBe("NOT_ASSIGNED");
    expect((await start(await signedIn(await makeAdmin()))).status).toBe(403);
  });

  it("serves the employee's own department+level test without answer keys", async () => {
    const { track, a } = await ready();
    const r = await start(a);
    expect(r.status).toBe(201);
    const att = r.body.data;
    expect(att).toMatchObject({ assessmentId: track.assessment.id, departmentId: track.dept.id, level: "junior", attemptNumber: 1, durationSeconds: 600 });
    expect(att.questions).toHaveLength(4);
    for (const q of att.questions) expect(q.options).toHaveLength(4);
    const raw = JSON.stringify(att);
    expect(raw).not.toMatch(/isCorrect|correctOptionId|correctIndex|explanation/);
    expect(new Date(att.expiresAt) - new Date(att.startedAt)).toBe(600000);
    expect(att.remainingSeconds).toBeGreaterThan(590);
  });

  it("resumes the running attempt instead of creating a second one (also under concurrency)", async () => {
    const { a, user } = await ready();
    const [r1, r2, r3] = await Promise.all([start(a), start(a), start(a)]);
    const ids = new Set([r1, r2, r3].map((r) => r.body.data.id));
    expect(ids.size).toBe(1);
    expect(await prisma.attempt.count({ where: { userId: user.id } })).toBe(1);
    const active = await a.get("/api/v1/training/attempts/active");
    expect(active.body.data.id).toBe(r1.body.data.id);
  });

  it("prioritises unseen questions across attempts", async () => {
    const { a } = await ready({ questions: 8, perAttempt: 4, maxAttempts: 2 });
    const first = (await start(a)).body.data;
    await submit(a, first.id, { answers: {} });
    const second = (await start(a)).body.data;
    const qid = async (attempt) => (await prisma.attemptQuestion.findMany({ where: { attemptId: attempt.id } })).map((q) => q.questionId);
    const [q1, q2] = [await qid(first), await qid(second)];
    expect(q1.filter((x) => q2.includes(x))).toEqual([]);
  });
});

describe("grading", () => {
  it("grades all-correct answers on the server", async () => {
    const { a } = await ready();
    const att = (await start(a)).body.data;
    const r = await submit(a, att.id, { answers: correctAnswers(att), time_taken_seconds: 1, focus_violations: 1 });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ correct: 4, incorrect: 0, unanswered: 0, percentage: 100, passed: true, focusViolations: 1, autoSubmitted: false, status: "submitted" });
    expect(r.body.data.review).toHaveLength(4);
    expect(r.body.data.review.every((x) => x.isCorrect && x.chosen === x.correctIndex)).toBe(true);
    expect(r.body.data.certificate.available).toBe(true);
  });

  it("grades incorrect, partial and unanswered answers", async () => {
    const { a } = await ready({ maxAttempts: 3 });
    let att = (await start(a)).body.data;
    let r = await submit(a, att.id, { answers: wrongAnswers(att) });
    expect(r.body.data).toMatchObject({ correct: 0, incorrect: 4, unanswered: 0, percentage: 0, passed: false });

    att = (await start(a)).body.data;
    const right = correctAnswers(att);
    const wrong = wrongAnswers(att);
    const [q1, q2, q3] = att.questions.map((q) => q.id);
    r = await submit(a, att.id, { answers: { [q1]: right[q1], [q2]: right[q2], [q3]: wrong[q3] } });
    expect(r.body.data).toMatchObject({ correct: 2, incorrect: 1, unanswered: 1, percentage: 50, passed: true });
    expect(r.body.data.review.find((x) => x.id === att.questions[3].id).chosen).toBeNull();

    att = (await start(a)).body.data;
    r = await submit(a, att.id, { answers: {} });
    expect(r.body.data).toMatchObject({ correct: 0, unanswered: 4, passed: false });
  });

  it("ignores client-sent scores and timing", async () => {
    const { a } = await ready();
    const att = (await start(a)).body.data;
    const r = await submit(a, att.id, { answers: wrongAnswers(att), time_taken_seconds: 9999, score: 100, passed: true, percentage: 100 });
    expect(r.body.data).toMatchObject({ passed: false, percentage: 0 });
    expect(r.body.data.timeTakenSeconds).toBeLessThan(60);
  });

  it("rejects invalid question and option ids without closing the attempt", async () => {
    const { a } = await ready();
    const att = (await start(a)).body.data;
    let r = await submit(a, att.id, { answers: { "not-a-question": att.questions[0].options[0].id } });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe("INVALID_QUESTION");
    r = await submit(a, att.id, { answers: { [att.questions[0].id]: att.questions[1].options[0].id } });
    expect(r.body.error.code).toBe("INVALID_OPTION");
    expect((await prisma.attempt.findUnique({ where: { id: att.id } })).status).toBe("IN_PROGRESS");
  });
});

describe("integrity", () => {
  it("grades a duplicate or concurrent submission only once", async () => {
    const { a } = await ready();
    const att = (await start(a)).body.data;
    const answers = correctAnswers(att);
    const rs = await Promise.all([submit(a, att.id, { answers }), submit(a, att.id, { answers }), submit(a, att.id, { answers: wrongAnswers(att) })]);
    expect(rs.every((r) => r.status === 200)).toBe(true);
    const graded = rs.filter((r) => !r.body.data.alreadySubmitted);
    expect(graded).toHaveLength(1);
    const final = await prisma.attempt.findUnique({ where: { id: att.id } });
    expect(new Set(rs.map((r) => r.body.data.percentage))).toEqual(new Set([final.percentage]));
    expect(await prisma.attemptAnswer.count({ where: { attemptId: att.id } })).toBe(4);
    const again = await submit(a, att.id, { answers: wrongAnswers(att) });
    expect(again.body.data).toMatchObject({ alreadySubmitted: true, percentage: final.percentage });
  });

  it("enforces the attempt limit", async () => {
    const { a } = await ready({ maxAttempts: 2 });
    for (let i = 0; i < 2; i++) {
      const att = (await start(a)).body.data;
      await submit(a, att.id, { answers: {} });
    }
    const r = await start(a);
    expect(r.status).toBe(403);
    expect(r.body.error.details.condition).toBe("attempts");
  });

  it("keeps attempts private to their owner", async () => {
    const { a } = await ready();
    const att = (await start(a)).body.data;
    const { a: other } = await ready();
    expect((await submit(other, att.id, { answers: {} })).status).toBe(404);
    expect((await other.put(`/api/v1/training/attempts/${att.id}/answers`).send({ answers: {} })).status).toBe(404);
    await submit(a, att.id, { answers: {} });
    expect((await other.get(`/api/v1/training/attempts/${att.id}`)).status).toBe(404);
    expect((await a.get(`/api/v1/training/attempts/${att.id}`)).status).toBe(200);
    expect((await agent().get(`/api/v1/training/attempts/${att.id}`)).status).toBe(401);
  });

  it("autosaves answers and restores them after a reload", async () => {
    const { a } = await ready();
    const att = (await start(a)).body.data;
    const right = correctAnswers(att);
    const [q1, q2] = att.questions.map((q) => q.id);
    const s = await a.put(`/api/v1/training/attempts/${att.id}/answers`).send({ answers: { [q1]: right[q1], [q2]: right[q2] }, focus_violations: 2 });
    expect(s.status).toBe(200);
    await a.put(`/api/v1/training/attempts/${att.id}/answers`).send({ answers: { [q2]: null } });
    const active = (await a.get("/api/v1/training/attempts/active")).body.data;
    expect(active.answers).toEqual({ [q1]: right[q1] });
    expect(active.focusViolations).toBe(2);
  });

  it("locks training content and past reviews while a test runs", async () => {
    const { a, track } = await ready({ maxAttempts: 3 });
    const first = (await start(a)).body.data;
    await submit(a, first.id, { answers: {} });
    const att = (await start(a)).body.data;
    for (const url of [`/api/v1/training/materials/${track.material.id}`, `/api/v1/training/attempts/${first.id}`]) {
      const r = await a.get(url);
      expect(r.status).toBe(403);
      expect(r.body.error).toMatchObject({ code: "ASSESSMENT_IN_PROGRESS", details: { attemptId: att.id } });
    }
    expect((await a.get("/api/v1/training/module")).body.data.activeAttempt.id).toBe(att.id);
    await submit(a, att.id, { answers: {} });
    expect((await a.get(`/api/v1/training/materials/${track.material.id}`)).status).toBe(200);
  });
});

describe("timer", () => {
  const expire = (id, secondsAgo) => prisma.attempt.update({ where: { id }, data: { expiresAt: new Date(Date.now() - secondsAgo * 1000) } });

  it("accepts a submission within the grace period", async () => {
    const { a } = await ready();
    const att = (await start(a)).body.data;
    await expire(att.id, 5);
    const r = await submit(a, att.id, { answers: correctAnswers(att), auto_submitted: true });
    expect(r.body.data).toMatchObject({ percentage: 100, autoSubmitted: true });
  });

  it("after the deadline, grades only answers saved in time and marks it auto-submitted", async () => {
    const { a } = await ready();
    const att = (await start(a)).body.data;
    const right = correctAnswers(att);
    const q1 = att.questions[0].id;
    await a.put(`/api/v1/training/attempts/${att.id}/answers`).send({ answers: { [q1]: right[q1] } });
    await expire(att.id, 120);
    expect((await a.put(`/api/v1/training/attempts/${att.id}/answers`).send({ answers: right })).body.error?.code).toBe("TIME_UP");
    const r = await submit(a, att.id, { answers: right });
    expect(r.body.data).toMatchObject({ correct: 1, unanswered: 3, autoSubmitted: true });
    expect(r.body.data.timeTakenSeconds).toBeLessThanOrEqual(600);
  });

  it("auto-submits an abandoned attempt on the next request", async () => {
    const { a } = await ready();
    const att = (await start(a)).body.data;
    await expire(att.id, 3600);
    const active = await a.get("/api/v1/training/attempts/active");
    expect(active.body.data).toBeNull();
    const mine = (await a.get("/api/v1/training/attempts/mine")).body.data;
    expect(mine[0]).toMatchObject({ id: att.id, autoSubmitted: true, unanswered: 4 });
  });
});

describe("history and results", () => {
  it("keeps past results unchanged when the question bank is edited or deleted", async () => {
    const { a, track } = await ready();
    const att = (await start(a)).body.data;
    await submit(a, att.id, { answers: correctAnswers(att) });
    const before = (await a.get(`/api/v1/training/attempts/${att.id}`)).body.data;

    const ad = await signedIn(await makeAdmin());
    const bank = await prisma.question.findMany({ where: { assessmentId: track.assessment.id } });
    for (const q of bank) await ad.patch(`/api/v1/admin/questions/${q.id}`).send({ text: "EDITED", answer: 3, options: ["e1", "e2", "e3", "e4"] });
    await ad.delete(`/api/v1/admin/questions/${bank[0].id}`);
    await ad.patch(`/api/v1/admin/assessments/${track.assessment.id}`).send({ passPercent: 100 });

    const after = (await a.get(`/api/v1/training/attempts/${att.id}`)).body.data;
    expect(after.review).toEqual(before.review);
    expect(after).toMatchObject({ percentage: before.percentage, passed: true, passPercent: before.passPercent });
  });

  it("reports department standing by best score", async () => {
    const track = await makeTrack({ maxAttempts: 2 });
    const people = [];
    for (let i = 0; i < 3; i++) {
      const u = await makeUser({ designationId: track.designation.id });
      const a = await signedIn(u);
      await readMaterial(a, u.id, track.material.id);
      people.push(a);
    }
    const results = [];
    // Scores 100, 50, 0.
    for (const [i, a] of people.entries()) {
      const att = (await start(a)).body.data;
      const right = correctAnswers(att);
      const answers = Object.fromEntries(Object.entries(right).slice(0, [4, 2, 0][i]));
      results.push((await submit(a, att.id, { answers })).body.data);
    }
    // Re-read once everyone has submitted.
    const standings = await Promise.all(people.map(async (a, i) => (await a.get(`/api/v1/training/attempts/${results[i].id}`)).body.data.standing));
    expect(standings.map((s) => s.rank)).toEqual([1, 2, 3]);
    expect(standings[0]).toMatchObject({ of: 3, departmentAverage: 50, totalEligible: 3 });
    const mine = (await people[1].get("/api/v1/training/attempts/mine")).body.data;
    expect(mine).toHaveLength(1);
    expect(JSON.stringify(standings[1])).not.toMatch(/name|email/i);
  });

  it("issues a certificate only for a passed attempt", async () => {
    const { a } = await ready({ maxAttempts: 2 });
    const fail = (await start(a)).body.data;
    await submit(a, fail.id, { answers: wrongAnswers(fail) });
    expect((await a.get(`/api/v1/training/attempts/${fail.id}/certificate`)).status).toBe(403);
    const pass = (await start(a)).body.data;
    await submit(a, pass.id, { answers: correctAnswers(pass) });
    const r = await a.get(`/api/v1/training/attempts/${pass.id}/certificate`).buffer(true).parse((res, cb) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => cb(null, Buffer.concat(chunks)));
    });
    expect(r.status).toBe(200);
    expect(r.headers["content-type"]).toBe("application/pdf");
    const text = r.body.toString("latin1");
    expect(text.startsWith("%PDF-")).toBe(true);
    expect(text).toMatch(/Certificate ID AJN-[0-9A-F]{10}/);
    expect(text).toContain("Aajneeti Connect Limited");
  });

  it("lets admins void attempts so the employee can retake", async () => {
    const { a, user } = await ready({ maxAttempts: 1 });
    const att = (await start(a)).body.data;
    await submit(a, att.id, { answers: {} });
    expect((await start(a)).status).toBe(403);
    const ad = await signedIn(await makeAdmin());
    expect((await ad.post(`/api/v1/admin/users/${user.id}/reset-attempts`).send({})).body.data.voided).toBe(1);
    const again = await start(a);
    expect(again.status).toBe(201);
    expect(again.body.data.attemptNumber).toBe(1);
    // History is kept for admins.
    expect(await prisma.attempt.count({ where: { userId: user.id } })).toBe(2);
  });
});

describe("admin results", () => {
  it("lists, filters, shows detail with answers and exports CSV — admins only, audited", async () => {
    const { a, track, user } = await ready();
    const att = (await start(a)).body.data;
    await submit(a, att.id, { answers: correctAnswers(att) });
    const ad = await signedIn(await makeAdmin());

    const list = await ad.get(`/api/v1/admin/results?departmentId=${track.dept.id}&passed=true`);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0]).toMatchObject({ userId: user.id, userEmail: user.email, passed: true });
    expect((await ad.get(`/api/v1/admin/results?departmentId=${track.dept.id}&passed=false`)).body.data).toHaveLength(0);

    const detail = await ad.get(`/api/v1/admin/results/${att.id}`);
    expect(detail.body.data.review[0]).toHaveProperty("correctIndex");
    expect(detail.body.data.userName).toBe(user.name);

    const csv = await ad.get(`/api/v1/admin/results/export?departmentId=${track.dept.id}`);
    expect(csv.status).toBe(200);
    expect(csv.headers["content-type"]).toMatch(/text\/csv/);
    expect(csv.headers["content-disposition"]).toMatch(/attachment/);
    expect(csv.text).toContain(user.email);

    expect((await a.get("/api/v1/admin/results/export")).status).toBe(403);
    expect((await a.get(`/api/v1/admin/results/${att.id}`)).status).toBe(403);
    const actions = (await prisma.auditLog.findMany({ where: { action: { in: ["RESULTS_LISTED", "RESULT_VIEWED", "RESULTS_EXPORTED"] } } })).map((x) => x.action);
    expect(new Set(actions)).toEqual(new Set(["RESULTS_LISTED", "RESULT_VIEWED", "RESULTS_EXPORTED"]));
  });

  it("deletes a single result, giving the attempt back", async () => {
    const { a, track } = await ready({ maxAttempts: 1 });
    const att = (await start(a)).body.data;
    await submit(a, att.id, { answers: wrongAnswers(att) });
    expect((await start(a)).status).toBe(403);
    const ad = await signedIn(await makeAdmin());

    expect((await a.delete(`/api/v1/admin/results/${att.id}`)).status).toBe(403);
    expect((await ad.delete(`/api/v1/admin/results/${att.id}`)).status).toBe(200);
    expect(await prisma.attempt.findUnique({ where: { id: att.id } })).toBeNull();
    expect(await prisma.attemptAnswer.count({ where: { attemptId: att.id } })).toBe(0);
    expect((await ad.delete(`/api/v1/admin/results/${att.id}`)).status).toBe(404);
    expect((await ad.get(`/api/v1/admin/results?departmentId=${track.dept.id}`)).body.data).toHaveLength(0);
    expect((await start(a)).status).toBe(201);
    expect(await prisma.auditLog.count({ where: { action: "RESULT_DELETED", entityId: att.id } })).toBe(1);
  });

  it("deletes an employee together with their results", async () => {
    const { a, user } = await ready();
    const att = (await start(a)).body.data;
    await submit(a, att.id, { answers: correctAnswers(att) });
    const ad = await signedIn(await makeAdmin());
    const r = await ad.delete(`/api/v1/admin/users/${user.id}`);
    expect(r.status).toBe(200);
    expect(r.body.data).toEqual({ attemptsDeleted: 1 });
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
    expect(await prisma.attempt.count({ where: { userId: user.id } })).toBe(0);
    expect((await a.get("/api/v1/me")).status).toBe(401);
  });
});
