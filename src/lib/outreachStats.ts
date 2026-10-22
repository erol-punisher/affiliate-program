import type { Prisma } from "@/generated/prisma/client";
import { mergeChannels, parseChannels, type OutreachChannel } from "@/lib/outreachChannels";

const DAY_MS = 24 * 60 * 60 * 1000;

export type OutreachTargets = {
  contacted: number;
  responded: number;
};

// Only the responded-with-interest target is shown; contacted is reported without one.
export const DEFAULT_OUTREACH_TARGETS: OutreachTargets = { contacted: 20, responded: 2 };
export const OUTREACH_TARGETS_KEY = "outreachTargets";

export type StageEventLite = {
  rootLeadId: string;
  pipelineName: string;
  toStageName: string;
  createdAt: Date;
  kind?: string; // "stage" (default) | "touch"
  channels?: string[];
};

export type WeekStats = {
  weekStart: string; // YYYY-MM-DD, Monday (UTC)
  contacted: number; // reached out to: moved into "Contacted", "Contacted (2)", "Contacted (3)", …
  responded: number; // moved into a "Responded with Interest…" stage
};

type Kind = "contacted" | "responded";

/** Which weekly bucket(s) moving into a stage counts towards, by stage name. */
export function classifyStage(stageName: string): Kind[] {
  const name = stageName.trim().toLowerCase();
  if (name === "contacted" || /^contacted \(\d+\)$/.test(name)) return ["contacted"];
  if (name.startsWith("responded with interest")) return ["responded"];
  return [];
}

/** Which weekly bucket(s) an event counts towards: a logged DM ("touch") always counts as contacted. */
export function classifyEvent(e: Pick<StageEventLite, "toStageName" | "kind">): Kind[] {
  return e.kind === "touch" ? ["contacted"] : classifyStage(e.toStageName);
}

/** Monday 00:00 UTC of the week containing `date`. */
export function weekStart(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const daysSinceMonday = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - daysSinceMonday * DAY_MS);
}

/**
 * Buckets stage events into Monday-based weeks, newest first, covering every
 * week from `from` to `now`. A lead and its mirrored copies share a rootLeadId,
 * so each affiliate counts at most once per bucket per week.
 */
export function weeklyOutreachStats(events: StageEventLite[], from: Date, now: Date, pipelineName?: string): WeekStats[] {
  const seen = new Map<string, Set<string>>(); // `${week}|${kind}` -> rootLeadIds
  for (const e of events) {
    if (pipelineName && e.pipelineName !== pipelineName) continue;
    const week = weekStart(e.createdAt).toISOString().slice(0, 10);
    for (const kind of classifyEvent(e)) {
      const key = `${week}|${kind}`;
      if (!seen.has(key)) seen.set(key, new Set());
      seen.get(key)!.add(e.rootLeadId);
    }
  }
  const count = (week: string, kind: Kind) => seen.get(`${week}|${kind}`)?.size ?? 0;

  const weeks: WeekStats[] = [];
  for (let w = weekStart(now); w.getTime() >= weekStart(from).getTime(); w = new Date(w.getTime() - 7 * DAY_MS)) {
    const week = w.toISOString().slice(0, 10);
    weeks.push({
      weekStart: week,
      contacted: count(week, "contacted"),
      responded: count(week, "responded"),
    });
  }
  return weeks;
}

/** rootLeadIds contacted (first contact or follow-up) per week, keyed by Monday (YYYY-MM-DD). */
export function contactedLeadIdsByWeek(events: StageEventLite[], pipelineName?: string): Map<string, Set<string>> {
  const byWeek = new Map<string, Set<string>>();
  for (const e of events) {
    if (pipelineName && e.pipelineName !== pipelineName) continue;
    if (!classifyEvent(e).includes("contacted")) continue;
    const week = weekStart(e.createdAt).toISOString().slice(0, 10);
    if (!byWeek.has(week)) byWeek.set(week, new Set());
    byWeek.get(week)!.add(e.rootLeadId);
  }
  return byWeek;
}

export type ChannelCounts = Record<OutreachChannel | "untagged", number>;

/**
 * For each week: how many affiliates were contacted on each channel (one affiliate on two
 * channels counts in both, so these can add up to more than the contacted total), plus the
 * channels each affiliate was contacted on that week.
 */
