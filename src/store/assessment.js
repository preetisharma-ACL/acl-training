// ─── Assessment session ─────────────────────────────────────────────────────
// Carried over from the original Training page. The whole in-progress test
// (attempt, answers, time left, focus violations) lives in ONE localStorage
// record per user, written on every change and every timer tick, so a reload,
// a route change or a closed tab resumes exactly where it stopped. Time is
// stored as SECONDS REMAINING, not a deadline: time spent away from the test
// never counts against the candidate, which is what "pause" means here.
//
// While `active` is true the app renders only the assessment (see App.jsx):
// the training module and every other screen are unreachable until submit.

import { createRoot, createEffect } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { load, save } from "../lib/storage";

const EMPTY = {
  userId: null,
  active: false,
  attempt: null, // from startAttempt()
  answers: {}, // questionId → original option index
  current: 0,
  remaining: 0, // seconds
  paused: false,
  pauseReason: null, // "hidden" | "blur" | "left"
  violations: 0,
};

const key = (userId) => `training.session.v2.${userId}`;

const [session, setSession] = createStore({ ...EMPTY });
export { session, setSession };

let boundTo = null;

// Load (or switch to) the session for this user. A test that was running
// when the page was last closed comes back paused and counted as a "left"
// warning — the candidate resumes it deliberately.
export function bindSession(userId) {
  if (boundTo === userId) return;
  boundTo = userId;
  const saved = userId ? load(key(userId), null) : null;
  const s = saved && saved.userId === userId && saved.active ? { ...EMPTY, ...saved } : { ...EMPTY, userId };
  if (s.active && !s.paused) Object.assign(s, { paused: true, pauseReason: "left", violations: s.violations + 1 });
  setSession(reconcile(s));
}

createRoot(() => {
  createEffect(() => {
    const snapshot = JSON.parse(JSON.stringify(session)); // tracks every field
    if (snapshot.userId) save(key(snapshot.userId), snapshot);
  });
});

export function beginSession(attempt) {
  setSession({
    active: true,
    attempt,
    answers: {},
    current: 0,
    remaining: attempt.durationSeconds,
    paused: false,
    pauseReason: null,
    violations: 0,
  });
}

export function endSession() {
  setSession(reconcile({ ...EMPTY, userId: session.userId }));
}
