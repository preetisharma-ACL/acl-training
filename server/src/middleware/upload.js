// PDF uploads: in memory (bounded by MAX_UPLOAD_MB), one file, and checked
// by content — the declared MIME type and extension alone prove nothing.

import multer from "multer";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxUploadBytes, files: 1, fields: 10 },
  fileFilter(req, file, cb) {
    const okType = file.mimetype === "application/pdf" || file.mimetype === "application/octet-stream";
    if (!okType || !/\.pdf$/i.test(file.originalname)) return cb(ApiError.badRequest("Only PDF files can be uploaded.", { code: "NOT_A_PDF" }));
    cb(null, true);
  },
}).single("file");

// Runs multer, then verifies the bytes really are a PDF.
export function uploadPdf(req, res, next) {
  pdfUpload(req, res, (err) => {
    if (err) return next(err);
    const f = req.file;
    if (!f) return next(ApiError.badRequest("Choose a PDF file to upload.", { code: "NO_FILE" }));
    const head = f.buffer.subarray(0, 1024).toString("latin1");
    const tail = f.buffer.subarray(Math.max(0, f.buffer.length - 2048)).toString("latin1");
    if (!head.includes("%PDF-") || !tail.includes("%%EOF")) {
      return next(ApiError.badRequest("This file isn't a valid PDF.", { code: "NOT_A_PDF" }));
    }
    // Refuse PDFs that carry scripts or auto-run actions.
    const body = f.buffer.toString("latin1");
    if (/\/JavaScript|\/JS\s*[(<]|\/Launch\b|\/EmbeddedFile/.test(body)) {
      return next(ApiError.badRequest("This PDF contains active content (scripts or embedded files) and can't be uploaded.", { code: "UNSAFE_PDF" }));
    }
    f.pages = (body.match(/\/Type\s*\/Page(?!s)/g) || []).length || null;
    f.safeName = f.originalname.replace(/[^\w.\- ]+/g, "_").slice(-120);
    next();
  });
}
