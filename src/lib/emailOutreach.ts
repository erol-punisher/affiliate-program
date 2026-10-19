import { prisma } from "@/lib/db";
import { crmLabelName, firstReplyAt, gmailAccessToken, sendGmail, setThreadCrmLabel } from "@/lib/gmail";
import { movesOnReply, moveLeadWithCopies, nextOutreachStage } from "@/lib/crmMoves";
import { renderTemplate } from "@/lib/emailTemplate";

export const MAX_EMAILS_PER_SEND = 25;
const GAP_BETWEEN_SENDS_MS = 1200;
const REPLY_STAGE = "Responded with Interest";

export type SendResult = { leadId: string; name: string; status: "sent" | "skipped" | "failed"; detail?: string };

/**
 * Emails each lead from the sender's Gmail, one by one. A lead who already has a
 * thread from this sender gets the email as a reply in that thread (when
 * `replyInThread`). After sending, the lead moves up one outreach stage (with its
 * copies) and the thread is labelled CRM/<pipeline>/<stage>.
 */
export async function sendOutreachEmails(args: {
  senderEmail: string;
  senderName: string;
  leadIds: string[];
  subject: string;
  body: string;
  replyInThread: boolean;
}): Promise<SendResult[]> {
  const token = await gmailAccessToken(args.senderEmail);
  // Copies resolve to their original so every affiliate is emailed (and moved) once.
  const picked = await prisma.lead.findMany({ where: { id: { in: args.leadIds } }, select: { id: true, sourceLeadId: true } });
  const rootIds = Array.from(new Set(picked.map((l) => l.sourceLeadId ?? l.id))).slice(0, MAX_EMAILS_PER_SEND);

  const results: SendResult[] = [];
  for (const [i, leadId] of rootIds.entries()) {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        name: true,
        email: true,
        country: true,
        username: true,
        followerCount: true,
        websiteUrl: true,
        socialsUrl: true,
        referralLink: true,
        dateOfReachOut: true,
        stage: { select: { name: true, pipeline: { select: { name: true } } } },
      },
    });
    if (!lead) continue;
    const to = lead.email?.trim();
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      results.push({ leadId, name: lead.name, status: "skipped", detail: "No valid email address" });
      continue;
    }
    if (i > 0) await new Promise((r) => setTimeout(r, GAP_BETWEEN_SENDS_MS));

    try {
      const info = { ...lead, pipelineName: lead.stage.pipeline.name, stageName: lead.stage.name };
      const sender = { name: args.senderName, email: args.senderEmail };
      const existing = args.replyInThread
        ? await prisma.emailThread.findFirst({ where: { leadId, ownerEmail: args.senderEmail }, orderBy: { lastSentAt: "desc" } })
        : null;
      const subject = existing ? (existing.subject.startsWith("Re:") ? existing.subject : `Re: ${existing.subject}`) : renderTemplate(args.subject, info, sender);
      const sent = await sendGmail(token, {
        from: args.senderEmail,
        fromName: args.senderName,
        to,
        subject,
        body: renderTemplate(args.body, info, sender),
        threadId: existing?.gmailThreadId,
        inReplyTo: existing?.lastMessageId,
      });

      // Move up one stage (with copies) and remember the thread.
      const next = nextOutreachStage(lead.stage.name);
      const moved = await prisma.$transaction(async (tx) => {
        const target = next ? await moveLeadWithCopies(tx, leadId, next, args.senderEmail) : null;
        if (!lead.dateOfReachOut) await tx.lead.update({ where: { id: leadId }, data: { dateOfReachOut: new Date() } });
        return target;
      });
      const labelName = crmLabelName(lead.stage.pipeline.name, moved?.name ?? lead.stage.name);
      const now = new Date();
      if (existing && existing.gmailThreadId === sent.threadId) {
        await prisma.emailThread.update({
          where: { id: existing.id },
          data: { lastMessageId: sent.messageId, lastSentAt: now, sentCount: { increment: 1 }, labelName },
        });
      } else {
        await prisma.emailThread.create({
          data: { leadId, ownerEmail: args.senderEmail, gmailThreadId: sent.threadId, lastMessageId: sent.messageId, toEmail: to, subject, labelName, lastSentAt: now },
        });
      }
      await setThreadCrmLabel(token, args.senderEmail, sent.threadId, labelName).catch((err) => console.error("label failed", err));
      results.push({ leadId, name: lead.name, status: "sent", detail: moved ? `Moved to ${moved.name}` : undefined });
    } catch (err) {
      console.error("send failed", leadId, err);
      results.push({ leadId, name: lead.name, status: "failed", detail: err instanceof Error ? err.message.slice(0, 200) : "Send failed" });
    }
  }
  return results;
}

/** Re-labels every dashboard thread of a lead to match the lead's current pipeline/stage. */
export async function relabelLeadThreads(leadId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { sourceLeadId: true, stage: { select: { name: true, pipeline: { select: { name: true } } } } },
  });
  if (!lead || lead.sourceLeadId) return; // copies don't own threads
  const threads = await prisma.emailThread.findMany({ where: { leadId } });
  const labelName = crmLabelName(lead.stage.pipeline.name, lead.stage.name);
  for (const t of threads) {
    if (t.labelName === labelName) continue;
    try {
      const token = await gmailAccessToken(t.ownerEmail);
      await setThreadCrmLabel(token, t.ownerEmail, t.gmailThreadId, labelName);
      await prisma.emailThread.update({ where: { id: t.id }, data: { labelName } });
    } catch (err) {
      console.error("relabel failed", t.id, err);
    }
  }
}

/**
 * Checks this mailbox's un-replied dashboard threads for replies. A reply marks
 * the thread and, if the lead is still in an outreach stage, moves them (and
 * their copies) to "Responded with Interest" and relabels the thread.
 */
export async function syncReplies(ownerEmail: string, opts: { maxThreads?: number } = {}): Promise<{ checked: number; replies: number; moved: number }> {
  const token = await gmailAccessToken(ownerEmail);
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const threads = await prisma.emailThread.findMany({
    where: { ownerEmail, repliedAt: null, lastSentAt: { gte: since } },
    orderBy: { lastSentAt: "desc" },
    take: opts.maxThreads ?? 60,
  });
  let replies = 0;
  let moved = 0;
  for (const t of threads) {
    try {
      const repliedAt = await firstReplyAt(token, ownerEmail, t.gmailThreadId);
      if (!repliedAt) continue;
      replies++;
      await prisma.emailThread.update({ where: { id: t.id }, data: { repliedAt } });
      if (!t.leadId) continue;
      const lead = await prisma.lead.findUnique({ where: { id: t.leadId }, select: { stage: { select: { name: true } } } });
      if (lead && movesOnReply(lead.stage.name)) {
        const target = await prisma.$transaction((tx) => moveLeadWithCopies(tx, t.leadId!, REPLY_STAGE, `gmail-reply:${ownerEmail}`));
        if (target) moved++;
      }
      await relabelLeadThreads(t.leadId);
    } catch (err) {
      console.error("reply sync failed", t.id, err);
    }
  }
  await prisma.gmailConnection.update({ where: { email: ownerEmail }, data: { lastSyncAt: new Date() } });
  return { checked: threads.length, replies, moved };
}
