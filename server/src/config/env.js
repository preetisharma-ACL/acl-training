// Loads the root .env (shared with Vite) and validates the server's settings
// once at startup, so a missing secret fails loudly instead of at first use.

import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const envFile = path.join(ROOT_DIR, ".env");
// Real environment variables win over .env (process.loadEnvFile never overwrites).
if (existsSync(envFile)) process.loadEnvFile(envFile);

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  TEST_DATABASE_URL: z.string().optional(),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  SESSION_HOURS: z.coerce.number().positive().default(12),
  REMEMBER_ME_DAYS: z.coerce.number().positive().default(14),
  APP_ORIGINS: z.string().default("http://localhost:5174"),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  SERVE_FRONTEND: z.coerce.number().int().min(0).max(1).default(1),
  STORAGE_DIR: z.string().default("server/storage"),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(25),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  • ${i.path.join(".")}: ${i.message}`).join("\n");
  console.error(`Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

const e = parsed.data;

export const env = {
  ...e,
  isProd: e.NODE_ENV === "production",
  isTest: e.NODE_ENV === "test",
  // Tests run against their own database.
  databaseUrl: e.NODE_ENV === "test" && e.TEST_DATABASE_URL ? e.TEST_DATABASE_URL : e.DATABASE_URL,
  appOrigins: e.APP_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean),
  storageDir: path.resolve(ROOT_DIR, e.STORAGE_DIR),
  maxUploadBytes: Math.round(e.MAX_UPLOAD_MB * 1024 * 1024),
};

// Prisma reads DATABASE_URL itself.
process.env.DATABASE_URL = env.databaseUrl;
