// Records which parts of a video were actually played.
//
// The player is sampled about once a second. While it's playing, each step
// from the previous time to the current one counts as watched if it looks
// like normal playback (0 < step ≤ MAX_STEP, i.e. up to 2× speed plus timer
// jitter). A seek (bigger jump, or going back) starts a new segment and the
// jumped-over part doesn't count. The server credits these ranges again,
// capped to real time, so this is the honest client half.

export const MAX_STEP = 2.6;

export function createWatchTracker() {
  let prev = null;
  let pending = [];

  return {
    // t: current time in seconds; playing: is the video playing right now.
    sample(t, playing) {
      if (!playing || t == null || Number.isNaN(t)) {
        prev = playing ? t : null;
        return;
      }
      if (prev != null) {
        const step = t - prev;
        if (step > 0 && step <= MAX_STEP) {
          const last = pending[pending.length - 1];
          if (last && Math.abs(last[1] - prev) < 0.01) last[1] = t;
          else pending.push([prev, t]);
        }
      }
      prev = t;
    },
    // Ranges watched since the last drain (rounded), then clears them.
    drain() {
      const out = pending.map(([a, b]) => [Math.round(a * 10) / 10, Math.round(b * 10) / 10]).filter(([a, b]) => b > a);
      pending = [];
      return out;
    },
    reset() {
      prev = null;
      pending = [];
    },
  };
}
