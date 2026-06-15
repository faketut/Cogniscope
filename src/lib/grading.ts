/**
 * Normalize an answer string for tolerant comparison.
 * - lowercase
 * - strip whitespace
 * - normalize unicode minus signs
 * - drop trailing semicolons
 * - normalize "x ^ 2" -> "x^2"
 */
export function normalize(s: string): string {
  if (s == null) return "";
  return s
    .toLowerCase()
    .replace(/[\u2212\u2013\u2014]/g, "-") // unicode minus/dashes -> "-"
    .replace(/\s+/g, "") // strip whitespace
    .replace(/[;]+$/g, "")
    .replace(/\*\*/g, "^") // python-style power
    .replace(/·/g, "*");
}

/** Compare two answer strings tolerantly. */
export function answersEqual(a: string, b: string): boolean {
  return normalize(a) === normalize(b);
}
