import { NextRequest, NextResponse } from "next/server";
import { getSessionWithFreshToken } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Do-not-contact list: GET lists it, POST adds an email or a domain, DELETE ?id= removes one.
export async function GET() {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const entries = await prisma.suppressedContact.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ entries });
}

export async function POST(request: NextRequest) {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const raw = typeof body?.value === "string" ? body.value.trim().toLowerCase().replace(/^@/, "") : "";
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw);
  const isDomain = !isEmail && /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(raw);
  if (!isEmail && !isDomain) {
    return NextResponse.json({ error: "Enter an email address or a domain like example.com" }, { status: 400 });
  }
  const entry = await prisma.suppressedContact.upsert({
    where: { value: raw },
    update: {},
    create: { value: raw, kind: isEmail ? "email" : "domain", reason: "manual", addedBy: session.email },
  });
  return NextResponse.json({ entry });
}

export async function DELETE(request: NextRequest) {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const id = request.nextUrl.searchParams.get("id") ?? "";
  await prisma.suppressedContact.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}
