// Announcements for the signed-in employee, fetched once and shared by the
// top bar and the dashboard (one request instead of one per component).
// Refreshed after a few minutes, or when a different user signs in.

import { getAnnouncements } from "../services/training";

const FRESH_MS = 5 * 60 * 1000;
let cached = { userId: null, at: 0, promise: null };

export function loadAnnouncements(userId) {
  if (cached.promise && cached.userId === userId && Date.now() - cached.at < FRESH_MS) return cached.promise;
  const promise = getAnnouncements().catch((e) => {
    if (cached.promise === promise) cached = { userId: null, at: 0, promise: null };
    throw e;
  });
  cached = { userId, at: Date.now(), promise };
  return promise;
}
