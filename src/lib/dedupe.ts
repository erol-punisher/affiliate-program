export type DedupeInput = {
  affiliateId: string;
  code: string | null;
  primaryEmail: string | null;
  phoneE164: string | null;
};

export type DedupeMatch = {
  affiliateAId: string;
  affiliateBId: string;
  matchType: "code" | "email" | "phone";
  matchConfidence: number;
};

/**
 * Exact-match duplicate detection on code / primary email / E.164 phone.
 * The doc's documented duplicates (5 codes, 12 emails, 21 phones) are exact
 * repeats, not near-matches, so this v1 pass groups on equality rather than
 * fuzzy string distance.
 */
export function findDuplicateCandidates(records: DedupeInput[]): DedupeMatch[] {
  const results: DedupeMatch[] = [];

  function groupBy(keyFn: (r: DedupeInput) => string | null, matchType: DedupeMatch["matchType"]) {
    const groups = new Map<string, string[]>();
    for (const record of records) {
      const key = keyFn(record);
      if (!key) continue;
      const ids = groups.get(key) ?? [];
      ids.push(record.affiliateId);
      groups.set(key, ids);
    }
    for (const ids of groups.values()) {
      if (ids.length < 2) continue;
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          results.push({ affiliateAId: ids[i], affiliateBId: ids[j], matchType, matchConfidence: 1 });
        }
      }
    }
  }

  groupBy((r) => r.code, "code");
  groupBy((r) => r.primaryEmail, "email");
  groupBy((r) => r.phoneE164, "phone");

  return results;
}
