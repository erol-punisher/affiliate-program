import { NextRequest, NextResponse } from "next/server";
import { getSessionWithFreshToken } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const cadenceId = typeof body?.cadenceId === "string" ? body.cadenceId : "";
  const label = typeof body?.label === "string" ? body.label.trim() : "";
  const content = typeof body?.content === "string" ? body.content.trim() : "";

  if (!cadenceId || !label || !content) {
    return NextResponse.json({ error: "cadenceId, label, and content are required" }, { status: 400 });
  }

  const cadence = await prisma.templateCadence.findUnique({ where: { id: cadenceId } });
  if (!cadence) {
    return NextResponse.json({ error: "Cadence not found" }, { status: 404 });
  }

  const existing = await prisma.templateStep.findMany({ where: { cadenceId }, select: { order: true } });
  const order = existing.length > 0 ? Math.max(...existing.map((s) => s.order)) + 1 : 0;

  const step = await prisma.templateStep.create({ data: { cadenceId, label, content, order } });
  return NextResponse.json({ step });
}
