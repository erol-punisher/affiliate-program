import { NextRequest, NextResponse } from "next/server";
import { getSessionWithFreshToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseOptionalDate } from "@/lib/crmLead";
import { applyAutoCompletions, ONBOARDING_AFFILIATE_SELECT } from "@/lib/onboardingServer";

/** Sets an affiliate's real usage-event dates (first install / first paid merchant) and immediately re-runs the auto-completion check. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);

  const data: { firstInstallAt?: Date | null; firstPaidMerchantAt?: Date | null } = {};

  const firstInstallAt = parseOptionalDate(body?.firstInstallAt);
  if (firstInstallAt !== undefined) data.firstInstallAt = firstInstallAt;

  const firstPaidMerchantAt = parseOptionalDate(body?.firstPaidMerchantAt);
  if (firstPaidMerchantAt !== undefined) data.firstPaidMerchantAt = firstPaidMerchantAt;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const affiliate = await prisma.affiliate.findUnique({ where: { id } });
  if (!affiliate) {
    return NextResponse.json({ error: "Affiliate not found" }, { status: 404 });
  }

  await prisma.affiliate.update({ where: { id }, data });

  const steps = await prisma.onboardingStep.findMany({ where: { affiliateId: id } });
  await applyAutoCompletions(steps, { ...affiliate, ...data });

  const result = await prisma.affiliate.findUnique({ where: { id }, select: ONBOARDING_AFFILIATE_SELECT });
  return NextResponse.json({ affiliate: result });
}

/** Removes an affiliate from onboarding tracking entirely — deletes their checklist (and its activity log), not the Affiliate record itself. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.onboardingStep.findFirst({ where: { affiliateId: id } });
  if (!existing) {
    return NextResponse.json({ error: "Affiliate is not being onboarded" }, { status: 404 });
  }

  await prisma.onboardingStep.deleteMany({ where: { affiliateId: id } });

  return NextResponse.json({ ok: true });
}
