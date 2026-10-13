import { describe, expect, it } from "vitest";
import { computeOnboardingMetrics, getCurrentStepStatus, type OnboardingStepInput } from "../onboardingStatus";
import type { OnboardingStepTemplateItem } from "../onboardingSteps";

const NOW = new Date("2026-09-25T12:00:00.000Z");

// Mirrors the seeded default template (see onboardingServer.ts's DB-backed equivalent) — kept local
// to this test file since the template itself now lives in the database, not a static export.
const TEST_TEMPLATE: OnboardingStepTemplateItem[] = [
  { key: "application_received", label: "Application received", order: 0, targetDays: 0, targetDaysAnchor: "step_start", isApprovalAnchor: false },
  { key: "qualification_review", label: "Qualification review", order: 1, targetDays: 5, targetDaysAnchor: "step_start", isApprovalAnchor: false },
  { key: "approved_manager_assigned", label: "Approved + manager assigned", order: 2, targetDays: 4, targetDaysAnchor: "step_start", isApprovalAnchor: true },
  { key: "contract_tipalti_profile", label: "Contract signed + Tipalti profile created", order: 3, targetDays: 3, targetDaysAnchor: "step_start", isApprovalAnchor: false },
  { key: "added_to_affiliate_database", label: "Added to affiliate database", order: 4, targetDays: 1, targetDaysAnchor: "step_start", isApprovalAnchor: false },
  { key: "welcome_pack_sent", label: "Welcome pack sent (ES or EN)", order: 5, targetDays: 2, targetDaysAnchor: "step_start", isApprovalAnchor: false },
  { key: "product_training_call", label: "Product training / onboarding call (optional for Tier C)", order: 6, targetDays: 7, targetDaysAnchor: "step_start", isApprovalAnchor: false },
  { key: "referral_tracking_verified", label: "Referral tracking verified", order: 7, targetDays: 3, targetDaysAnchor: "step_start", isApprovalAnchor: false },
  { key: "day_30_first_content", label: "Day 30: first content piece", order: 8, targetDays: 30, targetDaysAnchor: "approval", isApprovalAnchor: false },
  { key: "day_30_first_install", label: "Day 30: first install", order: 9, targetDays: 30, targetDaysAnchor: "approval", isApprovalAnchor: false },
  { key: "day_60_milestone", label: "Day 60: at least 1 paying merchant", order: 10, targetDays: 60, targetDaysAnchor: "approval", isApprovalAnchor: false },
  { key: "day_90_milestone", label: "Day 90: consistent installs and content, Tier B eligible", order: 11, targetDays: 90, targetDaysAnchor: "approval", isApprovalAnchor: false },
];

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

/** A full 12-step template, all not_started by default, so tests only need to override what matters. */
function buildSteps(overrides: Record<string, Partial<OnboardingStepInput>>): OnboardingStepInput[] {
  return TEST_TEMPLATE.map((template) => ({
    stepKey: template.key,
    order: template.order,
    status: "not_started",
    completedAt: null,
    targetDays: template.targetDays,
    targetDaysAnchor: template.targetDaysAnchor,
    isApprovalAnchor: template.isApprovalAnchor,
    ...overrides[template.key],
  }));
}

