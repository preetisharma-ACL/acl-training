// ─── Admin service ──────────────────────────────────────────────────────────
// FRONTEND-ONLY MOCK for the admin screens. Each function maps to one REST
// call (listed in README.md under "Admin API"); every one must be admin-only
// on the server. Mutations write to mockDb so the employee side reflects them.

import { db, commit, delay, clone, uid, resetDb, locationsOf } from "./mockDb";
import { MOCK_EMPLOYEE_PASSWORD } from "../../data/org";
import { LEVELS, levelKey, levelInfo, levelsText } from "../../lib/levels";
import { parseManual, manualToText } from "../../lib/manual";

export { parseManual, manualToText };

const deptOf = (designationId) => {
  const s = db();
  const des = s.designations.find((d) => d.id === designationId);
  return des?.departmentId ? s.departments.find((d) => d.id === des.departmentId) : null;
};

const levelOfUser = (u) => levelKey(db().designations.find((d) => d.id === u.designationId)?.level);

// Does material m reach user u? (department or company-wide, and level)
const reaches = (m, u) =>
  u.role === "employee" &&
  (!m.departmentId || deptOf(u.designationId)?.id === m.departmentId) &&
  (!m.levels?.length || m.levels.includes(levelOfUser(u)));

const newAssessment = (departmentId, level) => ({
  id: `asm-${departmentId}-${level}`,
  departmentId,
  level,
  durationMinutes: 10,
  passPercent: level === "junior" ? 70 : level === "senior" ? 75 : 80,
  marksPerQuestion: 1,
  maxAttempts: 3,
  questionsPerAttempt: 5,
  shuffle: true,
  active: true,
});

// Employee row as the admin tables need it (no password).
function userRow(u) {
  const s = db();
  const des = s.designations.find((d) => d.id === u.designationId);
  const dept = deptOf(u.designationId);
  const attempts = s.attempts.filter((a) => a.userId === u.id);
  const best = attempts.reduce((m, a) => Math.max(m, a.percentage), 0);
  const prog = s.progress[u.id] || {};
  const required = s.materials.filter((m) => m.required && reaches(m, u));
  const done = required.filter((m) => prog[m.id]?.completed).length;
  const { password, ...rest } = u;
  return {
    ...rest,
    designation: des?.title ?? null,
    departmentId: dept?.id ?? null,
    departmentName: dept?.name ?? null,
    attempts: attempts.length,
    bestScore: attempts.length ? best : null,
    passed: attempts.some((a) => a.passed),
    lastAttemptAt: attempts[0]?.submittedAt ?? null,
    materialsDone: done,
    materialsRequired: required.length,
    status: u.status,
    trainingStatus: !dept
      ? "unassigned"
      : attempts.some((a) => a.passed)
        ? "certified"
        : attempts.length
          ? "retake"
          : done === required.length
            ? "ready"
            : done
              ? "in-progress"
              : "not-started",
  };
}

// ── Overview ────────────────────────────────────────────────────────────────

