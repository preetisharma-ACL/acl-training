// Regression tests for the QA audit (QA-001 … QA-017), backend side.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { signedIn, resetDb, closeDb, prisma, makeDepartment, makeDesignation, makeUser, makeAdmin, makeTrack, readMaterial, backdatePing, agent, PASSWORD } from "./helpers.js";

// A minimal valid PDF.
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n", "latin1");

let track, admin, ad;

beforeAll(async () => {
  await resetDb();
  track = await makeTrack();
  admin = await makeAdmin({ email: "qa-admin@test.local" });
  ad = await signedIn(admin);
});
afterAll(closeDb);

// An employee on the track, signed in.
async function employee(data = {}) {
  const user = await makeUser({ designationId: track.designation.id, ...data });
  return { user, a: await signedIn(user) };
}

const material = (data) =>
  prisma.material.create({
    data: {
      title: data.title ?? "Material",
      type: data.type ?? "MANUAL",
      // Optional, so the track's own required guide alone decides unlocking.
      required: false,
      departmentId: track.dept.id,
      estMinutes: 1,
      content: data.content,
      levels: { create: [{ level: "TEAM_HEAD" }, { level: "SENIOR" }, { level: "JUNIOR" }] },
      ...(data.extra ?? {}),
    },
  });

const progress = (a, id, body) => a.post(`/api/v1/training/materials/${id}/progress`).send(body);
const moduleOf = async (a) => (await a.get("/api/v1/training/module")).body.data;

