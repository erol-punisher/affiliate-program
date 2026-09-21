import { describe, expect, it } from "vitest";
import { normalizeTier } from "../tier";

describe("normalizeTier", () => {
  it("maps a full labeled value to its canonical tier", () => {
    expect(normalizeTier("1. AAA (>$10K)").value).toBe("AAA");
    expect(normalizeTier("2. AA (>$500)").value).toBe("AA");
    expect(normalizeTier("3. A (>$100)").value).toBe("A");
    expect(normalizeTier("4. B (<$100)").value).toBe("B");
    expect(normalizeTier("5. C (No Referred Revenue)").value).toBe("C");
    expect(normalizeTier("6. D (Inactive)").value).toBe("D");
  });

  it("maps a bare letter", () => {
    expect(normalizeTier("C").value).toBe("C");
  });

  it("ignores a mismatched leading number and trusts the letter", () => {
    // Doc: "2. C (>$500)" is a stray value where the number doesn't match the letter.
    expect(normalizeTier("2. C (>$500)").value).toBe("C");
  });

  it("does not confuse AAA/AA/A with each other", () => {
    expect(normalizeTier("AAA").value).toBe("AAA");
    expect(normalizeTier("AA").value).toBe("AA");
    expect(normalizeTier("A").value).toBe("A");
  });

  it("trims a leading-space duplicate and flags it", () => {
    const result = normalizeTier(" 5. C");
    expect(result.value).toBe("C");
    expect(result.issues.some((i) => i.ruleId === "TIER_TRIM_WHITESPACE")).toBe(true);
  });

  it("flags unmapped values instead of guessing", () => {
    const result = normalizeTier("VIP");
    expect(result.value).toBeNull();
    expect(result.confidence).toBe("unmapped");
    expect(result.issues[0].ruleId).toBe("TIER_UNMAPPED");
  });

  it("treats blank as unmapped without an unmapped issue", () => {
    const result = normalizeTier("");
    expect(result.value).toBeNull();
    expect(result.confidence).toBe("unmapped");
  });
});
