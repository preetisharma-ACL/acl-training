// Level vocabulary. The database uses the enum; the API speaks the
// frontend's keys ("head" | "senior" | "junior") and labels.

export const LEVELS = [
  { enum: "TEAM_HEAD", key: "head", label: "Team head", plural: "Team heads" },
  { enum: "SENIOR", key: "senior", label: "Senior", plural: "Seniors" },
  { enum: "JUNIOR", key: "junior", label: "Junior", plural: "Juniors" },
];

export const LEVEL_ENUMS = LEVELS.map((l) => l.enum);
export const LEVEL_KEYS = LEVELS.map((l) => l.key);

const byEnum = Object.fromEntries(LEVELS.map((l) => [l.enum, l]));

// Accepts an enum, key or label ("TEAM_HEAD", "head", "Team head").
export function toLevelEnum(v) {
  const s = String(v ?? "").trim().toLowerCase();
  return LEVELS.find((l) => l.enum.toLowerCase() === s || l.key === s || l.label.toLowerCase() === s)?.enum ?? null;
}

export const levelKey = (e) => byEnum[e]?.key ?? null;
export const levelLabel = (e) => byEnum[e]?.label ?? null;
export const levelPlural = (e) => byEnum[e]?.plural ?? null;

// API "levels" list for a material: [] means all levels (frontend convention).
export const levelsToApi = (enums = []) => (enums.length >= LEVELS.length ? [] : LEVELS.filter((l) => enums.includes(l.enum)).map((l) => l.key));

export const levelsFromApi = (keys) => {
  const list = (keys ?? []).map(toLevelEnum).filter(Boolean);
  return list.length ? [...new Set(list)] : [...LEVEL_ENUMS];
};