describe("QA-001 training completion needs server-side evidence", () => {
  it("rejects a forged { completed: true } and keeps the assessment locked", async () => {
    const { a } = await employee();
    // Never opened → nothing to complete.
    expect((await progress(a, track.material.id, { completed: true })).body.error.code).toBe("NOT_OPENED");
    // Opened but not read.
    await a.get(`/api/v1/training/materials/${track.material.id}`);
    const r = await progress(a, track.material.id, { completed: true, percent: 100 });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe("NOT_READ_YET");
    expect(r.body.error.details).toMatchObject({ completed: false, canComplete: false });
    const m = await moduleOf(a);
    expect(m.completedRequired).toBe(0);
    expect(m.eligible).toBe(false);
    expect((await a.post("/api/v1/training/attempts")).status).toBe(403);
  });

  it("manual: needs every chapter (real ids only) and the minimum reading time, then completes itself", async () => {
    const m = await material({ title: "Manual", content: { chapters: ["a", "b", "c"].map((id) => ({ id, title: id, blocks: [{ type: "p", text: "x" }] })) } });
    const { user, a } = await employee();
    const opened = (await a.get(`/api/v1/training/materials/${m.id}`)).body.data.progress;
    expect(opened).toMatchObject({ opened: true, completed: false, canComplete: false, requirement: { sectionsTotal: 3, sectionsSeen: 0, minSeconds: 24 } });

    // All chapters (plus made-up ids, ignored) but no reading time yet.
    let r = await progress(a, m.id, { seen: ["a", "b", "c", "zzz"] });
    expect(r.body.data).toMatchObject({ completed: false, requirement: { sectionsSeen: 3 } });
    expect(r.body.data.requirement.activeSeconds).toBeLessThan(5);

    // Enough time but a chapter missing → still not complete.
    const m2 = await material({ title: "Manual 2", content: { chapters: ["a", "b"].map((id) => ({ id, title: id, blocks: [{ type: "p", text: "x" }] })) } });
    await a.get(`/api/v1/training/materials/${m2.id}`);
    await backdatePing(user.id, m2.id, 40);
    r = await progress(a, m2.id, { seen: ["a"] });
    expect(r.body.data).toMatchObject({ completed: false, requirement: { sectionsSeen: 1, activeSeconds: 24 } });
    expect((await progress(a, m2.id, { completed: true })).status).toBe(409);

    // Time arrives → completes on the next heartbeat without being asked.
    await backdatePing(user.id, m.id, 40);
    r = await progress(a, m.id, {});
    expect(r.body.data).toMatchObject({ completed: true, percent: 100, canComplete: true });
  });

  it("structured guide: completes from sections reported across several heartbeats", async () => {
    // makeTrack's guide: 5 minutes → 2 minutes of reading needed.
    const { user, a } = await employee();
    await a.get(`/api/v1/training/materials/${track.material.id}`);
    let r = await progress(a, track.material.id, { seen: ["s"] });
    expect(r.body.data).toMatchObject({ completed: false, requirement: { sectionsSeen: 1, minSeconds: 120 } });
    for (let i = 0; i < 3; i++) {
      await backdatePing(user.id, track.material.id, 40);
      r = await progress(a, track.material.id, {});
    }
    expect(r.body.data.completed).toBe(true);
    expect((await moduleOf(a)).eligible).toBe(true);
  });

  it("PDF: needs the file itself to have been opened, and the employee to ask", async () => {
    const up = await ad.post("/api/v1/admin/materials/upload").attach("file", PDF, { filename: "Policy.pdf", contentType: "application/pdf" });
    const created = await ad.post("/api/v1/admin/materials").send({ title: "Policy", type: "pdf", departmentId: track.dept.id, required: false, levels: ["junior"], estMinutes: 1, uploadId: up.body.data.uploadId });
    const id = created.body.data.id;
    const { user, a } = await employee();
    await a.get(`/api/v1/training/materials/${id}`);
    await backdatePing(user.id, id, 40);
    let r = await progress(a, id, { completed: true });
    expect(r.status).toBe(409);
    expect(r.body.error.message).toMatch(/Open the PDF/);
    expect(r.body.error.details.requirement.fileOpened).toBe(false);

    expect((await a.get(`/api/v1/training/materials/${id}/file`)).status).toBe(200);
    r = await progress(a, id, {});
    // Not automatic for PDFs…
    expect(r.body.data).toMatchObject({ completed: false, canComplete: true });
    // …but granted on request.
    r = await progress(a, id, { completed: true });
    expect(r.body.data.completed).toBe(true);
  });

  it("can't inflate reading time: back-to-back or long-idle heartbeats add at most real time, capped per gap", async () => {
    const m = await material({ title: "Long", content: { chapters: [{ id: "a", title: "a", blocks: [] }] }, extra: { estMinutes: 30 } });
    const { user, a } = await employee();
    await a.get(`/api/v1/training/materials/${m.id}`);
    for (let i = 0; i < 10; i++) await progress(a, m.id, {});
    let p = await prisma.materialProgress.findUnique({ where: { userId_materialId: { userId: user.id, materialId: m.id } } });
    expect(p.activeSeconds).toBeLessThan(5);
    // A tab left idle for an hour counts for one capped gap only.
    await backdatePing(user.id, m.id, 3600);
    await progress(a, m.id, {});
    p = await prisma.materialProgress.findUnique({ where: { userId_materialId: { userId: user.id, materialId: m.id } } });
    expect(p.activeSeconds).toBeLessThanOrEqual(50);
  });

  it("refuses progress on a material outside the employee's module", async () => {
    const other = await makeDepartment();
    const elsewhere = await prisma.material.create({ data: { title: "Elsewhere", type: "MANUAL", departmentId: other.id, content: { chapters: [{ id: "a", title: "a", blocks: [] }] }, levels: { create: [{ level: "JUNIOR" }] } } });
    const { a } = await employee();
    expect((await a.get(`/api/v1/training/materials/${elsewhere.id}`)).status).toBe(403);
    expect((await progress(a, elsewhere.id, { completed: true })).status).toBe(403);
  });
});

