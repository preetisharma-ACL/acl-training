// Video courses: frontend logic (links, time formats, watch tracking, the
// admin builder form).

import { describe, it, expect } from "vitest";
import { youtubeId, clock, totalLength, parseClock, thumbnail } from "../lib/youtube.js";
import { createWatchTracker } from "../lib/watch.js";
import { courseToForm, formToPayload, formProblems, blankLesson, move } from "../lib/courseForm.js";

describe("YouTube helpers", () => {
  it("parses links like the server does", () => {
    for (const s of ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://youtu.be/dQw4w9WgXcQ?t=5", "youtube.com/shorts/dQw4w9WgXcQ", "https://m.youtube.com/watch?v=dQw4w9WgXcQ&list=x", "dQw4w9WgXcQ"]) {
      expect(youtubeId(s), s).toBe("dQw4w9WgXcQ");
    }
    for (const s of ["https://vimeo.com/1", "https://example.com/watch?v=dQw4w9WgXcQ", "nope", null]) expect(youtubeId(s), String(s)).toBeNull();
    expect(thumbnail("dQw4w9WgXcQ")).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg");
  });

  it("formats and reads durations", () => {
    expect(clock(65)).toBe("1:05");
    expect(clock(3723)).toBe("1:02:03");
    expect(totalLength(2400)).toBe("40min");
    expect(totalLength(5280)).toBe("1hr 28min");
    expect(totalLength(45)).toBe("45s");
    expect(parseClock("12:30")).toBe(750);
    expect(parseClock("1:02:03")).toBe(3723);
    expect(parseClock("90")).toBe(90);
    for (const bad of ["", "abc", "1:xx", "1:2:3:4"]) expect(parseClock(bad), bad).toBeNull();
  });
});

describe("watch tracker", () => {
  it("records normal playback as one range", () => {
    const t = createWatchTracker();
    for (let s = 0; s <= 10; s++) t.sample(s, true);
    expect(t.drain()).toEqual([[0, 10]]);
    expect(t.drain()).toEqual([]);
  });

  it("counts up to 2× speed, but not a seek forward or backward", () => {
    const t = createWatchTracker();
    t.sample(0, true);
    t.sample(2, true); // 2× speed
    t.sample(4, true);
    t.sample(60, true); // seek
    t.sample(61, true);
    t.sample(30, true); // seek back
    t.sample(31, true);
    expect(t.drain()).toEqual([[0, 4], [60, 61], [30, 31]]);
  });

  it("ignores time while paused or buffering", () => {
    const t = createWatchTracker();
    t.sample(0, true);
    t.sample(1, true);
    t.sample(1, false);
    t.sample(5, false);
    t.sample(5, true);
    t.sample(6, true);
    expect(t.drain()).toEqual([[0, 1], [5, 6]]);
  });
});

describe("course builder form", () => {
  const course = {
    title: "Facebook Ads",
    description: "Intro",
    departmentId: null,
    required: true,
    levels: [],
    sections: [{ id: "sec1", title: "Intro", lessons: [{ id: "les1", title: "Welcome", youtubeId: "dQw4w9WgXcQ", durationSeconds: 125, description: "" }] }],
  };

  it("new course: nothing chosen, all problems reported", () => {
    const f = courseToForm(null);
    expect(f).toMatchObject({ departmentId: "", required: null, levels: [] });
    const p = formProblems(f);
    expect(Object.keys(p)).toEqual(expect.arrayContaining(["title", "scope", "levels", "required", "s0", "s0l0"]));
  });

  it("round-trips an existing course, keeping ids", () => {
    const f = courseToForm(course);
    expect(f).toMatchObject({ departmentId: "company", required: true, levels: ["head", "senior", "junior"] });
    expect(f.sections[0].lessons[0]).toMatchObject({ id: "les1", duration: "2:05" });
    expect(formProblems(f)).toEqual({});
    expect(formToPayload(f, "published")).toEqual({
      title: "Facebook Ads",
      description: "Intro",
      departmentId: null,
      required: true,
      levels: ["head", "senior", "junior"],
      status: "published",
      sections: [{ id: "sec1", title: "Intro", lessons: [{ id: "les1", title: "Welcome", description: "", video: "https://youtu.be/dQw4w9WgXcQ", durationSeconds: 125 }] }],
    });
  });

  it("flags a bad link, a missing title and a missing length", () => {
    const f = courseToForm(course);
    f.sections[0].lessons.push({ ...blankLesson(), video: "https://vimeo.com/1" }, { ...blankLesson(), video: "dQw4w9WgXcQ" }, { ...blankLesson(), video: "dQw4w9WgXcQ", title: "T" });
    const p = formProblems(f);
    expect(p.s0l1).toMatch(/YouTube/);
    expect(p.s0l2).toMatch(/title/);
    expect(p.s0l3).toMatch(/length/);
  });

  it("moves items within bounds", () => {
    expect(move([1, 2, 3], 0, 1)).toEqual([2, 1, 3]);
    expect(move([1, 2, 3], 2, 1)).toEqual([1, 2, 3]);
  });
});
