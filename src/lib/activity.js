// Activity log wording: an audit entry → a sentence ("Alok edited user
// Riya Sharma"), its field changes and extra details, in plain language.

export const AREAS = {
  User: "user",
  Department: "department",
  Designation: "designation",
  Location: "location",
  Material: "training material",
  Course: "video course",
  Assessment: "assessment",
  Question: "question",
  Announcement: "announcement",
  Attempt: "test result",
};

// Area filter options (entityType → label).
export const AREA_OPTIONS = [
  ["User", "Users"],
  ["Department", "Departments"],
  ["Designation", "Designations"],
  ["Location", "Locations"],
  ["Material", "Training materials"],
  ["Course", "Video courses"],
  ["Assessment", "Assessments"],
  ["Question", "Questions"],
  ["Announcement", "Announcements"],
  ["Attempt", "Tests & results"],
];

export const KINDS = {
  created: { label: "Created", tone: "badge-success" },
  updated: { label: "Edited", tone: "badge-plum" },
  deleted: { label: "Deleted", tone: "badge-danger" },
  access: { label: "Sign-in", tone: "badge-neutral" },
  tests: { label: "Test", tone: "badge-lime" },
  views: { label: "Viewed", tone: "badge-neutral" },
};

// Actions with their own wording. self: about the actor (no target shown);
// anonymous: nobody was signed in, so the subject is the record itself.
const PHRASES = {
  USER_STATUS_CHANGED: { verb: "changed the status of user" },
  USER_PASSWORD_RESET: { verb: "reset the password of" },
  USER_ATTEMPTS_RESET: { verb: "reset the test attempts of" },
  USER_VIEWED: { verb: "viewed the profile of" },
  MATERIAL_FILE_UPLOADED: { verb: "uploaded the PDF" },
  COURSE_PROGRESS_VIEWED: { verb: "viewed employee progress for" },
  RESULTS_LISTED: { verb: "opened Employee results", self: true },
  RESULTS_EXPORTED: { verb: "exported Employee results to CSV", self: true },
  RESULT_VIEWED: { verb: "viewed the test result of" },
  RESULT_DELETED: { verb: "deleted the test result of" },
  LOGIN_SUCCEEDED: { verb: "signed in", self: true },
  LOGOUT: { verb: "signed out", self: true },
  LOGIN_FAILED: { verb: "had a failed sign-in (wrong password)", anonymous: true },
  PASSWORD_CHANGED: { verb: "changed their password", self: true },
  PASSWORD_RESET_REQUESTED: { verb: "asked for a password reset", anonymous: true },
  PASSWORD_RESET_COMPLETED: { verb: "set a new password with a reset link", anonymous: true },
  PROFILE_UPDATED: { verb: "updated their profile", self: true },
  ATTEMPT_STARTED: { verb: "started the test" },
  ATTEMPT_SUBMITTED: { verb: "submitted the test" },
};

const VERBS = { CREATED: "created", UPDATED: "edited", DELETED: "deleted", ARCHIVED: "archived", VIEWED: "viewed" };

// → { who, verb, target } — who is null for system entries.
export function describe(item) {
  const p = PHRASES[item.action];
  const actorName = item.actor?.name ?? null;
  if (p?.anonymous) return { who: item.label ?? "Someone", verb: p.verb, target: null };
  if (p) return { who: actorName, verb: p.verb, target: p.self ? null : item.label };
  const suffix = item.action.split("_").pop();
  const area = AREAS[item.entityType] ?? item.entityType.toLowerCase();
  const verb = item.action === "USER_CREATED" ? "added user" : `${VERBS[suffix] ?? suffix.toLowerCase()} ${area}`;
  // Old entries kept no name; if the record is gone too, say so.
  return { who: actorName, verb, target: item.label ?? (item.entityId ? "(since deleted)" : null) };
}

