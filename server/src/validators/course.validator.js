import { z } from "zod";
import { required, text } from "./common.js";
import { youtubeId } from "../utils/youtube.js";

// A YouTube link (or id) → its video id.
const video = z
  .string({ error: "Paste the video's YouTube link." })
  .trim()
  .max(500)
  .transform((v, ctx) => youtubeId(v) ?? (ctx.addIssue({ code: "custom", message: "That isn't a YouTube video link." }), z.NEVER));

// `id` keeps an existing lesson/section (and employees' progress on it).
const lesson = z
  .object({
    id: z.string().max(64).optional(),
    title: required(200, "Video title"),
    description: text(2000, "Video description").default(""),
    video,
    durationSeconds: z.coerce.number({ error: "Video length is required." }).int().min(1, { error: "Video length is required." }).max(24 * 3600),
  })
  .strict();

const section = z
  .object({
    id: z.string().max(64).optional(),
    title: required(200, "Section title"),
    lessons: z.array(lesson, { error: "Add at least one video to each section." }).min(1, { error: "Add at least one video to each section." }).max(200),
  })
  .strict();

const sections = z.array(section, { error: "Add at least one section." }).min(1, { error: "Add at least one section." }).max(100);
const levels = z.array(z.enum(["head", "senior", "junior"]), { error: "Choose at least one level." }).min(1, { error: "Choose at least one level." }).max(3);

// Like materials: audience (department or null = company-wide), levels and
// required/optional must be chosen explicitly.
export const createCourseSchema = z
  .object({
    title: required(200, "Course title"),
    description: text(5000, "Description").default(""),
    departmentId: z.string({ error: "Choose who gets this course: a department or the whole company." }).trim().min(1).max(64).nullable(),
    required: z.boolean({ error: "Choose whether this course is required before the assessment." }),
    levels,
    status: z.enum(["draft", "published"]).default("draft"),
    sections,
  })
  .strict();

export const updateCourseSchema = z
  .object({
    title: required(200, "Course title").optional(),
    description: text(5000, "Description").optional(),
    departmentId: z.string().trim().min(1).max(64).nullable().optional(),
    required: z.boolean().optional(),
    levels: levels.optional(),
    status: z.enum(["draft", "published", "archived"]).optional(),
    // Replaces the whole structure; ids keep existing sections/lessons.
    sections: sections.optional(),
  })
  .strict();

// Heartbeat from the course player: what was watched since the last one.
export const lessonProgressSchema = z
  .object({
    ranges: z.array(z.tuple([z.number().min(0), z.number().min(0)])).max(500).optional(),
    position: z.number().min(0).max(24 * 3600).optional(),
  })
  .strict();
