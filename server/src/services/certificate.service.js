// Certificate PDF for a passed attempt, built only from the graded record
// and its snapshot (never from anything the browser sends).

import crypto from "node:crypto";
import { prisma } from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";
import { singlePagePdf } from "../utils/pdf.js";

export const ORGANIZATION = "Aajneeti Connect Limited";

// Stable, non-guessable id derived from the attempt.
export const certificateId = (attemptId) => `AJN-${crypto.createHash("sha256").update(`cert:${attemptId}`).digest("hex").slice(0, 10).toUpperCase()}`;

const C = { plum: "#542C5F", lime: "#C7E848", ivory: "#F5F1E8", ink: "#1F1A24", muted: "#6B6475" };

export async function certificateFor(viewer, attemptId, { admin = false } = {}) {
  const a = await prisma.attempt.findUnique({ where: { id: attemptId }, include: { user: { select: { name: true } } } });
  if (!a || (!admin && a.userId !== viewer.id)) throw ApiError.notFound("Result not found.");
  if (a.status !== "SUBMITTED" || !a.passed || a.voidedAt) throw ApiError.forbidden("A certificate is available only for a passed assessment.", { code: "NOT_PASSED" });

  const c = a.config;
  const id = certificateId(a.id);
  const date = a.submittedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const pdf = singlePagePdf({
    width: 841.89, // A4 landscape
    height: 595.28,
    title: `Certificate ${id}`,
    draw(p) {
      const { width: W, height: H } = p;
      p.rect(0, 0, W, H, C.ivory);
      p.rect(24, 24, W - 48, H - 48, C.plum);
      p.rect(30, 30, W - 60, H - 60, C.ivory);
      p.rect(0, H - 14, W, 14, C.plum);
      p.rect(W / 2 - 60, H - 150, 120, 3, C.lime);
      p.center("AAJNEETI ACADEMY", H - 90, 12, C.plum, true);
      p.center("Certificate of Completion", H - 132, 30, C.ink, true);
      p.center("This certifies that", H - 190, 12, C.muted);
      p.center(a.user.name, H - 232, 30, C.plum, true);
      p.center(`${c.designation ?? ""}${c.departmentName ? `  ·  ${c.departmentName}` : ""}`, H - 260, 12, C.muted);
      p.center("has successfully completed the assessment", H - 300, 12, C.muted);
      p.center(c.title ?? "Training assessment", H - 330, 18, C.ink, true);
      p.center(`Score ${a.percentage}%  ·  ${a.correctCount} of ${a.totalQuestions} correct  ·  Pass mark ${c.passPercent}%`, H - 360, 12, C.ink);
      p.text(`Completed ${date}`, 72, 80, 10, C.muted);
      p.text(`Certificate ID ${id}`, 72, 64, 10, C.muted, true);
      p.right(ORGANIZATION, W - 72, 80, 11, C.plum, true);
      p.right("Issued by Aajneeti Academy", W - 72, 64, 10, C.muted);
    },
  });
  return { pdf, fileName: `Aajneeti-Certificate-${id}.pdf`, certificateId: id };
}
