import { NextRequest, NextResponse } from "next/server";
import { getSessionWithFreshToken } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const groups = await prisma.pipelineGroup.findMany({
    orderBy: { order: "asc" },
    include: {
      pipelines: {
        orderBy: { order: "asc" },
        include: {
          stages: {
            orderBy: { order: "asc" },
            include: {
              leads: { orderBy: { order: "asc" } },
            },
          },
        },
      },
    },
  });

  return NextResponse.json({ groups });
}

export async function POST(request: NextRequest) {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const maxOrder = await prisma.pipelineGroup.aggregate({ _max: { order: true } });
  const group = await prisma.pipelineGroup.create({
    data: { name, order: (maxOrder._max.order ?? -1) + 1 },
    include: { pipelines: true },
  });

  return NextResponse.json({ group });
}
