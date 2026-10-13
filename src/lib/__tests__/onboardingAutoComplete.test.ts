import { describe, expect, it } from "vitest";
import { computeAutoCompletions, type AutoCompletableStep } from "../onboardingAutoComplete";

function step(id: string, stepKey: string, status: AutoCompletableStep["status"]): AutoCompletableStep {
  return { id, stepKey, status };
}

describe("computeAutoCompletions", () => {
  it("auto-completes the first-install step when firstInstallAt is set and the step is still pending", () => {
    const steps = [step("s1", "day_30_first_install", "not_started")];
    const result = computeAutoCompletions(steps, { firstInstallAt: "2026-09-20T00:00:00.000Z", firstPaidMerchantAt: null });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ stepId: "s1", stepKey: "day_30_first_install" });
    expect(result[0].completedAt.toISOString()).toBe("2026-09-20T00:00:00.000Z");
  });

  it("auto-completes the paying-merchant step when firstPaidMerchantAt is set", () => {
    const steps = [step("s2", "day_60_milestone", "in_progress")];
    const result = computeAutoCompletions(steps, { firstInstallAt: null, firstPaidMerchantAt: "2026-09-22T00:00:00.000Z" });

    expect(result).toHaveLength(1);
    expect(result[0].stepId).toBe("s2");
  });

  it("does nothing when the event date is not set yet", () => {
    const steps = [step("s1", "day_30_first_install", "not_started"), step("s2", "day_60_milestone", "not_started")];
    const result = computeAutoCompletions(steps, { firstInstallAt: null, firstPaidMerchantAt: null });
    expect(result).toEqual([]);
  });

  it("never overrides a step a human already marked done", () => {
    const steps = [step("s1", "day_30_first_install", "done")];
    const result = computeAutoCompletions(steps, { firstInstallAt: "2026-09-20T00:00:00.000Z", firstPaidMerchantAt: null });
    expect(result).toEqual([]);
  });

  it("never overrides a step a human deliberately skipped", () => {
    const steps = [step("s1", "day_30_first_install", "skipped")];
    const result = computeAutoCompletions(steps, { firstInstallAt: "2026-09-20T00:00:00.000Z", firstPaidMerchantAt: null });
    expect(result).toEqual([]);
  });

  it("leaves the first-content-piece step alone entirely — it's manual regardless of event dates", () => {
    const steps = [
      step("content", "day_30_first_content", "not_started"),
      step("install", "day_30_first_install", "not_started"),
    ];
    const result = computeAutoCompletions(steps, { firstInstallAt: "2026-09-20T00:00:00.000Z", firstPaidMerchantAt: null });

    expect(result).toHaveLength(1);
    expect(result[0].stepKey).toBe("day_30_first_install");
  });

  it("can complete both rules independently in the same call", () => {
    const steps = [step("s1", "day_30_first_install", "not_started"), step("s2", "day_60_milestone", "not_started")];
    const result = computeAutoCompletions(steps, {
      firstInstallAt: "2026-09-20T00:00:00.000Z",
      firstPaidMerchantAt: "2026-09-25T00:00:00.000Z",
    });

    expect(result.map((r) => r.stepKey).sort()).toEqual(["day_30_first_install", "day_60_milestone"]);
  });

  it("ignores an unparseable event date rather than throwing", () => {
    const steps = [step("s1", "day_30_first_install", "not_started")];
    const result = computeAutoCompletions(steps, { firstInstallAt: "not-a-date", firstPaidMerchantAt: null });
    expect(result).toEqual([]);
  });
});
