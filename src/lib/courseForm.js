// Admin course builder: course ↔ form, validation and reordering.
// Section and video ids are kept so employees' progress stays attached.

import { youtubeId, clock, parseClock } from "./youtube";

let n = 0;
const key = () => `k${Date.now().toString(36)}${(n++).toString(36)}`;

export const blankLesson = () => ({ key: key(), id: undefined, title: "", video: "", duration: "", description: "", probing: false, probeError: null });
export const blankSection = () => ({ key: key(), id: undefined, title: "", lessons: [blankLesson()] });

export function courseToForm(c) {
  return {
    title: c?.title ?? "",
    description: c?.description ?? "",
    // "" = not chosen yet (new course), "company" = everyone.
    departmentId: c ? c.departmentId ?? "company" : "",
    required: c ? c.required : null,
    levels: c ? [...(c.levels?.length ? c.levels : ["head", "senior", "junior"])] : [],
    sections: c?.sections?.length
      ? c.sections.map((s) => ({
          key: key(),
          id: s.id,
          title: s.title,
          lessons: s.lessons.map((l) => ({ key: key(), id: l.id, title: l.title, video: `https://youtu.be/${l.youtubeId}`, duration: clock(l.durationSeconds), description: l.description ?? "", probing: false, probeError: null })),
        }))
      : [blankSection()],
  };
}

export function formToPayload(f, status) {
  return {
    title: f.title.trim(),
    description: f.description.trim(),
    departmentId: f.departmentId === "company" ? null : f.departmentId,
    required: f.required,
    levels: f.levels,
    ...(status ? { status } : {}),
    sections: f.sections.map((s) => ({
      ...(s.id ? { id: s.id } : {}),
      title: s.title.trim(),
      lessons: s.lessons.map((l) => ({
        ...(l.id ? { id: l.id } : {}),
        title: l.title.trim(),
        description: l.description.trim(),
        video: l.video.trim(),
        durationSeconds: parseClock(l.duration) ?? 0,
      })),
    })),
  };
}

// → { field: message } (empty when valid)
export function formProblems(f) {
  const p = {};
  if (f.title.trim().length < 3) p.title = "Give the course a clear title.";
  if (!f.departmentId) p.scope = "Choose who gets this course.";
  if (!f.levels.length) p.levels = "Choose at least one level.";
  if (f.required == null) p.required = "Choose whether it's required.";
  if (!f.sections.length) p.sections = "Add at least one section.";
  f.sections.forEach((s, si) => {
    if (!s.title.trim()) p[`s${si}`] = "Give this section a title.";
    if (!s.lessons.length) p[`s${si}`] = "Add at least one video.";
    s.lessons.forEach((l, li) => {
      const k = `s${si}l${li}`;
      if (!youtubeId(l.video)) p[k] = "Paste a YouTube video link.";
      else if (!l.title.trim()) p[k] = "Give this video a title.";
      else if (!(parseClock(l.duration) > 0)) p[k] = l.probing ? "Reading the video length…" : "Enter the video length (mm:ss).";
    });
  });
  return p;
}

// Moves item i by d in a list (returns a new array; unchanged at the ends).
export function move(list, i, d) {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const out = [...list];
  const [x] = out.splice(i, 1);
  out.splice(j, 0, x);
  return out;
}
