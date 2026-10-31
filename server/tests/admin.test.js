import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { signedIn, resetDb, closeDb, prisma, makeDepartment, makeDesignation, makeUser, makeAdmin, makeLocation, agent, PASSWORD } from "./helpers.js";

let superAdmin, admin, employee, sa, ad, emp, dept, des;

// A minimal valid PDF.
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n", "latin1");

beforeAll(async () => {
  await resetDb();
  dept = await makeDepartment({ id: "seo", name: "SEO" });
  des = await makeDesignation(dept.id, "JUNIOR", { title: "SEO Executive" });
  superAdmin = await makeAdmin({ role: "SUPER_ADMIN", email: "super@test.local" });
  admin = await makeAdmin({ email: "admin@test.local" });
  employee = await makeUser({ name: "Priya Searchable", email: "emp@test.local", designationId: des.id });
  [sa, ad, emp] = await Promise.all([signedIn(superAdmin), signedIn(admin), signedIn(employee)]);
  await makeLocation("Noida");
});
afterAll(closeDb);

describe("authorization", () => {
  it("rejects signed-out and employee access to every admin endpoint", async () => {
    for (const url of ["/api/v1/admin/overview", "/api/v1/admin/users", "/api/v1/admin/materials", "/api/v1/admin/assessments"]) {
      expect((await agent().get(url)).status).toBe(401);
      const r = await emp.get(url);
      expect(r.status).toBe(403);
    }
    expect((await emp.post("/api/v1/admin/departments").send({ name: "Hack" })).status).toBe(403);
  });
});