export async function getOverview() {
  await delay(380);
  const s = db();
  const employees = s.users.filter((u) => u.role === "employee" && u.status === "active").map(userRow);
  const assigned = employees.filter((e) => e.departmentId);
  const attempts = s.attempts;
  const avg = attempts.length ? attempts.reduce((t, a) => t + a.percentage, 0) / attempts.length : 0;

  const departments = s.departments.map((d) => {
    const people = assigned.filter((e) => e.departmentId === d.id);
    const deptAttempts = attempts.filter((a) => a.departmentId === d.id);
    return {
      id: d.id,
      name: d.name,
      employees: people.length,
      certified: people.filter((p) => p.passed).length,
      completion: people.length ? Math.round((people.filter((p) => p.passed).length / people.length) * 100) : 0,
      avgScore: deptAttempts.length ? Math.round(deptAttempts.reduce((t, a) => t + a.percentage, 0) / deptAttempts.length) : 0,
      passRate: deptAttempts.length ? Math.round((deptAttempts.filter((a) => a.passed).length / deptAttempts.length) * 100) : 0,
    };
  });

  // Last 8 weeks: attempts and average score per week.
  const weeks = [];
  const now = Date.now();
  for (let w = 7; w >= 0; w--) {
    const end = now - w * 7 * 86400000;
    const start = end - 7 * 86400000;
    const inWeek = attempts.filter((a) => {
      const t = new Date(a.submittedAt).getTime();
      return t > start && t <= end;
    });
    weeks.push({
      label: new Date(end).toLocaleDateString(undefined, { day: "numeric", month: "short" }),
      attempts: inWeek.length,
      avgScore: inWeek.length ? Math.round(inWeek.reduce((t, a) => t + a.percentage, 0) / inWeek.length) : null,
      passed: inWeek.filter((a) => a.passed).length,
    });
  }

  const name = (id) => s.users.find((u) => u.id === id)?.name ?? "Unknown";
  return {
    kpis: {
      employees: employees.length,
      assigned: assigned.length,
      certified: assigned.filter((e) => e.passed).length,
      completionRate: assigned.length ? Math.round((assigned.filter((e) => e.passed).length / assigned.length) * 100) : 0,
      avgScore: Math.round(avg),
      passRate: attempts.length ? Math.round((attempts.filter((a) => a.passed).length / attempts.length) * 100) : 0,
      attempts: attempts.length,
      attemptsThisWeek: weeks[7].attempts,
      materials: s.materials.length,
      focusFlags: attempts.filter((a) => a.focusViolations >= 2).length,
    },
    departments,
    weeks,
    statusBreakdown: ["certified", "retake", "ready", "in-progress", "not-started"].map((k) => ({
      key: k,
      count: assigned.filter((e) => e.trainingStatus === k).length,
    })),
    recent: attempts.slice(0, 7).map((a) => ({ ...clone(a), userName: name(a.userId), review: undefined })),
    topPerformers: assigned
      .filter((e) => e.bestScore != null)
      .sort((a, b) => b.bestScore - a.bestScore)
      .slice(0, 5),
    attention: assigned
      .filter((e) => e.trainingStatus === "not-started" || e.trainingStatus === "retake")
      .slice(0, 5),
  };
}

// ── Users ───────────────────────────────────────────────────────────────────

export async function listUsers() {
  await delay();
  return db().users.map(userRow);
}

export async function saveUser(input) {
  await delay(500);
  const s = db();
  const email = input.email.trim().toLowerCase();
  if (s.users.some((u) => u.email.toLowerCase() === email && u.id !== input.id)) {
    throw new Error("Another user already has this email address.");
  }
  if (input.id) {
    const u = s.users.find((x) => x.id === input.id);
    Object.assign(u, {
      name: input.name.trim(),
      email,
      phone: input.phone,
      location: input.location,
      designationId: input.role === "admin" ? null : input.designationId,
      role: input.role,
      adminTitle: input.role === "admin" ? input.adminTitle || "Admin" : null,
      status: input.status,
    });
    if (input.password) u.password = input.password;
  } else {
    s.users.push({
      id: uid("e"),
      role: input.role,
      adminTitle: input.role === "admin" ? input.adminTitle || "Admin" : null,
      name: input.name.trim(),
      email,
      phone: input.phone,
      designationId: input.role === "admin" ? null : input.designationId,
      code: `AJN-${1100 + s.users.length}`,
      location: input.location,
      joinedAt: new Date().toISOString(),
      status: input.status || "active",
      lastActiveAt: null,
      password: input.password || MOCK_EMPLOYEE_PASSWORD,
      preferences: { emailReminders: true, resultEmails: true, weeklyDigest: false },
    });
  }
  commit();
}

export async function deleteUser(id) {
  await delay(300);
  const s = db();
  s.users = s.users.filter((u) => u.id !== id);
  s.attempts = s.attempts.filter((a) => a.userId !== id);
  commit();
}

export async function setUserStatus(id, status) {
  await delay(300);
  const u = db().users.find((x) => x.id === id);
  if (u) u.status = status;
  commit();
}

export async function resetUserPassword(id) {
  await delay(500);
  const u = db().users.find((x) => x.id === id);
  if (u) u.password = MOCK_EMPLOYEE_PASSWORD;
  commit();
  return { email: u?.email };
}

