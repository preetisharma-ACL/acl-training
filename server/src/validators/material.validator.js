import { z } from "zod";
import { id, required, text } from "./common.js";

const str = (max) => z.string().max(max);

// manual → { chapters: [{ id, title, blocks[] }] }
const block = z.discriminatedUnion("type", [
  z.object({ type: z.literal("p"), text: str(10000) }),
  z.object({ type: z.literal("h"), text: str(500) }),
  z.object({ type: z.literal("ul"), items: z.array(str(2000)).max(200) }),
  z.object({ type: z.literal("ol"), items: z.array(str(2000)).max(200) }),
  z.object({ type: z.literal("callout"), tone: str(20).optional(), title: str(200).optional(), text: str(5000) }),
]);
export const manualContent = z.object({
  chapters: z
    .array(z.object({ id: str(64), title: str(300), blocks: z.array(block).max(500) }))
    .min(1, { error: "A manual needs at least one chapter." })
    .max(200),
});

// structured → { intro, sections: [{ id, title, body[], points?, tip? }] }
export const structuredContent = z.object({
  intro: str(5000).default(""),
  sections: z
    .array(
      z.object({
        id: str(64),
        title: str(300),
        body: z.array(str(10000)).max(100).default([]),
        points: z.array(str(2000)).max(100).optional(),
        tip: str(2000).optional(),
      }),
    )
    .min(1, { error: "A guide needs at least one section." })
    .max(200),
});

// media → { url, kind }
export const mediaContent = z.object({
  url: z.url({ protocol: /^https$/, error: "Use an https:// link for video or audio." }).max(2000),
  kind: z.enum(["video", "audio"]).default("video"),
});

const levelKeys = z.array(z.enum(["head", "senior", "junior"])).max(3);

const fields = {
  title: required(200, "Title"),
  description: text(2000, "Description"),
  departmentId: id.nullable(), // null = company-wide
  required: z.boolean(),
  estMinutes: z.coerce.number().int().min(1).max(600),
  levels: levelKeys, // [] = all levels
  author: text(120, "Author"),
  status: z.enum(["draft", "published", "archived"]),
  content: z.unknown(), // checked per type in the service
  uploadId: z.string().max(80), // from POST /admin/materials/upload
};

// Who gets it (departmentId: a department, or null for company-wide), which
// levels ([] = all three) and whether it's required have no defaults: the
// admin must choose them, so nothing lands on everyone by accident.
export const createMaterialSchema = z.object({
  type: z.enum(["pdf", "manual", "structured", "media"]),
  ...fields,
  description: fields.description.default(""),
  departmentId: z.string({ error: "Choose who gets this material: a department or the whole company." }).trim().min(1).max(64).nullable(),
  required: z.boolean({ error: "Choose whether this material is required before the assessment." }),
  estMinutes: fields.estMinutes.default(5),
  levels: z.array(z.enum(["head", "senior", "junior"]), { error: "Choose at least one level." }).min(1, { error: "Choose at least one level." }).max(3),
  status: fields.status.default("published"),
  author: fields.author.optional(),
  content: fields.content.optional(),
  uploadId: fields.uploadId.optional(),
});

export const updateMaterialSchema = z
  .object({
    ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.optional()])),
    // Version policy: must everyone who completed an older version complete it again?
    requireRecompletion: z.boolean().optional().default(false),
  })
  .strict();

export const listMaterialsQuery = z.object({
  departmentId: z.string().max(64).optional(),
  type: z.enum(["pdf", "manual", "structured", "media"]).optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  q: z.string().trim().max(100).optional(),
});
