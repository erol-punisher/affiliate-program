import { prisma } from "@/lib/db";
import { analyzeThread, crmLabelName, gmailAccessToken, sendGmail, setThreadCrmLabel } from "@/lib/gmail";
import { movesOnReply, moveLeadWithCopies, nextOutreachStage, revertReplyMove } from "@/lib/crmMoves";
import { missingVariables, renderTemplate } from "@/lib/emailTemplate";
import {
  TEAMMATE_WINDOW_DAYS,
  findSuppression,
  getEmailSettings,
  suggestReplyCategory,
  suppressEmail,
  type ReplyCategory,
} from "@/lib/emailSafety";

export const MAX_EMAILS_PER_SEND = 25;
const GAP_BETWEEN_SENDS_MS = 1200;
const INTERESTED_STAGE = "Responded with Interest";
const DISINTEREST_STAGE = "Responded with Disinterest";
const DAY_MS = 24 * 60 * 60 * 1000;

export type SendResult = { leadId: string; name: string; status: "sent" | "skipped" | "failed"; detail?: string };

/** Emails sent today (UTC) by this sender, for the daily cap. */
export async function sentTodayCount(ownerEmail: string): Promise<number> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  return prisma.emailSend.count({ where: { ownerEmail, sentAt: { gte: start } } });
}

/**
 * Emails each lead from the sender's Gmail, one by one. Before each send it
 * skips leads that are on the do-not-contact list, were emailed by a teammate
 * recently, or would get a blank {{variable}}; it stops at the daily cap. A lead
 * who already has a thread from this sender gets the email as a reply in that
 * thread (when `replyInThread`). After sending, the lead moves up one outreach
 * stage (with its copies) and the thread is labelled CRM/<pipeline>/<stage>.
 */
