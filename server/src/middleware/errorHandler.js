// Turns any thrown error into the standard failure shape. Only ApiError
// messages reach the client; everything else is logged and answered with a
// generic message so internals never leak.

import { Prisma } from "@prisma/client";
import { MulterError } from "multer";
import { ApiError } from "../utils/ApiError.js";
import { fail } from "../utils/ApiResponse.js";
import { env } from "../config/env.js";

export function notFoundHandler(req, res) {
  fail(res, 404, "NOT_FOUND", "This endpoint doesn't exist.");
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) return fail(res, err.status, err.code, err.message, err.details);

  if (err instanceof MulterError) {
    const msg = err.code === "LIMIT_FILE_SIZE" ? `The file is larger than ${env.MAX_UPLOAD_MB} MB.` : "The upload was rejected.";
    return fail(res, err.code === "LIMIT_FILE_SIZE" ? 413 : 400, "UPLOAD_REJECTED", msg);
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") return fail(res, 409, "CONFLICT", "A record with these details already exists.");
    if (err.code === "P2025") return fail(res, 404, "NOT_FOUND", "Not found.");
    if (err.code === "P2003") return fail(res, 409, "CONFLICT", "This record is still in use by other records.");
  }

  // Malformed JSON body
  if (err.type === "entity.parse.failed") return fail(res, 400, "BAD_REQUEST", "The request body isn't valid JSON.");
  if (err.type === "entity.too.large") return fail(res, 413, "PAYLOAD_TOO_LARGE", "The request is too large.");

  console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, err);
  return fail(res, 500, "INTERNAL", "Something went wrong on our side. Please try again.");
}
