import { describe, expect, it } from "vitest";
import { normalizeLanguage } from "../language";

describe("normalizeLanguage", () => {
  it("passes through common two-letter codes", () => {
    expect(normalizeLanguage("es").value).toBe("es");
    expect(normalizeLanguage("en").value).toBe("en");
  });

  it("normalizes pt(Brazil) to BCP-47 pt-BR", () => {
    expect(normalizeLanguage("pt(Brazil)").value).toBe("pt-BR");
  });

  it("normalizes the bih typo to bs", () => {
    expect(normalizeLanguage("bih").value).toBe("bs");
  });

  it("is case-insensitive", () => {
    expect(normalizeLanguage("ES").value).toBe("es");
  });

  it("flags unrecognized codes", () => {
    const result = normalizeLanguage("klingon");
    expect(result.value).toBeNull();
    expect(result.issues[0].ruleId).toBe("LANGUAGE_UNRECOGNIZED");
  });

  it("treats blank as null with no issue", () => {
    const result = normalizeLanguage("");
    expect(result.value).toBeNull();
    expect(result.issues).toHaveLength(0);
  });
});
