import { describe, expect, it } from "vitest";
import { decisionBadgeColor, detectColumnRole, stageBadgeColor } from "../columnRoles";

describe("detectColumnRole", () => {
  it("detects a 'Stage' header as the stage role", () => {
    expect(detectColumnRole("Stage")).toBe("stage");
    expect(detectColumnRole(" stage ")).toBe("stage");
    expect(detectColumnRole("STAGE")).toBe("stage");
  });

  it("does not misdetect a header that merely contains 'stage' as a substring", () => {
    // Exact match only — a real header like "Onboarding Stage Notes" isn't the dedicated column.
    expect(detectColumnRole("Onboarding Stage Notes")).not.toBe("stage");
  });

  it("still detects status headers as before", () => {
    expect(detectColumnRole("Status")).toBe("status");
  });

  it("detects the real sheet's name column, which is titled exactly 'Affiliate'", () => {
    expect(detectColumnRole("Affiliate")).toBe("name");
    expect(detectColumnRole(" affiliate ")).toBe("name");
    expect(detectColumnRole("AFFILIATE")).toBe("name");
  });

  it("does not misdetect manager/owner/code columns as the name column just for containing 'affiliate'", () => {
    expect(detectColumnRole("Affiliate Manager")).not.toBe("name");
    expect(detectColumnRole("Affiliate Owner")).not.toBe("name");
    expect(detectColumnRole("Affiliate Code")).not.toBe("name");
    expect(detectColumnRole("Check if Active Affiliate")).not.toBe("name");
  });

  it("detects a 'Decision' header as the decision role (exact match only)", () => {
    expect(detectColumnRole("Decision")).toBe("decision");
    expect(detectColumnRole(" decision ")).toBe("decision");
    expect(detectColumnRole("Decision Notes")).not.toBe("decision");
  });
});

describe("stageBadgeColor", () => {
  it("is deterministic for the same name", () => {
    expect(stageBadgeColor("Negotiating")).toBe(stageBadgeColor("Negotiating"));
  });

  it("returns a non-empty class string", () => {
    expect(stageBadgeColor("Outreach").length).toBeGreaterThan(0);
  });
});

describe("decisionBadgeColor", () => {
  it("gives each known decision a distinct, case-insensitive color", () => {
    expect(decisionBadgeColor("Accepted")).toContain("emerald");
    expect(decisionBadgeColor("not accepted")).toContain("red");
    expect(decisionBadgeColor("REQUEST MORE INFO")).toContain("amber");
    expect(decisionBadgeColor("Number not on WA")).toContain("slate");
  });

  it("falls back to a neutral color for blank or unrecognized values", () => {
    expect(decisionBadgeColor("")).not.toContain("emerald");
    expect(decisionBadgeColor("")).not.toContain("red");
    expect(decisionBadgeColor("Some new decision")).toBe(decisionBadgeColor(""));
  });
});
