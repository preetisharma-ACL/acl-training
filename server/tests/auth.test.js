import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app, agent, signedIn, resetDb, closeDb, prisma, makeDepartment, makeDesignation, makeUser, makeAdmin, makeLocation, PASSWORD, ORIGIN } from "./helpers.js";
import { issueResetToken } from "../src/services/auth.service.js";

let dept, des, employee, admin;

beforeAll(async () => {
  await resetDb();
  dept = await makeDepartment({ name: "SEO" });
  des = await makeDesignation(dept.id, "SENIOR", { title: "SEO Analyst" });
  employee = await makeUser({ email: "emp@test.local", designationId: des.id });
  admin = await makeAdmin({ email: "admin@test.local" });
  await makeLocation("Noida");
});
afterAll(closeDb);

const login = (body) => request(app).post("/api/v1/auth/login").set("Origin", ORIGIN).send(body);

describe("login", () => {
  it("signs in with valid credentials, sets an httpOnly cookie and resolves department + level", async () => {
    const r = await login({ email: "EMP@test.local ", password: PASSWORD });
    expect(r.status).toBe(200);
    const cookie = r.headers["set-cookie"].join(";");
    expect(cookie).toMatch(/aa\.sid=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    const u = r.body.data.user;
    expect(u).toMatchObject({ role: "employee", email: "emp@test.local", level: "senior" });
    expect(u.designation).toMatchObject({ title: "SEO Analyst", level: "Senior", levelKey: "senior" });
    expect(u.department).toMatchObject({ id: dept.id, name: "SEO" });
    expect(JSON.stringify(r.body)).not.toMatch(/passwordHash|argon2/);
  });

  it("rejects a wrong password with a generic message", async () => {
    const r = await login({ email: "emp@test.local", password: "nope-nope-1" });
    expect(r.status).toBe(401);
    expect(r.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("gives an unknown email the same answer as a wrong password", async () => {
    const r = await login({ email: "ghost@test.local", password: "whatever-1" });
    expect(r.status).toBe(401);
    expect(r.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("refuses inactive and suspended accounts (only after a correct password)", async () => {
    const inactive = await makeUser({ status: "INACTIVE" });
    const suspended = await makeUser({ status: "SUSPENDED" });
    for (const u of [inactive, suspended]) {
      expect((await login({ email: u.email, password: "wrong-pass-1" })).body.error.code).toBe("INVALID_CREDENTIALS");
      const r = await login({ email: u.email, password: PASSWORD });
      expect(r.status).toBe(403);
      expect(r.body.error.code).toBe("ACCOUNT_INACTIVE");
    }
  });

  it("validates the payload", async () => {
    const r = await login({ email: "not-an-email", password: "" });
    expect(r.status).toBe(422);
  });

  it("blocks cross-site requests (CSRF origin check)", async () => {
    const r = await request(app).post("/api/v1/auth/login").set("Origin", "https://evil.example").send({ email: "emp@test.local", password: PASSWORD });
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe("BAD_ORIGIN");
  });

  it("sets a persistent cookie only with remember=true", async () => {
    const plain = await login({ email: "emp@test.local", password: PASSWORD });
    expect(plain.headers["set-cookie"].join(";")).not.toMatch(/Expires=/i);
    const remembered = await login({ email: "emp@test.local", password: PASSWORD, remember: true });
    expect(remembered.headers["set-cookie"].join(";")).toMatch(/Expires=/i);
  });
});

describe("/me", () => {
  it("requires a session", async () => {
    const r = await request(app).get("/api/v1/me");
    expect(r.status).toBe(401);
  });

  it("returns the profile for the signed-in user", async () => {
    const a = await signedIn(employee);
    const r = await a.get("/api/v1/me");
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ id: employee.id, role: "employee", department: { id: dept.id } });
  });

  it("lets employees update phone, location, bio and preferences only", async () => {
    const a = await signedIn(employee);
    const r = await a.patch("/api/v1/me").send({ phone: "+91 98765 43210", location: "Noida", bio: "Hi", preferences: { weeklyDigest: true } });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ phone: "+91 98765 43210", location: "Noida", bio: "Hi", preferences: { weeklyDigest: true } });
    // Only an office from the admin's list (any casing), or "" for not set.
    expect((await a.patch("/api/v1/me").send({ location: "Gurugram" })).status).toBe(400);
    expect((await a.patch("/api/v1/me").send({ location: "noida" })).body.data.location).toBe("Noida");
    expect((await a.patch("/api/v1/me").send({ location: "" })).body.data.location).toBe("");
    expect((await a.get("/api/v1/locations")).body.data.map((l) => l.name)).toEqual(["Noida"]);

    for (const forbidden of [{ email: "x@y.z" }, { name: "Boss" }, { designationId: "x" }, { role: "ADMIN" }, { status: "ACTIVE" }]) {
      const f = await a.patch("/api/v1/me").send(forbidden);
      expect(f.status).toBe(422);
    }
    const fresh = await prisma.user.findUnique({ where: { id: employee.id } });
    expect(fresh.email).toBe("emp@test.local");
    expect(fresh.role).toBe("EMPLOYEE");
  });
});

describe("logout", () => {
  it("destroys the session server-side", async () => {
    const a = await signedIn(employee);
    expect((await a.get("/api/v1/me")).status).toBe(200);
    expect((await a.post("/api/v1/auth/logout")).status).toBe(200);
    expect((await a.get("/api/v1/me")).status).toBe(401);
  });
});

describe("change password", () => {
  it("verifies the current password", async () => {
    const u = await makeUser();
    const a = await signedIn(u);
    const r = await a.post("/api/v1/me/password").send({ current_password: "wrong-one-1", new_password: "BrandNew123" });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe("WRONG_PASSWORD");
  });

  it("validates strength and confirmation", async () => {
    const u = await makeUser();
    const a = await signedIn(u);
    expect((await a.post("/api/v1/me/password").send({ current_password: PASSWORD, new_password: "short" })).status).toBe(422);
    expect((await a.post("/api/v1/me/password").send({ current_password: PASSWORD, new_password: "BrandNew123", confirm_password: "Other123" })).status).toBe(422);
  });

  it("changes the password, keeps this session and signs out all others", async () => {
    const u = await makeUser();
    const here = await signedIn(u);
    const elsewhere = await signedIn(u);
    const r = await here.post("/api/v1/me/password").send({ current_password: PASSWORD, new_password: "BrandNew123", confirm_password: "BrandNew123" });
    expect(r.status).toBe(200);
    expect((await here.get("/api/v1/me")).status).toBe(200);
    expect((await elsewhere.get("/api/v1/me")).status).toBe(401);
    expect((await login({ email: u.email, password: PASSWORD })).status).toBe(401);
    expect((await login({ email: u.email, password: "BrandNew123" })).status).toBe(200);
  });
});

describe("forced password change", () => {
  it("blocks everything but /me and /me/password until a new password is set", async () => {
    const u = await makeUser({ mustChangePassword: true });
    const a = await signedIn(u);
    const me = await a.get("/api/v1/me");
    expect(me.status).toBe(200);
    expect(me.body.data.mustChangePassword).toBe(true);
    const blocked = await a.patch("/api/v1/me").send({ bio: "x" });
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");
    expect((await a.post("/api/v1/me/password").send({ current_password: PASSWORD, new_password: "Fresh12345" })).status).toBe(200);
    expect((await a.patch("/api/v1/me").send({ bio: "x" })).status).toBe(200);
  });
});

describe("password reset", () => {
  it("answers the same for known and unknown emails and queues a request for admins", async () => {
    const known = await agent().post("/api/v1/auth/password-reset").send({ email: "emp@test.local" });
    const unknown = await agent().post("/api/v1/auth/password-reset").send({ email: "ghost@test.local" });
    expect(known.status).toBe(200);
    expect(unknown.body).toEqual(known.body);
    expect(await prisma.passwordResetRequest.count({ where: { userId: employee.id } })).toBe(1);
  });

  it("accepts a valid token once, then rejects it", async () => {
    const u = await makeUser();
    const old = await signedIn(u);
    const token = await issueResetToken(u.id);
    const ok = await agent().post("/api/v1/auth/password-reset/confirm").send({ token, new_password: "ResetPass99" });
    expect(ok.status).toBe(200);
    expect((await old.get("/api/v1/me")).status).toBe(401);
    const again = await agent().post("/api/v1/auth/password-reset/confirm").send({ token, new_password: "ResetPass98" });
    expect(again.status).toBe(400);
    expect((await login({ email: u.email, password: "ResetPass99" })).status).toBe(200);
    const stored = await prisma.passwordResetToken.findFirst({ where: { userId: u.id } });
    expect(stored.tokenHash).not.toBe(token);
  });
});

describe("account deactivation", () => {
  it("ends existing sessions when an account stops being active", async () => {
    const u = await makeUser();
    const a = await signedIn(u);
    await prisma.user.update({ where: { id: u.id }, data: { status: "INACTIVE" } });
    expect((await a.get("/api/v1/me")).status).toBe(401);
  });
});

describe("admin user", () => {
  it("reports role admin with its title and no department", async () => {
    const a = await signedIn(admin);
    const r = await a.get("/api/v1/me");
    expect(r.body.data).toMatchObject({ role: "admin", adminTitle: "Admin", department: null, designation: null });
  });
});
