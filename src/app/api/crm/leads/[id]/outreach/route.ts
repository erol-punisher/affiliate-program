import { NextRequest, NextResponse } from "next/server";
import { getSessionWithFreshToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseChannels } from "@/lib/outreachChannels";
import { classifyEvent, setResponseChannels, syncLeadChannels } from "@/lib/outreachStats";

async function rootIdOf(id: string): Promise<string | null> {
  const lead = await prisma.lead.findUnique({ where: { id }, select: { sourceLeadId: true } });
  return lead ? (lead.sourceLeadId ?? id) : null;
}

// The affiliate's reach-outs that have a channel (moves into Contacted and logged DMs), oldest first.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rootLeadId = await rootIdOf((await params).id);
  if (!rootLeadId) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }
  const events = await prisma.leadStageEvent.findMany({
    where: { rootLeadId, NOT: { channels: { isEmpty: true } } },
    select: { id: true, kind: true, toStageName: true, channels: true, actor: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  // A response's channels say how they replied, not a reach-out step.
  return NextResponse.json({ events: events.filter((e) => classifyEvent(e).includes("contacted")) });
}

// Undoes one channel of one reach-out: ?eventId=…&channel=…. A logged DM left with no channel is removed.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rootLeadId = await rootIdOf((await params).id);
  const eventId = request.nextUrl.searchParams.get("eventId") ?? "";
  const [channel] = parseChannels([request.nextUrl.searchParams.get("channel")]);
  const event = rootLeadId && eventId ? await prisma.leadStageEvent.findUnique({ where: { id: eventId } }) : null;
  if (!rootLeadId || !event || event.rootLeadId !== rootLeadId || !channel) {
    return NextResponse.json({ error: "Reach-out not found" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    const channels = event.channels.filter((c) => c !== channel);
    if (channels.length === 0 && event.kind === "touch") await tx.leadStageEvent.delete({ where: { id: event.id } });
    else await tx.leadStageEvent.update({ where: { id: event.id }, data: { channels } });
    await syncLeadChannels(tx, [rootLeadId]);
  });
  return NextResponse.json({ ok: true });
}

// Sets which channel(s) the affiliate responded with interest on: { responseChannels }.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rootLeadId = await rootIdOf((await params).id);
  const body = await request.json().catch(() => null);
  if (!rootLeadId || !Array.isArray(body?.responseChannels)) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }
  const ok = await prisma.$transaction((tx) => setResponseChannels(tx, rootLeadId, parseChannels(body.responseChannels)));
  if (!ok) {
    return NextResponse.json({ error: "This affiliate hasn't responded with interest" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
