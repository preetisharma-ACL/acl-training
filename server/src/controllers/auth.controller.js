import * as auth from "../services/auth.service.js";
import { SESSION_COOKIE } from "../config/session.js";
import { ok } from "../utils/ApiResponse.js";

export async function login(req, res) {
  const user = await auth.login(req, req.body);
  ok(res, { user });
}

export async function logout(req, res) {
  await auth.logout(req);
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  ok(res, { ok: true });
}

export async function requestPasswordReset(req, res) {
  ok(res, await auth.requestPasswordReset(req, req.body));
}

export async function confirmPasswordReset(req, res) {
  ok(res, await auth.confirmPasswordReset(req, req.body));
}
