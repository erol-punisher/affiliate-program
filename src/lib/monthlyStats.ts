import { prisma } from "@/lib/db";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

/** [start, end) range covering the given calendar month, in UTC. `month` is 1-12. */
function monthRange(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start, end };
}

export type MonthlyStats = {
  year: number;
  month: number;
  crmEntriesAdded: number;
  affiliatesOnboardingStarted: number;
};

/**
 * Affiliates "onboarded" this month = affiliates whose onboarding checklist
 * first appeared this month (earliest OnboardingStep.createdAt falls in the
 * range). There's no explicit "onboarding complete" flag in the schema today,
 * so this counts onboarding STARTS, not completions.
 */
export async function computeMonthlyStats(year: number, month: number): Promise<MonthlyStats> {
  const { start, end } = monthRange(year, month);

  const crmEntriesAdded = await prisma.lead.count({
    where: { createdAt: { gte: start, lt: end } },
  });

  const startDates = await prisma.onboardingStep.groupBy({
    by: ["affiliateId"],
    _min: { createdAt: true },
  });
  const affiliatesOnboardingStarted = startDates.filter((row) => {
    const started = row._min.createdAt;
    return started !== null && started >= start && started < end;
  }).length;

  return { year, month, crmEntriesAdded, affiliatesOnboardingStarted };
}

export function buildMonthlyReportTitle(year: number, month: number): string {
  return `Monthly Report — ${monthLabel(year, month)}`;
}

export function buildMonthlyReportContent(stats: MonthlyStats): string {
  return [
    `CRM entries added: ${stats.crmEntriesAdded}`,
    `Affiliates who started onboarding: ${stats.affiliatesOnboardingStarted}`,
  ].join("\n");
}
