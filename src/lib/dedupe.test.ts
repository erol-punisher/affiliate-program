import { describe, expect, it } from "vitest";
import { findDuplicateCandidates } from "./dedupe";

describe("findDuplicateCandidates", () => {
  it("finds a duplicate code pair", () => {
    const result = findDuplicateCandidates([
      { affiliateId: "a", code: "jane10", primaryEmail: null, phoneE164: null },
      { affiliateId: "b", code: "jane10", primaryEmail: null, phoneE164: null },
      { affiliateId: "c", code: "other", primaryEmail: null, phoneE164: null },
    ]);
    expect(result).toEqual([{ affiliateAId: "a", affiliateBId: "b", matchType: "code", matchConfidence: 1 }]);
  });

  it("finds duplicates across multiple match types independently", () => {
    const result = findDuplicateCandidates([
      { affiliateId: "a", code: "x1", primaryEmail: "jane@x.com", phoneE164: "+1111" },
      { affiliateId: "b", code: "x2", primaryEmail: "jane@x.com", phoneE164: "+2222" },
      { affiliateId: "c", code: "x3", primaryEmail: "other@x.com", phoneE164: "+1111" },
    ]);
    expect(result).toContainEqual({ affiliateAId: "a", affiliateBId: "b", matchType: "email", matchConfidence: 1 });
    expect(result).toContainEqual({ affiliateAId: "a", affiliateBId: "c", matchType: "phone", matchConfidence: 1 });
  });

  it("groups three-way duplicates into pairwise matches", () => {
    const result = findDuplicateCandidates([
      { affiliateId: "a", code: "dup", primaryEmail: null, phoneE164: null },
      { affiliateId: "b", code: "dup", primaryEmail: null, phoneE164: null },
      { affiliateId: "c", code: "dup", primaryEmail: null, phoneE164: null },
    ]);
    expect(result).toHaveLength(3);
  });

  it("ignores null keys entirely", () => {
    const result = findDuplicateCandidates([
      { affiliateId: "a", code: null, primaryEmail: null, phoneE164: null },
      { affiliateId: "b", code: null, primaryEmail: null, phoneE164: null },
    ]);
    expect(result).toHaveLength(0);
  });

  it("returns nothing when there are no duplicates", () => {
    const result = findDuplicateCandidates([
      { affiliateId: "a", code: "one", primaryEmail: null, phoneE164: null },
      { affiliateId: "b", code: "two", primaryEmail: null, phoneE164: null },
    ]);
    expect(result).toHaveLength(0);
  });
});
