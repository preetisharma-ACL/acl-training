// Employee-facing wording for training state, from the server's own data.

// Why the test can't be started right now. The module's conditions say
// which rule is blocking; a running attempt also blocks starting a new one.
export function blockedMessage(mod) {
  if (mod.activeAttempt) return "You have a test in progress. Open it to carry on before the timer runs out.";
  const c = mod.blocker ? { id: mod.blocker } : (mod.conditions ?? []).find((x) => !x.met);
  if (c?.id === "materials") return "Finish your required training to unlock your test.";
  if (c?.id === "attempts") return "You've used all your attempts. Please contact your training admin to reset them.";
  return "Your test isn't open yet. Please check back later or contact your training admin.";
}

// What's still needed before a material can be marked complete, from the
// progress the server returns (null when nothing is needed).
export function completionNeeded(progress, type) {
  const p = progress;
  if (!p || p.canComplete || p.completed || !p.requirement) return null;
  const r = p.requirement;
  if (!r.fileOpened) return "open the PDF to start";
  const parts = [];
  if (r.sectionsSeen < r.sectionsTotal) parts.push(`${r.sectionsSeen} of ${r.sectionsTotal} ${type === "manual" ? "chapters" : "sections"} read`);
  const left = r.minSeconds - r.activeSeconds;
  if (left > 0) parts.push(left >= 90 ? `about ${Math.ceil(left / 60)} min of reading left` : "less than a minute of reading left");
  return parts.join(" · ") || null;
}

// A percentage that may not exist yet (no test → no pass mark).
export const pct = (v) => (v == null ? "—" : `${v}%`);

// PDF upload: the title follows the chosen file until the admin types their
// own. → { title, auto } (auto = the title last filled in from a file).
export function titleForFile(current, auto, fileName) {
  if (current.trim() && current !== auto) return { title: current, auto };
  const t = fileName.replace(/\.pdf$/i, "").replace(/[-_]+/g, " ").trim();
  return { title: t, auto: t };
}
