import { z } from "zod";
import { id, required, text } from "./common.js";

const levelKey = z.enum(["head", "senior", "junior"]);

// The UI edits minutes; the API also accepts seconds.
const settings = {
  title: required(200, "Title"),
  description: text(2000, "Description"),
  durationMinutes: z.coerce.number().int().min(1).max(300),
  durationSeconds: z.coerce.number().int().min(60).max(18000),
  passPercent: z.coerce.number().int().min(1).max(100),
  marksPerQuestion: z.coerce.number().int().min(1).max(100),
  maxAttempts: z.coerce.number().int().min(1).max(50),
  questionsPerAttempt: z.coerce.number().int().min(1).max(200),
  shuffle: z.boolean(),
  active: z.boolean(),
};
const optional = Object.fromEntries(Object.entries(settings).map(([k, v]) => [k, v.optional()]));

export const createAssessmentSchema = z.object({ departmentId: id, level: levelKey, ...optional });
export const updateAssessmentSchema = z.object(optional).strict();

const fourOptions = z
  .array(z.string().trim().min(1, { error: "Fill in all four options." }).max(500))
  .length(4, { error: "A question needs exactly four options." })
  .refine((o) => new Set(o.map((x) => x.toLowerCase())).size === 4, { error: "The four options must be different." });

export const questionSchema = z.object({
  text: required(2000, "Question"),
  options: fourOptions,
  answer: z.coerce.number().int().min(0).max(3),
  explanation: text(2000, "Explanation").optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  active: z.boolean().optional(),
});

export const updateQuestionSchema = z
  .object({
    text: required(2000, "Question").optional(),
    options: fourOptions.optional(),
    answer: z.coerce.number().int().min(0).max(3).optional(),
    explanation: text(2000, "Explanation").optional(),
    difficulty: z.enum(["easy", "medium", "hard"]).optional(),
    active: z.boolean().optional(),
  })
  .strict();

export const listQuestionsQuery = z.object({
  q: z.string().trim().max(100).optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  active: z.enum(["true", "false"]).optional(),
  archived: z.enum(["true", "false"]).optional(),
});
