// Video courses (Study Materials): admin builder, assignment, per-video
// progress crediting, course completion and the assessment gate.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { signedIn, resetDb, closeDb, prisma, makeDepartment, makeDesignation, makeUser, makeAdmin, makeTrack, readMaterial } from "./helpers.js";
import { youtubeId } from "../src/utils/youtube.js";
import { addWatched, mergeRanges, covered } from "../src/utils/ranges.js";

let track, ad;
beforeAll(async () => {
  await resetDb();
  track = await makeTrack();
  ad = await signedIn(await makeAdmin());
});
afterAll(closeDb);

const V = (n) => `https://www.youtube.com/watch?v=abcdefghij${n}`;
const course = (over = {}) => ({
  title: "Facebook Ads Mastery",
  description: "From beginner to advanced",
  departmentId: track.dept.id,
  required: true,
  levels: ["junior"],
  status: "published",
  sections: [
    { title: "Intro", lessons: [{ title: "Welcome", video: V(1), durationSeconds: 60 }, { title: "Setup", video: "https://youtu.be/abcdefghij2", durationSeconds: 120 }] },
    { title: "Ads", lessons: [{ title: "First ad", video: "abcdefghij3", durationSeconds: 90 }] },
  ],
  ...over,
});
const create = (over) => ad.post("/api/v1/admin/courses").send(course(over));
const ping = (a, lessonId, body = {}) => a.post(`/api/v1/training/lessons/${lessonId}/progress`).send(body);
const backdate = (userId, lessonId, seconds) =>
  prisma.lessonProgress.update({ where: { userId_lessonId: { userId, lessonId } }, data: { lastPingAt: new Date(Date.now() - seconds * 1000) } });

// Watches a whole video the honest way: heartbeats every 30 s of real time.
async function watch(a, userId, lesson) {
  await ping(a, lesson.id);
  for (let t = 0; t < lesson.durationSeconds; t += 30) {
    await backdate(userId, lesson.id, 30);
    await ping(a, lesson.id, { ranges: [[t, Math.min(lesson.durationSeconds, t + 30)]], position: t + 30 });
  }
}

