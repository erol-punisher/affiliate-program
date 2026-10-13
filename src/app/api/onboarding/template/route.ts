import { NextRequest, NextResponse } from "next/server";
import { getSessionWithFreshToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateUniqueStepKey } from "@/lib/onboardingSteps";

export async function GET() {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const template = await prisma.onboardingStepTemplate.findMany({ orderBy: { order: "asc" } });
  return NextResponse.json({ template });
}

export async function POST(request: NextRequest) {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const label = typeof body?.label === "string" ? body.label.trim() : "";
  if (!label) {
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  }

  const targetDays = typeof body?.targetDays === "number" && Number.isFinite(body.targetDays) ? Math.trunc(body.targetDays) : 0;
  const targetDaysAnchor = body?.targetDaysAnchor === "approval" ? "approval" : "step_start";

  const existing = await prisma.onboardingStepTemplate.findMany({ select: { key: true, order: true } });
  const key = generateUniqueStepKey(
    label,
    existing.map((s) => s.key),
  );
  const order = existing.length > 0 ? Math.max(...existing.map((s) => s.order)) + 1 : 0;

  const step = await prisma.onboardingStepTemplate.create({
    data: { key, label, order, targetDays, targetDaysAnchor },
  });

  return NextResponse.json({ step });
}
