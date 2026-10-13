import { NextRequest, NextResponse } from "next/server";
import { getSessionWithFreshToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseOptionalInt, parseOptionalString } from "@/lib/crmLead";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);

  const existing = await prisma.onboardingStepTemplate.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Template step not found" }, { status: 404 });
  }

  const data: {
    label?: string;
    order?: number;
    targetDays?: number;
    targetDaysAnchor?: string;
    isApprovalAnchor?: boolean;
  } = {};

  const label = parseOptionalString(body?.label);
  if (label) data.label = label;

  if (typeof body?.order === "number") data.order = Math.trunc(body.order);

  const targetDays = parseOptionalInt(body?.targetDays);
  if (targetDays !== undefined) data.targetDays = targetDays ?? 0;

  if (body?.targetDaysAnchor === "approval" || body?.targetDaysAnchor === "step_start") {
    data.targetDaysAnchor = body.targetDaysAnchor;
  }

  if (typeof body?.isApprovalAnchor === "boolean") data.isApprovalAnchor = body.isApprovalAnchor;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const step = await prisma.$transaction(async (tx) => {
    // At most one template step is the approval anchor — setting this one true clears every other.
    if (data.isApprovalAnchor === true) {
      await tx.onboardingStepTemplate.updateMany({
        where: { id: { not: id }, isApprovalAnchor: true },
        data: { isApprovalAnchor: false },
      });
    }
    return tx.onboardingStepTemplate.update({ where: { id }, data });
  });

  return NextResponse.json({ step });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  await prisma.onboardingStepTemplate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