describe("QA-002 structured guides: create, edit, reorder, draft → preview → publish", () => {
  const guide = {
    intro: "Welcome",
    sections: [
      { id: "s-one", title: "One", body: ["First paragraph", "Second"], points: ["Point A"], tip: "Tip one" },
      { id: "s-two", title: "Two", body: ["Body two"] },
    ],
  };

  it("works end to end through the admin API", async () => {
    const r = await ad.post("/api/v1/admin/materials").send({ title: "Playbook", type: "structured", departmentId: track.dept.id, required: false, levels: ["junior"], status: "draft", content: guide });
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ status: "draft", sections: 2 });
    const id = r.body.data.id;

    // Admin preview of the draft; employees can't see it yet.
    expect((await ad.get(`/api/v1/admin/materials/${id}`)).body.data.content).toEqual(guide);
    const { a } = await employee();
    expect((await a.get(`/api/v1/training/materials/${id}`)).status).toBe(403);

    // Edit: rename, add a section, reorder (ids kept), then publish.
    const edited = { intro: "Welcome!", sections: [{ id: "s-three", title: "Three", body: ["New"] }, { ...guide.sections[1], title: "Two (renamed)" }, guide.sections[0]] };
    const e = await ad.patch(`/api/v1/admin/materials/${id}`).send({ content: edited, status: "published" });
    expect(e.status).toBe(200);
    expect(e.body.data).toMatchObject({ status: "published", sections: 3, version: "1.1" });

    const seen = (await a.get(`/api/v1/training/materials/${id}`)).body.data;
    expect(seen.content.sections.map((s) => s.id)).toEqual(["s-three", "s-two", "s-one"]);
    expect(seen.content.sections[1].title).toBe("Two (renamed)");
  });

  it("rejects a guide without sections", async () => {
    const r = await ad.post("/api/v1/admin/materials").send({ title: "Empty", type: "structured", departmentId: null, required: false, levels: ["junior"], content: { intro: "", sections: [] } });
    expect(r.status).toBe(422);
    expect(r.body.error.message).toBe("A guide needs at least one section.");
  });
});

describe("QA-003 result standing (values the Scoreboard shows)", () => {
  it("returns rank, department average, passed count and eligible headcount", async () => {
    const t = await makeTrack();
    const scores = [];
    for (const right of [true, false]) {
      const u = await makeUser({ designationId: t.designation.id });
      const a = await signedIn(u);
      await readMaterial(a, u.id, t.material.id);
      const att = (await a.post("/api/v1/training/attempts")).body.data;
      const answers = Object.fromEntries(att.questions.map((q) => [q.id, q.options.find((o) => o.text.endsWith("✓") === right).id]));
      const done = (await a.post(`/api/v1/training/attempts/${att.id}/submit`).send({ answers })).body.data;
      scores.push({ a, id: done.id ?? att.id });
    }
    const top = (await scores[0].a.get(`/api/v1/training/attempts/${scores[0].id}`)).body.data.standing;
    expect(top).toMatchObject({ rank: 1, of: 2, totalEligible: 2, departmentAverage: 50, best: 100, passedCount: 1 });
    const low = (await scores[1].a.get(`/api/v1/training/attempts/${scores[1].id}`)).body.data.standing;
    expect(low).toMatchObject({ rank: 2, of: 2, best: 0 });
  });
});

describe("QA-004 password-change limits are per account", () => {
  it("one person's failures don't block a colleague on the same IP", async () => {
    const { a } = await employee();
    const colleague = await employee();
    for (let i = 0; i < 10; i++) {
      expect((await a.post("/api/v1/me/password").send({ current_password: "wrong-one-1", new_password: "Another123" })).status).toBe(400);
    }
    expect((await a.post("/api/v1/me/password").send({ current_password: "wrong-one-1", new_password: "Another123" })).status).toBe(429);
    // Same IP, different account: unaffected.
    expect((await colleague.a.post("/api/v1/me/password").send({ current_password: "wrong-one-1", new_password: "Another123" })).status).toBe(400);
    expect((await colleague.a.post("/api/v1/me/password").send({ current_password: PASSWORD, new_password: "Another123" })).status).toBe(200);
  });
});

describe("QA-005 employees need a designation", () => {
  it("rejects creating an employee without one, and removing it later", async () => {
    let r = await ad.post("/api/v1/admin/users").send({ name: "No Desig", email: "nodesig@test.local", password: "Initial123" });
    expect(r.status).toBe(422);
    expect(r.body.error.message).toBe("Choose a designation for this employee.");
    r = await ad.post("/api/v1/admin/users").send({ name: "No Desig", email: "nodesig@test.local", password: "Initial123", role: "employee", designationId: null });
    expect(r.status).toBe(422);

    r = await ad.post("/api/v1/admin/users").send({ name: "With Desig", email: "desig@test.local", password: "Initial123", designationId: track.designation.id });
    expect(r.status).toBe(201);
    expect(r.body.data.user).toMatchObject({ departmentId: track.dept.id, level: "junior" });
    const id = r.body.data.user.id;
    expect((await ad.patch(`/api/v1/admin/users/${id}`).send({ designationId: null })).body.error.code).toBe("DESIGNATION_REQUIRED");
    // Other edits still work.
    expect((await ad.patch(`/api/v1/admin/users/${id}`).send({ name: "Renamed" })).status).toBe(200);
  });
});

