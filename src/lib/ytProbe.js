// Reads a YouTube video's length and title for the admin course builder,
// with one hidden, muted player (YouTube only reports the duration once the
// video starts). Also tells the admin early when a video can't be embedded.
// Requests are queued: one video at a time.

import { loadYouTubeApi } from "./youtube";

const PROBE_TIMEOUT_MS = 15000;
const ERRORS = {
  2: "That isn't a valid YouTube video.",
  100: "This video is private, removed or not found. Use an unlisted (not private) video.",
  101: "Embedding is turned off for this video. In YouTube Studio, turn on “Allow embedding”.",
  150: "Embedding is turned off for this video. In YouTube Studio, turn on “Allow embedding”.",
};

let queue = Promise.resolve();
const cache = new Map();

export function probeVideo(id) {
  if (cache.has(id)) return cache.get(id);
  const job = (queue = queue.then(() => run(id), () => run(id)));
  cache.set(id, job);
  job.catch(() => cache.delete(id));
  return job;
}

async function run(id) {
  const YT = await loadYouTubeApi();
  const host = document.createElement("div");
  const wrap = document.createElement("div");
  wrap.style.cssText = "position:fixed;left:-10000px;top:0;width:320px;height:180px;opacity:0;pointer-events:none";
  wrap.appendChild(host);
  document.body.appendChild(wrap);
  let player;
  try {
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("YouTube didn't answer in time. Enter the length yourself (mm:ss).")), PROBE_TIMEOUT_MS);
      const done = (fn, v) => {
        clearTimeout(timer);
        fn(v);
      };
      player = new YT.Player(host, {
        host: "https://www.youtube-nocookie.com",
        width: 320,
        height: 180,
        videoId: id,
        playerVars: { autoplay: 1, mute: 1, playsinline: 1, origin: window.location.origin },
        events: {
          onReady: (e) => {
            e.target.mute();
            e.target.playVideo();
          },
          onStateChange: (e) => {
            const d = e.target.getDuration?.();
            if (d > 0) {
              const title = e.target.getVideoData?.()?.title ?? "";
              e.target.stopVideo();
              done(resolve, { durationSeconds: Math.round(d), title });
            }
          },
          onError: (e) => done(reject, new Error(ERRORS[e.data] ?? "This video can't be played.")),
        },
      });
    });
  } finally {
    try {
      player?.destroy();
    } catch {
      /* ignore */
    }
    wrap.remove();
  }
}
