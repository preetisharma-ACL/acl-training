import { z } from "zod";
import { id } from "./common.js";

// Heartbeat from the open viewer. An empty object is a plain heartbeat
// (reading time only).
export const progressSchema = z
  .object({
    percent: z.coerce.number().min(0).max(100).optional(),
    seen: z.array(z.string().max(64)).max(200).optional(),
    completed: z.boolean().optional(),
  })
  .strict();

// answers: { [questionId]: optionId | null }
export const submitSchema = z
  .object({
    answers: z.record(id, id.nullable()).default({}),
    time_taken_seconds: z.coerce.number().int().min(0).max(86400).optional(),
    focus_violations: z.coerce.number().int().min(0).max(10000).optional(),
    auto_submitted: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v.answers).length <= 500, { error: "Too many answers." });

// Autosave while the test runs (answer persistence across reloads).
export const saveAnswersSchema = z
  .object({
    answers: z.record(id, id.nullable()).default({}),
    focus_violations: z.coerce.number().int().min(0).max(10000).optional(),
  })
  .refine((v) => Object.keys(v.answers).length <= 500, { error: "Too many answers." });
