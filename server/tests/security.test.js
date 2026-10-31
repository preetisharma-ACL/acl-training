// Browser-QA retest: start-test messages, session security, origin checks,
// downloads, preferences and company-wide materials.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { app, agent, signedIn, resetDb, closeDb, prisma, makeDepartment, makeDesignation, makeUser, makeAdmin, makeTrack, readMaterial, correctAnswers, PASSWORD, ORIGIN } from "./helpers.js";

beforeAll(resetDb);
afterAll(closeDb);

const COOKIE = "aa.sid";
const cookieOf = (res) => (res.headers["set-cookie"] ?? []).find((c) => c.startsWith(`${COOKIE}=`))?.split(";")[0] ?? null;
const login = (email, password = PASSWORD, cookie) => {
  const r = request(app).post("/api/v1/auth/login").set("Origin", ORIGIN).send({ email, password });
  return cookie ? r.set("Cookie", cookie) : r;
};
const meWith = (cookie) => request(app).get("/api/v1/me").set("Cookie", cookie);

// ── 1. Start-test messages ────────────────────────────────────────────────────
describe("1 · NOT_ELIGIBLE names the real reason", () => {
  it("materials, attempts and questions each get their own message; code and condition unchanged", async () => {
    const t = await makeTrack({ maxAttempts: 1 });
    const u = await makeUser({ designationId: t.designation.id });
    const a = await signedIn(u);
    const start = () => a.post("/api/v1/training/attempts");

    let r = await start();
    expect(r.status).toBe(403);
    expect(r.body.error).toMatchObject({ code: "NOT_ELIGIBLE", message: "Finish your required training first.", details: { condition: "materials" } });

    await readMaterial(a, u.id, t.material.id);
    await prisma.assessment.update({ where: { id: t.assessment.id }, data: { active: false } });
    r = await start();
    expect(r.body.error).toMatchObject({ code: "NOT_ELIGIBLE", message: "This test isn't ready yet. Ask your training admin.", details: { condition: "questions" } });

    await prisma.assessment.update({ where: { id: t.assessment.id }, data: { active: true } });
    const att = (await start()).body.data;
    await a.post(`/api/v1/training/attempts/${att.attemptId ?? att.id}/submit`).send({ answers: {} });
    r = await start();
    expect(r.body.error).toMatchObject({ code: "NOT_ELIGIBLE", message: "You've used all your attempts. Your training admin can give you another one.", details: { condition: "attempts" } });
  });
});

describe("6 · nothing assigned yet (department without a test)", () => {
  it("blames the missing test, not attempts", async () => {
    const d = await makeDepartment();
    const u = await makeUser({ designationId: (await makeDesignation(d.id, "JUNIOR")).id });
    const a = await signedIn(u);
    const m = (await a.get("/api/v1/training/module")).body.data;
    expect(m).toMatchObject({ requiredCount: 0, eligible: false, blocker: "questions", assessment: { id: null, passPercent: null } });
    expect(m.conditions.find((c) => c.id === "attempts").detail).toBe("No test yet");
    const r = await a.post("/api/v1/training/attempts");
    expect(r.body.error).toMatchObject({ code: "NOT_ELIGIBLE", message: "This test isn't ready yet. Ask your training admin.", details: { condition: "questions" } });
  });
});

