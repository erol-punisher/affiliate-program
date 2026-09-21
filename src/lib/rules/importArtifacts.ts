import type { NormalizationResult } from "./types";

export const IMPORT_ARTIFACT_SCRUB = "IMPORT_ARTIFACT_SCRUB";

const ARTIFACT_VALUES = new Set(["#N/A", "#ERROR!", "AND", "#REF!", "#VALUE!", "#NULL!", "#DIV/0!"]);

/** Clears spreadsheet-formula artifacts (#N/A, #ERROR!, stray "And") to null instead of storing them as data. */
export function scrubImportArtifact(raw: string | null | undefined, field: string): NormalizationResult<string | null> {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) {
    return { value: null, raw: null, issues: [] };
  }

  if (ARTIFACT_VALUES.has(trimmed.toUpperCase())) {
    return {
      value: null,
      raw: trimmed,
      issues: [
        {
          ruleId: IMPORT_ARTIFACT_SCRUB,
          severity: "info",
          field,
          message: `Cleared spreadsheet artifact "${trimmed}"`,
        },
      ],
    };
  }

  return { value: trimmed, raw: trimmed, issues: [] };
}
