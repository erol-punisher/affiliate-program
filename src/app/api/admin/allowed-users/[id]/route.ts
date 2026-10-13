import { NextRequest, NextResponse } from "next/server";
import { getSessionWithFreshToken } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.allowedUser.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Can't remove your own access via this screen — avoids locking yourself out with no way back in.
  if (existing.email === session.email.toLowerCase()) {
    return NextResponse.json({ error: "You can't remove your own access" }, { status: 400 });
  }

  await prisma.allowedUser.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
