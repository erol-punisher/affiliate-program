import type { NormalizationResult } from "./types";

export const EMAIL_STRIP_PREFIX = "EMAIL_STRIP_PREFIX";
export const EMAIL_SPLIT_MULTI = "EMAIL_SPLIT_MULTI";
export const EMAIL_FLAG_JUNK = "EMAIL_FLAG_JUNK";

export type EmailEntry = { address: string; isPrimary: boolean };

const EMAIL_RE = /[^\s,;]+@[^\s,;]+\.[^\s,;]+/g;

/** Splits multi-email cells, strips "Email: " prefixes, and flags non-email junk (e.g. "NO CONTACT INFO"). */
export function normalizeEmails(raw: string | null | undefined): NormalizationResult<EmailEntry[]> {
  const original = raw ?? "";
  let working = original.trim();
  const issues: NormalizationResult<EmailEntry[]>["issues"] = [];

  if (!working) {
    return { value: [], raw: null, issues: [] };
  }

  const prefixMatch = working.match(/^email:?\s*/i);
  if (prefixMatch) {
    working = working.slice(prefixMatch[0].length);
    issues.push({
      ruleId: EMAIL_STRIP_PREFIX,
      severity: "info",
      field: "email",
      message: `Stripped "${prefixMatch[0].trim()}" prefix`,
    });
  }

  const matches = working.match(EMAIL_RE);
  if (!matches || matches.length === 0) {
    issues.push({
      ruleId: EMAIL_FLAG_JUNK,
      severity: "warning",
      field: "email",
      message: `"${original}" does not contain a valid email address`,
    });
    return { value: [], raw: original, issues };
  }

  if (matches.length > 1) {
    issues.push({
      ruleId: EMAIL_SPLIT_MULTI,
      severity: "info",
      field: "email",
      message: `Split ${matches.length} emails out of a single cell`,
    });
  }

  const value = matches.map((address, i) => ({ address: address.toLowerCase(), isPrimary: i === 0 }));
  return { value, raw: original, issues };
}
