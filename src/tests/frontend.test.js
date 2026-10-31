// Frontend logic behind the QA fixes (plain JS: no DOM, no JSX).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { guideToEditable, editableToGuide, guideProblem, moveSection, blankSection } from "../lib/guide.js";
import { blockedMessage, completionNeeded, titleForFile } from "../lib/progress.js";
import { phoneProblem } from "../lib/phone.js";
import { removeWhere } from "../lib/storage.js";

const SRC = path.resolve(import.meta.dirname, "..");

describe("QA-002 structured guide editor content", () => {
  const api = {
    intro: "Welcome",
    sections: [
      { id: "s-1", title: "One", body: ["Para 1", "Para 2"], points: ["A", "B"], tip: "Tip" },
      { id: "s-2", title: "Two", body: ["Only"] },
    ],
  };

  it("round-trips API content through the editor, keeping section ids", () => {
    const ed = guideToEditable(api);
    expect(ed.sections[0]).toMatchObject({ id: "s-1", body: "Para 1\n\nPara 2", points: "A\nB", tip: "Tip" });
    expect(editableToGuide(ed)).toEqual(api);
  });

  it("splits paragraphs on blank lines, points per line (bullets stripped), drops empty tips", () => {
    const out = editableToGuide({ intro: " Hi ", sections: [{ id: "x", title: " T ", body: "one\n\n\ntwo\n", points: "- first\n• second\n\n", tip: "  " }] });
    expect(out).toEqual({ intro: "Hi", sections: [{ id: "x", title: "T", body: ["one", "two"], points: ["first", "second"] }] });
  });

  it("starts a new guide with one empty section and validates titles and content", () => {
    const ed = guideToEditable(null);
    expect(ed.sections).toHaveLength(1);
    expect(guideProblem(ed)).toBe("Section 1 needs a title.");
    ed.sections[0].title = "Intro";
    expect(guideProblem(ed)).toBe("Section 1 needs some content or key points.");
    ed.sections[0].points = "Something";
    expect(guideProblem(ed)).toBeNull();
    expect(guideProblem({ intro: "", sections: [] })).toBe("Add at least one section.");
  });

  it("reorders sections and gives new ones unique ids", () => {
    const list = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(moveSection(list, 2, -1).map((s) => s.id)).toEqual(["a", "c", "b"]);
    expect(moveSection(list, 0, 1).map((s) => s.id)).toEqual(["b", "a", "c"]);
    expect(moveSection(list, 0, -1)).toBe(list);
    expect(blankSection().id).not.toBe(blankSection().id);
  });
});

describe("QA-001 completion button follows the server", () => {
  const p = (r, extra = {}) => ({ completed: false, canComplete: false, requirement: { minSeconds: 120, activeSeconds: 0, sectionsTotal: 3, sectionsSeen: 0, fileOpened: true, ...r }, ...extra });
  it("explains what is missing, and nothing once the server allows completion", () => {
    expect(completionNeeded(p({}), "structured")).toBe("0 of 3 sections read · about 2 min of reading left");
    expect(completionNeeded(p({ sectionsSeen: 3, activeSeconds: 100 }), "manual")).toBe("less than a minute of reading left");
    expect(completionNeeded(p({ fileOpened: false, sectionsTotal: 0 }), "pdf")).toBe("open the PDF to start");
    expect(completionNeeded(p({}, { canComplete: true }), "pdf")).toBeNull();
    expect(completionNeeded(p({}, { completed: true }), "pdf")).toBeNull();
  });
});

describe("QA-010 PDF title follows the selected file", () => {
  it("replaces a title that came from the previous file, keeps one the admin typed", () => {
    let s = titleForFile("", null, "first-policy.pdf");
    expect(s).toEqual({ title: "first policy", auto: "first policy" });
    s = titleForFile(s.title, s.auto, "Second_Policy.PDF");
    expect(s.title).toBe("Second Policy");
    expect(titleForFile("My own title", s.auto, "third.pdf").title).toBe("My own title");
  });
});

