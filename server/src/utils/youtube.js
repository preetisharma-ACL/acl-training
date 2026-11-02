// YouTube video ids from the links admins paste. Accepts watch, youtu.be,
// embed, shorts and live links (youtube.com, m., music., -nocookie) or a
// bare 11-character id. → id or null. Same rules as src/lib/youtube.js.

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
