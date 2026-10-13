import { NextResponse } from "next/server";
import { getSessionWithFreshToken } from "@/lib/auth";
import { prisma } from "@/lib/db";

const DAY_MS = 24 * 60 * 60 * 1000;

type LeadLite = {
  id: string;
  sourceLeadId: string | null;
  createdAt: Date;
  updatedAt: Date;
  stage: { id: string; name: string; color: string | null };
};

function outcomeCounts(leads: LeadLite[]) {
  let won = 0;
  let lost = 0;
  let open = 0;
  for (const lead of leads) {
    if (lead.stage.color === "green") won++;
    else if (lead.stage.color === "red") lost++;
    else open++;
  }
  const closed = won + lost;
  return {
    total: leads.length,
    won,
    lost,
    open,
    conversionRate: closed > 0 ? Math.round((won / closed) * 1000) / 10 : null,
    winRate: leads.length > 0 ? Math.round((won / leads.length) * 1000) / 10 : null,
  };
}

function avgDays(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

export async function GET() {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const groups = await prisma.pipelineGroup.findMany({
    orderBy: { order: "asc" },
    include: {
      pipelines: {
        orderBy: { order: "asc" },
        include: {
          stages: {
            orderBy: { order: "asc" },
            include: {
              leads: {
                select: { id: true, sourceLeadId: true, createdAt: true, updatedAt: true },
              },
            },
          },
        },
      },
    },
  });

  const now = new Date();

  const result = groups.map((group) => {
    const allLeadsInGroup: LeadLite[] = [];

    const pipelines = group.pipelines.map((pipeline) => {
      const leads: LeadLite[] = pipeline.stages.flatMap((stage) =>
        stage.leads.map((lead) => ({ ...lead, stage: { id: stage.id, name: stage.name, color: stage.color } })),
      );
      allLeadsInGroup.push(...leads);

      const stages = pipeline.stages.map((stage) => ({
        stageId: stage.id,
        name: stage.name,
        color: stage.color,
        order: stage.order,
        count: stage.leads.length,
      }));

      return { pipelineId: pipeline.id, pipelineName: pipeline.name, stages, ...outcomeCounts(leads) };
    });

    // Dedupe leads mirrored into an overview pipeline (e.g. "Affiliates Standard") so
    // group-level totals count each real affiliate once. The original (sourceLeadId
    // null) wins over its copy when both are present, so createdAt/stage reflect the
    // source of truth rather than the backfill's copy timestamp.
    const uniqueByKey = new Map<string, LeadLite>();
    for (const lead of allLeadsInGroup) {
      const key = lead.sourceLeadId ?? lead.id;
      const existing = uniqueByKey.get(key);
      if (!existing || lead.sourceLeadId === null) uniqueByKey.set(key, lead);
    }
    const uniqueLeads = [...uniqueByKey.values()];

    const openAgeDays = uniqueLeads
      .filter((l) => l.stage.color !== "green" && l.stage.color !== "red")
      .map((l) => Math.floor((now.getTime() - l.createdAt.getTime()) / DAY_MS));

    // Approximate: assumes a won lead's `updatedAt` reflects when it reached that
    // stage. There's no stage-change history yet, so an edit after winning would
    // skew this — treat it as directional, not exact.
    const daysToWin = uniqueLeads
      .filter((l) => l.stage.color === "green")
      .map((l) => Math.floor((l.updatedAt.getTime() - l.createdAt.getTime()) / DAY_MS))
      .filter((d) => d >= 0);

    return {
      groupId: group.id,
      groupName: group.name,
      overview: {
        ...outcomeCounts(uniqueLeads),
        avgOpenAgeDays: avgDays(openAgeDays),
        avgDaysToWinApprox: avgDays(daysToWin),
      },
      pipelines,
    };
  });

  return NextResponse.json({ groups: result });
}
