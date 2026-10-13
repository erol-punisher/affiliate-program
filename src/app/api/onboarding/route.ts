import { NextRequest, NextResponse } from "next/server";
import { getSessionWithFreshToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildOnboardingStepRows } from "@/lib/onboardingSteps";
import { parseOptionalString } from "@/lib/crmLead";
import { applyAutoCompletions, getOnboardingTemplate, ONBOARDING_AFFILIATE_SELECT } from "@/lib/onboardingServer";

export async function GET() {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let affiliates = await prisma.affiliate.findMany({
    where: { onboardingSteps: { some: {} } },
    select: ONBOARDING_AFFILIATE_SELECT,
    orderBy: { name: "asc" },
  });

  let anyChanges = false;
  for (const affiliate of affiliates) {
    if (await applyAutoCompletions(affiliate.onboardingSteps, affiliate)) anyChanges = true;
  }

  if (anyChanges) {
    affiliates = await prisma.affiliate.findMany({
      where: { onboardingSteps: { some: {} } },
      select: ONBOARDING_AFFILIATE_SELECT,
      orderBy: { name: "asc" },
    });
  }

  return NextResponse.json({ affiliates });
}

export async function POST(request: NextRequest) {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const affiliateId = typeof body?.affiliateId === "string" ? body.affiliateId : "";
  const owner = parseOptionalString(body?.owner);
  if (!affiliateId) {
    return NextResponse.json({ error: "affiliateId is required" }, { status: 400 });
  }

  const affiliate = await prisma.affiliate.findUnique({ where: { id: affiliateId } });
  if (!affiliate) {
    return NextResponse.json({ error: "Affiliate not found" }, { status: 404 });
  }

  const existing = await prisma.onboardingStep.findFirst({ where: { affiliateId } });
  if (existing) {
    return NextResponse.json({ error: "Onboarding already started for this affiliate" }, { status: 409 });
  }

  const template = await getOnboardingTemplate();
  await prisma.onboardingStep.createMany({
    data: buildOnboardingStepRows(template, owner ?? null).map((row) => ({ ...row, affiliateId })),
  });

  const created = await prisma.onboardingStep.findMany({ where: { affiliateId } });
  await applyAutoCompletions(created, affiliate);

  const result = await prisma.affiliate.findUnique({
    where: { id: affiliateId },
    select: ONBOARDING_AFFILIATE_SELECT,
  });

  return NextResponse.json({ affiliate: result });
}
