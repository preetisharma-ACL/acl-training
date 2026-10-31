// ─── Training & Assessment service (employee side) ──────────────────────────
// Backed by the API. Eligibility, question selection, the timer and grading
// all happen on the server; questions arrive without answers.
//
//   GET  /training/module                  → Module
//   GET  /training/materials/{id}          → Material incl. content / fileUrl
//   POST /training/materials/{id}/progress { percent?, seen?, completed? }  (heartbeat)
//   POST /training/attempts                → Attempt (or the running one)
//   GET  /training/attempts/active         → running Attempt | null
//   PUT  /training/attempts/{id}/answers   { answers, focus_violations }  (autosave)
//   POST /training/attempts/{id}/submit    { answers, time_taken_seconds, focus_violations, auto_submitted }
//   GET  /training/attempts/mine           → Result summaries
//   GET  /training/attempts/{id}           → Result incl. review + standing
//   GET  /training/attempts/{id}/certificate → PDF
//   GET  /announcements
//
// Mock mode (VITE_USE_MOCK=true) swaps this file for services/mock/training.js.

import { get, post, put, fileUrl } from "./api";
import { makePdf } from "../lib/pdf";

export const perAttempt = (a, bankSize) => Math.max(1, Math.min(bankSize, a?.questionsPerAttempt ?? bankSize));

// ── Module & materials ──────────────────────────────────────────────────────

export const getMyModule = () => get("/training/module");

export const getMaterial = (me, id) => get(`/training/materials/${encodeURIComponent(id)}`);

// Heartbeat from the open viewer. The server records reading time itself
// and only completes a material on its own evidence.
export const updateProgress = (me, id, p = {}) => {
  const body = {};
  if (p.percent != null) body.percent = Math.max(0, Math.min(100, p.percent));
  if (p.seen?.length) body.seen = p.seen.slice(0, 200);
  if (p.completed != null) body.completed = !!p.completed;
  return post(`/training/materials/${encodeURIComponent(id)}/progress`, body);
};

// Manuals and guides → PDF blocks, for the Download button.
function toBlocks(m) {
  if (m.type === "structured") {
    const out = [];
    if (m.content?.intro) out.push({ type: "p", text: m.content.intro });
    for (const s of m.content?.sections ?? []) {
      out.push({ type: "h", text: s.title });
      for (const p of s.body ?? []) out.push({ type: "p", text: p });
      for (const p of s.points ?? []) out.push({ type: "li", text: p });
      if (s.tip) out.push({ type: "tip", label: "TIP", text: s.tip });
    }
    return out;
  }
  const out = [];
  for (const ch of m.content?.chapters ?? []) {
    out.push({ type: "h", text: ch.title });
    for (const b of ch.blocks) {
      if (b.type === "p") out.push({ type: "p", text: b.text });
      else if (b.type === "h") out.push({ type: "p", text: b.text.toUpperCase() });
      else if (b.type === "ul") b.items.forEach((t) => out.push({ type: "li", text: t }));
      else if (b.type === "ol") b.items.forEach((t, i) => out.push({ type: "num", n: i + 1, text: t }));
      else if (b.type === "callout") out.push({ type: "tip", label: (b.title || "NOTE").toUpperCase(), text: b.text });
    }
  }
  return out;
}

const fileCache = new Map();

// → { url, pages, sizeBytes, fileName } | null (media links have no file).
// Uploaded PDFs stream from the API (authorised, same-origin cookie);
// manuals and guides are rendered to PDF in the browser.
export async function getMaterialFile(material) {
  if (material.type === "media") return null;
  const fileName = material.fileName || `${material.title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-")}.pdf`;
  if (material.type === "pdf") {
    if (!material.fileUrl) return null;
    return { url: fileUrl(material.fileUrl), downloadUrl: fileUrl(`${material.fileUrl}?download=1`), pages: material.pages ?? null, sizeBytes: material.sizeBytes ?? null, fileName };
  }
  const key = `${material.id}:${material.updatedAt}`;
  if (!fileCache.has(key)) {
    const scope = material.departmentId ? material.departmentName ?? "Department" : "Company-wide";
    const { blob, pages } = makePdf({
      kicker: `Aajneeti Academy · ${scope}`,
      title: material.title,
      subtitle: material.description,
      meta: `Version ${material.version}  ·  ${material.author}  ·  Updated ${new Date(material.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`,
      blocks: toBlocks(material),
    });
    fileCache.set(key, { url: URL.createObjectURL(blob), pages, sizeBytes: blob.size, fileName });
  }
  return fileCache.get(key);
}

// ── Assessment ──────────────────────────────────────────────────────────────

export const startAttempt = () => post("/training/attempts");

export const getActiveAttempt = () => get("/training/attempts/active");

export const saveAnswers = (attemptId, answers, focusViolations) =>
  put(`/training/attempts/${encodeURIComponent(attemptId)}/answers`, { answers, focus_violations: focusViolations });

export const submitAttempt = (attempt) =>
  post(`/training/attempts/${encodeURIComponent(attempt.attemptId)}/submit`, {
    answers: attempt.answers ?? {},
    time_taken_seconds: Math.max(0, Math.round(attempt.timeTakenSeconds ?? 0)),
    focus_violations: attempt.focusViolations ?? 0,
    auto_submitted: !!attempt.autoSubmitted,
  });

export const listMyAttempts = () => get("/training/attempts/mine");

export const getAttempt = (me, id) => get(`/training/attempts/${encodeURIComponent(id)}`);

export const certificateUrl = (result) => (result?.certificate?.available ? fileUrl(result.certificate.url) : null);

export const getAnnouncements = () => get("/announcements");
