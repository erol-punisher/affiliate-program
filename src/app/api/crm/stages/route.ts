import { NextRequest, NextResponse } from "next/server";
import { getSessionWithFreshToken } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const pipelineId = typeof body?.pipelineId === "string" ? body.pipelineId : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const color = typeof body?.color === "string" ? body.color : null;

  if (!pipelineId || !name) {
    return NextResponse.json({ error: "pipelineId and name are required" }, { status: 400 });
  }

  const maxOrder = await prisma.stage.aggregate({
    where: { pipelineId },
    _max: { order: true },
  });

  const stage = await prisma.stage.create({
    data: { pipelineId, name, color, order: (maxOrder._max.order ?? -1) + 1 },
    include: { leads: true },
  });

  return NextResponse.json({ stage });
}