// ── 2. Session security ───────────────────────────────────────────────────────
describe("2a · session cookie attributes", () => {
  it("dev/test: HttpOnly, SameSite=Lax, Path=/", async () => {
    const u = await makeUser();
    const c = (await login(u.email)).headers["set-cookie"].find((x) => x.startsWith(COOKIE));
    expect(c).toMatch(/HttpOnly/i);
    expect(c).toMatch(/SameSite=Lax/i);
    expect(c).toMatch(/Path=\//);
  });

  it("production: __Host- cookie, HttpOnly, Secure, SameSite=Lax over HTTPS; never sent over plain HTTP", async () => {
    const u = await makeUser({ email: "prod-cookie@test.local" });
    const out = execFileSync(process.execPath, [path.resolve(import.meta.dirname, "fixtures/prod-login.js")], {
      env: {
        ...process.env,
        NODE_ENV: "production",
        DATABASE_URL: process.env.TEST_DATABASE_URL,
        TRUST_PROXY: "1",
        SERVE_FRONTEND: "0",
        APP_ORIGINS: "https://academy.example",
        QA_ORIGIN: "https://academy.example",
        QA_EMAIL: u.email,
        QA_PASSWORD: PASSWORD,
      },
      encoding: "utf8",
    });
    const { secure, plain } = JSON.parse(out.trim().split("\n").pop());
    expect(secure.status).toBe(200);
    const c = secure.cookies.find((x) => x.startsWith("__Host-aa.sid="));
    expect(c).toBeTruthy();
    expect(c).toMatch(/; HttpOnly/i);
    expect(c).toMatch(/; Secure/i);
    expect(c).toMatch(/; SameSite=Lax/i);
    expect(c).toMatch(/; Path=\//);
    expect(c).not.toMatch(/Domain=/i);
    // express-session refuses to send a Secure cookie over plain HTTP.
    expect(plain.cookies.some((x) => x.startsWith("__Host-aa.sid="))).toBe(false);
  }, 60000);
});

describe("2b · no session fixation", () => {
  it("issues a new session id on login and kills the previous one", async () => {
    const u = await makeUser();
    const first = cookieOf(await login(u.email));
    expect((await meWith(first)).status).toBe(200);
    // Log in again while presenting the old cookie (as a fixated victim would).
    const second = cookieOf(await login(u.email, PASSWORD, first));
    expect(second).toBeTruthy();
    expect(second).not.toBe(first);
    expect((await meWith(first)).status).toBe(401);
    expect((await meWith(second)).status).toBe(200);
  });

  it("ignores a planted session id", async () => {
    const u = await makeUser();
    const planted = `${COOKIE}=s%3Aattacker-chosen-id.invalidsignature`;
    const got = cookieOf(await login(u.email, PASSWORD, planted));
    expect(got).toBeTruthy();
    expect(got).not.toBe(planted);
    expect(got).not.toContain("attacker-chosen-id");
  });
});

describe("2c · other sessions end immediately", () => {
  let admin;
  beforeAll(async () => {
    admin = await signedIn(await makeAdmin());
  });

  // Same user, two devices (two cookie jars).
  async function twoDevices() {
    const u = await makeUser();
    const [laptop, phone] = [agent(), agent()];
    for (const d of [laptop, phone]) expect((await d.post("/api/v1/auth/login").send({ email: u.email, password: PASSWORD })).status).toBe(200);
    expect((await phone.get("/api/v1/me")).status).toBe(200);
    return { u, laptop, phone };
  }

  it("when an admin deactivates the user", async () => {
    const { u, laptop, phone } = await twoDevices();
    expect((await admin.patch(`/api/v1/admin/users/${u.id}/status`).send({ status: "inactive" })).status).toBe(200);
    expect((await laptop.get("/api/v1/me")).status).toBe(401);
    expect((await phone.get("/api/v1/me")).status).toBe(401);
  });

  it("when an admin resets the user's password", async () => {
    const { u, laptop, phone } = await twoDevices();
    expect((await admin.post(`/api/v1/admin/users/${u.id}/reset-password`)).status).toBe(200);
    expect((await laptop.get("/api/v1/me")).status).toBe(401);
    expect((await phone.get("/api/v1/me")).status).toBe(401);
  });

  it("when the user changes their own password (this device stays signed in)", async () => {
    const { laptop, phone } = await twoDevices();
    expect((await laptop.post("/api/v1/me/password").send({ current_password: PASSWORD, new_password: "Changed123x" })).status).toBe(200);
    expect((await laptop.get("/api/v1/me")).status).toBe(200);
    expect((await phone.get("/api/v1/me")).status).toBe(401);
  });
});

describe("2d · logout is server-side", () => {
  it("a replayed cookie after logout gets 401 and the session row is gone", async () => {
    const u = await makeUser();
    const c = cookieOf(await login(u.email));
    expect((await meWith(c)).status).toBe(200);
    const before = await prisma.session.count({ where: { sess: { path: ["userId"], equals: u.id } } });
    expect(before).toBe(1);
    expect((await request(app).post("/api/v1/auth/logout").set("Origin", ORIGIN).set("Cookie", c)).status).toBe(200);
    expect((await meWith(c)).status).toBe(401);
    expect(await prisma.session.count({ where: { sess: { path: ["userId"], equals: u.id } } })).toBe(0);
  });
});

// ── 3. Origin / CSRF ──────────────────────────────────────────────────────────
describe("3 · origin checks on state-changing requests", () => {
  let cookie, adminCookie, u;
  beforeAll(async () => {
    u = await makeUser();
    cookie = cookieOf(await login(u.email));
    const ad = await makeAdmin();
    adminCookie = cookieOf(await login(ad.email));
  });
  const send = (method, url, c, headers = {}) => {
    let r = request(app)[method](url).set("Cookie", c);
    for (const [k, v] of Object.entries(headers)) r = r.set(k, v);
    return method === "delete" ? r : r.send({});
  };

  it("rejects POST, PUT, PATCH and DELETE from another site (403 BAD_ORIGIN)", async () => {
    const evil = { Origin: "https://evil.example" };
    for (const [method, url, c] of [
      ["post", "/api/v1/auth/logout", cookie],
      ["put", "/api/v1/training/attempts/x/answers", cookie],
      ["patch", "/api/v1/me", cookie],
      ["delete", `/api/v1/admin/users/${u.id}`, adminCookie],
    ]) {
      const r = await send(method, url, c, evil);
      expect(r.status, `${method} ${url}`).toBe(403);
      expect(r.body.error.code).toBe("BAD_ORIGIN");
    }
    // A look-alike origin is not the app.
    expect((await send("patch", "/api/v1/me", cookie, { Origin: "http://localhost:5174.evil.example" })).status).toBe(403);
    // The user was not deleted and is still signed in.
    expect((await meWith(cookie)).status).toBe(200);
  });

  it("accepts the app's own origin, and same-origin requests that carry only a Referer", async () => {
    expect((await send("patch", "/api/v1/me", cookie, { Origin: ORIGIN })).status).toBe(200);
    expect((await send("patch", "/api/v1/me", cookie, { Referer: `${ORIGIN}/profile` })).status).toBe(200);
  });

  it("rejects requests with neither Origin nor Referer (browsers always send Origin on these methods)", async () => {
    const r = await send("patch", "/api/v1/me", cookie);
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe("BAD_ORIGIN");
  });

  it("leaves reads alone", async () => {
    expect((await request(app).get("/api/v1/me").set("Cookie", cookie).set("Origin", "https://evil.example")).status).toBe(200);
  });
});

// ── 6. Smaller items ──────────────────────────────────────────────────────────
describe("6 · notification preferences persist", () => {
  it("saves each toggle and keeps the others", async () => {
    const u = await makeUser({ preferences: { emailReminders: true, resultEmails: true, weeklyDigest: false } });
    const a = await signedIn(u);
    expect((await a.patch("/api/v1/me").send({ preferences: { weeklyDigest: true, emailReminders: false } })).status).toBe(200);
    // A fresh sign-in (like a reload on another device) sees the saved values.
    const again = await signedIn(u);
    expect((await again.get("/api/v1/me")).body.data.preferences).toEqual({ emailReminders: false, resultEmails: true, weeklyDigest: true });
    await again.patch("/api/v1/me").send({ preferences: { resultEmails: false } });
    expect((await again.get("/api/v1/me")).body.data.preferences).toEqual({ emailReminders: false, resultEmails: false, weeklyDigest: true });
  });
});

describe("6 · downloads have the right file and name", () => {
  const PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n", "latin1");

  it("PDF material: inline to view, attachment with its file name to download", async () => {
    const t = await makeTrack();
    const ad = await signedIn(await makeAdmin());
    const up = await ad.post("/api/v1/admin/materials/upload").attach("file", PDF, { filename: "Leave Policy 2026.pdf", contentType: "application/pdf" });
    const m = (await ad.post("/api/v1/admin/materials").send({ title: "Leave policy", type: "pdf", departmentId: t.dept.id, required: false, levels: ["junior"], uploadId: up.body.data.uploadId })).body.data;
    const a = await signedIn(await makeUser({ designationId: t.designation.id }));
    const view = await a.get(`/api/v1/training/materials/${m.id}/file`);
    expect(view.status).toBe(200);
    expect(view.headers["content-type"]).toBe("application/pdf");
    expect(view.headers["content-disposition"]).toMatch(/^inline; filename="Leave Policy 2026\.pdf"/);
    const dl = await a.get(`/api/v1/training/materials/${m.id}/file?download=1`).buffer(true);
    expect(dl.headers["content-disposition"]).toMatch(/^attachment; filename="Leave Policy 2026\.pdf"/);
    expect(Buffer.from(dl.body).subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("certificate: a PDF attachment named after the certificate id, owner only", async () => {
    const t = await makeTrack();
    const u = await makeUser({ designationId: t.designation.id });
    const a = await signedIn(u);
    await readMaterial(a, u.id, t.material.id);
    const att = (await a.post("/api/v1/training/attempts")).body.data;
    const id = att.attemptId ?? att.id;
    await a.post(`/api/v1/training/attempts/${id}/submit`).send({ answers: correctAnswers(att) });
    const c = await a.get(`/api/v1/training/attempts/${id}/certificate`).buffer(true);
    expect(c.status).toBe(200);
    expect(c.headers["content-type"]).toBe("application/pdf");
    expect(c.headers["content-disposition"]).toMatch(/^attachment; filename="Aajneeti-Certificate-AJN-[0-9A-F]{10}\.pdf"/);
    expect(Buffer.from(c.body).subarray(0, 5).toString()).toBe("%PDF-");
    const other = await signedIn(await makeUser({ designationId: t.designation.id }));
    expect((await other.get(`/api/v1/training/attempts/${id}/certificate`)).status).toBe(404);
  });
});

describe("6 · company-wide materials", () => {
  it("reach every department, but only the selected levels", async () => {
    const [d1, d2] = [await makeDepartment(), await makeDepartment()];
    const juniorIn1 = await makeUser({ designationId: (await makeDesignation(d1.id, "JUNIOR")).id });
    const juniorIn2 = await makeUser({ designationId: (await makeDesignation(d2.id, "JUNIOR")).id });
    const headIn2 = await makeUser({ designationId: (await makeDesignation(d2.id, "TEAM_HEAD")).id });
    const ad = await signedIn(await makeAdmin());
    const m = (
      await ad.post("/api/v1/admin/materials").send({
        title: "QA company-wide (juniors)",
        type: "manual",
        departmentId: null,
        required: false,
        levels: ["junior"],
        content: { chapters: [{ id: "c", title: "C", blocks: [{ type: "p", text: "x" }] }] },
      })
    ).body.data;
    expect(m.scope).toBe("company");
    const sees = async (user) => ((await (await signedIn(user)).get("/api/v1/training/module")).body.data.materials ?? []).some((x) => x.id === m.id);
    expect(await sees(juniorIn1)).toBe(true);
    expect(await sees(juniorIn2)).toBe(true);
    expect(await sees(headIn2)).toBe(false);
    expect((await (await signedIn(headIn2)).get(`/api/v1/training/materials/${m.id}`)).status).toBe(403);
  });
});
