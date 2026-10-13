import { describe, expect, it } from "vitest";
import { buildAffiliateMatchIndex, findMatchingAffiliate } from "../affiliateImportMatch";

const EXISTING = [
  { id: "a1", name: "Ivan Caicedo", emails: JSON.stringify([{ address: "ivan@example.com", isPrimary: true }]) },
  { id: "a2", name: "Priya Kapoor (Example)", emails: JSON.stringify([]) },
  { id: "a3", name: "Malformed Row", emails: "not json" },
];

describe("findMatchingAffiliate", () => {
  it("matches an existing affiliate by email, case-insensitively", () => {
    const index = buildAffiliateMatchIndex(EXISTING);
    const match = findMatchingAffiliate(index, {
      name: "Ivan C.",
      emails: [{ address: "IVAN@EXAMPLE.COM", isPrimary: true }],
    });
    expect(match?.id).toBe("a1");
  });

  it("falls back to an exact case-insensitive name match when there's no email match", () => {
    const index = buildAffiliateMatchIndex(EXISTING);
    const match = findMatchingAffiliate(index, {
      name: "priya kapoor (example)",
      emails: [{ address: "new-email@example.com", isPrimary: true }],
    });
    expect(match?.id).toBe("a2");
  });

  it("returns null for a genuinely new affiliate (no email or name match)", () => {
    const index = buildAffiliateMatchIndex(EXISTING);
    const match = findMatchingAffiliate(index, {
      name: "Someone Brand New",
      emails: [{ address: "brand-new@example.com", isPrimary: true }],
    });
    expect(match).toBeNull();
  });

  it("doesn't crash on a row with malformed stored emails JSON — still matches by name", () => {
    const index = buildAffiliateMatchIndex(EXISTING);
    const match = findMatchingAffiliate(index, {
      name: "Malformed Row",
      emails: [{ address: "whatever@example.com", isPrimary: true }],
    });
    expect(match?.id).toBe("a3");
  });

  it("prefers an email match over a name match when both are present but point to different rows", () => {
    const index = buildAffiliateMatchIndex(EXISTING);
    const match = findMatchingAffiliate(index, {
      name: "Priya Kapoor (Example)", // matches a2 by name
      emails: [{ address: "ivan@example.com", isPrimary: true }], // matches a1 by email
    });
    expect(match?.id).toBe("a1");
  });
});
