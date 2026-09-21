import type { NormalizationResult } from "./types";

export const LANGUAGE_NORMALIZE = "LANGUAGE_NORMALIZE";
export const LANGUAGE_UNRECOGNIZED = "LANGUAGE_UNRECOGNIZED";

// Keyed by the raw value lowercased with whitespace stripped.
const LANGUAGE_MAP: Record<string, string> = {
  es: "es",
  en: "en",
  it: "it",
  pt: "pt",
  "pt(brazil)": "pt-BR",
  "pt-br": "pt-BR",
  ptbr: "pt-BR",
  ar: "ar",
  bih: "bs", // known typo/local shorthand for Bosnian in the source sheet
  fr: "fr",
};

export function normalizeLanguage(raw: string | null | undefined): NormalizationResult<string | null> {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) {
    return { value: null, raw: raw ?? null, issues: [] };
  }

  const key = trimmed.toLowerCase().replace(/\s+/g, "");
  const mapped = LANGUAGE_MAP[key];
  if (mapped) {
    return { value: mapped, raw: trimmed, issues: [] };
  }

  return {
    value: null,
    raw: trimmed,
    issues: [
      {
        ruleId: LANGUAGE_UNRECOGNIZED,
        severity: "warning",
        field: "language",
        message: `Unrecognized language code "${trimmed}"`,
      },
    ],
  };
}