describe("QA-013 blocked-test message", () => {
  const cond = (id) => [
    { id: "materials", met: id !== "materials" },
    { id: "attempts", met: id !== "attempts" },
    { id: "questions", met: id !== "questions" },
  ];
  it("names the real reason", () => {
    expect(blockedMessage({ conditions: cond("attempts") })).toMatch(/used all your attempts/);
    expect(blockedMessage({ conditions: cond("questions") })).toMatch(/isn't open yet/);
    expect(blockedMessage({ conditions: cond("materials") })).toMatch(/Finish your required training/);
    expect(blockedMessage({ conditions: cond(null), activeAttempt: { id: "x" } })).toMatch(/test in progress/);
    expect(blockedMessage({ conditions: cond("questions") })).not.toMatch(/attempts/);
  });
});

describe("QA-008 phone check matches the server rule", () => {
  it("accepts real numbers and blank, rejects junk", () => {
    for (const ok of ["+91 98765 43210", "0522-4012345", "(0522) 401 2345", "", "  "]) expect(phoneProblem(ok)).toBeNull();
    for (const bad of ["12345", "abc1234567", "+91 98765 43210 98765 4321", "98765-43210 ext 5"]) expect(phoneProblem(bad)).toMatch(/valid phone/);
  });
});

describe("QA-014 login placeholder", () => {
  it("uses the company domain", () => {
    const login = readFileSync(path.join(SRC, "pages/Login.jsx"), "utf8");
    expect(login).not.toContain("you@aajneeti.com");
    expect(login).toContain('placeholder="you@aajneeti.social"');
  });
});

describe("QA-015 no demo data in the real app", () => {
  const files = (dir) => readdirSync(dir).flatMap((f) => (statSync(path.join(dir, f)).isDirectory() ? files(path.join(dir, f)) : [path.join(dir, f)]));

  it("only the mock services import sample data or mocks", () => {
    const offenders = files(SRC)
      .filter((f) => /\.(jsx?|tsx?)$/.test(f) && !f.includes(`${path.sep}services${path.sep}mock${path.sep}`) && !f.includes(`${path.sep}data${path.sep}`) && !f.includes(`${path.sep}tests${path.sep}`))
      .filter((f) => /from\s+["'][^"']*(\/data\/|\/mock\/|mockDb)/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("removeWhere clears old mock keys and leaves the rest", () => {
    // Like a browser's Storage: stored keys are the object's own keys.
    class FakeStorage {
      getItem(k) {
        return Object.hasOwn(this, k) ? this[k] : null;
      }
      setItem(k, v) {
        this[k] = String(v);
      }
      removeItem(k) {
        delete this[k];
      }
    }
    const ls = Object.assign(new FakeStorage(), { "acl.mockdb.v6": "{}", "acl.mockdb.v5": "{}", "acl.auth.v1": "t", theme: "dark" });
    const before = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", { value: ls, configurable: true, writable: true });
    try {
      removeWhere((k) => k.startsWith("acl.mockdb") || k === "acl.auth.v1");
      expect(Object.keys(ls)).toEqual(["theme"]);
    } finally {
      if (before) Object.defineProperty(globalThis, "localStorage", before);
      else delete globalThis.localStorage;
    }
  });
});

describe("QA-016 announcements are fetched once", () => {
  beforeEach(() => vi.resetModules());

  it("shares one request between the top bar and the dashboard", async () => {
    const getAnnouncements = vi.fn(async () => [{ id: "a" }]);
    vi.doMock("../services/training", () => ({ getAnnouncements }));
    const { loadAnnouncements } = await import("../store/announcements.js");
    const [bar, dash] = await Promise.all([loadAnnouncements("u1"), loadAnnouncements("u1")]);
    expect(bar).toEqual([{ id: "a" }]);
    expect(dash).toBe(bar);
    expect(getAnnouncements).toHaveBeenCalledTimes(1);
    // A different person signing in gets their own list.
    await loadAnnouncements("u2");
    expect(getAnnouncements).toHaveBeenCalledTimes(2);
  });

  it("retries after a failed request", async () => {
    let n = 0;
    const getAnnouncements = vi.fn(async () => {
      if (n++ === 0) throw new Error("offline");
      return [];
    });
    vi.doMock("../services/training", () => ({ getAnnouncements }));
    const { loadAnnouncements } = await import("../store/announcements.js");
    await expect(loadAnnouncements("u1")).rejects.toThrow("offline");
    await expect(loadAnnouncements("u1")).resolves.toEqual([]);
  });
});