// Clears an employee's attempts so they can sit the assessment again.
export async function resetUserAttempts(id) {
  await delay(400);
  const s = db();
  s.attempts = s.attempts.filter((a) => a.userId !== id);
  commit();
}

// ── Departments ─────────────────────────────────────────────────────────────

export async function listDepartments() {
  await delay();
  const s = db();
  return s.departments.map((d) => ({
    ...clone(d),
    designations: s.designations.filter((x) => x.departmentId === d.id).map((x) => x.title),
    employees: s.users.filter((u) => u.role === "employee" && deptOf(u.designationId)?.id === d.id).length,
    materials: s.materials.filter((m) => m.departmentId === d.id).length,
    questions: s.assessments.filter((a) => a.departmentId === d.id).reduce((t, a) => t + (s.questions[a.id] || []).length, 0),
  }));
}

export async function saveDepartment(input) {
  await delay(450);
  const s = db();
  if (input.id && s.departments.some((d) => d.id === input.id)) {
    Object.assign(s.departments.find((d) => d.id === input.id), {
      name: input.name.trim(),
      description: input.description,
      head: input.head,
      location: input.location,
      active: input.active,
    });
  } else {
    const id = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "") || uid("dept");
    if (s.departments.some((d) => d.id === id)) throw new Error("A department with this name already exists.");
    s.departments.push({
      id,
      name: input.name.trim(),
      description: input.description,
      head: input.head,
      location: input.location,
      durationMinutes: 10,
      passPercent: 70,
      marksPerQuestion: 1,
      maxAttempts: 3,
      dueDays: 14,
      shuffle: true,
      active: input.active ?? true,
    });
    for (const lv of LEVELS) {
      const a = newAssessment(id, lv.key);
      s.assessments.push(a);
      s.questions[a.id] = [];
    }
  }
  commit();
}

export async function deleteDepartment(id) {
  await delay(350);
  const s = db();
  if (s.designations.some((d) => d.departmentId === id)) {
    throw new Error("Move or delete this department's designations first.");
  }
  s.departments = s.departments.filter((d) => d.id !== id);
  for (const a of s.assessments.filter((x) => x.departmentId === id)) delete s.questions[a.id];
  s.assessments = s.assessments.filter((a) => a.departmentId !== id);
  s.materials = s.materials.filter((m) => m.departmentId !== id);
  commit();
}

// ── Designations ────────────────────────────────────────────────────────────

export async function listDesignations() {
  await delay();
  const s = db();
  return s.designations.map((d) => ({
    ...clone(d),
    departmentName: s.departments.find((x) => x.id === d.departmentId)?.name ?? null,
    employees: s.users.filter((u) => u.designationId === d.id).length,
  }));
}

export async function saveDesignation(input) {
  await delay(400);
  const s = db();
  const title = input.title.trim();
  if (s.designations.some((d) => d.title.toLowerCase() === title.toLowerCase() && d.id !== input.id)) {
    throw new Error("This designation already exists.");
  }
  if (input.id) Object.assign(s.designations.find((d) => d.id === input.id), { title, departmentId: input.departmentId || null, level: input.level });
  else s.designations.push({ id: uid("des"), title, departmentId: input.departmentId || null, level: input.level });
  commit();
}

export async function deleteDesignation(id) {
  await delay(300);
  const s = db();
  if (s.users.some((u) => u.designationId === id)) throw new Error("Reassign the employees with this designation first.");
  s.designations = s.designations.filter((d) => d.id !== id);
  commit();
}

// ── Locations ───────────────────────────────────────────────────────────────

export async function listLocations() {
  await delay();
  const s = db();
  return locationsOf(s).map((l) => ({
    ...l,
    users: s.users.filter((u) => u.location === l.name).length,
    departments: s.departments.filter((d) => d.location === l.name).length,
  }));
}

export async function saveLocation(input) {
  await delay(300);
  const s = db();
  const list = locationsOf(s);
  const name = input.name.trim();
  if (list.some((l) => l.name.toLowerCase() === name.toLowerCase() && l.id !== input.id)) throw new Error("A location with this name already exists.");
  if (input.id) {
    const l = list.find((x) => x.id === input.id);
    for (const x of [...s.users, ...s.departments]) if (x.location === l.name) x.location = name;
    l.name = name;
  } else list.push({ id: uid("loc"), name });
  commit();
}

