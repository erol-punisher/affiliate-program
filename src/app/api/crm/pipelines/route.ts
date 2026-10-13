import { NextRequest, NextResponse } from "next/server";
import { getSessionWithFreshToken } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const pipelineGroupId = typeof body?.pipelineGroupId === "string" ? body.pipelineGroupId : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const cloneStagesFrom = typeof body?.cloneStagesFrom === "string" ? body.cloneStagesFrom : null;

  if (!pipelineGroupId || !name) {
    return NextResponse.json({ error: "pipelineGroupId and name are required" }, { status: 400 });
  }

  const maxOrder = await prisma.pipeline.aggregate({
    where: { pipelineGroupId },
    _max: { order: true },
  });

  const templateStages = cloneStagesFrom
    ? await prisma.stage.findMany({ where: { pipelineId: cloneStagesFrom }, orderBy: { order: "asc" } })
    : [];

  const pipeline = await prisma.pipeline.create({
    data: {
      pipelineGroupId,
      name,
      order: (maxOrder._max.order ?? -1) + 1,
      stages: {
        create: templateStages.map((s) => ({ name: s.name, order: s.order, color: s.color })),
      },
    },
    include: { stages: { include: { leads: true } } },
  });

  return NextResponse.json({ pipeline });
}
