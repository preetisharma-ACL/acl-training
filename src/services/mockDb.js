// ─── Mock database ──────────────────────────────────────────────────────────
// FRONTEND-ONLY. Stands in for the backend so every screen works end to end:
// admin edits (a new question, a changed pass mark, a new PDF) show up in the
// employee experience straight away. Persisted to localStorage; the admin
// Settings menu has "Reset demo data".
//
// Services (auth.js, training.js, admin.js) are the only readers. When the
// real API exists, their function bodies become fetch calls and this file is
// deleted — no component imports it.

import { DEPARTMENTS } from "../data/trainingData";
import { DEPARTMENT_META, DESIGNATIONS, SEED_USERS } from "../data/org";
import { SEED_MATERIALS } from "../data/materials";
import { load, save, remove } from "../lib/storage";

const DB_KEY = "acl.mockdb.v5";

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

function seed() {
  const departments = DEPARTMENTS.map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    head: DEPARTMENT_META[d.id]?.head ?? "",
    location: DEPARTMENT_META[d.id]?.location ?? "",
    durationMinutes: d.durationMinutes,
    passPercent: d.passPercent,
    marksPerQuestion: d.marksPerQuestion,
    maxAttempts: 3,
    dueDays: 14,
    shuffle: true,
    active: true,
  }));
  const questions = Object.fromEntries(DEPARTMENTS.map((d) => [d.id, d.questions.map((q) => ({ ...q }))]));
  const users = SEED_USERS.map((u) => ({ ...u, preferences: { emailReminders: true, resultEmails: true, weeklyDigest: false } }));
  const designations = DESIGNATIONS.map((d) => ({ ...d }));
  return {
    version: 5,
    departments,
    designations,
    users,
    questions,
    materials: SEED_MATERIALS.map((m) => ({ ...m })),
    // No sample attempts or reading progress: every employee starts fresh.
    attempts: [],
    progress: {},
    announcements: [
      {
        id: "an-1",
        title: "October training cycle is open",
        body: "Complete your module and assessment by 31 October. Scores feed into the H2 performance review.",
        createdAt: daysAgo(3),
        author: "Meera Iyer",
        tone: "lime",
      },
      {
        id: "an-2",
        title: "Updated Employee Handbook (v4.0)",
        body: "The data protection chapter has new rules on lead downloads. Please re-read it, even if you completed it before.",
        createdAt: daysAgo(9),
        author: "HR",
        tone: "plum",
      },
    ],
  };
}

let state = load(DB_KEY, null);
if (!state || state.version !== 5) {
  state = seed();
  save(DB_KEY, state);
}

export const db = () => state;
export const commit = () => save(DB_KEY, state);

export function resetDb() {
  remove(DB_KEY);
  state = seed();
  save(DB_KEY, state);
}

// Simulated network latency so loading states are visible in the demo.
export const delay = (ms = 260) => new Promise((r) => setTimeout(r, ms));

export const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));

export const uid = (prefix) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
