import * as auth from "../services/auth.service.js";
import { meOut } from "../services/serializers.js";
import { ok } from "../utils/ApiResponse.js";

export function getMe(req, res) {
  ok(res, meOut(req.user));
}

export async function updateMe(req, res) {
  ok(res, await auth.updateProfile(req.user, req.body));
}

export async function changePassword(req, res) {
  ok(res, { user: await auth.changePassword(req, req.body) });
}
