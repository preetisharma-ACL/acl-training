// ─── Assessment session ─────────────────────────────────────────────────────
// The in-progress test (attempt, answers, time left, focus violations) for
// the signed-in user.
//
// Real API: the server owns the attempt. Its deadline (expiresAt) is fixed
// at start and the clock keeps running while the candidate is away; leaving
// the tab still shows the warning and counts a violation. Answers autosave
// to the server, so a reload — or another device — resumes from there.
// A local copy (localStorage) only bridges the moment between reload and the
// server answering.
//
// Mock mode has no server deadline: time is SECONDS REMAINING and pauses
// while away, as before.
//
// While `active` is true the app renders only the assessment (see App.jsx).

import { createRoot, createEffect, on } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { load, save } from "../lib/storage";
import * as training from "../services/training";

const EMPTY = {
  userId: null,
  active: false,
  attempt: null, // from startAttempt()
  answers: {}, // questionId → optionId
  current: 0,
  remaining: 0, // seconds
  deadline: null, // local epoch ms when time is up (real API only)
  paused: false,
  pauseReason: null, // "hidden" | "blur" | "left"
  violations: 0,
};

const key = (userId) => `training.session.v3.${userId}`;

const [session, setSession] = createStore({ ...EMPTY });
export { session, setSession };

let boundTo = null;

// Server time → local clock, correcting for a skewed device clock.
function deadlineOf(attempt) {
  if (!attempt?.expiresAt) return null;
  const skew = attempt.serverNow ? Date.now() - new Date(attempt.serverNow).getTime() : 0;
  return new Date(attempt.expiresAt).getTime() + skew;
}

export const secondsLeft = () => (session.deadline ? Math.max(0, Math.ceil((session.deadline - Date.now()) / 1000)) : session.remaining);

// Load (or switch to) the local session for this user. A test that was
// running when the page was last closed comes back paused and counted as a
// "left" warning — the candidate resumes it deliberately.
export function bindSession(userId) {
  if (boundTo === userId) return;
  boundTo = userId;
  const saved = userId ? load(key(userId), null) : null;
  const s = saved && saved.userId === userId && saved.active ? { ...EMPTY, ...saved } : { ...EMPTY, userId };
  if (s.active && !s.paused) Object.assign(s, { paused: true, pauseReason: "left", violations: s.violations + 1 });
  if (s.deadline) s.remaining = Math.max(0, Math.ceil((s.deadline - Date.now()) / 1000));
  setSession(reconcile(s));
}

// After sign-in / reload: the server decides whether a test is running.
export async function restoreRunningAttempt() {
  if (!training.getActiveAttempt) return; // mock mode: local copy only
  let attempt;
  try {
    attempt = await training.getActiveAttempt();
  } catch {
    return; // offline: keep the local copy
  }
  if (!attempt) {
    // Submitted elsewhere, or auto-submitted when time ran out.
    if (session.active) endSession();
    return;
  }
  const local = session.active && session.attempt?.attemptId === attempt.attemptId;
  setSession({
    active: true,
    attempt,
    answers: { ...attempt.answers, ...(local ? session.answers : {}) },
    current: local ? session.current : 0,
    deadline: deadlineOf(attempt),
    remaining: attempt.remainingSeconds,
    paused: true,
    pauseReason: "left",
    violations: Math.max(attempt.focusViolations ?? 0, local ? session.violations : 0) + (local ? 0 : 1),
  });
}

export function beginSession(attempt) {
  setSession({
    active: true,
    attempt,
    answers: { ...(attempt.answers ?? {}) },
    current: 0,
    deadline: deadlineOf(attempt),
    remaining: attempt.remainingSeconds ?? attempt.durationSeconds,
    paused: false,
    pauseReason: null,
    violations: attempt.focusViolations ?? 0,
  });
}

export function endSession() {
  setSession(reconcile({ ...EMPTY, userId: session.userId }));
}

createRoot(() => {
  // Local copy on every change.
  createEffect(() => {
    const snapshot = JSON.parse(JSON.stringify(session)); // tracks every field
    if (snapshot.userId) save(key(snapshot.userId), snapshot);
  });

  // Autosave answers and focus warnings to the server (debounced).
  let timer = null;
  createEffect(
    on(
      () => [session.active, session.attempt?.attemptId, JSON.stringify(session.answers), session.violations],
      ([active, attemptId]) => {
        clearTimeout(timer);
        if (!active || !attemptId || !training.saveAnswers || !session.deadline) return;
        timer = setTimeout(() => {
          training.saveAnswers(attemptId, { ...session.answers }, session.violations).catch(() => {
            /* retried on the next change; submit sends everything anyway */
          });
        }, 800);
      },
      { defer: true },
    ),
  );
});
