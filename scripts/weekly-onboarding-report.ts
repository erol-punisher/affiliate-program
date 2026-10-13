import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { computeOnboardingMetrics, getCurrentStepStatus, type OnboardingStepInput } from "../src/lib/onboardingStatus";

const adapter = new PrismaBetterSqlite3({ url: "./dev.db" });
const prisma = new PrismaClient({ adapter });

const WEEK_START = new Date("2026-10-05T00:00:00.000Z");
const WEEK_END = new Date("2026-10-10T00:00:00.000Z"); // exclusive

async function main() {
  const affiliates = await prisma.affiliate.findMany({
    where: { onboardingSteps: { some: {} } },
    select: {
      id: true,
      name: true,
      tier: true,
      status: true,
      countryCode: true,
      onboardingSteps: { orderBy: { order: "asc" } },
    },
  });

  const toStepInput = (steps: (typeof affiliates)[number]["onboardingSteps"]): OnboardingStepInput[] =>
    steps.map((s) => ({
      stepKey: s.stepKey,
      order: s.order,
      status: s.status as OnboardingStepInput["status"],
      completedAt: s.completedAt,
      targetDays: s.targetDays,
      targetDaysAnchor: s.targetDaysAnchor as OnboardingStepInput["targetDaysAnchor"],
      isApprovalAnchor: s.isApprovalAnchor,
    }));

  const metrics = computeOnboardingMetrics(affiliates.map((a) => toStepInput(a.onboardingSteps)));

  const startedThisWeek = affiliates
    .map((a) => {
      const earliest = a.onboardingSteps.reduce<Date | null>((min, s) => {
        const d = new Date(s.createdAt);
        return min === null || d < min ? d : min;
      }, null);
      return { affiliate: a, earliest };
    })
    .filter(({ earliest }) => earliest !== null && earliest >= WEEK_START && earliest < WEEK_END)
    .map(({ affiliate, earliest }) => {
      const steps = toStepInput(affiliate.onboardingSteps);
      const current = getCurrentStepStatus(steps);
      const doneSteps = affiliate.onboardingSteps.filter((s) => s.status === "done");
      const doneCount = doneSteps.length;
      const totalCount = affiliate.onboardingSteps.length;
      const maxDoneOrder = doneSteps.reduce((max, s) => Math.max(max, s.order), -1);
      const lastCompleted = doneSteps.reduce<(typeof doneSteps)[number] | null>((latest, s) => {
        if (!s.completedAt) return latest;
        if (!latest || !latest.completedAt) return s;
        return new Date(s.completedAt) > new Date(latest.completedAt) ? s : latest;
      }, null);
      const nextStep = affiliate.onboardingSteps.find((s) => s.status === "not_started" && s.order > maxDoneOrder);
      return {
        name: affiliate.name,
        tier: affiliate.tier,
        countryCode: affiliate.countryCode,
        doneCount,
        totalCount,
        lastCompletedLabel: lastCompleted?.label ?? null,
        nextStepLabel: nextStep?.label ?? null,
        startedDate: earliest?.toISOString().slice(0, 10) ?? null,
        overdue: !current.graduated && current.overdue,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  console.log(JSON.stringify({ metrics, startedThisWeek }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