describe("users", () => {
  it("creates an employee who can sign in with the admin-set password straight away", async () => {
    const r = await ad.post("/api/v1/admin/users").send({ name: "New Person", email: "New@Test.local", password: "Initial123", designationId: des.id });
    expect(r.status).toBe(201);
    expect(r.body.data.user).toMatchObject({ email: "new@test.local", role: "employee", departmentId: "seo", level: "junior", mustChangePassword: false });
    expect(r.body.data.temporaryPassword).toBeUndefined();
    expect(JSON.stringify(r.body)).not.toMatch(/passwordHash/);
    const a = await signedIn({ email: "new@test.local" }, "Initial123");
    expect((await a.get("/api/v1/me")).body.data.mustChangePassword).toBe(false);
    expect((await a.get("/api/v1/training/module")).status).toBe(200);
  });

  it("lets an admin set a new password that works without a forced change", async () => {
    const u = await makeUser({ designationId: des.id });
    expect((await ad.patch(`/api/v1/admin/users/${u.id}`).send({ password: "Changed123" })).status).toBe(200);
    const a = await signedIn(u, "Changed123");
    expect((await a.get("/api/v1/training/module")).status).toBe(200);
  });

  it("generates a temporary password when none is given", async () => {
    const r = await ad.post("/api/v1/admin/users").send({ name: "Temp Person", email: "temp@test.local", designationId: des.id });
    expect(r.status).toBe(201);
    expect(r.body.data.temporaryPassword).toMatch(/^\w+-\d{4}-\w+\d{2}$/);
  });

  it("rejects duplicate emails and invalid designations", async () => {
    expect((await ad.post("/api/v1/admin/users").send({ name: "Dup", email: "emp@test.local", password: "Initial123", designationId: des.id })).status).toBe(409);
    expect((await ad.post("/api/v1/admin/users").send({ name: "Bad", email: "bad@test.local", password: "Initial123", designationId: "nope" })).status).toBe(400);
  });

  it("only lets a super admin create or edit admin accounts", async () => {
    expect((await ad.post("/api/v1/admin/users").send({ name: "Admin Two", email: "a2@test.local", role: "admin", password: "Initial123" })).status).toBe(403);
    expect((await ad.patch(`/api/v1/admin/users/${superAdmin.id}`).send({ name: "Renamed" })).status).toBe(403);
    expect((await ad.patch(`/api/v1/admin/users/${employee.id}`).send({ role: "admin" })).status).toBe(403);
    const r = await sa.post("/api/v1/admin/users").send({ name: "Admin Two", email: "a2@test.local", role: "admin", adminTitle: "Trainer", password: "Initial123" });
    expect(r.status).toBe(201);
    expect(r.body.data.user).toMatchObject({ role: "admin", adminTitle: "Trainer", designationId: null });
  });

  it("lists, searches and filters employees", async () => {
    const all = await ad.get("/api/v1/admin/users");
    expect(all.status).toBe(200);
    const row = all.body.data.find((u) => u.id === employee.id);
    expect(row).toMatchObject({ designation: "SEO Executive", departmentName: "SEO", trainingStatus: expect.any(String), status: "active" });
    expect((await ad.get(`/api/v1/admin/users?q=${encodeURIComponent(employee.name)}`)).body.data.map((u) => u.id)).toEqual([employee.id]);
    expect((await ad.get("/api/v1/admin/users?departmentId=seo&level=junior&role=employee")).body.data.every((u) => u.departmentId === "seo")).toBe(true);
    expect((await ad.get("/api/v1/admin/users?status=bogus")).status).toBe(422);
  });

  it("resets a password to a temporary one, ends sessions and forces a change", async () => {
    const u = await makeUser({ designationId: des.id });
    const session = await signedIn(u);
    const r = await ad.post(`/api/v1/admin/users/${u.id}/reset-password`);
    expect(r.status).toBe(200);
    const temp = r.body.data.temporaryPassword;
    expect(temp).toBeTruthy();
    expect((await session.get("/api/v1/me")).status).toBe(401);
    const fresh = await signedIn(u, temp);
    expect((await fresh.get("/api/v1/me")).body.data.mustChangePassword).toBe(true);
    expect((await fresh.get("/api/v1/announcements")).body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");
    expect(await prisma.auditLog.count({ where: { action: "USER_PASSWORD_RESET", entityId: u.id } })).toBe(1);
  });

  it("deactivates accounts (ending sessions) and protects the acting admin", async () => {
    const u = await makeUser();
    const session = await signedIn(u);
    expect((await ad.patch(`/api/v1/admin/users/${u.id}/status`).send({ status: "inactive" })).status).toBe(200);
    expect((await session.get("/api/v1/me")).status).toBe(401);
    expect((await agent().post("/api/v1/auth/login").send({ email: u.email, password: PASSWORD })).status).toBe(403);
    expect((await sa.patch(`/api/v1/admin/users/${superAdmin.id}/status`).send({ status: "inactive" })).status).toBe(403);
  });

  it("deletes users without history", async () => {
    const u = await makeUser();
    expect((await ad.delete(`/api/v1/admin/users/${u.id}`)).status).toBe(200);
    expect(await prisma.user.findUnique({ where: { id: u.id } })).toBeNull();
  });
});

describe("departments", () => {
  it("creates a department with three assessments, updates and deletes it", async () => {
    const r = await ad.post("/api/v1/admin/departments").send({ name: "Finance Ops", head: "Someone" });
    expect(r.status).toBe(201);
    const id = r.body.data.id;
    expect(id).toBe("finance_ops");
    const asm = await prisma.assessment.findMany({ where: { departmentId: id } });
    expect(asm.map((a) => a.level).sort()).toEqual(["JUNIOR", "SENIOR", "TEAM_HEAD"]);
    expect((await ad.post("/api/v1/admin/departments").send({ name: "finance ops" })).status).toBe(409);
    expect((await ad.patch(`/api/v1/admin/departments/${id}`).send({ location: "Noida" })).body.data.location).toBe("Noida");
    const list = await ad.get("/api/v1/admin/departments");
    expect(list.body.data.find((d) => d.id === id)).toMatchObject({ employees: 0, materials: 0, designations: [] });
    expect((await ad.delete(`/api/v1/admin/departments/${id}`)).status).toBe(200);
  });

  it("blocks deleting a department that still has designations", async () => {
    const r = await ad.delete(`/api/v1/admin/departments/${dept.id}`);
    expect(r.status).toBe(409);
  });
});

describe("locations", () => {
  it("adds, renames (moving people and departments) and deletes office locations", async () => {
    expect((await emp.get("/api/v1/admin/locations")).status).toBe(403);
    const r = await ad.post("/api/v1/admin/locations").send({ name: "Kolkata" });
    expect(r.status).toBe(201);
    const id = r.body.data.id;
    expect((await ad.post("/api/v1/admin/locations").send({ name: "kolkata" })).status).toBe(409);
    expect((await ad.post("/api/v1/admin/locations").send({ name: " " })).status).toBe(422);

    const u = await makeUser({ location: "Kolkata" });
    const d = await makeDepartment({ location: "Kolkata" });
    let list = (await ad.get("/api/v1/admin/locations")).body.data;
    expect(list.find((l) => l.id === id)).toMatchObject({ name: "Kolkata", users: 1, departments: 1 });

    // In use → can't delete.
    expect((await ad.delete(`/api/v1/admin/locations/${id}`)).status).toBe(409);

    expect((await ad.patch(`/api/v1/admin/locations/${id}`).send({ name: "Kolkata Office" })).status).toBe(200);
    expect((await prisma.user.findUnique({ where: { id: u.id } })).location).toBe("Kolkata Office");
    expect((await prisma.department.findUnique({ where: { id: d.id } })).location).toBe("Kolkata Office");
    expect((await ad.patch(`/api/v1/admin/locations/${id}`).send({ name: "noida" })).status).toBe(409);

    // Users and departments only accept listed locations.
    expect((await ad.patch(`/api/v1/admin/users/${u.id}`).send({ location: "Delhi" })).status).toBe(400);
    expect((await ad.patch(`/api/v1/admin/users/${u.id}`).send({ location: "" })).status).toBe(200);
    expect((await ad.post("/api/v1/admin/departments").send({ name: "Somewhere", location: "Delhi" })).status).toBe(400);
    await prisma.department.delete({ where: { id: d.id } });

    expect((await ad.delete(`/api/v1/admin/locations/${id}`)).status).toBe(200);
    list = (await ad.get("/api/v1/admin/locations")).body.data;
    expect(list.map((l) => l.name)).toEqual(["Noida"]);
    const logs = await prisma.auditLog.findMany({ where: { entityType: "Location" } });
    expect(logs.map((l) => l.action).sort()).toEqual(["LOCATION_CREATED", "LOCATION_DELETED", "LOCATION_UPDATED"]);
  });
});

describe("designations", () => {
  it("requires a department and a level", async () => {
    expect((await ad.post("/api/v1/admin/designations").send({ title: "Floating" })).status).toBe(422);
    expect((await ad.post("/api/v1/admin/designations").send({ title: "Floating", departmentId: "nope", level: "junior" })).status).toBe(400);
  });

  it("re-maps employees' department and level when the designation changes", async () => {
    const other = await makeDepartment({ name: "Content" });
    const d = await ad.post("/api/v1/admin/designations").send({ title: "Writer", departmentId: dept.id, level: "Junior" });
    expect(d.status).toBe(201);
    expect(d.body.data).toMatchObject({ level: "Junior", levelKey: "junior" });
    const u = await makeUser({ designationId: d.body.data.id });
    const a = await signedIn(u);
    expect((await a.get("/api/v1/me")).body.data).toMatchObject({ level: "junior", department: { id: dept.id } });

    await ad.patch(`/api/v1/admin/designations/${d.body.data.id}`).send({ departmentId: other.id, level: "head" });
    expect((await a.get("/api/v1/me")).body.data).toMatchObject({ level: "head", department: { id: other.id } });

    expect((await ad.delete(`/api/v1/admin/designations/${d.body.data.id}`)).status).toBe(409);
  });
});

describe("materials", () => {
  const guide = { intro: "Hi", sections: [{ id: "s1", title: "One", body: ["Text"], points: ["a"], tip: "t" }] };

  const scope = { departmentId: null, required: true, levels: ["head", "senior", "junior"] };

  it("creates a structured guide for the levels chosen", async () => {
    const r = await ad.post("/api/v1/admin/materials").send({ title: "Guide", type: "structured", departmentId: dept.id, required: true, levels: ["head", "senior", "junior"], content: guide });
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ type: "structured", levels: [], levelsLabel: "All levels", version: "1.0", status: "published", required: true });
    const levels = await prisma.materialLevel.count({ where: { materialId: r.body.data.id } });
    expect(levels).toBe(3);
  });

  it("validates content per type", async () => {
    expect((await ad.post("/api/v1/admin/materials").send({ title: "Bad", type: "manual", ...scope, content: { chapters: [] } })).status).toBe(422);
    expect((await ad.post("/api/v1/admin/materials").send({ title: "Bad", type: "media", ...scope, content: { url: "http://x.test/v.mp4" } })).status).toBe(422);
    expect((await ad.post("/api/v1/admin/materials").send({ title: "No file", type: "pdf", ...scope })).status).toBe(400);
  });

  it("uploads a PDF privately and attaches it", async () => {
    const up = await ad.post("/api/v1/admin/materials/upload").attach("file", PDF, { filename: "Policy.pdf", contentType: "application/pdf" });
    expect(up.status).toBe(201);
    expect(up.body.data).toMatchObject({ fileName: "Policy.pdf", sizeBytes: PDF.length, pages: 1 });
    const r = await ad.post("/api/v1/admin/materials").send({ title: "Policy", type: "pdf", departmentId: null, required: false, levels: ["head", "senior"], uploadId: up.body.data.uploadId });
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ fileName: "Policy.pdf", levels: ["head", "senior"], fileUrl: `/api/v1/training/materials/${r.body.data.id}/file` });
    const m = await prisma.material.findUnique({ where: { id: r.body.data.id } });
    expect(m.fileKey).toBe(`materials/${m.id}/r1.pdf`);
    // The pending upload is consumed.
    expect((await ad.post("/api/v1/admin/materials").send({ title: "Again", type: "pdf", ...scope, uploadId: up.body.data.uploadId })).status).toBe(400);
  });

  it("rejects non-PDF and unsafe uploads", async () => {
    const fake = await ad.post("/api/v1/admin/materials/upload").attach("file", Buffer.from("MZ not a pdf"), { filename: "x.pdf", contentType: "application/pdf" });
    expect(fake.status).toBe(400);
    const exe = await ad.post("/api/v1/admin/materials/upload").attach("file", PDF, { filename: "x.exe", contentType: "application/octet-stream" });
    expect(exe.status).toBe(400);
    const js = Buffer.from(PDF.toString("latin1").replace("/Type/Catalog", "/Type/Catalog/OpenAction<</S/JavaScript/JS(app.alert(1))>>"), "latin1");
    const unsafe = await ad.post("/api/v1/admin/materials/upload").attach("file", js, { filename: "x.pdf", contentType: "application/pdf" });
    expect(unsafe.body.error.code).toBe("UNSAFE_PDF");
  });

  it("versions content changes and applies the re-completion policy", async () => {
    const r = await ad.post("/api/v1/admin/materials").send({ title: "Versioned", type: "structured", ...scope, content: guide });
    const id = r.body.data.id;
    expect((await ad.patch(`/api/v1/admin/materials/${id}`).send({ required: false })).body.data.version).toBe("1.0");
    const v2 = await ad.patch(`/api/v1/admin/materials/${id}`).send({ content: { ...guide, intro: "Changed" } });
    expect(v2.body.data).toMatchObject({ version: "1.1", revision: 2, requiredRevision: 1 });
    const v3 = await ad.patch(`/api/v1/admin/materials/${id}`).send({ content: { ...guide, intro: "Again" }, requireRecompletion: true });
    expect(v3.body.data).toMatchObject({ version: "1.2", revision: 3, requiredRevision: 3 });
    expect(v3.body.data.versions.map((v) => v.revision)).toEqual([3, 2, 1]);
  });

  it("unpublishes, and deletes unused materials", async () => {
    const r = await ad.post("/api/v1/admin/materials").send({ title: "Temp", type: "media", ...scope, content: { url: "https://video.test/a.mp4" } });
    expect((await ad.patch(`/api/v1/admin/materials/${r.body.data.id}`).send({ status: "draft" })).body.data.status).toBe("draft");
    expect((await ad.delete(`/api/v1/admin/materials/${r.body.data.id}`)).body.data).toEqual({ deleted: true });
  });
});

