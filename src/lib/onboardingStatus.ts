import type { OnboardingStepAnchor, OnboardingStepStatus } from "@/lib/onboardingSteps";

const DAY_MS = 24 * 60 * 60 * 1000;

export type OnboardingStepInput = {
  stepKey: string;
  order: number;
  status: OnboardingStepStatus;
  completedAt: string | Date | null;
  targetDays: number | null;
  targetDaysAnchor: OnboardingStepAnchor;
  isApprovalAnchor: boolean;
};

export type CurrentStepStatus =
  | { graduated: true; overdue: false }
  | {
      graduated: false;
      stepKey: string;
      order: number;
      overdue: boolean;
      /** Days since whatever this step's overdue clock starts from, or null if that date isn't known yet. */
      daysSinceReference: number | null;
    };

function toDate(value: string | Date | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Finds an affiliate's current onboarding step — the first one that's neither
 * done nor skipped — and whether it's overdue. If every step is done or
 * skipped, the affiliate has graduated.
 *
 * Steps 1-8 (config anchor "step_start") are overdue when days since the
 * *immediately preceding* step's completedAt exceed the current step's
 * target_days. Milestone steps 9-11 (anchor "approval") are instead measured
 * from the "Approved + manager assigned" step's completedAt.
 *
 * A step can't be judged overdue when its reference date isn't known: the
 * preceding step was skipped (no completedAt), approval hasn't happened yet
 * (skipped or not reached), or this is the very first step (no preceding
 * step at all). In all of those cases this returns `overdue: false` and
 * `daysSinceReference: null` rather than guessing.
 */
export function getCurrentStepStatus(steps: OnboardingStepInput[], now: Date = new Date()): CurrentStepStatus {
  const sorted = [...steps].sort((a, b) => a.order - b.order);
  const currentIndex = sorted.findIndex((s) => s.status !== "done" && s.status !== "skipped");

  if (currentIndex === -1) {
    return { graduated: true, overdue: false };
  }

  const current = sorted[currentIndex];

  const referenceDate =
    current.targetDaysAnchor === "approval"
      ? toDate(sorted.find((s) => s.isApprovalAnchor)?.completedAt)
      : toDate(sorted[currentIndex - 1]?.completedAt);

  const daysSinceReference = referenceDate ? Math.floor((now.getTime() - referenceDate.getTime()) / DAY_MS) : null;
  const overdue = daysSinceReference !== null && current.targetDays !== null && daysSinceReference > current.targetDays;

  return { graduated: false, stepKey: current.stepKey, order: current.order, overdue, daysSinceReference };
}

const DAY_30_STEP_KEY = "day_30_first_install";
const DAY_90_STEP_KEY = "day_90_milestone";
const NINETY_DAYS_MS = 90 * DAY_MS;
const SIX_MONTHS_MS = 182 * DAY_MS; // ~6 months, good enough for a dashboard KPI

export type OnboardingMetrics = {
  /** Affiliates not yet graduated (still have a step that isn't done/skipped). */
  inOnboardingCount: number;
  /** Of those, how many have a currently-overdue step. */
  overdueCount: number;
  /** Mean days from approval to completing the Day 30 (first install) milestone, or null if nobody's reached it yet. */
  avgDaysApprovalToFirstInstall: number | null;
  /**
   * Of affiliates who were approved long enough ago to have had a chance at Day 90 (>= 90 days
   * since approval), what fraction actually completed it within the last ~6 months. Null if
   * nobody in the set is even eligible yet, so a percentage would be meaningless.
   */
  day90RecentRate: { percent: number; eligible: number; reached: number } | null;
};

/** Aggregates the four onboarding dashboard metrics over a set of affiliates' step lists. */
export function computeOnboardingMetrics(affiliatesSteps: OnboardingStepInput[][], now: Date = new Date()): OnboardingMetrics {
  let inOnboardingCount = 0;
  let overdueCount = 0;
  const firstInstallDurations: number[] = [];
  let day90Eligible = 0;
  let day90Reached = 0;

  for (const steps of affiliatesSteps) {
    const current = getCurrentStepStatus(steps, now);
    if (!current.graduated) {
      inOnboardingCount++;
      if (current.overdue) overdueCount++;
    }

    const approvalDate = toDate(steps.find((s) => s.isApprovalAnchor)?.completedAt);

    const day30 = steps.find((s) => s.stepKey === DAY_30_STEP_KEY);
    const day30Date = day30?.status === "done" ? toDate(day30.completedAt) : null;
    if (approvalDate && day30Date) {
      firstInstallDurations.push(Math.floor((day30Date.getTime() - approvalDate.getTime()) / DAY_MS));
    }

    if (approvalDate && now.getTime() - approvalDate.getTime() >= NINETY_DAYS_MS) {
      day90Eligible++;
      const day90 = steps.find((s) => s.stepKey === DAY_90_STEP_KEY);
      const day90Date = day90?.status === "done" ? toDate(day90.completedAt) : null;
      if (day90Date && now.getTime() - day90Date.getTime() <= SIX_MONTHS_MS) {
        day90Reached++;
      }
    }
  }

  return {
    inOnboardingCount,
    overdueCount,
    avgDaysApprovalToFirstInstall:
      firstInstallDurations.length > 0
        ? Math.round((firstInstallDurations.reduce((a, b) => a + b, 0) / firstInstallDurations.length) * 10) / 10
        : null,
    day90RecentRate:
      day90Eligible > 0
        ? {
            percent: Math.round((day90Reached / day90Eligible) * 1000) / 10,
            eligible: day90Eligible,
            reached: day90Reached,
          }
        : null,
  };
}
