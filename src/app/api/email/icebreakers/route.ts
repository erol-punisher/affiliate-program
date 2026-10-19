import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSessionWithFreshToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { suggestIcebreakers } from "@/lib/icebreakers";

export const maxDuration = 60;

// Suggests an AI opening line per lead; the user reviews/edits them before sending.
export async function POST(request: NextRequest) {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI first lines need an ANTHROPIC_API_KEY in the Vercel settings" }, { status: 501 });
  }
  const body = await request.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.leadIds) ? body.leadIds.filter((id: unknown) => typeof id === "string").slice(0, 25) : [];
  if (ids.length === 0) return NextResponse.json({ lines: {} });

  const leads = await prisma.lead.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      name: true,
      country: true,
      followerCount: true,
      socialsUrl: true,
      websiteUrl: true,
      notes: true,
      stage: { select: { pipeline: { select: { name: true } } } },
    },
  });
  try {
    const lines = await suggestIcebreakers(leads.map((l) => ({ ...l, pipeline: l.stage.pipeline.name })));
    return NextResponse.json({ lines });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "The AI service is busy — try again in a minute" }, { status: 429 });
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "The ANTHROPIC_API_KEY in Vercel isn't valid" }, { status: 502 });
    }
    console.error(err);
    return NextResponse.json({ error: "Couldn't generate first lines" }, { status: 500 });
  }
}
