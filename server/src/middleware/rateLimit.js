// Rate limits for credential endpoints and a general API ceiling.

import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { fail } from "../utils/ApiResponse.js";
import { env } from "../config/env.js";

const handler = (req, res) => fail(res, 429, "RATE_LIMITED", "Too many attempts. Please wait a few minutes and try again.");

const common = { standardHeaders: "draft-8", legacyHeaders: false, handler };

// Per IP + email, so one person can't lock everybody out from a shared office IP.
export const loginLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: env.isTest ? 1000 : 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}|${String(req.body?.email ?? "").trim().toLowerCase()}`,
});

export const passwordResetLimiter = rateLimit({ ...common, windowMs: 60 * 60 * 1000, limit: env.isTest ? 1000 : 5 });

// Changing your own password (signed in): failed attempts are counted per
// account, so one person's typos never block colleagues on the same office
// IP. A much higher per-IP ceiling still stops one machine from cycling
// through many accounts.
const changeByUser = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `pw-change|user|${req.user?.id}`,
});
const changeByIp = rateLimit({ ...common, windowMs: 15 * 60 * 1000, limit: env.isTest ? 1000 : 100, keyGenerator: (req) => `pw-change|ip|${ipKeyGenerator(req.ip)}` });
export const passwordChangeLimiter = [changeByIp, changeByUser];

// Admin password resets issue a new credential each time: capped per admin.
export const adminResetLimiter = rateLimit({
  ...common,
  windowMs: 60 * 60 * 1000,
  limit: 20,
  keyGenerator: (req) => `admin-reset|${req.user?.id}`,
  handler: (req, res) => fail(res, 429, "RATE_LIMITED", "Too many password resets in a short time. Please wait a while and try again."),
});

export const apiLimiter = rateLimit({ ...common, windowMs: 60 * 1000, limit: env.isTest ? 100000 : 300 });