describe("YouTube links and watched ranges", () => {
  it("parses the usual link shapes", () => {
    for (const s of ["https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10", "youtu.be/dQw4w9WgXcQ", "https://www.youtube.com/embed/dQw4w9WgXcQ", "https://youtube.com/shorts/dQw4w9WgXcQ", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"]) {
      expect(youtubeId(s), s).toBe("dQw4w9WgXcQ");
    }
    for (const s of ["https://vimeo.com/123", "https://www.youtube.com/watch?v=short", "hello", ""]) expect(youtubeId(s), s).toBeNull();
  });

  it("merges ranges and credits new coverage only up to the allowance", () => {
    expect(mergeRanges([[10, 20], [0, 5], [19, 30], [40, 35]], 100)).toEqual([[0, 5], [10, 30], [35, 40]]);
    expect(covered([[0, 5], [10, 30]])).toBe(25);
    expect(addWatched([[0, 10]], [[0, 100]], 20, 100)).toEqual([[0, 30]]);
    expect(addWatched([[0, 10]], [[5, 15]], 100, 100)).toEqual([[0, 15]]);
    expect(addWatched([], [[0, 50]], 0, 100)).toEqual([]);
  });
});

describe("admin course builder", () => {
  it("creates a course with sections and videos, ids parsed from links", async () => {
    const r = await create();
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ title: "Facebook Ads Mastery", status: "published", required: true, levels: ["junior"], sectionsCount: 2 });
    expect(r.body.data.sections[0].lessons.map((l) => l.youtubeId)).toEqual(["abcdefghij1", "abcdefghij2"]);
  });

  it("validates: explicit audience, levels, required, sections with videos, real YouTube links", async () => {
    const bad = async (body, msg) => {
      const r = await ad.post("/api/v1/admin/courses").send(body);
      expect(r.status).toBe(422);
      if (msg) expect(r.body.error.message).toBe(msg);
    };
    const { departmentId, required, levels, ...rest } = course();
    await bad(rest);
    await bad(course({ sections: [] }), "Add at least one section.");
    await bad(course({ sections: [{ title: "Empty", lessons: [] }] }), "Add at least one video to each section.");
    await bad(course({ sections: [{ title: "S", lessons: [{ title: "V", video: "https://vimeo.com/1", durationSeconds: 10 }] }] }), "That isn't a YouTube video link.");
    await bad(course({ sections: [{ title: "S", lessons: [{ title: "V", video: V(1) }] }] }), "Video length is required.");
    expect((await ad.post("/api/v1/admin/courses").send(course({ departmentId: "nope" }))).status).toBe(400);
  });

  it("edits keep existing videos (and progress), reorder, add and remove", async () => {
    const c = (await create({ title: "Editable" })).body.data;
    const [s1, s2] = c.sections;
    const u = await makeUser({ designationId: track.designation.id });
    const a = await signedIn(u);
    await ping(a, s1.lessons[0].id);

    const edited = {
      sections: [
        { id: s2.id, title: "Ads (first now)", lessons: [{ id: s2.lessons[0].id, title: "First ad", video: s2.lessons[0].youtubeId, durationSeconds: 90 }] },
        { id: s1.id, title: "Intro", lessons: [{ id: s1.lessons[0].id, title: "Welcome (renamed)", video: V(1), durationSeconds: 60 }, { title: "New video", video: V(4), durationSeconds: 30 }] },
      ],
    };
    const r = await ad.patch(`/api/v1/admin/courses/${c.id}`).send(edited);
    expect(r.status).toBe(200);
    expect(r.body.data.sections.map((s) => s.title)).toEqual(["Ads (first now)", "Intro"]);
    expect(r.body.data.sections[1].lessons.map((l) => l.title)).toEqual(["Welcome (renamed)", "New video"]);
    expect(r.body.data.sections[1].lessons[0].id).toBe(s1.lessons[0].id);
    // The removed "Setup" video is gone; the opened one kept its progress.
    expect(await prisma.courseLesson.findUnique({ where: { id: s1.lessons[1].id } })).toBeNull();
    expect(await prisma.lessonProgress.count({ where: { lessonId: s1.lessons[0].id } })).toBe(1);
  });

  it("drafts are invisible to employees; delete archives a course with activity", async () => {
    const draft = (await create({ title: "Draft course", status: "draft" })).body.data;
    const u = await makeUser({ designationId: track.designation.id });
    const a = await signedIn(u);
    expect((await a.get("/api/v1/training/courses")).body.data.some((c) => c.id === draft.id)).toBe(false);
    expect((await a.get(`/api/v1/training/courses/${draft.id}`)).status).toBe(404);

    const untouched = (await create({ title: "Untouched" })).body.data;
    expect((await ad.delete(`/api/v1/admin/courses/${untouched.id}`)).body.data).toEqual({ deleted: true });
    const used = (await create({ title: "Used" })).body.data;
    await ping(a, used.sections[0].lessons[0].id);
    expect((await ad.delete(`/api/v1/admin/courses/${used.id}`)).body.data).toEqual({ archived: true });
  });

  it("is admin-only", async () => {
    const a = await signedIn(await makeUser({ designationId: track.designation.id }));
    expect((await a.get("/api/v1/admin/courses")).status).toBe(403);
    expect((await a.post("/api/v1/admin/courses").send(course())).status).toBe(403);
  });
});

describe("assignment", () => {
  it("reaches the right department and levels; company-wide reaches everyone at those levels", async () => {
    const mine = (await create({ title: "Juniors here", required: false })).body.data;
    const company = (await create({ title: "Company juniors", departmentId: null, required: false })).body.data;
    const other = await makeDepartment();
    const juniorElsewhere = await signedIn(await makeUser({ designationId: (await makeDesignation(other.id, "JUNIOR")).id }));
    const headHere = await signedIn(await makeUser({ designationId: (await makeDesignation(track.dept.id, "TEAM_HEAD")).id }));
    const juniorHere = await signedIn(await makeUser({ designationId: track.designation.id }));
    const ids = async (a) => (await a.get("/api/v1/training/courses")).body.data.map((c) => c.id);

    expect(await ids(juniorHere)).toEqual(expect.arrayContaining([mine.id, company.id]));
    expect(await ids(juniorElsewhere)).toContain(company.id);
    expect(await ids(juniorElsewhere)).not.toContain(mine.id);
    expect(await ids(headHere)).not.toContain(company.id);
    expect((await headHere.get(`/api/v1/training/courses/${mine.id}`)).status).toBe(403);
    expect((await ping(headHere, mine.sections[0].lessons[0].id)).status).toBe(403);
  });
});

