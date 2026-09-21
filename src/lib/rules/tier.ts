import type { FieldIssue, NormalizationResult } from "./types";

export const TIER_TRIM_WHITESPACE = "TIER_TRIM_WHITESPACE";
export const TIER_MAP_CANONICAL = "TIER_MAP_CANONICAL";
export const TIER_UNMAPPED = "TIER_UNMAPPED";

const CANONICAL_TIERS = ["AAA", "AA", "A", "B", "C", "D"] as const;
export type Tier = (typeof CANONICAL_TIERS)[number];

export type TierResult = NormalizationResult<Tier | null> & {
  confidence: "high" | "unmapped";
};

/**
 * Tier is a hand-typed revenue band ("1. AAA (>$10K)", " 5. C", "2. C (>$500)", bare "C", ...).
 * We ignore the leading number/label entirely and match on the canonical
 * letter token itself, since the doc confirms the numbering has drifted out
 * of sync with the letter in some rows.
 */
export function normalizeTier(raw: string | null | undefined): TierResult {
  const original = raw ?? "";
  const trimmed = original.trim();
  const issues: FieldIssue[] = [];

  if (trimmed !== original && original !== "") {
    issues.push({
      ruleId: TIER_TRIM_WHITESPACE,
      severity: "info",
      field: "tier",
      message: `Trimmed whitespace from tier value "${original}"`,
    });
  }

  if (!trimmed) {
    return { value: null, raw: raw ?? null, issues, confidence: "unmapped" };
  }

  for (const tier of CANONICAL_TIERS) {
    const re = new RegExp(`(^|[^A-Za-z])${tier}([^A-Za-z]|$)`);
    if (re.test(trimmed)) {
      // A successful mapping isn't a data-quality problem — even a verbose
      // label like "3. A (>$100)" is valid input, just not worth a health
      // deduction. TIER_MAP_CANONICAL is exposed for provenance, not raised
      // as an issue.
      return { value: tier, raw: trimmed, issues, confidence: "high" };
    }
  }

  issues.push({
    ruleId: TIER_UNMAPPED,
    severity: "warning",
    field: "tier",
    message: `Could not map tier value "${trimmed}" to a canonical tier — left unmapped rather than guessed`,
  });
  return { value: null, raw: trimmed, issues, confidence: "unmapped" };
}
