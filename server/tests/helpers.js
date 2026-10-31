// Test helpers: a clean database, small factories and signed-in agents.

import request from "supertest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/config/db.js";
import { pgPool } from "../src/config/session.js";
import { hashPassword } from "../src/utils/password.js";

export { prisma };
export const app = createApp();
export const ORIGIN = "http://localhost:5174";
export const PASSWORD = "Passw0rd!x";

const TABLES = [
  "AuditLog",
  "PasswordResetToken",
  "PasswordResetRequest",
  "AnnouncementDepartment",
  "Announcement",
  "AttemptAnswer",
  "AttemptQuestion",
  "Attempt",
  "QuestionOption",
  "Question",
  "Assessment",
  "MaterialProgress",
  "MaterialVersion",
  "MaterialLevel",
  "Material",
  "User",
  "Designation",
  "Department",
  "Location",
  "session",
];

export async function resetDb() {
  if (!process.env.DATABASE_URL?.includes("_test")) throw new Error("Refusing to wipe a non-test database.");
  await prisma.$executeRawUnsafe(`TRUNCATE ${TABLES.map((t) => `"${t}"`).join(", ")} CASCADE`);
}

export async function closeDb() {
  await prisma.$disconnect();
  await pgPool.end();
}

let hashed;
const pw = async () => (hashed ??= await hashPassword(PASSWORD));

let n = 0;
const next = () => ++n;

export async function makeDepartment(data = {}) {
  const i = next();
  return prisma.department.create({ data: { id: data.id ?? `dept-${i}`, name: data.name ?? `Department ${i}`, ...data } });
}

export const makeLocation = (name) => prisma.location.create({ data: { name } });

export async function makeDesignation(departmentId, level = "JUNIOR", data = {}) {
  const i = next();
  return prisma.designation.create({ data: { id: data.id ?? `des-${i}`, title: data.title ?? `Designation ${i}`, departmentId, level, ...data } });
}

export async function makeUser(data = {}) {
  const i = next();
  return prisma.user.create({
    data: {
      name: `User ${i}`,
      email: `user${i}@test.local`,
      passwordHash: await pw(),
      role: "EMPLOYEE",
      ...data,
    },
  });
}

export const makeAdmin = (data = {}) => makeUser({ role: "ADMIN", adminTitle: "Admin", ...data });

// A supertest agent that keeps cookies and sends the app's Origin.
export function agent() {
  const a = request.agent(app);
  const wrap = (method) => (url) => a[method](url).set("Origin", ORIGIN);
  return { get: (url) => a.get(url), post: wrap("post"), patch: wrap("patch"), put: wrap("put"), delete: wrap("delete") };
}

export async function signedIn(user, password = PASSWORD) {
  const a = agent();
  const r = await a.post("/api/v1/auth/login").send({ email: user.email, password });
  if (r.status !== 200) throw new Error(`login failed: ${r.status} ${JSON.stringify(r.body)}`);
  return a;
}

// A department + designation + assessment with `questions` questions (the
// correct option is always the one whose text ends in "✓") and one required
// structured material for the level.
export async function makeTrack({ level = "JUNIOR", questions = 6, perAttempt = 4, maxAttempts = 3, passPercent = 50, durationSeconds = 600, active = true } = {}) {
  const dept = await makeDepartment();
  const designation = await makeDesignation(dept.id, level);
  const assessment = await prisma.assessment.create({
    data: { departmentId: dept.id, level, title: `${dept.name} test`, durationSeconds, passPercent, maxAttempts, questionsPerAttempt: perAttempt, active },
  });
  for (let i = 0; i < questions; i++) {
    await prisma.question.create({
      data: {
        assessmentId: assessment.id,
        text: `Question ${i}`,
        options: { create: [0, 1, 2, 3].map((p) => ({ text: p === i % 4 ? `Answer ${i} ✓` : `Wrong ${i}.${p}`, position: p, isCorrect: p === i % 4 })) },
      },
    });
  }
  const material = await prisma.material.create({
    data: {
      title: `${dept.name} guide`,
      type: "STRUCTURED_GUIDE",
      departmentId: dept.id,
      required: true,
      content: { intro: "", sections: [{ id: "s", title: "S", body: ["b"] }] },
      levels: { create: [{ level: "TEAM_HEAD" }, { level: "SENIOR" }, { level: "JUNIOR" }] },
    },
  });
  return { dept, designation, assessment, material };
}

// Moves the employee's last heartbeat back, as if they had been reading
// for `seconds` (instead of the test actually waiting).
export const backdatePing = (userId, materialId, seconds) =>
  prisma.materialProgress.update({ where: { userId_materialId: { userId, materialId } }, data: { lastPingAt: new Date(Date.now() - seconds * 1000) } });

// Reads a material the way the viewer does — open it (and its PDF file),
// report every chapter/section, send heartbeats until the server has seen
// enough reading time — then asks for completion if it isn't automatic.
// → the last progress response.
export async function readMaterial(a, userId, materialId) {
  await a.get(`/api/v1/training/materials/${materialId}`);
  const m = await prisma.material.findUnique({ where: { id: materialId } });
  if (m.type === "PDF") await a.get(`/api/v1/training/materials/${materialId}/file`);
  const seen = m.type === "MANUAL" ? m.content.chapters.map((c) => c.id) : m.type === "STRUCTURED_GUIDE" ? m.content.sections.map((s) => s.id) : undefined;
  let r;
  for (let i = 0; i < 20; i++) {
    await backdatePing(userId, materialId, 40);
    r = await a.post(`/api/v1/training/materials/${materialId}/progress`).send(seen ? { seen } : {});
    if (r.body.data?.canComplete) break;
  }
  if (!r.body.data.completed) r = await a.post(`/api/v1/training/materials/${materialId}/progress`).send({ completed: true });
  if (!r.body.data?.completed) throw new Error(`could not complete material: ${JSON.stringify(r.body)}`);
  return r;
}

// The correct / a wrong option id for each question of a running attempt.
export const correctAnswers = (attempt) => Object.fromEntries(attempt.questions.map((q) => [q.id, q.options.find((o) => o.text.endsWith("✓")).id]));
export const wrongAnswers = (attempt) => Object.fromEntries(attempt.questions.map((q) => [q.id, q.options.find((o) => !o.text.endsWith("✓")).id]));
