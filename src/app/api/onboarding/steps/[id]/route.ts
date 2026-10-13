import { NextRequest, NextResponse } from "next/server";
import { getSessionWithFreshToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ONBOARDING_STEP_STATUSES, describeStepChanges, type OnboardingStepStatus } from "@/lib/onboardingSteps";
import { parseOptionalDate, parseOptionalInt, parseOptionalString } from "@/lib/crmLead";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);

  const existing = await prisma.onboardingStep.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Step not found" }, { status: 404 });
  }

  const data: {
    status?: OnboardingStepStatus;
    owner?: string | null;
    startedAt?: Date | null;
    completedAt?: Date | null;
    targetDays?: number | null;
    targetDaysAnchor?: string;
    notes?: string | null;
    autoCompleted?: boolean;
    label?: string;
    order?: number;
    isApprovalAnchor?: boolean;
  } = {};

  if (typeof body?.status === "string" && (ONBOARDING_STEP_STATUSES as string[]).includes(body.status)) {
    data.status = body.status as OnboardingStepStatus;
    // A human is deliberately changing this step's status — it's no longer an automatic completion,
    // even if the automation had set it done earlier. Only relevant when it was actually auto-completed.
    if (existing.autoCompleted) data.autoCompleted = false;
  }

  const owner = parseOptionalString(body?.owner);
  if (owner !== undefined) data.owner = owner;

  const notes = parseOptionalString(body?.notes);
  if (notes !== undefined) data.notes = notes;

  const targetDays = parseOptionalInt(body?.targetDays);
  if (targetDays !== undefined) data.targetDays = targetDays;

  if (body?.targetDaysAnchor === "approval" || body?.targetDaysAnchor === "step_start") {
    data.targetDaysAnchor = body.targetDaysAnchor;
  }

  const label = parseOptionalString(body?.label);
  if (label) data.label = label;

  if (typeof body?.order === "number") data.order = Math.trunc(body.order);

  if (typeof body?.isApprovalAnchor === "boolean") data.isApprovalAnchor = body.isApprovalAnchor;

  const startedAt = parseOptionalDate(body?.startedAt);
  if (startedAt !== undefined) data.startedAt = startedAt;

  const completedAt = parseOptionalDate(body?.completedAt);
  if (completedAt !== undefined) data.completedAt = completedAt;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  // Convenience defaults: moving into a status implies a timestamp, if one wasn't already set or sent explicitly.
  if (data.status === "in_progress" && data.startedAt === undefined && !existing.startedAt) {
    data.startedAt = new Date();
  }
  if (data.status === "done" && data.completedAt === undefined && !existing.completedAt) {
    data.completedAt = new Date();
  }

  const changeMessages = describeStepChanges({ ...existing, status: existing.status as OnboardingStepStatus }, data);

  const step = await prisma.$transaction(async (tx) => {
    // At most one step per affiliate is the approval anchor — setting this one true clears every
    // other step of the same affiliate (mirrors the template's single-anchor rule).
    if (data.isApprovalAnchor === true) {
      await tx.onboardingStep.updateMany({
        where: { affiliateId: existing.affiliateId, id: { not: id }, isApprovalAnchor: true },
        data: { isApprovalAnchor: false },
      });
    }
    await tx.onboardingStep.update({ where: { id }, data });
    if (changeMessages.length > 0) {
      await tx.onboardingActivity.createMany({
        data: changeMessages.map((message) => ({ stepId: id, actor: session.email, message })),
      });
    }
    return tx.onboardingStep.findUniqueOrThrow({
      where: { id },
      include: { activity: { orderBy: { createdAt: "desc" } } },
    });
  });

  return NextResponse.json({ step });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.onboardingStep.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Step not found" }, { status: 404 });
  }

  await prisma.onboardingStep.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
