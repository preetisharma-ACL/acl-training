// Browser-QA retest: focus-warning detection and user-list pagination.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createFocusGuard, BLUR_GRACE_MS } from "../lib/focusGuard.js";
import { paginate } from "../lib/paginate.js";
import { blockedMessage, pct } from "../lib/progress.js";
import { daysUntil, dueLabel } from "../lib/format.js";

describe("4 · focus warnings", () => {
  let hits, away, guard;
  beforeEach(() => {
    vi.useFakeTimers();
    hits = [];
    away = true;
    guard = createFocusGuard({ onViolation: (r) => hits.push(r), isAway: () => away });
  });
  afterEach(() => {
    guard.dispose();
    vi.useRealTimers();
  });

  it("counts a real tab switch (page hidden) at once", () => {
    guard.hidden();
    expect(hits).toEqual(["hidden"]);
  });

  it("ignores a short blur (devtools, side panel, notification) that comes back within the grace period", () => {
    guard.blur();
    vi.advanceTimersByTime(BLUR_GRACE_MS - 100);
    away = false;
    guard.back();
    vi.advanceTimersByTime(5000);
    expect(hits).toEqual([]);
  });

  it("counts a blur that lasts longer than the grace period", () => {
    guard.blur();
    vi.advanceTimersByTime(BLUR_GRACE_MS + 1);
    expect(hits).toEqual(["blur"]);
  });

  it("doesn't count if focus is already back when the grace period ends (missed focus event)", () => {
    guard.blur();
    away = false;
    vi.advanceTimersByTime(BLUR_GRACE_MS + 1);
    expect(hits).toEqual([]);
  });

  it("counts one warning for one switch: blur then hidden, repeated events", () => {
    guard.blur();
    vi.advanceTimersByTime(300);
    guard.hidden();
    guard.hidden();
    guard.blur();
    vi.advanceTimersByTime(10_000);
    expect(hits).toEqual(["hidden"]);
  });

  it("counts again on the next trip away after coming back", () => {
    guard.hidden();
    away = false;
    guard.back();
    away = true;
    guard.hidden();
    expect(hits).toEqual(["hidden", "hidden"]);
  });

  it("a long devtools blur is one warning, not one per extra blur event", () => {
    guard.blur();
    guard.blur();
    vi.advanceTimersByTime(BLUR_GRACE_MS * 3);
    expect(hits).toEqual(["blur"]);
  });
});

describe("6 · empty states", () => {
  it("uses the server's blocker, so 'no test yet' isn't reported as 'no attempts'", () => {
    const mod = { blocker: "questions", conditions: [{ id: "materials", met: true }, { id: "attempts", met: false }, { id: "questions", met: false }] };
    expect(blockedMessage(mod)).toMatch(/isn't open yet/);
    expect(blockedMessage({ ...mod, blocker: "attempts" })).toMatch(/used all your attempts/);
  });
  it("shows a dash, never 'null%', when there's no pass mark", () => {
    expect(pct(null)).toBe("—");
    expect(pct(undefined)).toBe("—");
    expect(pct(70)).toBe("70%");
  });
});

describe("due date on the dashboard", () => {
  // The cycle ends at 23:59 on the last day of the month.
  const due = new Date(2026, 9, 31, 23, 59).toISOString();
  it("counts calendar days, not 24-hour blocks", () => {
    expect(daysUntil(due, new Date(2026, 9, 31, 11, 0))).toBe(0);
    expect(daysUntil(due, new Date(2026, 9, 30, 23, 0))).toBe(1);
    expect(daysUntil(due, new Date(2026, 9, 28, 0, 30))).toBe(3);
  });
  it("says 'due today' on the day, days left before, overdue after", () => {
    expect(dueLabel(due, new Date(2026, 9, 31, 11, 0))).toMatch(/· due today$/);
    expect(dueLabel(due, new Date(2026, 9, 30, 9, 0))).toMatch(/· 1 day left$/);
    expect(dueLabel(due, new Date(2026, 9, 26, 9, 0))).toMatch(/· 5 days left$/);
    expect(dueLabel(due, new Date(2026, 10, 1, 8, 0))).toMatch(/^Overdue since/);
  });
});

describe("6 · user list pagination", () => {
  const users = Array.from({ length: 23 }, (_, i) => ({ id: i + 1 }));

  it("pages and counts", () => {
    expect(paginate(users, 0, 10)).toMatchObject({ page: 0, pages: 3, from: 1, to: 10, total: 23 });
    const last = paginate(users, 2, 10);
    expect(last).toMatchObject({ page: 2, from: 21, to: 23 });
    expect(last.rows.map((u) => u.id)).toEqual([21, 22, 23]);
  });

  it("never shows an empty page after rows disappear (delete / filter)", () => {
    // On page 3 of 21 users, the 21st is deleted → page 2 is shown.
    const v = paginate(users.slice(0, 20), 2, 10);
    expect(v).toMatchObject({ page: 1, pages: 2, from: 11, to: 20 });
    expect(v.rows).toHaveLength(10);
  });

  it("empty list: one page, 0–0 of 0", () => {
    expect(paginate([], 4, 10)).toMatchObject({ page: 0, pages: 1, from: 0, to: 0, total: 0, rows: [] });
  });
});
