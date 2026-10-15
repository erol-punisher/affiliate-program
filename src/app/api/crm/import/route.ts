import { NextRequest, NextResponse } from "next/server";
import { getSessionWithFreshToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseImportCsv, type ImportRow } from "@/lib/crmImport";

type ExistingLead = {
  id: string;
  email: string | null;
  notes: string | null;
  username: string | null;
  country: string | null;
  whatsapp: string | null;
  followerCount: number | null;
  websiteUrl: string | null;
  referralLink: string | null;
  socialsUrl: string | null;
  affiliateManager: string | null;
  owner: string | null;
  closingDate: Date | null;
  dateOfReachOut: Date | null;
};

type PreloadedStage = { id: string; order: number; maxLeadOrder: number };
type PreloadedPipeline = {
  id: string;
  stages: Map<string, PreloadedStage>;
  leadsByName: Map<string, ExistingLead>;
  maxStageOrder: number;
};
type PreloadedGroup = { id: string; pipelines: Map<string, PreloadedPipeline>; maxPipelineOrder: number };

type RowResult = {
  rowNumber: number;
  name: string;
  groupName: string;
  pipelineName: string;
  stageName: string;
  action: "create" | "update";
  groupCreated: boolean;
  pipelineCreated: boolean;
  stageCreated: boolean;
};

const norm = (s: string) => s.trim().toLowerCase();

/** Fills in only fields the existing lead doesn't already have — a re-import should never clobber data entered since the last import. */
function buildFillBlanksData(existing: ExistingLead, row: ImportRow) {
  const data: Record<string, string | number | Date> = {};
  const maybeSet = (field: keyof ExistingLead, value: string | number | null) => {
    if (value !== null && (existing[field] === null || existing[field] === "")) {
      data[field] = value;
    }
  };
  maybeSet("email", row.email);
  maybeSet("notes", row.notes);
  maybeSet("username", row.username);
  maybeSet("country", row.country);
  maybeSet("whatsapp", row.whatsapp);
  maybeSet("followerCount", row.followerCount);
  maybeSet("websiteUrl", row.websiteUrl);
  maybeSet("referralLink", row.referralLink);
  maybeSet("socialsUrl", row.socialsUrl);
  maybeSet("affiliateManager", row.affiliateManager);
  maybeSet("owner", row.owner);
  if (row.closingDate && !existing.closingDate) {
    data.closingDate = new Date(row.closingDate);
  }
  if (row.dateOfReachOut && !existing.dateOfReachOut) {
    data.dateOfReachOut = new Date(row.dateOfReachOut);
  }
  return data;
}

