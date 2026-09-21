import type { NormalizationResult } from "./types";

export const COMMISSION_PARSE = "COMMISSION_PARSE";

/**
 * Parses commission text into a decimal rate.
 * Accepts "15%" (-> 0.15), a bare decimal already in rate form ("0.15" -> 0.15),
 * a bare number meant as a percent ("15" -> 0.15), and the known typo
 * "no comission" (-> 0, flagged as intentional rather than missing).
 */
export function normalizeCommission(raw: string | null | undefined): NormalizationResult<number | null> {
  const trimmed = (raw ?? "").trim();

  if (!trimmed) {
    return {
      value: null,
      raw: raw ?? null,
      issues: [
        { ruleId: COMMISSION_PARSE, severity: "warning", field: "commission", message: "Commission is blank" },
      ],
    };
  }

  const percentMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*%$/);
  if (percentMatch) {
    return { value: Number(percentMatch[1]) / 100, raw: trimmed, issues: [] };
  }

  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    const num = Number(trimmed);
    // Values already <= 1 are a decimal rate; larger bare numbers were meant as a percent.
    const value = num <= 1 ? num : num / 100;
    return { value, raw: trimmed, issues: [] };
  }

  if (/no\s*comm?ission/i.test(trimmed)) {
    return {
      value: 0,
      raw: trimmed,
      issues: [
        {
          ruleId: COMMISSION_PARSE,
          severity: "info",
          field: "commission",
          message: `Commission recorded as "${trimmed}" — treated as 0%`,
        },
      ],
    };
  }

  return {
    value: null,
    raw: trimmed,
    issues: [
      {
        ruleId: COMMISSION_PARSE,
        severity: "blocker",
        field: "commission",
        message: `Could not parse commission value "${trimmed}"`,
      },
    ],
  };
}
