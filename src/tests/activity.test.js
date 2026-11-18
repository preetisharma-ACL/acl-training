// Activity log wording (src/lib/activity.js).

import { describe as group, it, expect } from "vitest";
import { describe, changeList, notes, createdWith, fieldValue, historyHref } from "../lib/activity.js";

const actor = { id: "a1", name: "Alok", email: "alok@x" };

group("activity log wording", () => {
  it("names who did what to which record", () => {
    expect(describe({ action: "USER_CREATED", entityType: "User", label: "Riya", actor })).toEqual({ who: "Alok", verb: "added user", target: "Riya" });
    expect(describe({ action: "DESIGNATION_UPDATED", entityType: "Designation", label: "SEO Lead", actor })).toEqual({ who: "Alok", verb: "edited designation", target: "SEO Lead" });
    expect(describe({ action: "MATERIAL_DELETED", entityType: "Material", label: "HR essentials", actor })).toEqual({ who: "Alok", verb: "deleted training material", target: "HR essentials" });
    expect(describe({ action: "COURSE_ARCHIVED", entityType: "Course", label: "FB Ads", actor }).verb).toBe("archived video course");
  });

  it("words sign-ins about the person themselves, and failed sign-ins without an actor", () => {
    expect(describe({ action: "LOGIN_SUCCEEDED", entityType: "User", label: "Neha", actor: { name: "Neha" } })).toEqual({ who: "Neha", verb: "signed in", target: null });
    expect(describe({ action: "LOGIN_FAILED", entityType: "User", label: "Neha", actor: null })).toEqual({ who: "Neha", verb: "had a failed sign-in (wrong password)", target: null });
    expect(describe({ action: "DEPARTMENT_CREATED", entityType: "Department", label: "SEO", actor: null }).who).toBeNull();
  });

  it("lists field changes with readable labels and values", () => {
    const item = {
      changes: {
        designation: { from: "Content Writer · Content", to: "Content Strategist · Content" },
        required: { from: false, to: true },
        passPercent: { from: 60, to: 70 },
        phone: { from: null, to: "+91 98765 43210" },
        levels: { from: "All levels", to: "Seniors, Juniors" },
      },
    };
    expect(changeList(item)).toEqual([
      { field: "designation", label: "Designation", from: "Content Writer · Content", to: "Content Strategist · Content" },
      { field: "required", label: "Required", from: "No", to: "Yes" },
      { field: "passPercent", label: "Pass mark", from: "60%", to: "70%" },
      { field: "phone", label: "Phone", from: "(empty)", to: "+91 98765 43210" },
      { field: "levels", label: "Levels", from: "All levels", to: "Seniors, Juniors" },
    ]);
    expect(changeList({})).toEqual([]);
    expect(fieldValue("options", ["A", "B"])).toBe("A / B");
  });

  it("adds short notes: scores, versions and counts", () => {
    expect(notes({ action: "ATTEMPT_SUBMITTED", entityType: "Attempt", meta: { percentage: 80, passed: true } })).toEqual(["Scored 80% — passed"]);
    expect(notes({ action: "MATERIAL_UPDATED", entityType: "Material", meta: { contentChanged: true, newVersion: "1.2", requireRecompletion: true } })).toEqual([
      "Content edited (now version 1.2)",
      "Employees must read it again",
    ]);
    expect(notes({ action: "USER_UPDATED", entityType: "User", meta: { passwordSet: true } })).toEqual(["Password changed"]);
    expect(notes({ action: "QUESTION_UPDATED", entityType: "Question", meta: { assessment: "SEO test" } })).toEqual(["In SEO test"]);
  });

  it("shows what a record was created with", () => {
    const item = { kind: "created", meta: { label: "Riya", name: "Riya", email: "riya@x", role: "Employee", phone: null, designation: "Writer · Content" } };
    expect(createdWith(item)).toEqual([
      { label: "Name", value: "Riya" },
      { label: "Email", value: "riya@x" },
      { label: "Role", value: "Employee" },
      { label: "Designation", value: "Writer · Content" },
    ]);
    expect(createdWith({ kind: "updated", meta: { name: "x" } })).toEqual([]);
  });

  it("links to one record's history", () => {
    expect(historyHref("User", "u 1", "Riya & Co")).toBe("/admin/activity?entityType=User&entityId=u%201&label=Riya%20%26%20Co");
  });
});
