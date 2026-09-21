import { describe, expect, it } from "vitest";
import { normalizeEmails } from "../email";

describe("normalizeEmails", () => {
  it("parses a single plain email", () => {
    const result = normalizeEmails("jane@example.com");
    expect(result.value).toEqual([{ address: "jane@example.com", isPrimary: true }]);
    expect(result.issues).toHaveLength(0);
  });

  it("strips an 'Email: ' prefix", () => {
    const result = normalizeEmails("Email: jane@example.com");
    expect(result.value[0].address).toBe("jane@example.com");
    expect(result.issues.some((i) => i.ruleId === "EMAIL_STRIP_PREFIX")).toBe(true);
  });

  it("splits multiple emails out of one cell", () => {
    const result = normalizeEmails("jane@example.com, john@example.com");
    expect(result.value).toEqual([
      { address: "jane@example.com", isPrimary: true },
      { address: "john@example.com", isPrimary: false },
    ]);
    expect(result.issues.some((i) => i.ruleId === "EMAIL_SPLIT_MULTI")).toBe(true);
  });

  it("flags non-email junk instead of storing it as an address", () => {
    const result = normalizeEmails("NO CONTACT INFO");
    expect(result.value).toHaveLength(0);
    expect(result.issues[0].ruleId).toBe("EMAIL_FLAG_JUNK");
  });

  it("treats blank as an empty list with no issue", () => {
    const result = normalizeEmails("");
    expect(result.value).toEqual([]);
    expect(result.issues).toHaveLength(0);
  });
});