describe("QA-006 progress payloads", () => {
  it("records opening on load and accepts an empty heartbeat", async () => {
    const { a } = await employee();
    const m = (await a.get(`/api/v1/training/materials/${track.material.id}`)).body.data;
    expect(m.progress.opened).toBe(true);
    expect(m.progress.lastOpenedAt).toBeTruthy();
    const r = await progress(a, track.material.id, {});
    expect(r.status).toBe(200);
    expect((await progress(a, track.material.id, { percent: "lots" })).status).toBe(422);
    expect((await progress(a, track.material.id, { unexpected: 1 })).status).toBe(422);
  });
});

describe("QA-007 guide section tracking", () => {
  it("counts sections reported together (fast scroll) or one by one", async () => {
    const m = await material({ type: "STRUCTURED_GUIDE", content: { intro: "", sections: ["x", "y", "z"].map((id) => ({ id, title: id, body: ["b"] })) } });
    const { user, a } = await employee();
    await a.get(`/api/v1/training/materials/${m.id}`);
    expect((await progress(a, m.id, { seen: ["x"] })).body.data.requirement.sectionsSeen).toBe(1);
    expect((await progress(a, m.id, { seen: ["x", "y"] })).body.data.requirement.sectionsSeen).toBe(2);
    await backdatePing(user.id, m.id, 40);
    expect((await progress(a, m.id, { seen: ["x", "y", "z"] })).body.data.completed).toBe(true);
  });
});

describe("QA-008 phone numbers", () => {
  it("accepts real numbers and blank, rejects junk — on the profile and in admin", async () => {
    const { user, a } = await employee();
    for (const ok of ["+91 98765 43210", "0522-4012345", "(0522) 401 2345", ""]) {
      expect((await a.patch("/api/v1/me").send({ phone: ok })).status).toBe(200);
    }
    for (const bad of ["12345", "abc1234567", "+91 98765 43210 98765 4321", "98765-43210 ext 5"]) {
      const r = await a.patch("/api/v1/me").send({ phone: bad });
      expect(r.status).toBe(422);
      expect(r.body.error.message).toMatch(/valid phone number/);
    }
    expect((await ad.patch(`/api/v1/admin/users/${user.id}`).send({ phone: "call me" })).status).toBe(422);
    expect((await ad.patch(`/api/v1/admin/users/${user.id}`).send({ phone: "+91 98390 10001" })).status).toBe(200);
  });
});

describe("QA-009 admin password resets are rate-limited per admin", () => {
  it("allows 20 an hour per admin, without blocking other admins", async () => {
    const busy = await signedIn(await makeAdmin({ email: "busy-admin@test.local" }));
    const other = await signedIn(await makeAdmin({ email: "other-admin@test.local" }));
    const { user } = await employee();
    for (let i = 0; i < 20; i++) expect((await busy.post(`/api/v1/admin/users/${user.id}/reset-password`)).status).toBe(200);
    const blocked = await busy.post(`/api/v1/admin/users/${user.id}/reset-password`);
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("RATE_LIMITED");
    expect((await other.post(`/api/v1/admin/users/${user.id}/reset-password`)).status).toBe(200);
  });
});

describe("QA-011 focus flags", () => {
  it("counts attempts with 2+ warnings and states the threshold", async () => {
    const before = (await ad.get("/api/v1/admin/overview")).body.data.kpis;
    const base = { assessmentId: track.assessment.id, status: "SUBMITTED", startedAt: new Date(), submittedAt: new Date(), expiresAt: new Date(), percentage: 50, passed: true, attemptNumber: 1, totalQuestions: 4, config: { departmentId: track.dept.id } };
    for (const [i, v] of [0, 1, 2, 5].entries()) {
      const u = await makeUser({ designationId: track.designation.id, email: `focus${i}@test.local` });
      await prisma.attempt.create({ data: { ...base, userId: u.id, focusViolations: v } });
    }
    const k = (await ad.get("/api/v1/admin/overview")).body.data.kpis;
    expect(k.focusFlagAt).toBe(2);
    expect(k.focusFlags - before.focusFlags).toBe(2);
  });
});

