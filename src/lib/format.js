// Small formatting helpers shared by every screen.

export const cx = (...parts) => parts.filter(Boolean).join(" ");

export const fmtClock = (secs) => {
  const s = Math.max(0, Math.floor(secs));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

export const fmtDuration = (secs) => {
  const s = Math.max(0, Math.round(secs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h) return m ? `${h}h ${m}m` : `${h}h`;
  if (!m) return `${r}s`;
  return r ? `${m}m ${r}s` : `${m}m`;
};

export const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";

export const fmtDateTime = (iso) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

export function fmtRelative(iso) {
  if (!iso) return "—";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return fmtDate(iso);
}

// Calendar days from today to the date (0 = today, 1 = tomorrow, -1 =
// yesterday), in local time, whatever the hour.
export const daysUntil = (iso, now = new Date()) => {
  const day = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((day(new Date(iso)) - day(now)) / 86400000);
};

// "Due 31 Oct · due today" / "· 1 day left" / "Overdue since …".
export const dueLabel = (iso, now = new Date()) => {
  const d = daysUntil(iso, now);
  if (new Date(iso) < now) return `Overdue since ${fmtDate(iso)}`;
  if (d === 0) return `Due ${fmtDate(iso)} · due today`;
  return `Due ${fmtDate(iso)} · ${d} day${d === 1 ? "" : "s"} left`;
};

export const initials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";

export const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export const fmtBytes = (n) => {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};

export const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

export const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
