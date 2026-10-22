import { NextRequest, NextResponse } from "next/server";
import { getSessionWithFreshToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  OUTREACH_TARGETS_KEY,
  averagePerWeek,
  contactedChannelsByWeek,
  contactedLeadIdsByWeek,
  parseTargets,
  respondedChannelsByWeek,
  weeklyOutreachStats,
} from "@/lib/outreachStats";

const MAX_WEEKS = 26;
// Weekly reporting starts with the week of Oct 12, 2026; earlier history is
// patchy (backfilled from reach-out dates), so it's kept but not shown.
const REPORTING_START = new Date("2026-10-12T00:00:00Z");

// Weekly outreach numbers (contacted incl. follow-ups and logged DMs / responded, with channels),
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
      select: { rootLeadId: true, pipelineName: true, toStageName: true, createdAt: true, kind: true, channels: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.appSetting.findUnique({ where: { key: OUTREACH_TARGETS_KEY } }),
    prisma.pipeline.findMany({ select: { name: true }, orderBy: { order: "asc" } }),
  ]);

  const trackingSince = REPORTING_START;
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
    },
    allTime: {
      contacted: averagePerWeek(completed, "contacted"),
      responded: averagePerWeek(completed, "responded"),
    },
  };

  // Who was reached out to in each shown week: Name (Country) - pipeline - owner.
  const shownWeeks = new Set(weeks.map((w) => w.weekStart));
  const idsByWeek = contactedLeadIdsByWeek(events, pipeline);
  const channelsByWeek = contactedChannelsByWeek(events, pipeline);
  const respondedByWeek = respondedChannelsByWeek(events, pipeline);
  const ids = new Set<string>();
  for (const [week, set] of idsByWeek) if (shownWeeks.has(week)) set.forEach((id) => ids.add(id));
  for (const [week, map] of respondedByWeek) if (shownWeeks.has(week)) map.forEach((_c, id) => ids.add(id));
  const leads = await prisma.lead.findMany({
    where: { id: { in: Array.from(ids) } },
    select: { id: true, name: true, country: true, owner: true, stage: { select: { pipeline: { select: { name: true } } } } },
  });
  const leadById = new Map(leads.map((l) => [l.id, l]));
  type ContactedLead = { id: string; name: string; country: string | null; pipeline: string; owner: string | null; channels: string[] };
  const contactedByWeek: Record<string, ContactedLead[]> = {};
  // Who responded with interest each week, with the channel(s) they responded on.
  const respondedLeadsByWeek: Record<string, ContactedLead[]> = {};
  const channelCounts: Record<string, Record<string, number>> = {};
  for (const week of shownWeeks) {
    const channels = channelsByWeek.get(week);
    if (channels) channelCounts[week] = channels.counts;
    contactedByWeek[week] = Array.from(idsByWeek.get(week) ?? [])
      .map((id) => leadById.get(id))
      .filter((l) => l !== undefined)
      .map((l) => ({
        id: l.id,
        name: l.name,
        country: l.country,
        pipeline: l.stage.pipeline.name,
        owner: l.owner,
        channels: channels?.byLead.get(l.id) ?? [],
      }))
      .sort((a, b) => a.pipeline.localeCompare(b.pipeline) || a.name.localeCompare(b.name));
    const responded = respondedByWeek.get(week);
    respondedLeadsByWeek[week] = Array.from(responded?.keys() ?? [])
      .map((id) => leadById.get(id))
      .filter((l) => l !== undefined)
      .map((l) => ({
        id: l.id,
        name: l.name,
        country: l.country,
        pipeline: l.stage.pipeline.name,
        owner: l.owner,
        channels: responded?.get(l.id) ?? [],
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  return NextResponse.json({
    weeks,
    contactedByWeek,
    respondedByWeek: respondedLeadsByWeek,
    channelCounts,
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