export function contactedChannelsByWeek(
  events: StageEventLite[],
  pipelineName?: string,
): Map<string, { counts: ChannelCounts; byLead: Map<string, OutreachChannel[]> }> {
  const raw = new Map<string, Map<string, string[]>>(); // week -> rootLeadId -> channels
  for (const e of events) {
    if (pipelineName && e.pipelineName !== pipelineName) continue;
    if (!classifyEvent(e).includes("contacted")) continue;
    const week = weekStart(e.createdAt).toISOString().slice(0, 10);
    if (!raw.has(week)) raw.set(week, new Map());
    const leads = raw.get(week)!;
    leads.set(e.rootLeadId, [...(leads.get(e.rootLeadId) ?? []), ...(e.channels ?? [])]);
  }
  const out = new Map<string, { counts: ChannelCounts; byLead: Map<string, OutreachChannel[]> }>();
  for (const [week, leads] of raw) {
    const counts: ChannelCounts = { email: 0, instagram: 0, linkedin: 0, whatsapp: 0, other: 0, untagged: 0 };
    const byLead = new Map<string, OutreachChannel[]>();
    for (const [id, list] of leads) {
      const channels = mergeChannels(list);
      byLead.set(id, channels);
      if (channels.length === 0) counts.untagged++;
      for (const c of channels) counts[c]++;
    }
    out.set(week, { counts, byLead });
  }
  return out;
}

/**
 * For each week: the affiliates who responded with interest, with the channel(s) they responded
 * on. A move into a Responded with Interest stage keeps that in its `channels`.
 */
export function respondedChannelsByWeek(events: StageEventLite[], pipelineName?: string): Map<string, Map<string, OutreachChannel[]>> {
  const out = new Map<string, Map<string, OutreachChannel[]>>(); // week -> rootLeadId -> channels
  for (const e of events) {
    if (pipelineName && e.pipelineName !== pipelineName) continue;
    if (!classifyEvent(e).includes("responded")) continue;
    const week = weekStart(e.createdAt).toISOString().slice(0, 10);
    if (!out.has(week)) out.set(week, new Map());
    const leads = out.get(week)!;
    leads.set(e.rootLeadId, mergeChannels(leads.get(e.rootLeadId) ?? [], e.channels ?? []));
  }
  return out;
}

/** Sets which channel(s) an affiliate responded with interest on: their latest move into Responded with Interest. */
export async function setResponseChannels(db: Prisma.TransactionClient, rootLeadId: string, channels: OutreachChannel[]): Promise<boolean> {
  const events = await db.leadStageEvent.findMany({
    where: { rootLeadId, kind: "stage" },
    orderBy: { createdAt: "desc" },
    select: { id: true, toStageName: true, kind: true },
  });
  const latest = events.find((e) => classifyEvent(e).includes("responded"));
  if (!latest) return false;
  await db.leadStageEvent.update({ where: { id: latest.id }, data: { channels } });
  await syncLeadChannels(db, [rootLeadId]);
  return true;
}

/** Average per week over the given weeks (rounded to 1 decimal), or null if there are none. */
export function averagePerWeek(weeks: WeekStats[], field: keyof Omit<WeekStats, "weekStart">): number | null {
  if (weeks.length === 0) return null;
  return Math.round((weeks.reduce((sum, w) => sum + w[field], 0) / weeks.length) * 10) / 10;
}

export function parseTargets(value: string | null | undefined): OutreachTargets {
  try {
    const parsed = value ? JSON.parse(value) : {};
    const pick = (k: keyof OutreachTargets) =>
      Number.isFinite(parsed?.[k]) && parsed[k] >= 0 ? Math.round(parsed[k]) : DEFAULT_OUTREACH_TARGETS[k];
    return { contacted: pick("contacted"), responded: pick("responded") };
  } catch {
    return DEFAULT_OUTREACH_TARGETS;
  }
}

// A move into a Contacted stage this soon after a dashboard email is flagged as following that email
// (the send itself is already logged as an email reach-out, so the move isn't tagged email again).
const EMAIL_TAG_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

