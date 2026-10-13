import type { OnboardingStepStatus } from "@/lib/onboardingSteps";

export type AffiliateEventDates = {
  firstInstallAt: string | Date | null;
  firstPaidMerchantAt: string | Date | null;
};

export type AutoCompletableStep = {
  id: string;
  stepKey: string;
  status: OnboardingStepStatus;
};

export type AutoCompletion = {
  stepId: string;
  stepKey: string;
  completedAt: Date;
};

function toDate(value: string | Date | null): Date | null {
  if (value === null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Which onboarding steps auto-complete from real usage events, and where that
 * event date comes from. The Day 30 step is split so "first content piece"
 * stays a manual check while "first install" is driven by this rule.
 */
const AUTO_COMPLETION_RULES: {
  stepKey: string;
  getEventDate: (affiliate: AffiliateEventDates) => Date | null;
}[] = [
  { stepKey: "day_30_first_install", getEventDate: (a) => toDate(a.firstInstallAt) },
  { stepKey: "day_60_milestone", getEventDate: (a) => toDate(a.firstPaidMerchantAt) },
];

/**
 * Given an affiliate's onboarding steps and their real usage-event dates,
 * returns the steps that should now be auto-marked done, with the real event
 * date as completedAt. Never overrides a step a human already resolved
 * (done or skipped) — the automation only fills in steps still pending.
 */
export function computeAutoCompletions(steps: AutoCompletableStep[], affiliate: AffiliateEventDates): AutoCompletion[] {
  const completions: AutoCompletion[] = [];

  for (const rule of AUTO_COMPLETION_RULES) {
    const step = steps.find((s) => s.stepKey === rule.stepKey);
    if (!step || step.status === "done" || step.status === "skipped") continue;

    const eventDate = rule.getEventDate(affiliate);
    if (eventDate) {
      completions.push({ stepId: step.id, stepKey: step.stepKey, completedAt: eventDate });
    }
  }

  return completions;
}
