// YouTube helpers for video courses: link → id (same rules as the server's
// utils/youtube.js), thumbnails, and loading the IFrame Player API once.

const ID = /^[A-Za-z0-9_-]{11}$/;
const HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"]);

export function youtubeId(input) {
  const s = String(input ?? "").trim();
  if (ID.test(s)) return s;
  let u;
  try {
    u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  let id = null;
  if (host === "youtu.be") id = u.pathname.split("/")[1];
  else if (HOSTS.has(host)) {
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts[0] === "watch") id = u.searchParams.get("v");
    else if (["embed", "shorts", "live", "v"].includes(parts[0])) id = parts[1];
  }
  return id && ID.test(id) ? id : null;
}

export const thumbnail = (id) => (id ? `https://i.ytimg.com/vi/${id}/mqdefault.jpg` : null);

// "1:05", "12:30", "1:02:03"
export function clock(secs) {
  const s = Math.max(0, Math.round(secs || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
}

// "1hr 28min", "40min", "45s" — section and course totals, Udemy style.
export function totalLength(secs) {
  const s = Math.max(0, Math.round(secs || 0));
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  if (h) return m ? `${h}hr ${m}min` : `${h}hr`;
  return `${m}min`;
}

// "mm:ss" / "h:mm:ss" / "90" → seconds (null if unreadable).
export function parseClock(text) {
  const t = String(text ?? "").trim();
  if (!t) return null;
  if (/^\d+$/.test(t)) return Number(t);
  const parts = t.split(":").map((p) => (/^\d+$/.test(p) ? Number(p) : NaN));
  if (parts.length < 2 || parts.length > 3 || parts.some(Number.isNaN)) return null;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

// The IFrame Player API, loaded once. → Promise<YT>
let api;
export function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  api ??= new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT);
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    s.onerror = () => {
      api = null;
      reject(new Error("Couldn't load the YouTube player. Check your connection and try again."));
    };
    document.head.appendChild(s);
  });
  return api;
}
