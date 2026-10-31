// One Prisma client for the whole process.

import { PrismaClient } from "@prisma/client";
import { env } from "./env.js";

export const prisma = new PrismaClient({
  datasourceUrl: env.databaseUrl,
  log: env.isProd ? ["error"] : ["warn", "error"],
});
