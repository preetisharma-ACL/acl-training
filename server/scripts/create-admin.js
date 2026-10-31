// One-time administrator setup (safe for production — no default credentials).
//
//   npm run admin:create -- --email alok@aajneeti.social --name "Alok" [--super] [--title "Super Admin"]
//
// Generates a temporary password, prints it ONCE, and forces a password
// change at first sign-in. Re-running for an existing email resets that
// admin's password the same way.

import { parseArgs } from "node:util";
import { prisma } from "../src/config/db.js";
import { hashPassword, temporaryPassword } from "../src/utils/password.js";

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    name: { type: "string" },
    title: { type: "string" },
    super: { type: "boolean", default: false },
  },
});

const email = values.email?.trim().toLowerCase();
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !values.name?.trim()) {
  console.error('Usage: npm run admin:create -- --email you@company.com --name "Full Name" [--super] [--title "Training Admin"]');
  process.exit(1);
}

const password = temporaryPassword();
const passwordHash = await hashPassword(password);
const role = values.super ? "SUPER_ADMIN" : "ADMIN";
const adminTitle = values.title?.trim() || (values.super ? "Super Admin" : "Admin");

const existing = await prisma.user.findUnique({ where: { email } });
if (existing && existing.role === "EMPLOYEE") {
  console.error("That email belongs to an employee account. Promote it from the admin panel instead.");
  process.exit(1);
}

const user = existing
  ? await prisma.user.update({
      where: { email },
      data: { passwordHash, mustChangePassword: true, status: "ACTIVE", role, adminTitle, authVersion: { increment: 1 } },
    })
  : await prisma.user.create({
      data: { email, name: values.name.trim(), role, adminTitle, passwordHash, mustChangePassword: true, joinedAt: new Date() },
    });

await prisma.auditLog.create({
  data: { action: existing ? "ADMIN_PASSWORD_RESET_CLI" : "ADMIN_CREATED_CLI", entityType: "User", entityId: user.id, meta: { email, role } },
});

console.log(`\n${existing ? "Reset" : "Created"} ${role} ${email}`);
console.log(`Temporary password (shown once): ${password}`);
console.log("They must choose a new password at first sign-in.\n");
await prisma.$disconnect();