describe("QA-012 validation messages are plain English", () => {
  it("never shows Zod's raw wording", async () => {
    const cases = [
      [() => ad.post("/api/v1/admin/users").send({ email: "x@test.local", designationId: track.designation.id }), "Name is required."],
      [() => ad.post("/api/v1/admin/users").send({ name: "X", email: "x@test.local", role: "boss", designationId: track.designation.id }), "Choose a valid role."],
      [() => ad.patch(`/api/v1/admin/assessments/${track.assessment.id}`).send({ passPercent: 150 }), "Pass mark must be at most 100."],
      [() => ad.post("/api/v1/admin/locations").send({ name: "X", extra: 1 }), "extra can't be set here."],
      [() => ad.post("/api/v1/admin/departments").send({ name: "Y", active: "yes" }), "Active has the wrong format."],
    ];
    for (const [req, message] of cases) {
      const r = await req();
      expect(r.status).toBe(422);
      expect(r.body.error.message).toBe(message);
      expect(r.body.error.message).not.toMatch(/Invalid input|expected|received/);
    }
  });
});

describe("QA-013 blocked reasons come from the module conditions", () => {
  it("distinguishes no attempts left from an unopened test and a running attempt", async () => {
    const t = await makeTrack({ maxAttempts: 1 });
    const u = await makeUser({ designationId: t.designation.id });
    const a = await signedIn(u);
    await readMaterial(a, u.id, t.material.id);
    await prisma.assessment.update({ where: { id: t.assessment.id }, data: { active: false } });
    let m = await moduleOf(a);
    expect(m.conditions.find((c) => !c.met).id).toBe("questions");
    await prisma.assessment.update({ where: { id: t.assessment.id }, data: { active: true } });
    const att = (await a.post("/api/v1/training/attempts")).body.data;
    m = await moduleOf(a);
    expect(m.activeAttempt).toMatchObject({ id: att.attemptId ?? att.id });
    expect(m.eligible).toBe(false);
    await a.post(`/api/v1/training/attempts/${att.attemptId ?? att.id}/submit`).send({ answers: {} });
    m = await moduleOf(a);
    expect(m.conditions.find((c) => !c.met).id).toBe("attempts");
  });
});

describe("QA-016 announcements", () => {
  it("are no longer duplicated inside the module response", async () => {
    const { a } = await employee();
    expect(await moduleOf(a)).not.toHaveProperty("announcements");
    expect((await a.get("/api/v1/announcements")).status).toBe(200);
  });
});

describe("QA-017 new materials need an explicit audience", () => {
  it("rejects a material without audience, levels or required, then accepts explicit choices", async () => {
    const content = { url: "https://video.test/a.mp4" };
    let r = await ad.post("/api/v1/admin/materials").send({ title: "Video", type: "media", content });
    expect(r.status).toBe(422);
    expect(r.body.error.details.map((d) => d.path).sort()).toEqual(["departmentId", "levels", "required"]);
    r = await ad.post("/api/v1/admin/materials").send({ title: "Video", type: "media", content, departmentId: null, required: false, levels: [] });
    expect(r.status).toBe(422);
    expect(r.body.error.message).toBe("Choose at least one level.");
    r = await ad.post("/api/v1/admin/materials").send({ title: "Video", type: "media", content, departmentId: track.dept.id, required: false, levels: ["senior"] });
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ departmentId: track.dept.id, required: false, levels: ["senior"] });
  });
});

describe("unchanged: sign-in still works for everyone after these limits", () => {
  it("logs in", async () => {
    const u = await makeUser({ email: "plain@test.local" });
    expect((await agent().post("/api/v1/auth/login").send({ email: u.email, password: PASSWORD })).status).toBe(200);
  });
});
