// ─── Training materials — SAMPLE content ────────────────────────────────────
// Seeds the mock database. Each department starts with one module: its
// "essentials" guide. Admins add PDF modules on top by uploading files in
// Admin › Training materials.
//
// Content types the backend will send:
//   structured → { intro, sections: [{ id, title, body[], points?[], tip? }] }
//   pdf        → { fileUrl, fileName, sizeBytes }   (an uploaded file)
//   manual     → { chapters: [{ id, title, blocks[] }] }   (written in the admin)
//
// departmentId: null means company-wide (assigned to every employee).
// The guides come from trainingData.js so the assessment questions stay
// answerable from the material.

import { DEPARTMENTS } from "./trainingData";

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();
const words = (guide) => JSON.stringify(guide).split(/\s+/).length;

export const SEED_MATERIALS = DEPARTMENTS.map((d, i) => ({
  id: `guide-${d.id}`,
  title: `${d.name} essentials`,
  type: "structured",
  departmentId: d.id,
  required: true,
  description: d.guide.intro,
  estMinutes: Math.max(6, Math.round(words(d.guide) / 200)),
  version: "2.1",
  author: "Department head",
  updatedAt: daysAgo(6 + i * 3),
  content: { intro: d.guide.intro, sections: d.guide.sections },
}));
