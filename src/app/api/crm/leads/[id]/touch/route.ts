import { NextRequest, NextResponse } from "next/server";
import { getSessionWithFreshToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseChannels } from "@/lib/outreachChannels";
import { recordTouch } from "@/lib/outreachStats";

// Logs a DM (or other reach-out) without moving the lead: { channels }. Counts as contacted this week.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const channels = parseChannels(body?.channels);
  if (channels.length === 0) {
    return NextResponse.json({ error: "Pick at least one channel" }, { status: 400 });
  }

  const event = await prisma.$transaction((tx) => recordTouch(tx, { leadId: id, channels, actor: session.email }));
  if (!event) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }
  const lead = await prisma.lead.findUnique({ where: { id }, select: { outreachChannels: true } });
  return NextResponse.json({ ok: true, outreachChannels: lead?.outreachChannels ?? channels });
}
