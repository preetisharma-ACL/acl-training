// CSRF protection for cookie-authenticated, state-changing requests.
//
// Two layers, on top of SameSite=Lax cookies:
//   1. The Origin (or Referer) must be the app itself or an approved origin.
//   2. Bodies must be JSON or multipart — plain HTML forms from another site
//      can't produce application/json.

import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

const originOf = (url) => {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
};

export function originCheck(req, res, next) {
  if (SAFE.has(req.method)) return next();

  const self = `${req.protocol}://${req.get("host")}`;
  const origin = req.get("origin") || originOf(req.get("referer") || "");
  const allowed = origin && (origin === self || env.appOrigins.includes(origin));
  if (!allowed) return next(ApiError.forbidden("This request was blocked for your security.", { code: "BAD_ORIGIN" }));

  const hasBody = Number(req.get("content-length") || 0) > 0 || req.get("transfer-encoding");
  if (hasBody && !req.is(["application/json", "multipart/form-data"])) {
    return next(new ApiError(415, "Unsupported content type.", { code: "UNSUPPORTED_MEDIA_TYPE" }));
  }
  next();
}
