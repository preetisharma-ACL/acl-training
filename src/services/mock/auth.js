// ─── Auth & profile service ─────────────────────────────────────────────────
// FRONTEND-ONLY MOCK. No real authentication happens here: credentials are
// checked against the mock database and a fake token is stored. Contract the
// backend should provide (see README.md):
//
//   POST /auth/login/            { email, password } → { token, user }
//   POST /auth/logout/
//   POST /auth/password-reset/   { email }
//   GET  /me/                    → Me (below)
//   PATCH /me/                   { phone, location, bio, preferences }
//   POST /me/password/           { current_password, new_password }
//
//   Me: { id, role: "employee" | "admin", name, email, phone, code, location,
//         joinedAt, bio, adminTitle?, preferences,
//         designation: { id, title, level } | null,
//         department:  { id, name, description, head } | null }
//
// The department is resolved SERVER-SIDE from the designation. The UI never
// asks the employee for it.

import { db, commit, delay, locationsOf } from "./mockDb";

// The mock hands out a fake token; the real API uses an httpOnly cookie.
export const USES_TOKEN = true;

function toMe(u) {
  const s = db();
  const des = s.designations.find((d) => d.id === u.designationId) || null;
  const dept = des?.departmentId ? s.departments.find((d) => d.id === des.departmentId) : null;
  return {
    id: u.id,
    role: u.role,
    name: u.name,
    email: u.email,
    phone: u.phone,
    code: u.code,
    location: u.location,
    joinedAt: u.joinedAt,
    bio: u.bio || "",
    adminTitle: u.adminTitle || null,
    preferences: { ...(u.preferences || {}) },
    mustChangePassword: false,
    designation: des ? { id: des.id, title: des.title, level: des.level } : null,
    department: dept ? { id: dept.id, name: dept.name, description: dept.description, head: dept.head, location: dept.location } : null,
  };
}

const findUser = (id) => db().users.find((u) => u.id === id);

export async function login(email, password) {
  await delay(650);
  const u = db().users.find((x) => x.email.toLowerCase() === String(email).trim().toLowerCase());
  if (!u || u.password !== password) throw new Error("That email and password don't match our records.");
  if (u.status !== "active") throw new Error("Your account is inactive. Please contact an administrator.");
  u.lastActiveAt = new Date().toISOString();
  commit();
  return { token: `mock.${u.id}`, user: toMe(u) };
}

export async function getMe(token) {
  await delay(180);
  const id = String(token || "").replace(/^mock\./, "");
  const u = findUser(id);
  if (!u || u.status !== "active") throw new Error("Your session has expired. Please sign in again.");
  return toMe(u);
}

export async function logout() {
  await delay(120);
}

export async function listOfficeLocations() {
  await delay(150);
  return locationsOf(db());
}

export async function requestPasswordReset(email) {
  await delay(700);
  // Always succeed: never reveal whether an email has an account.
  return { ok: true, email };
}

export async function updateProfile(userId, patch) {
  await delay(450);
  const u = findUser(userId);
  if (!u) throw new Error("User not found.");
  // Only these fields are editable by the employee; name, email, designation
  // and department are managed by admins.
  for (const k of ["phone", "location", "bio"]) if (k in patch) u[k] = patch[k];
  if (patch.preferences) u.preferences = { ...(u.preferences || {}), ...patch.preferences };
  commit();
  return toMe(u);
}

export async function changePassword(userId, current, next) {
  await delay(600);
  const u = findUser(userId);
  if (!u || u.password !== current) throw new Error("Your current password is incorrect.");
  if (next.length < 8) throw new Error("Use at least 8 characters.");
  u.password = next;
  commit();
  return toMe(u);
}
