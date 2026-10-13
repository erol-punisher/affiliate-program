import { NextRequest, NextResponse } from "next/server";
import { getSessionWithFreshToken } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);

  const data: { label?: string; content?: string; order?: number } = {};
  if (typeof body?.label === "string") {
    const label = body.label.trim();
    if (!label) return NextResponse.json({ error: "label cannot be blank" }, { status: 400 });
    data.label = label;
  }
  if (typeof body?.content === "string") {
    const content = body.content.trim();
    if (!content) return NextResponse.json({ error: "content cannot be blank" }, { status: 400 });
    data.content = content;
  }
  if (typeof body?.order === "number") data.order = body.order;

  const existing = await prisma.templateStep.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const step = await prisma.templateStep.update({ where: { id }, data });
  return NextResponse.json({ step });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.templateStep.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.templateStep.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
