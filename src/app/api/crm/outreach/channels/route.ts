import { NextRequest, NextResponse } from "next/server";
import { getSessionWithFreshToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseChannels } from "@/lib/outreachChannels";
import { setEventChannels } from "@/lib/outreachStats";

const MAX_EVENTS = 200;

// Sets how leads were reached for moves into a Contacted stage: { eventIds, channels }.
export async function POST(request: NextRequest) {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const eventIds: string[] = Array.isArray(body?.eventIds)
    ? body.eventIds.filter((id: unknown) => typeof id === "string").slice(0, MAX_EVENTS)
    : [];
  const channels = parseChannels(body?.channels);
  if (eventIds.length === 0) {
    return NextResponse.json({ error: "No outreach to tag" }, { status: 400 });
  }

  const updated = await prisma.$transaction((tx) => setEventChannels(tx, eventIds, channels));
  return NextResponse.json({ updated, channels });
}
