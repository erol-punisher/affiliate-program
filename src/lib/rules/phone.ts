import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import type { NormalizationResult } from "./types";

export const PHONE_NORMALIZE_E164 = "PHONE_NORMALIZE_E164";
export const PHONE_INVALID = "PHONE_INVALID";

// Bidi/directional-formatting control characters that sneak in from
// copy-pasting phone numbers out of WhatsApp/RTL text (invisible in the sheet).
const BIDI_CONTROL_CHARS = /[‎‏‪-‮⁦-⁩]/g;
// Stray marks (backticks, smart quotes) occasionally typed before a number.
const STRAY_LEADING_MARKS = /^[´`'"]+/;

function cleanPhoneText(raw: string): string {
  return raw.replace(BIDI_CONTROL_CHARS, "").replace(STRAY_LEADING_MARKS, "").trim();
}

/**
 * Normalizes a phone number to E.164. `defaultCountry` helps parse numbers
 * written without a country/dial code (falls back to the affiliate's country
 * code when available).
 *
 * Many rows write "<calling code><national number>" with no leading "+"
 * (e.g. "393474736045" for an Italian number) — libphonenumber can't guess a
 * country from that alone, so after a direct parse we retry with a "+"
 * prepended before giving up.
 */
export function normalizePhone(
  raw: string | null | undefined,
  defaultCountry?: string | null,
): NormalizationResult<string | null> {
  const trimmed = cleanPhoneText(raw ?? "");
  if (!trimmed) {
    return { value: null, raw: null, issues: [] };
  }

  let parsed = parsePhoneNumberFromString(trimmed, (defaultCountry as CountryCode) || undefined);

  if (!parsed?.isValid() && !trimmed.startsWith("+")) {
    const digitsOnly = trimmed.replace(/\D/g, "");
    if (digitsOnly) {
      const withPlus = parsePhoneNumberFromString(`+${digitsOnly}`);
      if (withPlus?.isValid()) parsed = withPlus;
    }
  }

  if (parsed?.isValid()) {
    return { value: parsed.number, raw: trimmed, issues: [] };
  }

  return {
    value: null,
    raw: trimmed,
    issues: [
      {
        ruleId: PHONE_INVALID,
        severity: "warning",
        field: "phone",
        message: `Could not parse phone number "${trimmed}" to E.164`,
      },
    ],
  };
}
