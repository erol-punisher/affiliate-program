import { getCountries, parsePhoneNumberFromString } from "libphonenumber-js";
import type { NormalizationResult } from "./types";

export const COUNTRY_CODE_VALIDATE = "COUNTRY_CODE_VALIDATE";
export const COUNTRY_CODE_INFER_FROM_PHONE = "COUNTRY_CODE_INFER_FROM_PHONE";
export const COUNTRY_CODE_MISSING = "COUNTRY_CODE_MISSING";

const VALID_CODES = new Set<string>(getCountries());

export type CountryCodeResult = NormalizationResult<string | null> & { inferred: boolean };

/**
 * @param phoneE164 the already-normalized E.164 phone number (not the raw
 * cell text) — parsing a clean E.164 string reliably yields a country,
 * whereas re-parsing the raw text here would just duplicate normalizePhone's
 * own cleanup/retry logic.
 */
export function normalizeCountryCode(
  raw: string | null | undefined,
  phoneE164?: string | null,
): CountryCodeResult {
  const trimmed = (raw ?? "").trim().toUpperCase();

  if (trimmed && VALID_CODES.has(trimmed)) {
    return { value: trimmed, raw: trimmed, issues: [], inferred: false };
  }

  // Either blank or an invalid code (e.g. "SAU", "UAE") — try inferring from
  // the phone number's dial code before giving up.
  if (phoneE164) {
    const parsed = parsePhoneNumberFromString(phoneE164);
    if (parsed?.country) {
      return {
        value: parsed.country,
        raw: raw ?? null,
        inferred: true,
        issues: [
          {
            ruleId: COUNTRY_CODE_INFER_FROM_PHONE,
            severity: "info",
            field: "country_code",
            message: trimmed
              ? `"${trimmed}" is not a valid ISO-3166-1 alpha-2 code — inferred ${parsed.country} from phone number instead`
              : `Inferred country ${parsed.country} from phone number`,
          },
        ],
      };
    }
  }

  if (trimmed) {
    return {
      value: null,
      raw: trimmed,
      inferred: false,
      issues: [
        {
          ruleId: COUNTRY_CODE_VALIDATE,
          severity: "warning",
          field: "country_code",
          message: `"${trimmed}" is not a valid ISO-3166-1 alpha-2 code`,
        },
      ],
    };
  }

  return {
    value: null,
    raw: null,
    inferred: false,
    issues: [
      {
        ruleId: COUNTRY_CODE_MISSING,
        severity: "info",
        field: "country_code",
        message: "Country code is missing",
      },
    ],
  };
}
