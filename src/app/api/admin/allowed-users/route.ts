import { NextRequest, NextResponse } from "next/server";
import { getSessionWithFreshToken } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const users = await prisma.allowedUser.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json({ users });
}

export async function POST(request: NextRequest) {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }

  const existing = await prisma.allowedUser.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ user: existing });
  }

  const user = await prisma.allowedUser.create({ data: { email, addedBy: session.email } });
  return NextResponse.json({ user });
}
