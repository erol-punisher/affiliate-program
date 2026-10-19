import { NextRequest, NextResponse, after } from "next/server";
import { getSessionWithFreshToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { moveLeadWithCopies } from "@/lib/crmMoves";
import { recordStageEvent } from "@/lib/outreachStats";
import { relabelLeadThreads } from "@/lib/emailOutreach";

const MAX_LEADS = 200;

// Moves the given cards to a stage of their pipeline: { leadIds, stageId }. Each affiliate is
// moved once, together with its mirrored copies (same-named stage in each copy's pipeline).
export async function POST(request: NextRequest) {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const leadIds: string[] = Array.isArray(body?.leadIds) ? body.leadIds.filter((id: unknown) => typeof id === "string").slice(0, MAX_LEADS) : [];
  const stageId = typeof body?.stageId === "string" ? body.stageId : "";
  const stage = stageId ? await prisma.stage.findUnique({ where: { id: stageId }, select: { id: true, name: true, pipelineId: true } }) : null;
  if (!stage || leadIds.length === 0) {
    return NextResponse.json({ error: "Pick the leads and a stage" }, { status: 400 });
  }

  const cards = await prisma.lead.findMany({
    where: { id: { in: leadIds }, stage: { pipelineId: stage.pipelineId } },
    select: { id: true, sourceLeadId: true, stageId: true, stage: { select: { name: true } } },
  });

  const roots = new Set<string>();
  let moved = 0;
  for (const card of cards) {
    const rootId = card.sourceLeadId ?? card.id;
    if (roots.has(rootId)) continue;
    roots.add(rootId);
    await prisma.$transaction(async (tx) => {
      // Moving the original carries every copy (including this card, if it is one) along.
      const viaRoot = await moveLeadWithCopies(tx, rootId, stage.name, session.email);
      const now = await tx.lead.findUnique({ where: { id: card.id }, select: { stageId: true } });
      if (now && now.stageId !== stage.id) {
        // The original's pipeline has no stage with this name: move just this card.
        const order = ((await tx.lead.aggregate({ where: { stageId: stage.id }, _max: { order: true } }))._max.order ?? -1) + 1;
        await tx.lead.update({ where: { id: card.id }, data: { stageId: stage.id, order } });
        if (!viaRoot) await recordStageEvent(tx, { leadId: card.id, toStageId: stage.id, fromStageName: card.stage.name, actor: session.email });
        moved++;
      } else if (viaRoot || card.stageId !== stage.id) {
        moved++;
      }
    });
  }

  after(async () => {
    for (const rootId of roots) await relabelLeadThreads(rootId).catch((err) => console.error("relabel failed", rootId, err));
  });
  return NextResponse.json({ moved, stageName: stage.name });
}
