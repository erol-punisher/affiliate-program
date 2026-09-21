import { describe, expect, it } from "vitest";
import { computeHealthScore } from "../healthScore";

describe("computeHealthScore", () => {
  it("scores a perfectly clean record at 100", () => {
    expect(computeHealthScore([])).toBe(100);
  });

  it("deducts 20 per blocker", () => {
    expect(computeHealthScore([{ severity: "blocker" }])).toBe(80);
  });

  it("deducts 8 per warning", () => {
    expect(computeHealthScore([{ severity: "warning" }])).toBe(92);
  });

  it("deducts 2 per info", () => {
    expect(computeHealthScore([{ severity: "info" }])).toBe(98);
  });

  it("never goes below 0", () => {
    const issues = Array.from({ length: 10 }, () => ({ severity: "blocker" as const }));
    expect(computeHealthScore(issues)).toBe(0);
  });

  it("mixes severities", () => {
    expect(
      computeHealthScore([{ severity: "blocker" }, { severity: "warning" }, { severity: "info" }]),
    ).toBe(70);
  });
});
