import { NextResponse } from "next/server";
import { getSessionWithFreshToken } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const connection = await prisma.gmailConnection.findUnique({ where: { email: session.email }, select: { lastSyncAt: true } });
  return NextResponse.json({ connected: !!connection, email: session.email, name: session.name, lastSyncAt: connection?.lastSyncAt ?? null });
}

// Disconnect: forget the stored Gmail access (Google access can also be revoked at myaccount.google.com/permissions).
export async function DELETE() {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  await prisma.gmailConnection.deleteMany({ where: { email: session.email } });
  return NextResponse.json({ connected: false });
}
