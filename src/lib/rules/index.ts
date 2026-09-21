import { normalizeCommission } from "./commission";
import { normalizeTier } from "./tier";
import { normalizeStatus } from "./status";
import { normalizeLanguage } from "./language";
import { normalizeCountryCode } from "./countryCode";
import { normalizePhone } from "./phone";
import { normalizeEmails, type EmailEntry } from "./email";
import { scrubImportArtifact } from "./importArtifacts";
import { computeHealthScore } from "./healthScore";
import type { FieldIssue } from "./types";

export * from "./types";
export * from "./commission";
export * from "./tier";
export * from "./status";
export * from "./language";
export * from "./countryCode";
export * from "./phone";
export * from "./email";
export * from "./importArtifacts";
export * from "./healthScore";

/** A single row as imported, keyed by the original sheet column header. */
export type RawAffiliateRow = Record<string, string | undefined>;

export type NormalizedAffiliate = {
  name: string;

  commissionRate: number | null;
  commissionRaw: string | null;

  tier: string | null;
  tierRaw: string | null;
  tierConfidence: "high" | "unmapped";

  status: string;
  statusRaw: string | null;
  statusFlagged: boolean;

  language: string | null;
  languageRaw: string | null;

  countryCode: string | null;
  countryCodeInferred: boolean;

  phoneE164: string | null;
  phoneRaw: string | null;

  emails: EmailEntry[];

  importArtifacts: string[];
  healthScore: number;
  issues: FieldIssue[];
};

/**
 * Runs Module A's normalization pipeline over one raw sheet row. Column
 * headers here match the real sheet (see the feature doc's column list).
 */
export function normalizeAffiliateRow(row: RawAffiliateRow): NormalizedAffiliate {
  const issues: FieldIssue[] = [];
  const importArtifacts: string[] = [];

  function scrub(field: string, value: string | undefined): string | null {
    const result = scrubImportArtifact(value, field);
    if (result.issues.length > 0) {
      issues.push(...result.issues);
      importArtifacts.push(field);
    }
    return result.value;
  }

  const name = (row["Affiliate"] ?? "").trim();

  const commission = normalizeCommission(scrub("commission", row["Commission"]));
  issues.push(...commission.issues);

  const tier = normalizeTier(scrub("tier", row["Affiliate Tier"]));
  issues.push(...tier.issues);

  const status = normalizeStatus(scrub("status", row["Status"]));
  issues.push(...status.issues);

  const language = normalizeLanguage(scrub("language", row["Language"]));
  issues.push(...language.issues);

  const countryCodeRaw = scrub("country_code", row["Country Code"]);
  const countryHint = countryCodeRaw && /^[A-Za-z]{2}$/.test(countryCodeRaw) ? countryCodeRaw : undefined;

  const phoneRawScrubbed = scrub("phone", row["Contact Phone"]);
  const phone = normalizePhone(phoneRawScrubbed, countryHint);
  issues.push(...phone.issues);

  // Uses the already-normalized E.164 number, not the raw text, so inference
  // benefits from normalizePhone's own cleanup (bidi chars, missing "+", etc.)
  // instead of re-deriving it.
  const countryCode = normalizeCountryCode(countryCodeRaw, phone.value);
  issues.push(...countryCode.issues);

  const emails = normalizeEmails(scrub("email", row["Contact Email"]));
  issues.push(...emails.issues);

  const healthScore = computeHealthScore(issues);

  return {
    name,
    commissionRate: commission.value,
    commissionRaw: commission.raw,
    tier: tier.value,
    tierRaw: tier.raw,
    tierConfidence: tier.confidence,
    status: status.value,
    statusRaw: status.raw,
    statusFlagged: status.flagged,
    language: language.value,
    languageRaw: language.raw,
    countryCode: countryCode.value,
    countryCodeInferred: countryCode.inferred,
    phoneE164: phone.value,
    phoneRaw: phone.raw,
    emails: emails.value,
    importArtifacts,
    healthScore,
    issues,
  };
}
