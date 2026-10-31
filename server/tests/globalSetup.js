// Brings the TEST database up to the latest migration before any test runs.

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

export default function setup() {
  const root = path.resolve(import.meta.dirname, "../..");
  if (existsSync(path.join(root, ".env"))) process.loadEnvFile(path.join(root, ".env"));
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set — tests refuse to run against the main database.");
  if (url === process.env.DATABASE_URL) throw new Error("TEST_DATABASE_URL must differ from DATABASE_URL.");
  execSync("npx prisma migrate deploy", { cwd: root, stdio: "pipe", env: { ...process.env, DATABASE_URL: url } });
}
