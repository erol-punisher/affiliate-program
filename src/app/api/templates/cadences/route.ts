import { NextRequest, NextResponse } from "next/server";
import { getSessionWithFreshToken } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const cadences = await prisma.templateCadence.findMany({
    orderBy: { order: "asc" },
    include: { steps: { orderBy: { order: "asc" } } },
  });
  return NextResponse.json({ cadences });
}

export async function POST(request: NextRequest) {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : null;
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const existing = await prisma.templateCadence.findMany({ select: { order: true } });
  const order = existing.length > 0 ? Math.max(...existing.map((c) => c.order)) + 1 : 0;

  const cadence = await prisma.templateCadence.create({
    data: { name, description, order },
    include: { steps: true },
  });

  return NextResponse.json({ cadence });
}
