// Focus guard for a running test: decides when leaving counts as a warning.
//
//   • The tab/window becomes hidden (tab switch, minimise, another app full
//     screen) → counts at once.
//   • The window loses focus while still visible (devtools, the browser's
//     side panel, address bar, an extension popup, a notification) → counts
//     only if focus hasn't come back within the grace period.
//   • One trip away counts once: a blur followed by "hidden" (the usual
//     sequence for a tab switch) is a single warning. The next trip starts
//     when the test is visible and focused again.
//
// Pure logic with injected clock helpers, so it can be unit tested.

export const BLUR_GRACE_MS = 2000;

// onViolation(reason): "hidden" | "blur"
// isAway(): true while the page is hidden or unfocused (checked again when
// the grace period ends).
export function createFocusGuard({ onViolation, isAway = () => true, graceMs = BLUR_GRACE_MS, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let counted = false; // this trip away has been counted
  let timer = null;

  const cancel = () => {
    if (timer != null) clearTimer(timer);
    timer = null;
  };
  const count = (reason) => {
    cancel();
    if (counted) return;
    counted = true;
    onViolation(reason);
  };

  return {
    hidden() {
      count("hidden");
    },
    blur() {
      if (counted || timer != null) return;
      timer = setTimer(() => {
        timer = null;
        if (isAway()) count("blur");
      }, graceMs);
    },
    // Back on the test (visible and focused): a quick blur is forgiven and
    // the next trip away can count again.
    back() {
      cancel();
      counted = false;
    },
    dispose: cancel,
  };
}