describe("assessments & question bank", () => {
  let asmId;
  beforeAll(async () => {
    const a = await ad.post("/api/v1/admin/assessments").send({ departmentId: dept.id, level: "junior", durationMinutes: 15 });
    asmId = a.body.data.id;
  });

  it("creates one assessment per department and level", async () => {
    expect(asmId).toBeTruthy();
    expect((await ad.post("/api/v1/admin/assessments").send({ departmentId: dept.id, level: "junior" })).status).toBe(409);
    const list = await ad.get("/api/v1/admin/assessments");
    expect(list.body.data.find((a) => a.id === asmId)).toMatchObject({ durationSeconds: 900, durationMinutes: 15, level: "junior", employees: expect.any(Number) });
  });

  it("updates settings", async () => {
    const r = await ad.patch(`/api/v1/admin/assessments/${asmId}`).send({ passPercent: 65, maxAttempts: 2, questionsPerAttempt: 3, active: false });
    expect(r.body.data).toMatchObject({ passPercent: 65, maxAttempts: 2, questionsPerAttempt: 3, active: false });
    expect((await ad.patch(`/api/v1/admin/assessments/${asmId}`).send({ passPercent: 150 })).status).toBe(422);
  });

  it("manages questions with exactly four options and one correct answer", async () => {
    expect((await ad.post(`/api/v1/admin/assessments/${asmId}/questions`).send({ text: "Q?", options: ["a", "b", "c"], answer: 0 })).status).toBe(422);
    expect((await ad.post(`/api/v1/admin/assessments/${asmId}/questions`).send({ text: "Q?", options: ["a", "a", "c", "d"], answer: 0 })).status).toBe(422);
    const q = await ad.post(`/api/v1/admin/assessments/${asmId}/questions`).send({ text: "Capital?", options: ["A", "B", "C", "D"], answer: 2, explanation: "Because", difficulty: "hard" });
    expect(q.status).toBe(201);
    expect(q.body.data).toMatchObject({ options: ["A", "B", "C", "D"], answer: 2, difficulty: "hard" });

    const u = await ad.patch(`/api/v1/admin/questions/${q.body.data.id}`).send({ answer: 0, options: ["W", "X", "Y", "Z"] });
    expect(u.body.data).toMatchObject({ answer: 0, options: ["W", "X", "Y", "Z"] });
    expect(await prisma.questionOption.count({ where: { questionId: q.body.data.id, isCorrect: true } })).toBe(1);

    const list = await ad.get(`/api/v1/admin/assessments/${asmId}/questions?difficulty=hard`);
    expect(list.body.data).toHaveLength(1);
    expect((await ad.delete(`/api/v1/admin/questions/${q.body.data.id}`)).body.data).toEqual({ deleted: true });
  });
});

