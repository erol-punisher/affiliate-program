import { describe, expect, it } from "vitest";
import { normalizeCommission } from "../commission";

describe("normalizeCommission", () => {
  it("parses a percent string", () => {
    const result = normalizeCommission("15%");
    expect(result.value).toBe(0.15);
    expect(result.issues).toHaveLength(0);
  });

  it("parses a bare decimal already in rate form", () => {
    const result = normalizeCommission("0.15");
    expect(result.value).toBe(0.15);
  });

  it("parses a bare number meant as a percent", () => {
    const result = normalizeCommission("15");
    expect(result.value).toBe(0.15);
  });

  it("treats 'no comission' as 0 with an info issue", () => {
    const result = normalizeCommission("no comission");
    expect(result.value).toBe(0);
    expect(result.issues[0].severity).toBe("info");
  });

  it("flags blank as a warning", () => {
    const result = normalizeCommission("");
    expect(result.value).toBeNull();
    expect(result.issues[0].severity).toBe("warning");
  });

  it("flags unparseable text as a blocker", () => {
    const result = normalizeCommission("ask manager");
    expect(result.value).toBeNull();
    expect(result.issues[0].severity).toBe("blocker");
  });

  it("handles null input", () => {
    const result = normalizeCommission(null);
    expect(result.value).toBeNull();
  });
});
