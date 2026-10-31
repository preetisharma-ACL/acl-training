// Shared Zod building blocks.

import { z } from "zod";
import { PASSWORD_MAX, PASSWORD_MIN } from "../utils/password.js";

// Plain-English messages for every rule that doesn't set its own, instead
// of Zod's defaults ("Invalid input: expected string, received undefined").
const LABELS = { estMinutes: "Reading time", passPercent: "Pass mark", durationMinutes: "Duration", maxAttempts: "Attempts", questionsPerAttempt: "Questions per attempt", code: "Employee code" };
export const fieldLabel = (path = []) => {
  const key = [...path].reverse().find((p) => typeof p === "string");
  if (!key) return "This field";
  if (LABELS[key]) return LABELS[key];
  const words = key.replace(/Ids?$/, "").replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};
z.config({
  customError: (iss) => {
    const label = fieldLabel(iss.path);
    const lower = label.toLowerCase();
    switch (iss.code) {
      case "invalid_type":
        return iss.input === undefined || iss.input === null ? `${label} is required.` : `${label} has the wrong format.`;
      case "invalid_value":
        return `Choose a valid ${lower}.`;
      case "invalid_format":
        return `Enter a valid ${lower}.`;
      case "too_small":
        if (iss.origin === "string") return Number(iss.minimum) <= 1 ? `${label} is required.` : `${label} is too short.`;
        if (iss.origin === "array" || iss.origin === "set") return `Add at least ${iss.minimum} to ${lower}.`;
        return `${label} must be at least ${iss.minimum}.`;
      case "too_big":
        if (iss.origin === "string") return `${label} is too long.`;
        if (iss.origin === "array" || iss.origin === "set") return `${label} has too many items.`;
        return `${label} must be at most ${iss.maximum}.`;
      case "unrecognized_keys":
        return `${iss.keys.join(", ")} can't be set here.`;
      default:
        return `Check ${lower} and try again.`;
    }
  },
});

export const email = z
  .string({ error: "Enter your email address." })
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email({ error: "Enter a valid email address." }));

export const newPassword = z
  .string({ error: "Enter a new password." })
  .min(PASSWORD_MIN, { error: `Use at least ${PASSWORD_MIN} characters.` })
  .max(PASSWORD_MAX, { error: `Use at most ${PASSWORD_MAX} characters.` })
  .refine((p) => /[A-Za-z]/.test(p) && /[0-9]/.test(p), { error: "Use at least one letter and one number." });

export const id = z.string().trim().min(1).max(64);

export const idParams = z.object({ id });

export const text = (max, label = "This field") => z.string().trim().max(max, { error: `${label} is too long.` });

// Mobile / phone: digits with optional +, spaces, dashes, dots and
// brackets; 7–15 digits. Empty clears it.
export const phone = z
  .string()
  .trim()
  .max(30, { error: "Phone number is too long." })
  .refine(
    (v) => {
      if (v === "") return true;
      const digits = (v.match(/\d/g) ?? []).length;
      return /^\+?[\d\s().-]+$/.test(v) && digits >= 7 && digits <= 15;
    },
    { error: "Enter a valid phone number, e.g. +91 98765 43210." },
  );

export const required = (max, label) => z.string({ error: `${label} is required.` }).trim().min(1, { error: `${label} is required.` }).max(max, { error: `${label} is too long.` });
