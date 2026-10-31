// ─── Auth & profile service ─────────────────────────────────────────────────
// Backed by the API. Sign-in creates a server-side session; the browser only
// holds an httpOnly cookie, so there is no token in JS (USES_TOKEN = false).
//
//   POST /auth/login            { email, password, remember } → { user }
//   POST /auth/logout
//   POST /auth/password-reset   { email }   (always succeeds)
//   GET  /me                    → Me (department/level resolved server-side)
//   PATCH /me                   { phone, location, bio, preferences }
//   POST /me/password           { current_password, new_password, confirm_password }
//
// Mock mode (VITE_USE_MOCK=true) swaps this file for services/mock/auth.js.

import { get, post, patch } from "./api";

export const USES_TOKEN = false;

export async function login(email, password, remember = false) {
  return post("/auth/login", { email: String(email).trim(), password, remember });
}

export const getMe = () => get("/me");

export const logout = () => post("/auth/logout");

// Office locations for the profile form → [{ id, name }]
export const listOfficeLocations = () => get("/locations");

export const requestPasswordReset = (email) => post("/auth/password-reset", { email: String(email).trim() });

export const updateProfile = (userId, p) => {
  const body = {};
  for (const k of ["phone", "location", "bio", "preferences"]) if (k in p) body[k] = p[k];
  return patch("/me", body);
};

export async function changePassword(userId, current, next, confirm) {
  const r = await post("/me/password", { current_password: current, new_password: next, ...(confirm !== undefined ? { confirm_password: confirm } : {}) });
  return r.user;
}