export async function deleteLocation(id) {
  await delay(300);
  const s = db();
  const l = locationsOf(s).find((x) => x.id === id);
  if ([...s.users, ...s.departments].some((x) => x.location === l.name)) throw new Error(`${l.name} is still in use. Move people and departments to another location first.`);
  s.locations = s.locations.filter((x) => x.id !== id);
  commit();
}

// ── Materials ───────────────────────────────────────────────────────────────

export async function listMaterials() {
  await delay();
  const s = db();
  return s.materials.map(({ content, ...m }) => {
    const audience = s.users.filter((u) => reaches(m, u));
    const completed = audience.filter((u) => s.progress[u.id]?.[m.id]?.completed).length;
    return {
      ...clone(m),
      departmentName: m.departmentId ? s.departments.find((d) => d.id === m.departmentId)?.name ?? "—" : "All departments",
      levelsLabel: levelsText(m.levels),
      audience: audience.length,
      completed,
      sections: m.type === "structured" ? content.sections.length : m.type === "manual" ? content.chapters.length : null,
    };
  });
}

export async function getMaterialForAdmin(id) {
  await delay(150);
  return clone(db().materials.find((m) => m.id === id));
}

const readAsDataUrl = (file) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error("Couldn't read the file."));
    r.readAsDataURL(file);
  });

// input: { id?, title, type, departmentId, required, description, estMinutes,
//          manualText? (manual), file? (pdf: a File from the upload field) }
export async function saveMaterial(input) {
  await delay(650);
  const s = db();
  const base = {
    title: input.title.trim(),
    departmentId: input.departmentId || null,
    required: !!input.required,
    description: input.description?.trim() || "",
    estMinutes: Number(input.estMinutes) || 5,
    levels: input.levels?.length && input.levels.length < LEVELS.length ? [...input.levels] : [],
    status: input.status ?? "published",
    updatedAt: new Date().toISOString(),
  };
  let file = {};
  if (input.type === "pdf" && input.file) {
    // Mock storage: small files are kept as data URLs so they survive a
    // reload; bigger ones only live for this browser session.
    const url = input.file.size <= 1.5 * 1024 * 1024 ? await readAsDataUrl(input.file) : URL.createObjectURL(input.file);
    file = { fileUrl: url, fileName: input.file.name, sizeBytes: input.file.size };
  }
  if (input.id) {
    const m = s.materials.find((x) => x.id === input.id);
    Object.assign(m, base, file);
    if (m.type === "manual" && input.manualText != null) m.content = parseManual(input.manualText);
    if (m.type === "media" && input.mediaUrl) m.content = { url: input.mediaUrl.trim(), kind: input.mediaKind || "video" };
    if (m.type === "structured" && input.guide) m.content = input.guide;
    m.version = bump(m.version);
  } else {
    s.materials.unshift({
      id: uid("mat"),
      type: input.type,
      version: "1.0",
      author: input.author || "Admin",
      ...base,
      ...file,
      fileUrl: file.fileUrl ?? null,
      content:
        input.type === "manual"
          ? parseManual(input.manualText || "")
          : input.type === "media"
            ? { url: (input.mediaUrl || "").trim(), kind: input.mediaKind || "video" }
            : input.type === "structured"
              ? input.guide
              : { blocks: [{ type: "p", text: base.description || "Uploaded document." }] },
    });
  }
  commit();
}

const bump = (v = "1.0") => {
  const [a, b] = v.split(".").map(Number);
  return `${a}.${(b || 0) + 1}`;
};

export async function setMaterialStatus(id, status) {
  await delay(250);
  const m = db().materials.find((x) => x.id === id);
  if (m) m.status = status;
  commit();
}

export async function setMaterialRequired(id, required) {
  await delay(200);
  const m = db().materials.find((x) => x.id === id);
  if (m) m.required = !!required;
  commit();
}

export async function deleteMaterial(id) {
  await delay(300);
  const s = db();
  s.materials = s.materials.filter((m) => m.id !== id);
  for (const p of Object.values(s.progress)) delete p[id];
  commit();
}

