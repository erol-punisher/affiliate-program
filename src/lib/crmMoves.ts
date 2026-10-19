import type { Prisma } from "@/generated/prisma/client";
import { recordStageEvent } from "@/lib/outreachStats";

/** The stage a lead moves to after being reached out to again, or null if it shouldn't move. */
export function nextOutreachStage(stageName: string): string | null {
  const name = stageName.trim().toLowerCase();
  if (name.startsWith("affiliates in the pipeline")) return "Contacted";
  if (name === "contacted") return "Contacted (2)";
  if (name === "contacted (2)") return "Contacted (3)";
  return null;
}

/** Whether a reply from a lead in this stage should move them to "Responded with Interest". */
export function movesOnReply(stageName: string): boolean {
  const name = stageName.trim().toLowerCase();
  return name.startsWith("affiliates in the pipeline") || name === "contacted" || /^contacted \(\d+\)$/.test(name);
}

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
  await recordStageEvent(tx, { leadId, toStageId: target.id, fromStageName: lead.stage.name, actor });

  for (const copy of lead.copies) {
    const copyStage = await tx.stage.findFirst({
      where: { pipelineId: copy.stage.pipelineId, name: { equals: target.name, mode: "insensitive" } },
      select: { id: true },
    });
    if (copyStage) await tx.lead.update({ where: { id: copy.id }, data: { stageId: copyStage.id, order: await order(copyStage.id) } });
  }
  return { ...target, pipelineName: lead.stage.pipeline.name };
}