const FIELDS = {
  name: "Name",
  email: "Email",
  phone: "Phone",
  location: "Location",
  code: "Employee code",
  role: "Role",
  adminTitle: "Admin title",
  designation: "Designation",
  status: "Status",
  joined: "Joined",
  bio: "Bio",
  notifications: "Notifications",
  title: "Title",
  description: "Description",
  head: "Department head",
  active: "Active",
  department: "Department",
  departments: "Shown to",
  level: "Level",
  levels: "Levels",
  required: "Required",
  readingMinutes: "Reading time",
  author: "Author",
  file: "PDF file",
  version: "Version",
  sections: "Sections",
  videos: "Videos",
  passPercent: "Pass mark",
  marksPerQuestion: "Marks per question",
  maxAttempts: "Attempts allowed",
  questionsPerAttempt: "Questions per test",
  durationMinutes: "Time limit",
  shuffle: "Shuffle questions",
  question: "Question",
  options: "Options",
  answer: "Correct answer",
  explanation: "Explanation",
  difficulty: "Difficulty",
  body: "Message",
  tone: "Colour",
  published: "Published",
  archived: "Archived",
};
const UNITS = { passPercent: "%", readingMinutes: " min", durationMinutes: " min" };
const CAPITALISED = new Set(["status", "difficulty", "tone"]);

export const fieldLabel = (k) => FIELDS[k] ?? k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());

export function fieldValue(k, v) {
  if (v === null || v === undefined || v === "") return "(empty)";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) return v.length ? v.join(" / ") : "(none)";
  if (typeof v === "object") return JSON.stringify(v);
  if (typeof v === "number" && UNITS[k]) return `${v}${UNITS[k]}`;
  const s = String(v);
  // One-word codes read better capitalised ("active" → "Active"); names, emails and text stay as typed.
  return CAPITALISED.has(k) ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// [{ field, label, from, to }] for an edit, in a stable order.
export const changeList = (item) =>
  Object.entries(item.changes ?? {}).map(([k, c]) => ({ field: k, label: fieldLabel(k), from: fieldValue(k, c.from), to: fieldValue(k, c.to) }));

const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

// Short extra notes from the entry's details (score, counts, flags).
export function notes(item) {
  const m = item.meta ?? {};
  const out = [];
  if (item.action === "ATTEMPT_SUBMITTED" && m.percentage != null) out.push(`Scored ${m.percentage}% — ${m.passed ? "passed" : "not passed"}${m.autoSubmitted ? " (auto-submitted when time ran out)" : ""}`);
  if (m.assessment && item.entityType !== "Attempt") out.push(item.entityType === "Question" ? `In ${m.assessment}` : `Test: ${m.assessment}`);
  if (m.passwordSet) out.push("Password changed");
  if (m.contentChanged) out.push(m.newVersion ? `Content edited (now version ${m.newVersion})` : "Content edited");
  else if (m.newVersion) out.push(`New version ${m.newVersion}`);
  if (m.requireRecompletion) out.push("Employees must read it again");
  if (m.videosChanged) out.push("Sections or videos changed");
  if (m.employeesRemapped) out.push(`${plural(m.employeesRemapped, "employee")} moved with it`);
  if (m.voided != null) out.push(`${plural(m.voided, "attempt")} reset`);
  if (m.attemptsDeleted) out.push(`${plural(m.attemptsDeleted, "test attempt")} deleted with the account`);
  if (item.action === "LOCATION_UPDATED" && (m.users || m.departments)) out.push(`Also updated ${[m.users && plural(m.users, "person"), m.departments && plural(m.departments, "department")].filter(Boolean).join(" and ")}`);
  if (item.action === "LOGIN_SUCCEEDED" && m.remember) out.push("Kept signed in");
  if ((item.action === "RESULTS_EXPORTED" || item.action === "RESULTS_LISTED") && m.count != null) out.push(plural(m.count, "result"));
  if (item.action === "RESULT_DELETED" && m.percentage != null) out.push(`It scored ${m.percentage}%${m.passed ? " (passed)" : ""}`);
  if (item.action === "MATERIAL_FILE_UPLOADED" && m.pages) out.push(plural(m.pages, "page"));
  return out;
}

// What a new record was created with (for the details panel).
const SNAPSHOT_SKIP = new Set(["label", "type", "assessmentId", "userId", "count", "filters", "fileName", "sizeBytes", "pages", "assessment"]);
export const createdWith = (item) =>
  item.kind === "created" ? Object.entries(item.meta ?? {}).filter(([k, v]) => FIELDS[k] && !SNAPSHOT_SKIP.has(k) && v !== null && v !== "" && v !== undefined).map(([k, v]) => ({ label: fieldLabel(k), value: fieldValue(k, v) })) : [];

// The Activity log filtered to one record ("History" menus).
export const historyHref = (entityType, id, label) => `/admin/activity?entityType=${entityType}&entityId=${encodeURIComponent(id)}&label=${encodeURIComponent(label ?? "")}`;