async function emailedRecently(db: Prisma.TransactionClient, rootLeadId: string): Promise<boolean> {
  const send = await db.emailSend.findFirst({
    where: { leadId: rootLeadId, sentAt: { gte: new Date(Date.now() - EMAIL_TAG_WINDOW_MS) } },
    select: { id: true },
  });
  return send !== null;
}

/**
 * Records that `leadId` entered `toStageId` (from `fromStageName`, or null for a
 * newly created lead). Call inside the same transaction as the stage change.
 * A move into a Contacted stage gets the given channels; `emailed` says whether
 * the affiliate was emailed from the dashboard in the last few days.
 */
export async function recordStageEvent(
  db: Prisma.TransactionClient,
  args: { leadId: string; toStageId: string; fromStageName: string | null; actor: string | null; channels?: OutreachChannel[] },
): Promise<{ id: string; contacted: boolean; channels: OutreachChannel[]; emailed: boolean } | null> {
  const [lead, stage] = await Promise.all([
    db.lead.findUnique({ where: { id: args.leadId }, select: { sourceLeadId: true } }),
    db.stage.findUnique({ where: { id: args.toStageId }, select: { name: true, pipeline: { select: { name: true } } } }),
  ]);
  if (!lead || !stage) return null;
  const rootLeadId = lead.sourceLeadId ?? args.leadId;
  const contacted = classifyStage(stage.name).includes("contacted");
  const channels = contacted ? mergeChannels(args.channels ?? []) : [];
  const emailed = contacted && args.fromStageName !== null && (await emailedRecently(db, rootLeadId));
  const event = await db.leadStageEvent.create({
    data: {
      leadId: args.leadId,
      rootLeadId,
      pipelineName: stage.pipeline.name,
      fromStageName: args.fromStageName,
      toStageName: stage.name,
      actor: args.actor,
      channels,
    },
    select: { id: true },
  });
  if (channels.length > 0) await syncLeadChannels(db, [rootLeadId]);
  return { id: event.id, contacted, channels, emailed };
}

/** Logs a DM (or other reach-out) that didn't change the lead's stage. Counts as contacted that week. */
export async function recordTouch(
  db: Prisma.TransactionClient,
  args: { leadId: string; channels: OutreachChannel[]; actor: string },
): Promise<{ id: string } | null> {
  const lead = await db.lead.findUnique({
    where: { id: args.leadId },
    select: { sourceLeadId: true, stage: { select: { name: true, pipeline: { select: { name: true } } } } },
  });
  if (!lead) return null;
  const rootLeadId = lead.sourceLeadId ?? args.leadId;
  const event = await db.leadStageEvent.create({
    data: {
      leadId: args.leadId,
      rootLeadId,
      pipelineName: lead.stage.pipeline.name,
      fromStageName: lead.stage.name,
      toStageName: lead.stage.name,
      actor: args.actor,
      kind: "touch",
      channels: args.channels,
    },
    select: { id: true },
  });
  await syncLeadChannels(db, [rootLeadId]);
  return event;
}

/** Sets the channels of outreach events (moves into Contacted, or touches) and refreshes their leads. */
export async function setEventChannels(db: Prisma.TransactionClient, eventIds: string[], channels: OutreachChannel[]): Promise<number> {
  const events = await db.leadStageEvent.findMany({
    where: { id: { in: eventIds } },
    select: { id: true, rootLeadId: true, toStageName: true, kind: true },
  });
  const outreach = events.filter((e) => classifyEvent(e).includes("contacted"));
  if (outreach.length === 0) return 0;
  await db.leadStageEvent.updateMany({ where: { id: { in: outreach.map((e) => e.id) } }, data: { channels } });
  await syncLeadChannels(db, Array.from(new Set(outreach.map((e) => e.rootLeadId))));
  return outreach.length;
}

/** Recomputes each affiliate's outreachChannels from its events, on the original and every copy. */
export async function syncLeadChannels(db: Prisma.TransactionClient, rootLeadIds: string[]) {
  for (const rootLeadId of rootLeadIds) {
    const events = await db.leadStageEvent.findMany({ where: { rootLeadId }, select: { channels: true } });
    const channels = parseChannels(events.flatMap((e) => e.channels));
    await db.lead.updateMany({
      where: { OR: [{ id: rootLeadId }, { sourceLeadId: rootLeadId }] },
      data: { outreachChannels: channels },
    });
  }
}
