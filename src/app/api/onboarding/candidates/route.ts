import { NextRequest, NextResponse } from "next/server";
import { getSessionWithFreshToken } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  // Filtering in JS rather than a SQL `contains`: SQLite's LIKE is only case-insensitive for
  // ASCII a-z, so a `contains` query would silently fail to match accented names ("chávez" vs
  // "Chávez") — common in this affiliate list — while looking like an exact-substring bug.
  const candidates = await prisma.affiliate.findMany({
    where: { onboardingSteps: { none: {} } },
    select: { id: true, name: true, tier: true, status: true },
    orderBy: { name: "asc" },
  });

  const needle = q.toLocaleLowerCase();
  const matches = q ? candidates.filter((a) => a.name.toLocaleLowerCase().includes(needle)) : candidates;

  return NextResponse.json({ affiliates: matches.slice(0, 20) });
}