export async function sendOutreachEmails(args: {
  senderEmail: string;
  senderName: string;
  leadIds: string[];
  subject: string;
  body: string;
  replyInThread: boolean;
  templateStepId?: string | null;
  icebreakers?: Record<string, string>;
}): Promise<SendResult[]> {
  const token = await gmailAccessToken(args.senderEmail);
  const { dailyCap } = await getEmailSettings();
  let remaining = dailyCap - (await sentTodayCount(args.senderEmail));

  // Copies resolve to their original so every affiliate is emailed (and moved) once.
  const picked = await prisma.lead.findMany({ where: { id: { in: args.leadIds } }, select: { id: true, sourceLeadId: true } });
  const rootOf = new Map(picked.map((l) => [l.id, l.sourceLeadId ?? l.id]));
  const rootIds = Array.from(new Set(picked.map((l) => l.sourceLeadId ?? l.id))).slice(0, MAX_EMAILS_PER_SEND);
  const icebreakers: Record<string, string> = {};
  for (const [id, line] of Object.entries(args.icebreakers ?? {})) icebreakers[rootOf.get(id) ?? id] = line;
  const sender = { name: args.senderName, email: args.senderEmail };

  const results: SendResult[] = [];
  let sentSoFar = 0;
  for (const leadId of rootIds) {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        name: true,
        email: true,
        country: true,
        username: true,
        firstName: true,
        followerCount: true,
        websiteUrl: true,
        socialsUrl: true,
        referralLink: true,
        dateOfReachOut: true,
        stage: { select: { name: true, pipeline: { select: { name: true } } } },
      },
    });
    if (!lead) continue;
    const skip = (detail: string) => results.push({ leadId, name: lead.name, status: "skipped", detail });

    const to = lead.email?.trim();
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      skip("No valid email address");
      continue;
    }
    if (remaining <= 0) {
      skip(`Daily limit of ${dailyCap} emails reached`);
      continue;
    }
    const suppressed = await findSuppression(to);
    if (suppressed) {
      skip(`On the do-not-contact list (${suppressed.reason.replace(/_/g, " ")})`);
      continue;
    }
    const teammate = await prisma.emailThread.findFirst({
      where: { leadId, ownerEmail: { not: args.senderEmail }, lastSentAt: { gte: new Date(Date.now() - TEAMMATE_WINDOW_DAYS * DAY_MS) } },
      orderBy: { lastSentAt: "desc" },
    });
    if (teammate) {
      skip(`Already emailed by ${teammate.ownerEmail} on ${teammate.lastSentAt.toISOString().slice(0, 10)}`);
      continue;
    }

    const info = { ...lead, pipelineName: lead.stage.pipeline.name, stageName: lead.stage.name, icebreaker: icebreakers[leadId] ?? null };
    const existing = args.replyInThread
      ? await prisma.emailThread.findFirst({ where: { leadId, ownerEmail: args.senderEmail, bouncedAt: null }, orderBy: { lastSentAt: "desc" } })
      : null;
    const missing = missingVariables(`${existing ? "" : args.subject}\n${args.body}`, info, sender);
    if (missing.length) {
      skip(`Blank ${missing.map((k) => `{{${k}}}`).join(", ")} — add a fallback or fill it in`);
      continue;
    }

    if (sentSoFar > 0) await new Promise((r) => setTimeout(r, GAP_BETWEEN_SENDS_MS));
    try {
      const subject = existing
        ? existing.subject.startsWith("Re:")
          ? existing.subject
          : `Re: ${existing.subject}`
        : renderTemplate(args.subject, info, sender);
      const sent = await sendGmail(token, {
        from: args.senderEmail,
        fromName: args.senderName,
        to,
        subject,
        body: renderTemplate(args.body, info, sender),
        threadId: existing?.gmailThreadId,
        inReplyTo: existing?.lastMessageId,
      });
      sentSoFar++;
      remaining--;

      // Move up one stage (with copies) and remember the thread + this send.
      const next = nextOutreachStage(lead.stage.name);
      const moved = await prisma.$transaction(async (tx) => {
        const target = next ? await moveLeadWithCopies(tx, leadId, next, args.senderEmail) : null;
        if (!lead.dateOfReachOut) await tx.lead.update({ where: { id: leadId }, data: { dateOfReachOut: new Date() } });
        return target;
      });
      const labelName = crmLabelName(lead.stage.pipeline.name, moved?.name ?? lead.stage.name);
      const now = new Date();
      const thread =
        existing && existing.gmailThreadId === sent.threadId
          ? await prisma.emailThread.update({
              where: { id: existing.id },
              data: { lastMessageId: sent.messageId, lastSentAt: now, sentCount: { increment: 1 }, labelName },
            })
          : await prisma.emailThread.create({
              data: { leadId, ownerEmail: args.senderEmail, gmailThreadId: sent.threadId, lastMessageId: sent.messageId, toEmail: to, subject, labelName, lastSentAt: now },
            });
      await prisma.emailSend.create({
        data: { threadId: thread.id, ownerEmail: args.senderEmail, leadId, templateStepId: args.templateStepId ?? null, sentAt: now },
      });
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
 * Applies a reply category to a thread and does what it implies:
 * - interested: lead to "Responded with Interest"
 * - not_interested / unsubscribe: lead to "Responded with Disinterest", address on the do-not-contact list
 * - wrong_person: address on the do-not-contact list, the automatic reply move undone
 * - out_of_office: the automatic reply move undone, so the lead stays due for follow-up
 */
export async function applyReplyCategory(threadId: string, category: ReplyCategory, actor: string) {
  const thread = await prisma.emailThread.findUnique({ where: { id: threadId } });
  if (!thread) return;
  await prisma.$transaction(async (tx) => {
    const data: { replyCategory: string; ignoreRepliesBefore?: Date | null } = { replyCategory: category };
    if (category === "out_of_office") data.ignoreRepliesBefore = thread.repliedAt ?? new Date();
    await tx.emailThread.update({ where: { id: threadId }, data });
    if (!thread.leadId) return;
    const lead = await tx.lead.findUnique({ where: { id: thread.leadId }, select: { stage: { select: { name: true } } } });
    const stage = lead?.stage.name.toLowerCase() ?? "";

    if (category === "interested" && (movesOnReply(stage) || stage.startsWith("responded with disinterest"))) {
      await moveLeadWithCopies(tx, thread.leadId, INTERESTED_STAGE, `reply-category:${actor}`);
    }
    if (category === "not_interested" || category === "unsubscribe") {
      if (movesOnReply(stage) || stage.startsWith("responded with interest")) {
        await moveLeadWithCopies(tx, thread.leadId, DISINTEREST_STAGE, `reply-category:${actor}`);
      }
      await suppressEmail(tx, thread.toEmail, category, actor);
    }
    if (category === "wrong_person") {
      await suppressEmail(tx, thread.toEmail, "wrong_person", actor);
      await revertReplyMove(tx, thread.leadId);
    }
    if (category === "out_of_office") {
      await revertReplyMove(tx, thread.leadId);
    }
  });
  if (thread.leadId) await relabelLeadThreads(thread.leadId);
}

/**
 * Checks this mailbox's open dashboard threads. A bounce marks the thread and
 * puts the address on the do-not-contact list. An automatic reply (out of
 * office) is noted but not treated as a reply. A real reply marks the thread,
 * moves a lead still in outreach to "Responded with Interest", and — when the
 * text clearly says so — files it as unsubscribe / not interested.
 */
export async function syncReplies(
  ownerEmail: string,
  opts: { maxThreads?: number } = {},
): Promise<{ checked: number; replies: number; moved: number; bounces: number }> {
  const token = await gmailAccessToken(ownerEmail);
  const since = new Date(Date.now() - 90 * DAY_MS);
  const threads = await prisma.emailThread.findMany({
    where: { ownerEmail, repliedAt: null, bouncedAt: null, lastSentAt: { gte: since } },
    orderBy: { lastSentAt: "desc" },
    take: opts.maxThreads ?? 60,
  });
  let replies = 0;
  let moved = 0;
  let bounces = 0;
  for (const t of threads) {
    try {
      const activity = await analyzeThread(token, ownerEmail, t.gmailThreadId, t.ignoreRepliesBefore);

      if (activity.bounce && !activity.reply) {
        bounces++;
        await prisma.emailThread.update({ where: { id: t.id }, data: { bouncedAt: activity.bounce.at } });
        await suppressEmail(prisma, t.toEmail, "bounce", "gmail-bounce");
        continue;
      }
      if (!activity.reply) {
        if (activity.autoReply && t.replyCategory !== "out_of_office") {
          await prisma.emailThread.update({
            where: { id: t.id },
            data: { replyCategory: "out_of_office", replySnippet: activity.autoReply.snippet, ignoreRepliesBefore: activity.autoReply.at },
          });
        }
        continue;
      }

      replies++;
      await prisma.emailThread.update({
        where: { id: t.id },
        data: { repliedAt: activity.reply.at, replySnippet: activity.reply.snippet, replyCategory: null },
      });
      if (!t.leadId) continue;
      const lead = await prisma.lead.findUnique({ where: { id: t.leadId }, select: { stage: { select: { name: true } } } });
      if (lead && movesOnReply(lead.stage.name)) {
        const target = await prisma.$transaction((tx) => moveLeadWithCopies(tx, t.leadId!, INTERESTED_STAGE, `gmail-reply:${ownerEmail}`));
        if (target) moved++;
      }
      const suggested = suggestReplyCategory(activity.reply.snippet);
      if (suggested) await applyReplyCategory(t.id, suggested, `auto:${ownerEmail}`);
      else await relabelLeadThreads(t.leadId);
    } catch (err) {
      console.error("reply sync failed", t.id, err);
    }
  }
  await prisma.gmailConnection.update({ where: { email: ownerEmail }, data: { lastSyncAt: new Date() } });
  return { checked: threads.length, replies, moved, bounces };
}
