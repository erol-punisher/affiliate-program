import { prisma } from "@/lib/db";
import { computeAutoCompletions, type AutoCompletableStep } from "@/lib/onboardingAutoComplete";
import type { OnboardingStepTemplateItem } from "@/lib/onboardingSteps";

/** Fetches the current editable onboarding template, ordered for display/seeding. */
export async function getOnboardingTemplate(): Promise<OnboardingStepTemplateItem[]> {
  const rows = await prisma.onboardingStepTemplate.findMany({ orderBy: { order: "asc" } });
  return rows.map((r) => ({
    key: r.key,
    label: r.label,
    order: r.order,
    targetDays: r.targetDays,
    targetDaysAnchor: r.targetDaysAnchor as "step_start" | "approval",
    isApprovalAnchor: r.isApprovalAnchor,
  }));
}

export const ONBOARDING_AFFILIATE_SELECT = {
  id: true,
  name: true,
  tier: true,
  status: true,
  countryCode: true,
  firstInstallAt: true,
  firstPaidMerchantAt: true,
  onboardingSteps: {
    orderBy: { order: "asc" as const },
    include: { activity: { orderBy: { createdAt: "desc" as const } } },
  },
};

const AUTO_COMPLETE_LABEL: Record<string, string> = {
  day_30_first_install: "first install",
  day_60_milestone: "first paying merchant",
};

/** Runs the install/paying-merchant auto-completion check for one affiliate; returns whether anything changed. */
export async function applyAutoCompletions(
  steps: { id: string; stepKey: string; status: string }[],
  affiliate: { firstInstallAt: Date | null; firstPaidMerchantAt: Date | null },
): Promise<boolean> {
  const completions = computeAutoCompletions(steps as AutoCompletableStep[], affiliate);

  for (const c of completions) {
    await prisma.onboardingStep.update({
      where: { id: c.stepId },
      data: { status: "done", completedAt: c.completedAt, autoCompleted: true },
    });
    await prisma.onboardingActivity.create({
      data: {
        stepId: c.stepId,
        actor: "system",
        message: `Auto-completed: ${AUTO_COMPLETE_LABEL[c.stepKey] ?? c.stepKey} recorded on ${c.completedAt.toISOString().slice(0, 10)}`,
      },
    });
  }

  return completions.length > 0;
}
