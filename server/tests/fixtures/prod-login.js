// Child-process fixture for session-cookie tests in PRODUCTION mode.
// Started by server/tests/security.test.js with NODE_ENV=production and the
// TEST database (never the real one). Logs in once over "HTTPS" (behind a
// proxy: X-Forwarded-Proto) and once over plain HTTP, and prints the
// Set-Cookie headers as JSON.

import request from "supertest";

const { QA_EMAIL, QA_PASSWORD, QA_ORIGIN } = process.env;
if (process.env.NODE_ENV !== "production" || !process.env.DATABASE_URL?.includes("_test")) {
  console.error("refusing: production mode against the test database only");
  process.exit(2);
}

const { createApp } = await import("../../src/app.js");
const { prisma } = await import("../../src/config/db.js");
const { pgPool } = await import("../../src/config/session.js");
const app = createApp();

const login = (https) => {
  const r = request(app).post("/api/v1/auth/login").set("Origin", QA_ORIGIN).send({ email: QA_EMAIL, password: QA_PASSWORD });
  return https ? r.set("X-Forwarded-Proto", "https") : r;
};
const secure = await login(true);
const plain = await login(false);
console.log(JSON.stringify({ secure: { status: secure.status, cookies: secure.headers["set-cookie"] ?? [] }, plain: { status: plain.status, cookies: plain.headers["set-cookie"] ?? [] } }));
await prisma.$disconnect();
await pgPool.end();
