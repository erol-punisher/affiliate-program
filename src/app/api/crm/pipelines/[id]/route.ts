import { NextRequest, NextResponse } from "next/server";
import { getSessionWithFreshToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parsePipelineCategory } from "@/lib/pipelineCategory";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);

  const data: { name?: string; order?: number; category?: string | null } = {};
  if (typeof body?.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body?.order === "number") data.order = body.order;
  const category = parsePipelineCategory(body?.category);
  if (category !== undefined) data.category = category;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const pipeline = await prisma.pipeline.update({ where: { id }, data });
  return NextResponse.json({ pipeline });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const pipeline = await prisma.pipeline.findUnique({ where: { id }, select: { category: true } });
  if (!pipeline) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // Main overview pipelines (e.g. Affiliates Standard) hold every affiliate's mirrored copy.
  if (!pipeline.category) {
    return NextResponse.json({ error: "The main pipeline can't be deleted" }, { status: 409 });
  }
  await prisma.pipeline.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