describe("announcements", () => {
  it("targets departments", async () => {
    const other = await makeDepartment();
    await ad.post("/api/v1/admin/announcements").send({ title: "For all", body: "Hello" });
    await ad.post("/api/v1/admin/announcements").send({ title: "For SEO", body: "Hi", departmentIds: [dept.id] });
    await ad.post("/api/v1/admin/announcements").send({ title: "For other", body: "Hi", departmentIds: [other.id] });
    const draft = await ad.post("/api/v1/admin/announcements").send({ title: "Draft", body: "Hi", published: false });
    const titles = (await emp.get("/api/v1/announcements")).body.data.map((a) => a.title);
    expect(titles).toEqual(expect.arrayContaining(["For all", "For SEO"]));
    expect(titles).not.toContain("For other");
    expect(titles).not.toContain("Draft");
    await ad.patch(`/api/v1/admin/announcements/${draft.body.data.id}`).send({ published: true });
    expect((await emp.get("/api/v1/announcements")).body.data.map((a) => a.title)).toContain("Draft");
  });
});

describe("overview & audit", () => {
  it("returns real counts", async () => {
    const r = await ad.get("/api/v1/admin/overview");
    expect(r.status).toBe(200);
    expect(r.body.data.kpis).toMatchObject({ departments: await prisma.department.count(), attempts: 0, designations: await prisma.designation.count() });
    expect(r.body.data.weeks).toHaveLength(8);
  });

  it("lists forgot-password requests until an admin resets the password", async () => {
    const u = await makeUser({ name: "Forgetful Person", designationId: des.id });
    await agent().post("/api/v1/auth/password-reset").send({ email: u.email });
    let r = await ad.get("/api/v1/admin/overview");
    expect(r.body.data.resetRequests).toEqual(expect.arrayContaining([expect.objectContaining({ userId: u.id, name: "Forgetful Person", email: u.email })]));
    expect((await ad.get("/api/v1/admin/users")).body.data.find((x) => x.id === u.id).resetRequestedAt).toBeTruthy();

    await ad.post(`/api/v1/admin/users/${u.id}/reset-password`);
    r = await ad.get("/api/v1/admin/overview");
    expect(r.body.data.resetRequests.some((x) => x.userId === u.id)).toBe(false);
    expect((await ad.get("/api/v1/admin/users")).body.data.find((x) => x.id === u.id).resetRequestedAt).toBeNull();
  });

  it("records admin actions", async () => {
    const r = await ad.get("/api/v1/admin/audit-logs");
    const actions = r.body.data.map((x) => x.action);
    expect(actions).toEqual(expect.arrayContaining(["USER_CREATED", "DEPARTMENT_CREATED", "MATERIAL_CREATED", "QUESTION_CREATED"]));
  });
});
