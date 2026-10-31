// Phone / mobile number check, the same rule as the server: digits with an
// optional leading +, spaces, dashes, dots or brackets; 7–15 digits. Empty
// is allowed (clears it).

export function phoneProblem(v) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const digits = (s.match(/\d/g) ?? []).length;
  if (!/^\+?[\d\s().-]+$/.test(s) || digits < 7 || digits > 15) return "Enter a valid phone number, e.g. +91 98765 43210.";
  return null;
}