describe("getCurrentStepStatus", () => {
  it("picks the first step that is neither done nor skipped", () => {
    const steps = buildSteps({
      application_received: { status: "done", completedAt: daysAgo(10) },
      qualification_review: { status: "done", completedAt: daysAgo(8) },
    });

    const result = getCurrentStepStatus(steps, NOW);

    expect(result.graduated).toBe(false);
    if (!result.graduated) expect(result.stepKey).toBe("approved_manager_assigned");
  });

  it("flags a step_start step as overdue once days since the previous step's completion exceed target_days", () => {
    // approved_manager_assigned: target 4d, previous step completed 6 days ago -> overdue.
    const steps = buildSteps({
      application_received: { status: "done", completedAt: daysAgo(10) },
      qualification_review: { status: "done", completedAt: daysAgo(6) },
    });

    const result = getCurrentStepStatus(steps, NOW);

    expect(result.graduated).toBe(false);
    if (!result.graduated) {
      expect(result.stepKey).toBe("approved_manager_assigned");
      expect(result.daysSinceReference).toBe(6);
      expect(result.overdue).toBe(true);
    }
  });

  it("does not flag a step_start step as overdue while still within target_days", () => {
    // approved_manager_assigned: target 4d, previous step completed 2 days ago -> on track.
    const steps = buildSteps({
      application_received: { status: "done", completedAt: daysAgo(10) },
      qualification_review: { status: "done", completedAt: daysAgo(2) },
    });

    const result = getCurrentStepStatus(steps, NOW);

    expect(result.graduated).toBe(false);
    if (!result.graduated) {
      expect(result.daysSinceReference).toBe(2);
      expect(result.overdue).toBe(false);
    }
  });

  it("is not overdue exactly at the target_days boundary (only when it exceeds it)", () => {
    // approved_manager_assigned: target 4d, previous step completed exactly 4 days ago.
    const steps = buildSteps({
      application_received: { status: "done", completedAt: daysAgo(10) },
      qualification_review: { status: "done", completedAt: daysAgo(4) },
    });

    const result = getCurrentStepStatus(steps, NOW);

    expect(result.graduated).toBe(false);
    if (!result.graduated) expect(result.overdue).toBe(false);
  });

  it("edge case: cannot compute overdue when the preceding step was skipped (no completedAt)", () => {
    const steps = buildSteps({
      application_received: { status: "done", completedAt: daysAgo(20) },
      qualification_review: { status: "done", completedAt: daysAgo(15) },
      approved_manager_assigned: { status: "done", completedAt: daysAgo(12) },
      contract_tipalti_profile: { status: "done", completedAt: daysAgo(10) },
      added_to_affiliate_database: { status: "done", completedAt: daysAgo(9) },
      // welcome_pack_sent skipped with no completedAt — product_training_call becomes current.
      welcome_pack_sent: { status: "skipped", completedAt: null },
    });

    const result = getCurrentStepStatus(steps, NOW);

    expect(result.graduated).toBe(false);
    if (!result.graduated) {
      expect(result.stepKey).toBe("product_training_call");
      expect(result.daysSinceReference).toBeNull();
      expect(result.overdue).toBe(false);
    }
  });

  it("edge case: the very first step has no preceding step, so it can't be overdue", () => {
    const steps = buildSteps({});

    const result = getCurrentStepStatus(steps, NOW);

    expect(result.graduated).toBe(false);
    if (!result.graduated) {
      expect(result.stepKey).toBe("application_received");
      expect(result.daysSinceReference).toBeNull();
      expect(result.overdue).toBe(false);
    }
  });

  it("measures milestone steps (9-12) from the approval date, not the previous step", () => {
    // day_30_first_content: target 30d, approved 35 days ago, but the step right before it
    // (referral_tracking_verified) only completed 1 day ago — the approval date should win.
    const steps = buildSteps({
      application_received: { status: "done", completedAt: daysAgo(40) },
      qualification_review: { status: "done", completedAt: daysAgo(38) },
      approved_manager_assigned: { status: "done", completedAt: daysAgo(35) },
      contract_tipalti_profile: { status: "done", completedAt: daysAgo(30) },
      added_to_affiliate_database: { status: "done", completedAt: daysAgo(29) },
      welcome_pack_sent: { status: "done", completedAt: daysAgo(28) },
      product_training_call: { status: "done", completedAt: daysAgo(27) },
      referral_tracking_verified: { status: "done", completedAt: daysAgo(1) },
    });

    const result = getCurrentStepStatus(steps, NOW);

    expect(result.graduated).toBe(false);
    if (!result.graduated) {
      expect(result.stepKey).toBe("day_30_first_content");
      expect(result.daysSinceReference).toBe(35);
      expect(result.overdue).toBe(true); // 35 > 30
    }
  });

  it("does not flag a milestone step as overdue while within its target_days of approval", () => {
    const steps = buildSteps({
      application_received: { status: "done", completedAt: daysAgo(20) },
      qualification_review: { status: "done", completedAt: daysAgo(18) },
      approved_manager_assigned: { status: "done", completedAt: daysAgo(15) },
      contract_tipalti_profile: { status: "done", completedAt: daysAgo(14) },
      added_to_affiliate_database: { status: "done", completedAt: daysAgo(13) },
      welcome_pack_sent: { status: "done", completedAt: daysAgo(12) },
      product_training_call: { status: "done", completedAt: daysAgo(11) },
      referral_tracking_verified: { status: "done", completedAt: daysAgo(10) },
    });

    const result = getCurrentStepStatus(steps, NOW);

    expect(result.graduated).toBe(false);
    if (!result.graduated) {
      expect(result.stepKey).toBe("day_30_first_content");
      expect(result.daysSinceReference).toBe(15);
      expect(result.overdue).toBe(false); // 15 < 30
    }
  });

  it("edge case: a milestone step can't be overdue with no approval date (approval was skipped)", () => {
    const steps = buildSteps({
      application_received: { status: "done", completedAt: daysAgo(50) },
      qualification_review: { status: "done", completedAt: daysAgo(45) },
      // Approval skipped rather than completed — no approval date exists at all.
      approved_manager_assigned: { status: "skipped", completedAt: null },
      contract_tipalti_profile: { status: "done", completedAt: daysAgo(40) },
      added_to_affiliate_database: { status: "done", completedAt: daysAgo(39) },
      welcome_pack_sent: { status: "done", completedAt: daysAgo(38) },
      product_training_call: { status: "done", completedAt: daysAgo(37) },
      referral_tracking_verified: { status: "done", completedAt: daysAgo(36) },
    });

    const result = getCurrentStepStatus(steps, NOW);

    expect(result.graduated).toBe(false);
    if (!result.graduated) {
      expect(result.stepKey).toBe("day_30_first_content");
      expect(result.daysSinceReference).toBeNull();
      expect(result.overdue).toBe(false);
    }
  });

  it("treats an affiliate as graduated once every step is done or skipped", () => {
    const steps = buildSteps(
      Object.fromEntries(TEST_TEMPLATE.map((t) => [t.key, { status: "done", completedAt: daysAgo(1) }])),
    );

    const result = getCurrentStepStatus(steps, NOW);

    expect(result).toEqual({ graduated: true, overdue: false });
  });

  it("treats an affiliate as graduated when remaining steps are a mix of done and skipped", () => {
    const steps = buildSteps(
      Object.fromEntries(
        TEST_TEMPLATE.map((t, i) => [
          t.key,
          i % 2 === 0 ? { status: "done", completedAt: daysAgo(1) } : { status: "skipped", completedAt: null },
        ]),
      ),
    );

    const result = getCurrentStepStatus(steps, NOW);

    expect(result.graduated).toBe(true);
  });
});

