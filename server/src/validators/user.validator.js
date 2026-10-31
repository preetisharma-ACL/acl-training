import { z } from "zod";
import { newPassword, text, phone } from "./common.js";

// Employee-editable profile fields only. .strict(): an attempt to send name,
// email, designation, role… is rejected rather than silently ignored.
export const updateProfileSchema = z
  .object({
    phone: phone.optional(),
    location: text(100, "Location").optional(),
    bio: text(1000, "Bio").optional(),
    preferences: z
      .object({
        emailReminders: z.boolean().optional(),
        resultEmails: z.boolean().optional(),
        weeklyDigest: z.boolean().optional(),
      })
      .strict()
      .optional(),
  })
  .strict({ error: (iss) => (iss.code === "unrecognized_keys" ? `You can't change ${iss.keys.join(", ")} yourself. Ask an administrator.` : undefined) });

export const changePasswordSchema = z
  .object({
    current_password: z.string({ error: "Enter your current password." }).min(1, { error: "Enter your current password." }).max(256),
    new_password: newPassword,
    confirm_password: z.string().optional(),
  })
  .refine((v) => v.confirm_password === undefined || v.confirm_password === v.new_password, {
    error: "The new passwords don't match.",
    path: ["confirm_password"],
  })
  .refine((v) => v.current_password !== v.new_password, {
    error: "Choose a password different from your current one.",
    path: ["new_password"],
  });