// ── Assessments & question bank ─────────────────────────────────────────────

// One assessment per department per level (team heads, seniors, juniors).
export async function listAssessments() {
  await delay();
  const s = db();
  return s.assessments.map((a) => {
    const d = s.departments.find((x) => x.id === a.departmentId);
    const attempts = s.attempts.filter((x) => x.assessmentId === a.id);
    const people = s.users.filter((u) => u.role === "employee" && deptOf(u.designationId)?.id === a.departmentId && levelOfUser(u) === a.level);
    return {
      ...clone(a),
      name: `${d?.name ?? "—"} · ${levelInfo(a.level).plural}`,
      departmentName: d?.name ?? "—",
      levelLabel: levelInfo(a.level).plural,
      designations: s.designations.filter((x) => x.departmentId === a.departmentId && levelKey(x.level) === a.level).map((x) => x.title),
      employees: people.length,
      questions: (s.questions[a.id] || []).length,
      attempts: attempts.length,
      avgScore: attempts.length ? Math.round(attempts.reduce((t, x) => t + x.percentage, 0) / attempts.length) : null,
      passRate: attempts.length ? Math.round((attempts.filter((x) => x.passed).length / attempts.length) * 100) : null,
    };
  });
}

export async function saveAssessmentSettings(id, patch) {
  await delay(450);
  const a = db().assessments.find((x) => x.id === id);
  for (const k of ["durationMinutes", "passPercent", "marksPerQuestion", "maxAttempts", "questionsPerAttempt", "shuffle"]) {
    if (k in patch) a[k] = k === "shuffle" ? !!patch[k] : Number(patch[k]);
  }
  commit();
}

export async function listQuestions(departmentId) {
  await delay(220);
  const s = db();
  // How often each question is answered correctly (portal attempts only).
  const stats = {};
  for (const a of s.attempts) {
    if ((a.assessmentId ?? a.departmentId) !== departmentId || !a.review) continue;
    for (const r of a.review) {
      stats[r.id] ??= { seen: 0, correct: 0 };
      stats[r.id].seen++;
      if (r.isCorrect) stats[r.id].correct++;
    }
  }
  return clone(s.questions[departmentId] || []).map((q) => ({ ...q, stats: stats[q.id] || null }));
}

export async function saveQuestion(departmentId, q) {
  await delay(350);
  const s = db();
  s.questions[departmentId] ??= [];
  const bank = s.questions[departmentId];
  const clean = { text: q.text.trim(), options: q.options.map((o) => o.trim()), answer: Number(q.answer) };
  if (q.id) Object.assign(bank.find((x) => x.id === q.id), clean);
  else bank.push({ id: uid("q"), ...clean });
  commit();
}

export async function deleteQuestion(departmentId, id) {
  await delay(250);
  const s = db();
  s.questions[departmentId] = (s.questions[departmentId] || []).filter((q) => q.id !== id);
  commit();
}

// ── Results ─────────────────────────────────────────────────────────────────

export async function listResults() {
  await delay();
  const s = db();
  return s.attempts.map(({ review, ...a }) => {
    const u = s.users.find((x) => x.id === a.userId);
    return { ...clone(a), userName: u?.name ?? "Unknown", userEmail: u?.email ?? "", userCode: u?.code ?? "", hasReview: !!review };
  });
}

export async function getResult(id) {
  await delay(200);
  const s = db();
  const a = s.attempts.find((x) => x.id === id);
  if (!a) throw new Error("Result not found.");
  const u = s.users.find((x) => x.id === a.userId);
  return { ...clone(a), userName: u?.name, userEmail: u?.email };
}

export async function deleteResult(id) {
  await delay(250);
  const s = db();
  s.attempts = s.attempts.filter((a) => a.id !== id);
  commit();
}

// ── Announcements & demo data ───────────────────────────────────────────────

export async function postAnnouncement({ title, body, author }) {
  await delay(400);
  db().announcements.unshift({ id: uid("an"), title, body, author, tone: "lime", createdAt: new Date().toISOString() });
  commit();
}

export async function resetDemoData() {
  await delay(400);
  resetDb();
}