async function runImport(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], rows: ImportRow[], actor: string) {
  const groups = await tx.pipelineGroup.findMany({
    include: { pipelines: { include: { stages: { include: { leads: true } } } } },
  });

  const groupMap = new Map<string, PreloadedGroup>();
  let maxGroupOrder = -1;

  for (const g of groups) {
    maxGroupOrder = Math.max(maxGroupOrder, g.order);
    const pipelines = new Map<string, PreloadedPipeline>();
    let maxPipelineOrder = -1;

    for (const p of g.pipelines) {
      maxPipelineOrder = Math.max(maxPipelineOrder, p.order);
      const stages = new Map<string, PreloadedStage>();
      const leadsByName = new Map<string, ExistingLead>();
      let maxStageOrder = -1;

      for (const s of p.stages) {
        maxStageOrder = Math.max(maxStageOrder, s.order);
        let maxLeadOrder = -1;
        for (const l of s.leads) {
          maxLeadOrder = Math.max(maxLeadOrder, l.order);
          leadsByName.set(norm(l.name), l);
        }
        stages.set(norm(s.name), { id: s.id, order: s.order, maxLeadOrder });
      }
      pipelines.set(norm(p.name), { id: p.id, stages, leadsByName, maxStageOrder });
    }
    groupMap.set(norm(g.name), { id: g.id, pipelines, maxPipelineOrder });
  }

  const results: RowResult[] = [];
  const summary = { created: 0, updated: 0, newGroups: 0, newPipelines: 0, newStages: 0 };

  for (const row of rows) {
    const groupKey = norm(row.groupName);
    let group = groupMap.get(groupKey);
    let groupCreated = false;
    if (!group) {
      const created = await tx.pipelineGroup.create({ data: { name: row.groupName.trim(), order: ++maxGroupOrder } });
      group = { id: created.id, pipelines: new Map(), maxPipelineOrder: -1 };
      groupMap.set(groupKey, group);
      groupCreated = true;
      summary.newGroups++;
    }

    const pipelineKey = norm(row.pipelineName);
    let pipeline = group.pipelines.get(pipelineKey);
    let pipelineCreated = false;
    if (!pipeline) {
      const created = await tx.pipeline.create({
        data: { name: row.pipelineName.trim(), order: ++group.maxPipelineOrder, pipelineGroupId: group.id },
      });
      pipeline = { id: created.id, stages: new Map(), leadsByName: new Map(), maxStageOrder: -1 };
      group.pipelines.set(pipelineKey, pipeline);
      pipelineCreated = true;
      summary.newPipelines++;
    }

    const stageKey = norm(row.stageName);
    let stage = pipeline.stages.get(stageKey);
    let stageCreated = false;
    if (!stage) {
      const created = await tx.stage.create({
        data: { name: row.stageName.trim(), order: ++pipeline.maxStageOrder, pipelineId: pipeline.id },
      });
      stage = { id: created.id, order: created.order, maxLeadOrder: -1 };
      pipeline.stages.set(stageKey, stage);
      stageCreated = true;
      summary.newStages++;
    }

    const nameKey = norm(row.name);
    const existingLead = pipeline.leadsByName.get(nameKey);

    if (existingLead) {
      const data = buildFillBlanksData(existingLead, row);
      if (Object.keys(data).length > 0) {
        await tx.lead.update({ where: { id: existingLead.id }, data });
      }
      summary.updated++;
      results.push({
        rowNumber: row.rowNumber,
        name: row.name,
        groupName: row.groupName,
        pipelineName: row.pipelineName,
        stageName: row.stageName,
        action: "update",
        groupCreated,
        pipelineCreated,
        stageCreated,
      });
    } else {
      const created = await tx.lead.create({
        data: {
          stageId: stage.id,
          name: row.name,
          order: ++stage.maxLeadOrder,
          email: row.email,
          notes: row.notes,
          username: row.username,
          country: row.country,
          whatsapp: row.whatsapp,
          followerCount: row.followerCount,
          websiteUrl: row.websiteUrl,
          referralLink: row.referralLink,
          socialsUrl: row.socialsUrl,
          affiliateManager: row.affiliateManager,
          owner: row.owner,
          closingDate: row.closingDate ? new Date(row.closingDate) : null,
          dateOfReachOut: row.dateOfReachOut ? new Date(row.dateOfReachOut) : null,
        },
      });
      // Stage history for the weekly outreach numbers (names as given in the import row).
      await tx.leadStageEvent.create({
        data: {
          leadId: created.id,
          rootLeadId: created.id,
          pipelineName: row.pipelineName.trim(),
          fromStageName: null,
          toStageName: row.stageName.trim(),
          actor,
        },
      });
      pipeline.leadsByName.set(nameKey, created);
      summary.created++;
      results.push({
        rowNumber: row.rowNumber,
        name: row.name,
        groupName: row.groupName,
        pipelineName: row.pipelineName,
        stageName: row.stageName,
        action: "create",
        groupCreated,
        pipelineCreated,
        stageCreated,
      });
    }
  }

  return { results, summary };
}

export async function POST(request: NextRequest) {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const csv = typeof body?.csv === "string" ? body.csv : "";
  const commit = body?.commit === true;

  if (!csv) {
    return NextResponse.json({ error: "csv is required" }, { status: 400 });
  }

  const { rows, errors } = parseImportCsv(csv);

  if (rows.length === 0) {
    return NextResponse.json({
      errors,
      results: [],
      summary: { created: 0, updated: 0, newGroups: 0, newPipelines: 0, newStages: 0 },
      committed: false,
    });
  }

  type Outcome = Awaited<ReturnType<typeof runImport>>;

  class DryRunAbort extends Error {
    constructor(public outcome: Outcome) {
      super("dry run — rolled back");
    }
  }

  let outcome: Outcome;

  if (commit) {
    outcome = await prisma.$transaction((tx) => runImport(tx, rows, session.email));
  } else {
    try {
      await prisma.$transaction(async (tx) => {
        throw new DryRunAbort(await runImport(tx, rows, session.email));
      });
      throw new Error("unreachable");
    } catch (err) {
      if (!(err instanceof DryRunAbort)) throw err;
      outcome = err.outcome;
    }
  }

  return NextResponse.json({ errors, results: outcome.results, summary: outcome.summary, committed: commit });
}