describe("video progress", () => {
  it("records opening, credits watching at real-time speed only, completes at 90%", async () => {
    const c = (await create({ title: "Progress", required: false })).body.data;
    const lesson = c.sections[0].lessons[1]; // 120 s
    const u = await makeUser({ designationId: track.designation.id });
    const a = await signedIn(u);

    let r = await ping(a, lesson.id);
    expect(r.body.data.lesson.progress).toMatchObject({ opened: true, completed: false, percent: 0 });

    // Claiming the whole video immediately: only a few seconds are credited.
    r = await ping(a, lesson.id, { ranges: [[0, 120]], position: 120 });
    expect(r.body.data.lesson.progress.watchedSeconds).toBeLessThan(10);
    expect(r.body.data.lesson.progress.completed).toBe(false);

    // 30 s later: at most 30 s × 2 (fastest speed) + slack more.
    await backdate(u.id, lesson.id, 30);
    r = await ping(a, lesson.id, { ranges: [[0, 120]] });
    expect(r.body.data.lesson.progress.watchedSeconds).toBeLessThanOrEqual(70);

    // An idle hour counts as one capped gap, not an hour.
    await backdate(u.id, lesson.id, 3600);
    r = await ping(a, lesson.id, { ranges: [[0, 120]] });
    expect(r.body.data.lesson.progress.watchedSeconds).toBeLessThanOrEqual(120);
    expect(r.body.data.lesson.progress.watchedSeconds).toBeGreaterThanOrEqual(108);
    expect(r.body.data.lesson.progress).toMatchObject({ completed: true, percent: 100 });
    expect(r.body.data.course).toMatchObject({ lessonsTotal: 3, lessonsCompleted: 1, percent: 33 });
  });

  it("skipping ahead doesn't count the skipped part", async () => {
    const c = (await create({ title: "Skip", required: false })).body.data;
    const lesson = c.sections[0].lessons[1]; // 120 s
    const u = await makeUser({ designationId: track.designation.id });
    const a = await signedIn(u);
    await ping(a, lesson.id);
    await backdate(u.id, lesson.id, 30);
    await ping(a, lesson.id, { ranges: [[0, 20]] }); // watched 0–20
    await backdate(u.id, lesson.id, 30);
    const r = await ping(a, lesson.id, { ranges: [[100, 120]], position: 120 }); // jumped to the end
    expect(r.body.data.lesson.progress.watchedSeconds).toBe(40);
    expect(r.body.data.lesson.progress.completed).toBe(false);
    const row = await prisma.lessonProgress.findUnique({ where: { userId_lessonId: { userId: u.id, lessonId: lesson.id } } });
    expect(row.watchedRanges).toEqual([[0, 20], [100, 120]]);
  });

  it("shows per-video progress on the course page and resumes at the last position", async () => {
    const c = (await create({ title: "Resume", required: false })).body.data;
    const lesson = c.sections[1].lessons[0];
    const u = await makeUser({ designationId: track.designation.id });
    const a = await signedIn(u);
    await ping(a, lesson.id);
    await backdate(u.id, lesson.id, 30);
    await ping(a, lesson.id, { ranges: [[0, 30]], position: 30 });
    const page = (await a.get(`/api/v1/training/courses/${c.id}`)).body.data;
    const l = page.sections[1].lessons[0];
    expect(l.progress).toMatchObject({ opened: true, completed: false, watchedSeconds: 30, percent: 33, position: 30 });
    expect(page.sections[0].lessons[0].progress).toMatchObject({ opened: false, percent: 0 });
    expect(page).toMatchObject({ lessonsTotal: 3, lessonsCompleted: 0, percent: 0 });
  });
});

