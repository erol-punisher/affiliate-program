export type ExistingAffiliateForMatch = {
  id: string;
  name: string;
  emails: string; // JSON: [{ address: string, isPrimary: boolean }]
};

/** Builds email → row and name → row lookup maps (both keys lowercased) for matching import rows against existing affiliates. */
export function buildAffiliateMatchIndex(existing: ExistingAffiliateForMatch[]) {
  const byEmail = new Map<string, ExistingAffiliateForMatch>();
  const byName = new Map<string, ExistingAffiliateForMatch>();

  for (const a of existing) {
    let parsedEmails: { address: string; isPrimary: boolean }[] = [];
    try {
      parsedEmails = JSON.parse(a.emails);
    } catch {
      // malformed/legacy data — fall back to name-only matching for this row
    }
    for (const e of parsedEmails) {
      if (e.address) byEmail.set(e.address.toLowerCase(), a);
    }
    byName.set(a.name.toLowerCase(), a);
  }

  return { byEmail, byName };
}

/**
 * Finds the existing affiliate a freshly-normalized import row should update, if any — matched by
 * any of their previously-recorded emails first, falling back to an exact (case-insensitive) name
 * match. Returns null for a genuinely new affiliate (create a fresh row for these).
 */
export function findMatchingAffiliate(
  index: { byEmail: Map<string, ExistingAffiliateForMatch>; byName: Map<string, ExistingAffiliateForMatch> },
  row: { name: string; emails: { address: string; isPrimary: boolean }[] },
): ExistingAffiliateForMatch | null {
  for (const e of row.emails) {
    const match = index.byEmail.get(e.address.toLowerCase());
    if (match) return match;
  }
  return index.byName.get(row.name.toLowerCase()) ?? null;
}
