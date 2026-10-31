// Phase 5: assignment rules, material access, progress and unlock conditions.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { signedIn, resetDb, closeDb, prisma, makeDepartment, makeDesignation, makeUser, makeAdmin, makeTrack, readMaterial, backdatePing } from "./helpers.js";

let track, other, emp, a, senior, sa;

const material = (data) =>
  prisma.material.create({
    data: {
      title: data.title,
      type: "MANUAL",
      required: data.required ?? false,
      departmentId: data.departmentId ?? null,
      status: data.status ?? "PUBLISHED",
      content: { chapters: [{ id: "c", title: "C", blocks: [{ type: "p", text: "x" }] }] },
      levels: { create: (data.levels ?? ["TEAM_HEAD", "SENIOR", "JUNIOR"]).map((level) => ({ level })) },
    },
  });

let company, otherDept, seniorsOnly, draft;

beforeAll(async () => {
  await resetDb();
  track = await makeTrack({ level: "JUNIOR" });
  other = await makeDepartment({ name: "Elsewhere" });
  company = await material({ title: "Handbook" });
  otherDept = await material({ title: "Other dept", departmentId: other.id });
  seniorsOnly = await material({ title: "Seniors only", departmentId: track.dept.id, levels: ["SENIOR"] });
  draft = await material({ title: "Draft", departmentId: track.dept.id, status: "DRAFT" });
  emp = await makeUser({ designationId: track.designation.id });
  a = await signedIn(emp);
  const seniorDes = await makeDesignation(track.dept.id, "SENIOR");
  senior = await makeUser({ designationId: seniorDes.id });
  sa = await signedIn(senior);
});
afterAll(closeDb);

describe("module", () => {
  it("is derived from the designation: department + level materials and company-wide ones", async () => {
    const r = await a.get("/api/v1/training/module");
    expect(r.status).toBe(200);
    const m = r.body.data;
    expect(m.department.id).toBe(track.dept.id);
    expect(m.level).toBe("junior");
    expect(m.materials.map((x) => x.title).sort()).toEqual([track.material.title, "Handbook"].sort());
    // Department material first.
    expect(m.materials[0].scope).toBe("department");
    expect(m.assessment).toMatchObject({ id: track.assessment.id, questionCount: 4, bankSize: 6, maxAttempts: 3, attemptsLeft: 3 });
    expect(m.stage).toBe("learn");
    expect(m.eligible).toBe(false);
    expect(m.conditions.find((c) => c.id === "materials").met).toBe(false);
  });

  it("gives seniors the senior-level material", async () => {
    const titles = (await sa.get("/api/v1/training/module")).body.data.materials.map((x) => x.title);
    expect(titles).toContain("Seniors only");
  });

  it("shows the unassigned state for employees without a designation", async () => {
    const u = await makeUser();
    const r = await (await signedIn(u)).get("/api/v1/training/module");
    expect(r.body.data).toMatchObject({ stage: "unassigned", department: null, assessment: null, eligible: false });
    expect(r.body.data.materials.map((x) => x.title)).toEqual(["Handbook"]);
  });
});

describe("material access", () => {
  it("opens assigned and company-wide materials", async () => {
    const r = await a.get(`/api/v1/training/materials/${track.material.id}`);
    expect(r.status).toBe(200);
    expect(r.body.data.content.sections).toHaveLength(1);
    expect((await a.get(`/api/v1/training/materials/${company.id}`)).status).toBe(200);
  });

  it("refuses another department's material", async () => {
    const r = await a.get(`/api/v1/training/materials/${otherDept.id}`);
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe("NOT_ASSIGNED");
  });

  it("refuses material for another level", async () => {
    expect((await a.get(`/api/v1/training/materials/${seniorsOnly.id}`)).status).toBe(403);
  });

  it("refuses unpublished material", async () => {
    expect((await a.get(`/api/v1/training/materials/${draft.id}`)).status).toBe(403);
  });

  it("refuses progress on materials that aren't assigned", async () => {
    expect((await a.post(`/api/v1/training/materials/${otherDept.id}/progress`).send({ completed: true })).status).toBe(403);
  });

  it("lets admins open any material", async () => {
    const ad = await signedIn(await makeAdmin());
    expect((await ad.get(`/api/v1/training/materials/${otherDept.id}`)).status).toBe(200);
  });
});

describe("progress and unlock", () => {
  it("tracks percent (only upwards) and completion", async () => {
    // Progress needs an opened material (opening is recorded by the server).
    const unopened = await material({ title: "Unopened" });
    expect((await a.post(`/api/v1/training/materials/${unopened.id}/progress`).send({ percent: 40 })).body.error.code).toBe("NOT_OPENED");
    await a.get(`/api/v1/training/materials/${company.id}`);
    let r = await a.post(`/api/v1/training/materials/${company.id}/progress`).send({ percent: 40 });
    expect(r.body.data).toMatchObject({ opened: true, percent: 40, completed: false });
    r = await a.post(`/api/v1/training/materials/${company.id}/progress`).send({ percent: 10 });
    expect(r.body.data.percent).toBe(40);
    expect((await a.post(`/api/v1/training/materials/${company.id}/progress`).send({ percent: 140 })).status).toBe(422);
  });

  it("unlocks the assessment once every required material is complete", async () => {
    await readMaterial(a, emp.id, track.material.id);
    const m = (await a.get("/api/v1/training/module")).body.data;
    expect(m.completedRequired).toBe(1);
    expect(m.eligible).toBe(true);
    expect(m.stage).toBe("assess");
  });

  it("locks again when a required material is updated with re-completion", async () => {
    const ad = await signedIn(await makeAdmin());
    await ad.patch(`/api/v1/admin/materials/${track.material.id}`).send({ content: { intro: "v2", sections: [{ id: "s", title: "S", body: ["new"] }] }, requireRecompletion: true });
    let m = (await a.get("/api/v1/training/module")).body.data;
    expect(m.eligible).toBe(false);
    expect(m.materials.find((x) => x.id === track.material.id).progress).toMatchObject({ completed: false, outdated: true });
    // The new version has to be read again, not just re-marked.
    expect((await a.post(`/api/v1/training/materials/${track.material.id}/progress`).send({ completed: true })).status).toBe(409);
    await readMaterial(a, emp.id, track.material.id);
    m = (await a.get("/api/v1/training/module")).body.data;
    expect(m.eligible).toBe(true);
    expect(m.materials.find((x) => x.id === track.material.id).progress.completedVersion).toBe("1.1");
  });

  it("does not unlock an inactive assessment", async () => {
    await prisma.assessment.update({ where: { id: track.assessment.id }, data: { active: false } });
    const m = (await a.get("/api/v1/training/module")).body.data;
    expect(m.eligible).toBe(false);
    expect((await a.post("/api/v1/training/attempts")).status).toBe(403);
    await prisma.assessment.update({ where: { id: track.assessment.id }, data: { active: true } });
  });
});
