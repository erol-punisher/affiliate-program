import { describe, expect, it } from "vitest";
import { normalizeStatus } from "../status";

describe("normalizeStatus", () => {
  it("maps ACTIVE", () => {
    expect(normalizeStatus("ACTIVE").value).toBe("ACTIVE");
  });

  it("maps INACTIVE", () => {
    expect(normalizeStatus("INACTIVE").value).toBe("INACTIVE");
  });

  it("maps ACTIVE (NO CONTRACT)", () => {
    expect(normalizeStatus("ACTIVE (NO CONTRACT)").value).toBe("ACTIVE_NO_CONTRACT");
  });

  it("is case-insensitive and tolerant of extra whitespace", () => {
    expect(normalizeStatus("active  (no contract)").value).toBe("ACTIVE_NO_CONTRACT");
  });

  it("maps blank to UNKNOWN and flags it", () => {
    const result = normalizeStatus("");
    expect(result.value).toBe("UNKNOWN");
    expect(result.flagged).toBe(true);
    expect(result.issues[0].ruleId).toBe("STATUS_BLANK");
  });

  it("maps junk values to UNKNOWN as a blocker", () => {
    const result = normalizeStatus("Fulfillment Centre");
    expect(result.value).toBe("UNKNOWN");
    expect(result.flagged).toBe(true);
    expect(result.issues[0].severity).toBe("blocker");
  });
});
