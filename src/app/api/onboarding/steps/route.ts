import { NextRequest, NextResponse } from "next/server";
import { getSessionWithFreshToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateUniqueStepKey } from "@/lib/onboardingSteps";

/** Adds a one-off custom step to a single affiliate's checklist — independent of the shared template. */
export async function POST(request: NextRequest) {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const affiliateId = typeof body?.affiliateId === "string" ? body.affiliateId : "";
  const label = typeof body?.label === "string" ? body.label.trim() : "";
  if (!affiliateId || !label) {
    return NextResponse.json({ error: "affiliateId and label are required" }, { status: 400 });
  }

  const existingSteps = await prisma.onboardingStep.findMany({
    where: { affiliateId },
    select: { stepKey: true, order: true },
  });
  if (existingSteps.length === 0) {
    return NextResponse.json({ error: "Affiliate has no onboarding checklist yet" }, { status: 404 });
  }

  const targetDays =
    typeof body?.targetDays === "number" && Number.isFinite(body.targetDays) ? Math.trunc(body.targetDays) : null;
  const targetDaysAnchor = body?.targetDaysAnchor === "approval" ? "approval" : "step_start";

  const stepKey = generateUniqueStepKey(
    label,
    existingSteps.map((s) => s.stepKey),
  );
  const order = Math.max(...existingSteps.map((s) => s.order)) + 1;

  const step = await prisma.$transaction(async (tx) => {
    const created = await tx.onboardingStep.create({
      data: { affiliateId, stepKey, label, order, targetDays, targetDaysAnchor, status: "not_started" },
    });
    await tx.onboardingActivity.create({
      data: { stepId: created.id, actor: session.email, message: `Added custom step "${label}"` },
    });
    return tx.onboardingStep.findUniqueOrThrow({
      where: { id: created.id },
      include: { activity: { orderBy: { createdAt: "desc" } } },
    });
  });

  return NextResponse.json({ step });
}
