import type { Prisma } from "@/generated/prisma/client";
import { recordStageEvent } from "@/lib/outreachStats";

export { movesOnReply, nextOutreachStage } from "@/lib/outreachStages";

/**
 * Moves an original lead to the stage named `toStageName` in its own pipeline,
 * moves its mirrored copies to the same-named stage in their pipelines, and
 * records the stage change. Returns the new stage, or null if the pipeline has
 * no stage with that name.
 */
export async function moveLeadWithCopies(
  tx: Prisma.TransactionClient,
  leadId: string,
  toStageName: string,
  actor: string,
  opts: { record?: boolean } = {},
): Promise<{ id: string; name: string; pipelineName: string } | null> {
  const lead = await tx.lead.findUnique({
    where: { id: leadId },
    select: {
      stageId: true,
      stage: { select: { name: true, pipelineId: true, pipeline: { select: { name: true } } } },
      copies: { select: { id: true, stage: { select: { pipelineId: true } } } },
    },
  });
  if (!lead) return null;
  const target = await tx.stage.findFirst({
    where: { pipelineId: lead.stage.pipelineId, name: { equals: toStageName, mode: "insensitive" } },
    select: { id: true, name: true },
  });
  if (!target || target.id === lead.stageId) return null;

  const order = async (stageId: string) =>
    ((await tx.lead.aggregate({ where: { stageId }, _max: { order: true } }))._max.order ?? -1) + 1;

  await tx.lead.update({ where: { id: leadId }, data: { stageId: target.id, order: await order(target.id) } });
  if (opts.record !== false) await recordStageEvent(tx, { leadId, toStageId: target.id, fromStageName: lead.stage.name, actor });

  for (const copy of lead.copies) {
    const copyStage = await tx.stage.findFirst({
      where: { pipelineId: copy.stage.pipelineId, name: { equals: target.name, mode: "insensitive" } },
      select: { id: true },
    });
    if (copyStage) await tx.lead.update({ where: { id: copy.id }, data: { stageId: copyStage.id, order: await order(copyStage.id) } });
  }
  return { ...target, pipelineName: lead.stage.pipeline.name };
}

/**
 * Undoes the automatic "moved on reply" for a lead (e.g. the reply was an
 * out-of-office or from the wrong person): moves it (and copies) back to the
 * stage it came from and deletes that stage event so weekly stats don't count it.
 */
export async function revertReplyMove(tx: Prisma.TransactionClient, leadId: string): Promise<boolean> {
  const event = await tx.leadStageEvent.findFirst({
    where: { rootLeadId: leadId, actor: { startsWith: "gmail-reply" } },
    orderBy: { createdAt: "desc" },
  });
  if (!event?.fromStageName) return false;
  await moveLeadWithCopies(tx, leadId, event.fromStageName, "revert", { record: false });
  await tx.leadStageEvent.delete({ where: { id: event.id } });
  return true;
}