describe("computeOnboardingMetrics", () => {
  it("returns all-empty metrics for an empty affiliate list", () => {
    const metrics = computeOnboardingMetrics([], NOW);
    expect(metrics).toEqual({
      inOnboardingCount: 0,
      overdueCount: 0,
      avgDaysApprovalToFirstInstall: null,
      day90RecentRate: null,
    });
  });

  it("counts in-onboarding and overdue affiliates, excluding graduated ones", () => {
    const graduated = buildSteps(
      Object.fromEntries(TEST_TEMPLATE.map((t) => [t.key, { status: "done", completedAt: daysAgo(1) }])),
    );
    const onTrack = buildSteps({
      application_received: { status: "done", completedAt: daysAgo(10) },
      qualification_review: { status: "in_progress" },
    });
    const overdue = buildSteps({
      application_received: { status: "done", completedAt: daysAgo(10) },
      qualification_review: { status: "in_progress" },
      approved_manager_assigned: { status: "not_started" },
    });
    // Force the overdue one to actually be overdue: qualification_review target is 5d, previous step 10 days ago.
    const metrics = computeOnboardingMetrics([graduated, onTrack, overdue], NOW);
    expect(metrics.inOnboardingCount).toBe(2);
    expect(metrics.overdueCount).toBe(2); // both onTrack and overdue exceed the 5d target from a 10-day-old previous step
  });

  it("averages days from approval to the Day 30 (first install) milestone, only over affiliates who reached it", () => {
    const reachedIn25 = buildSteps({
      approved_manager_assigned: { status: "done", completedAt: daysAgo(25) },
      day_30_first_install: { status: "done", completedAt: daysAgo(0) },
    });
    const reachedIn35 = buildSteps({
      approved_manager_assigned: { status: "done", completedAt: daysAgo(35) },
      day_30_first_install: { status: "done", completedAt: daysAgo(0) },
    });
    const notReachedYet = buildSteps({
      approved_manager_assigned: { status: "done", completedAt: daysAgo(10) },
      day_30_first_install: { status: "in_progress" },
    });

    const metrics = computeOnboardingMetrics([reachedIn25, reachedIn35, notReachedYet], NOW);
    expect(metrics.avgDaysApprovalToFirstInstall).toBe(30);
  });

  it("returns null for the first-install average when nobody has reached it", () => {
    const notReachedYet = buildSteps({
      approved_manager_assigned: { status: "done", completedAt: daysAgo(10) },
    });
    const metrics = computeOnboardingMetrics([notReachedYet], NOW);
    expect(metrics.avgDaysApprovalToFirstInstall).toBeNull();
  });

  it("computes the Day 90 recent-reach rate only over affiliates eligible (approved >= 90 days ago)", () => {
    const reachedRecently = buildSteps({
      approved_manager_assigned: { status: "done", completedAt: daysAgo(100) },
      day_90_milestone: { status: "done", completedAt: daysAgo(10) }, // within last 6 months
    });
    const eligibleButMissed = buildSteps({
      approved_manager_assigned: { status: "done", completedAt: daysAgo(200) },
      day_90_milestone: { status: "not_started" },
    });
    const notYetEligible = buildSteps({
      approved_manager_assigned: { status: "done", completedAt: daysAgo(10) }, // only 10 days since approval
    });

    const metrics = computeOnboardingMetrics([reachedRecently, eligibleButMissed, notYetEligible], NOW);
    expect(metrics.day90RecentRate).toEqual({ percent: 50, eligible: 2, reached: 1 });
  });

  it("does not count a Day 90 completion outside the last 6 months as 'reached recently'", () => {
    const reachedLongAgo = buildSteps({
      approved_manager_assigned: { status: "done", completedAt: daysAgo(400) },
      day_90_milestone: { status: "done", completedAt: daysAgo(300) }, // outside the ~182 day window
    });
    const metrics = computeOnboardingMetrics([reachedLongAgo], NOW);
    expect(metrics.day90RecentRate).toEqual({ percent: 0, eligible: 1, reached: 0 });
  });

  it("returns null for the Day 90 rate when nobody is eligible yet", () => {
    const tooRecent = buildSteps({ approved_manager_assigned: { status: "done", completedAt: daysAgo(5) } });
    const metrics = computeOnboardingMetrics([tooRecent], NOW);
    expect(metrics.day90RecentRate).toBeNull();
  });
});
