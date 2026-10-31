import { z } from "zod";
import { email, id, newPassword, required, text, phone } from "./common.js";
import { toLevelEnum } from "../utils/levels.js";

const status = z.enum(["active", "inactive", "suspended"]);
const level = z
  .string()
  .transform((v, ctx) => toLevelEnum(v) ?? (ctx.addIssue({ code: "custom", message: "Choose a valid level." }), z.NEVER));
const date = z.coerce.date();

// ── Users ──
const userFields = {
  name: required(120, "Name"),
  email,
  phone,
  location: text(100, "Location"),
  bio: text(1000, "Bio"),
  code: text(30, "Employee code"),
  joinedAt: date,
  role: z.enum(["employee", "admin", "super_admin"]),
  adminTitle: text(80, "Admin title"),
  designationId: id.nullable(),
  status,
  password: newPassword,
};

export const createUserSchema = z.object({
  ...userFields,
  role: userFields.role.default("employee"),
  status: userFields.status.default("active"),
  phone: userFields.phone.optional(),
  location: userFields.location.optional(),
  bio: userFields.bio.optional(),
  code: userFields.code.optional(),
  joinedAt: userFields.joinedAt.optional(),
  adminTitle: userFields.adminTitle.optional(),
  designationId: userFields.designationId.optional(),
  // Omit to have the server generate a temporary password.
  password: userFields.password.optional(),
  mustChangePassword: z.boolean().optional(),
})
  // Department and level come from the designation, so employees need one.
  .refine((v) => v.role !== "employee" || !!v.designationId, { error: "Choose a designation for this employee.", path: ["designationId"] });

export const updateUserSchema = z.object(Object.fromEntries(Object.entries(userFields).map(([k, v]) => [k, v.optional()]))).strict();

export const userStatusSchema = z.object({ status });

export const resetAttemptsSchema = z.object({ assessmentId: id.optional() });

export const listUsersQuery = z.object({
  q: z.string().trim().max(100).optional(),
  departmentId: z.string().max(64).optional(),
  designationId: z.string().max(64).optional(),
  level: level.optional(),
  status: status.optional(),
  role: z.enum(["employee", "admin"]).optional(),
});

// ── Departments ──
const departmentFields = {
  name: required(120, "Department name"),
  description: text(1000, "Description"),
  head: text(120, "Department head"),
  location: text(100, "Location"),
  active: z.boolean(),
};
export const createDepartmentSchema = z.object({
  ...departmentFields,
  description: departmentFields.description.default(""),
  head: departmentFields.head.default(""),
  location: departmentFields.location.default(""),
  active: departmentFields.active.default(true),
});
export const updateDepartmentSchema = z.object(Object.fromEntries(Object.entries(departmentFields).map(([k, v]) => [k, v.optional()]))).strict();

// ── Locations ──
export const locationSchema = z.object({ name: required(60, "Location name") }).strict();

// ── Designations ── (every designation has a department and a level)
export const createDesignationSchema = z.object({
  title: required(120, "Designation title"),
  departmentId: id,
  level,
  description: text(1000, "Description").default(""),
});
export const updateDesignationSchema = z
  .object({ title: required(120, "Designation title").optional(), departmentId: id.optional(), level: level.optional(), description: text(1000, "Description").optional() })
  .strict();

// ── Announcements ──
const tone = z.enum(["lime", "plum", "amber", "sky", "crimson", "neutral"]);
export const createAnnouncementSchema = z.object({
  title: required(200, "Title"),
  body: required(5000, "Message"),
  author: text(120, "Author").optional(),
  tone: tone.optional(),
  published: z.boolean().optional(),
  departmentIds: z.array(id).max(100).optional(), // empty / omitted = everyone
});
export const updateAnnouncementSchema = z
  .object({
    title: required(200, "Title").optional(),
    body: required(5000, "Message").optional(),
    author: text(120, "Author").optional(),
    tone: tone.optional(),
    published: z.boolean().optional(),
    archived: z.boolean().optional(),
    departmentIds: z.array(id).max(100).optional(),
  })
  .strict();

// ── Results ──
export const resultsQuery = z.object({
  q: z.string().trim().max(100).optional(),
  departmentId: z.string().max(64).optional(),
  designation: z.string().max(120).optional(),
  level: z.enum(["head", "senior", "junior"]).optional(),
  assessmentId: z.string().max(64).optional(),
  userId: z.string().max(64).optional(),
  passed: z.enum(["true", "false"]).transform((s) => s === "true").optional(),
  from: date.optional(),
  to: date.optional(),
  includeVoided: z.enum(["true", "false"]).transform((s) => s === "true").optional(),
});
