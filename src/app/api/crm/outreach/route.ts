import { NextRequest, NextResponse } from "next/server";
import { getSessionWithFreshToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  OUTREACH_TARGETS_KEY,
  averagePerWeek,
  parseTargets,
  weeklyOutreachStats,
} from "@/lib/outreachStats";

const MAX_WEEKS = 26;

// Weekly outreach numbers (contacted / follow-ups / responded / with interest),
// counted from LeadStageEvent history, plus the editable weekly targets.
export async function GET(request: NextRequest) {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const pipeline = request.nextUrl.searchParams.get("pipeline") || undefined;
  const now = new Date();

  const [events, setting, pipelines] = await Promise.all([
    prisma.leadStageEvent.findMany({
      select: { rootLeadId: true, pipelineName: true, toStageName: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.appSetting.findUnique({ where: { key: OUTREACH_TARGETS_KEY } }),
    prisma.pipeline.findMany({ select: { name: true }, orderBy: { order: "asc" } }),
  ]);

  const trackingSince = events[0]?.createdAt ?? now;
  const earliestShown = new Date(now.getTime() - (MAX_WEEKS - 1) * 7 * 24 * 60 * 60 * 1000);
  const from = trackingSince > earliestShown ? trackingSince : earliestShown;
  const weeks = weeklyOutreachStats(events, from, now, pipeline);

  // Averages leave out the current, still-running week so it doesn't drag them down.
  const completed = weeks.slice(1);
  const last4 = completed.slice(0, 4);
  const averages = {
    last4: {
      contacted: averagePerWeek(last4, "contacted"),
      responded: averagePerWeek(last4, "responded"),
      interested: averagePerWeek(last4, "interested"),
    },
    allTime: {
      contacted: averagePerWeek(completed, "contacted"),
      responded: averagePerWeek(completed, "responded"),
      interested: averagePerWeek(completed, "interested"),
    },
  };

  return NextResponse.json({
    weeks,
    averages,
    targets: parseTargets(setting?.value),
    targetsUpdatedBy: setting?.updatedBy ?? null,
    trackingSince: trackingSince.toISOString(),
    pipelines: Array.from(new Set(pipelines.map((p) => p.name))),
  });
}

export async function PUT(request: NextRequest) {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const targets = parseTargets(JSON.stringify(body?.targets ?? {}));
  await prisma.appSetting.upsert({
    where: { key: OUTREACH_TARGETS_KEY },
    update: { value: JSON.stringify(targets), updatedBy: session.email },
    create: { key: OUTREACH_TARGETS_KEY, value: JSON.stringify(targets), updatedBy: session.email },
  });
  return NextResponse.json({ targets });
}
