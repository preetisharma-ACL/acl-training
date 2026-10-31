// Structured guide content ↔ the editor's text fields.
//
// API shape: { intro, sections: [{ id, title, body[], points?, tip? }] }
// Editor shape: { intro, sections: [{ id, title, body, points, tip }] } with
// body = paragraphs separated by blank lines, points = one per line.
// Section ids are kept when editing so employees' reading progress still
// matches; new sections get a fresh id.

const newId = () => `s-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const blankSection = () => ({ id: newId(), title: "", body: "", points: "", tip: "" });

export function guideToEditable(content) {
  const sections = (content?.sections ?? []).map((s) => ({
    id: s.id || newId(),
    title: s.title ?? "",
    body: (s.body ?? []).join("\n\n"),
    points: (s.points ?? []).join("\n"),
    tip: s.tip ?? "",
  }));
  return { intro: content?.intro ?? "", sections: sections.length ? sections : [blankSection()] };
}

export function editableToGuide(ed) {
  return {
    intro: ed.intro.trim(),
    sections: ed.sections.map((s) => {
      const points = s.points
        .split("\n")
        .map((t) => t.replace(/^\s*[-•*]\s*/, "").trim())
        .filter(Boolean);
      const tip = s.tip.trim();
      return {
        id: s.id,
        title: s.title.trim(),
        body: s.body
          .split(/\n\s*\n/)
          .map((t) => t.trim())
          .filter(Boolean),
        ...(points.length ? { points } : {}),
        ...(tip ? { tip } : {}),
      };
    }),
  };
}

// → error message or null
export function guideProblem(ed) {
  if (!ed.sections.length) return "Add at least one section.";
  const i = ed.sections.findIndex((s) => !s.title.trim());
  if (i >= 0) return `Section ${i + 1} needs a title.`;
  const j = ed.sections.findIndex((s) => !s.body.trim() && !s.points.trim());
  if (j >= 0) return `Section ${j + 1} needs some content or key points.`;
  return null;
}

// Moves the section at index i by d (−1 up, +1 down); returns a new array.
export function moveSection(sections, i, d) {
  const j = i + d;
  if (j < 0 || j >= sections.length) return sections;
  const list = [...sections];
  const [s] = list.splice(i, 1);
  list.splice(j, 0, s);
  return list;
}
