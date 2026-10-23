// Work out how to play a video / audio link inside the portal.
//   youtube / vimeo / drive → iframe embed URL
//   file                    → direct media file, played with <video>/<audio>
//   link                    → anything else: opened in a new tab

const FILE_RE = /\.(mp4|webm|ogv|mov|m4v|mp3|wav|ogg|oga|m4a|aac|flac)(\?|#|$)/i;

export const isHttpUrl = (s) => {
  try {
    const u = new URL(String(s).trim());
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
};

export function parseMedia(raw) {
  const url = String(raw || "").trim();
  if (!isHttpUrl(url)) return { provider: "invalid", url };
  const u = new URL(url);
  const host = u.hostname.replace(/^www\.|^m\./, "");

  if (host === "youtu.be") {
    const id = u.pathname.slice(1).split("/")[0];
    if (id) return { provider: "youtube", url, embed: `https://www.youtube.com/embed/${id}` };
  }
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const id = u.searchParams.get("v") || u.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/)?.[1];
    if (id) return { provider: "youtube", url, embed: `https://www.youtube.com/embed/${id}` };
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = u.pathname.match(/(\d{6,})/)?.[1];
    if (id) return { provider: "vimeo", url, embed: `https://player.vimeo.com/video/${id}` };
  }
  if (host === "drive.google.com") {
    const id = u.pathname.match(/\/file\/d\/([^/]+)/)?.[1] || u.searchParams.get("id");
    if (id) return { provider: "drive", url, embed: `https://drive.google.com/file/d/${id}/preview` };
  }
  if (FILE_RE.test(u.pathname)) return { provider: "file", url };
  return { provider: "link", url };
}

export const PROVIDER_LABEL = {
  youtube: "YouTube",
  vimeo: "Vimeo",
  drive: "Google Drive",
  file: "Direct media file",
  link: "External link",
};
