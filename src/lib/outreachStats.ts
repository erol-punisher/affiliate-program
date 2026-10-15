import type { Prisma } from "@/generated/prisma/client";

const DAY_MS = 24 * 60 * 60 * 1000;

export type OutreachTargets = {
  contacted: number;
  responded: number;
  interested: number;
};

export const DEFAULT_OUTREACH_TARGETS: OutreachTargets = { contacted: 25, responded: 3, interested: 2 };
export const OUTREACH_TARGETS_KEY = "outreachTargets";

export type StageEventLite = {
  rootLeadId: string;
  pipelineName: string;
  toStageName: string;
  createdAt: Date;
};

export type WeekStats = {
  weekStart: string; // YYYY-MM-DD, Monday (UTC)
  contacted: number; // first touch: moved into "Contacted"
  followUps: number; // moved into "Contacted (2)" / "Contacted (3)"
  responded: number; // moved into any "Responded…" stage
  interested: number; // moved into "Responded with Interest" (incl. "- For a Fee")
};

type Kind = "contacted" | "followUp" | "responded" | "interested";

/** Which weekly bucket(s) moving into a stage counts towards, by stage name. */
export function classifyStage(stageName: string): Kind[] {
  const name = stageName.trim().toLowerCase();
  if (name === "contacted") return ["contacted"];
  if (/^contacted \(\d+\)$/.test(name)) return ["followUp"];
  if (name.startsWith("responded with interest")) return ["responded", "interested"];
  if (name.startsWith("responded")) return ["responded"];
  return [];
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
    for (const kind of classifyStage(e.toStageName)) {
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
      followUps: count(week, "followUp"),
      responded: count(week, "responded"),
      interested: count(week, "interested"),
    });
  }
  return weeks;
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
    return { contacted: pick("contacted"), responded: pick("responded"), interested: pick("interested") };
  } catch {
    return DEFAULT_OUTREACH_TARGETS;
  }
}

/**
 * Records that `leadId` entered `toStageId` (from `fromStageName`, or null for a
 * newly created lead). Call inside the same transaction as the stage change.
 */
export async function recordStageEvent(
  db: Prisma.TransactionClient,
  args: { leadId: string; toStageId: string; fromStageName: string | null; actor: string | null },
) {
  const [lead, stage] = await Promise.all([
    db.lead.findUnique({ where: { id: args.leadId }, select: { sourceLeadId: true } }),
    db.stage.findUnique({ where: { id: args.toStageId }, select: { name: true, pipeline: { select: { name: true } } } }),
  ]);
  if (!lead || !stage) return;
  await db.leadStageEvent.create({
    data: {
      leadId: args.leadId,
      rootLeadId: lead.sourceLeadId ?? args.leadId,
      pipelineName: stage.pipeline.name,
      fromStageName: args.fromStageName,
      toStageName: stage.name,
      actor: args.actor,
    },
  });
}
