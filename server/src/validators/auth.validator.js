import { z } from "zod";
import { email, newPassword } from "./common.js";

export const loginSchema = z.object({
  email,
  password: z.string({ error: "Enter your password." }).min(1, { error: "Enter your password." }).max(256),
  remember: z.boolean().optional().default(false),
});

export const passwordResetSchema = z.object({ email });

export const passwordResetConfirmSchema = z.object({
  token: z.string().min(20).max(200),
  new_password: newPassword,
});
