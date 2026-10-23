// Seniority levels. Every designation has one; materials and assessments are
// targeted by level inside a department.

export const LEVELS = [
  { key: "head", label: "Team head", plural: "Team heads" },
  { key: "senior", label: "Senior", plural: "Seniors" },
  { key: "junior", label: "Junior", plural: "Juniors" },
];

export const LEVEL_KEYS = LEVELS.map((l) => l.key);

// Designation level label ("Team head", "Senior", "Junior") → key.
export const levelKey = (label) => LEVELS.find((l) => l.label === label || l.key === label)?.key ?? "junior";

export const levelInfo = (key) => LEVELS.find((l) => l.key === key) ?? LEVELS[2];

// "Team heads, Seniors" / "Everyone" for a list of level keys.
export const levelsText = (keys) =>
  !keys?.length || keys.length === LEVELS.length ? "All levels" : LEVELS.filter((l) => keys.includes(l.key)).map((l) => l.plural).join(", ");