describe("assessment gate", () => {
  it("a Required course must be completed before the test unlocks; Optional ones don't block", async () => {
    const t = await makeTrack();
    const u = await makeUser({ designationId: t.designation.id });
    const a = await signedIn(u);
    await readMaterial(a, u.id, t.material.id);
    const mod = async () => (await a.get("/api/v1/training/module")).body.data;
    expect((await mod()).eligible).toBe(true);

    // An optional course changes nothing.
    await create({ title: "Optional extra", departmentId: t.dept.id, required: false });
    expect((await mod()).eligible).toBe(true);

    // A required one locks the test until every video is watched.
    const req = (await create({ title: "Required course", departmentId: t.dept.id, required: true })).body.data;
    let m = await mod();
    expect(m).toMatchObject({ eligible: false, blocker: "materials", requiredCount: 2, completedRequired: 1, requiredCourses: 1, completedRequiredCourses: 0, stage: "learn" });
    expect((await a.post("/api/v1/training/attempts")).body.error).toMatchObject({ code: "NOT_ELIGIBLE", details: { condition: "materials" } });

    const lessons = req.sections.flatMap((s) => s.lessons);
    for (const l of lessons.slice(0, 2)) await watch(a, u.id, l);
    expect((await mod()).eligible).toBe(false);
    await watch(a, u.id, lessons[2]);
    m = await mod();
    expect(m).toMatchObject({ eligible: true, completedRequiredCourses: 1, completedRequired: 2 });
    expect((await a.post("/api/v1/training/attempts")).status).toBe(201);
  });

  it("the admin users list counts required courses in the training status", async () => {
    const t = await makeTrack();
    const u = await makeUser({ designationId: t.designation.id, name: "Gate Person" });
    const a = await signedIn(u);
    await readMaterial(a, u.id, t.material.id);
    await create({ title: "Required for list", departmentId: t.dept.id, required: true });
    const row = (await ad.get("/api/v1/admin/users")).body.data.find((x) => x.id === u.id);
    expect(row).toMatchObject({ materialsDone: 1, materialsRequired: 2, trainingStatus: "in-progress" });
  });
});

describe("admin progress report", () => {
  it("lists every assigned employee with per-video activity", async () => {
    const t = await makeTrack();
    const c = (await create({ title: "Report", departmentId: t.dept.id, required: false })).body.data;
    const watcher = await makeUser({ designationId: t.designation.id, name: "A Watcher" });
    await makeUser({ designationId: t.designation.id, name: "B Idle" });
    const a = await signedIn(watcher);
    const first = c.sections[0].lessons[0];
    await watch(a, watcher.id, first);
    await ping(a, c.sections[0].lessons[1].id);

    const r = await ad.get(`/api/v1/admin/courses/${c.id}/progress`);
    expect(r.status).toBe(200);
    const [w, idle] = r.body.data.employees;
    expect(w).toMatchObject({ name: "A Watcher", lessonsCompleted: 1, lessonsTotal: 3, percent: 33, opened: 2 });
    expect(w.lessons[0]).toMatchObject({ opened: true, completed: true, percent: 100 });
    expect(w.lessons[1]).toMatchObject({ opened: true, completed: false, percent: 0 });
    expect(w.lessons[2]).toMatchObject({ opened: false });
    expect(idle).toMatchObject({ name: "B Idle", lessonsCompleted: 0, opened: 0, lastWatchedAt: null });
    const list = (await ad.get("/api/v1/admin/courses")).body.data.find((x) => x.id === c.id);
    expect(list).toMatchObject({ audience: 2, completed: 0, lessonsCount: 3, durationSeconds: 270 });
  });
});

describe("security policy allows YouTube playback", () => {
  it("CSP lists YouTube for frames, the player script and thumbnails", async () => {
    const r = await ad.get("/api/v1/health");
    const csp = r.headers["content-security-policy"];
    expect(csp).toMatch(/frame-src [^;]*https:\/\/www\.youtube-nocookie\.com/);
    expect(csp).toMatch(/script-src [^;]*https:\/\/www\.youtube\.com/);
    expect(csp).toMatch(/img-src [^;]*https:\/\/i\.ytimg\.com/);
  });
});
