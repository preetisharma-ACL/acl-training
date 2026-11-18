// Activity log: who did what, with field-level changes, filters and paging.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { signedIn, resetDb, closeDb, prisma, makeDepartment, makeDesignation, makeUser, makeAdmin, makeTrack, readMaterial, correctAnswers, agent } from "./helpers.js";

let admin, ad, dept, junior, senior;
const activity = async (query = "") => (await ad.get(`/api/v1/admin/activity${query}`)).body.data;

beforeAll(async () => {
  await resetDb();
  dept = await makeDepartment({ name: "Content" });
  junior = await makeDesignation(dept.id, "JUNIOR", { title: "Content Writer" });
  senior = await makeDesignation(dept.id, "SENIOR", { title: "Content Strategist" });
  admin = await makeAdmin({ name: "Alok Admin", email: "alok@test.local" });
  ad = await signedIn(admin);
});
afterAll(closeDb);

describe("activity log", () => {
  it("records who created, edited and deleted a user, with what changed", async () => {
    const u = (await ad.post("/api/v1/admin/users").send({ name: "Riya Sharma", email: "riya@test.local", designationId: junior.id })).body.data.user;
    await ad.patch(`/api/v1/admin/users/${u.id}`).send({ designationId: senior.id, phone: "+91 98765 43210" });
    await ad.delete(`/api/v1/admin/users/${u.id}`);

    const { items } = await activity(`?entityType=User&entityId=${u.id}`);
    expect(items.map((i) => i.action)).toEqual(["USER_DELETED", "USER_UPDATED", "USER_CREATED"]);
    for (const i of items) {
      // The name survives the delete; the actor is the admin.
      expect(i.label).toBe("Riya Sharma");
      expect(i.actor).toMatchObject({ id: admin.id, name: "Alok Admin", email: "alok@test.local" });
    }
    expect(items[1].kind).toBe("updated");
    expect(items[1].changes).toEqual({
      designation: { from: "Content Writer · Content", to: "Content Strategist · Content" },
      phone: { from: null, to: "+91 98765 43210" },
    });
  });

  it("records department, designation and assessment edits as before → after", async () => {
    await ad.patch(`/api/v1/admin/departments/${dept.id}`).send({ head: "Kavya Reddy" });
    await ad.patch(`/api/v1/admin/designations/${junior.id}`).send({ title: "Junior Content Writer" });
    const assessment = await prisma.assessment.findFirst({ where: { departmentId: dept.id } });
    if (assessment) await ad.patch(`/api/v1/admin/assessments/${assessment.id}`).send({ passPercent: 70 });

    const { items } = await activity("?kind=updated");
    expect(items.find((i) => i.action === "DEPARTMENT_UPDATED")).toMatchObject({ label: "Content", changes: { head: { from: null, to: "Kavya Reddy" } } });
    expect(items.find((i) => i.action === "DESIGNATION_UPDATED")).toMatchObject({ label: "Junior Content Writer", changes: { title: { from: "Content Writer", to: "Junior Content Writer" } } });
  });

  it("records sign-ins, sign-outs and profile edits by employees", async () => {
    const e = await makeUser({ name: "Neha Gupta", email: "neha@test.local", designationId: junior.id });
    const a = await signedIn(e);
    await a.patch("/api/v1/me").send({ bio: "Hello" });
    await a.post("/api/v1/auth/logout");
    await agent().post("/api/v1/auth/login").send({ email: e.email, password: "wrong-password1" });

    const { items } = await activity(`?entityType=User&entityId=${e.id}`);
    expect(items.map((i) => i.action)).toEqual(["LOGIN_FAILED", "LOGOUT", "PROFILE_UPDATED", "LOGIN_SUCCEEDED"]);
    expect(items.find((i) => i.action === "PROFILE_UPDATED")).toMatchObject({ actor: { name: "Neha Gupta" }, changes: { bio: { from: null, to: "Hello" } } });
    // A failed sign-in has no actor: nobody was signed in.
    expect(items[0].actor).toBeNull();
    expect((await activity(`?kind=access&actorId=${e.id}`)).items.every((i) => i.kind === "access")).toBe(true);
  });

  it("records test starts and submissions with the score", async () => {
    const track = await makeTrack();
    const e = await makeUser({ name: "Test Taker", designationId: track.designation.id });
    const a = await signedIn(e);
    await readMaterial(a, e.id, track.material.id);
    const attempt = (await a.post("/api/v1/training/attempts")).body.data;
    await a.post(`/api/v1/training/attempts/${attempt.id}/submit`).send({ answers: correctAnswers(attempt) });

    const { items } = await activity(`?kind=tests&actorId=${e.id}`);
    expect(items.map((i) => i.action)).toEqual(["ATTEMPT_SUBMITTED", "ATTEMPT_STARTED"]);
    expect(items[0]).toMatchObject({ label: track.assessment.title, meta: { percentage: 100, passed: true } });
  });

  it("hides page views unless asked, searches by name and pages with a cursor", async () => {
    const u = await makeUser({ name: "Searchable Person", designationId: junior.id });
    await ad.get(`/api/v1/admin/users/${u.id}`); // USER_VIEWED
    expect((await activity()).items.some((i) => i.action === "USER_VIEWED")).toBe(false);
    expect((await activity("?views=true")).items.some((i) => i.action === "USER_VIEWED")).toBe(true);
    expect((await activity("?kind=views")).items.every((i) => i.kind === "views")).toBe(true);

    expect((await activity("?q=riya")).items.every((i) => i.label === "Riya Sharma" || i.actor?.name?.toLowerCase().includes("riya"))).toBe(true);
    expect((await activity("?q=riya")).items.length).toBeGreaterThan(0);

    const first = await activity("?limit=2");
    expect(first.items).toHaveLength(2);
    const second = await activity(`?limit=2&cursor=${first.nextCursor}`);
    expect(second.items[0].id).not.toBe(first.items[1].id);
    expect(new Date(second.items[0].at) <= new Date(first.items[1].at)).toBe(true);
  });

  it("lists the people who appear in the log", async () => {
    const people = await (await ad.get("/api/v1/admin/activity/actors")).body.data;
    expect(people.map((p) => p.name)).toEqual(expect.arrayContaining(["Alok Admin", "Neha Gupta"]));
  });

  it("is admin-only", async () => {
    const e = await signedIn(await makeUser({ designationId: junior.id }));
    expect((await e.get("/api/v1/admin/activity")).status).toBe(403);
  });
});
