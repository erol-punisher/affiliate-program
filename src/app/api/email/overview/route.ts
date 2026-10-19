import { NextResponse } from "next/server";
import { getSessionWithFreshToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { weekStart } from "@/lib/outreachStats";

// Everything the Emails tab shows: sent threads with their lead, this week's
// numbers, and when each lead was last emailed (for the "not emailed recently" filter).
export async function GET() {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const threads = await prisma.emailThread.findMany({
    orderBy: { lastSentAt: "desc" },
    take: 300,
    select: {
      id: true,
      leadId: true,
      ownerEmail: true,
      toEmail: true,
      subject: true,
      sentCount: true,
      lastSentAt: true,
      repliedAt: true,
      replyCategory: true,
      replySnippet: true,
      bouncedAt: true,
      gmailThreadId: true,
      sends: { select: { templateStepId: true, sentAt: true }, orderBy: { sentAt: "asc" } },
      lead: { select: { name: true, country: true, stage: { select: { name: true, pipeline: { select: { name: true } } } } } },
    },
  });

  const monday = weekStart(new Date());
  const lastEmailedAt: Record<string, string> = {};
  for (const t of threads) {
    if (t.leadId && !lastEmailedAt[t.leadId]) lastEmailedAt[t.leadId] = t.lastSentAt.toISOString();
  }

  return NextResponse.json({
    threads: threads.map((t) => ({
      id: t.id,
      leadId: t.leadId,
      leadName: t.lead?.name ?? "(deleted lead)",
      country: t.lead?.country ?? null,
      pipeline: t.lead?.stage.pipeline.name ?? null,
      stage: t.lead?.stage.name ?? null,
      ownerEmail: t.ownerEmail,
      toEmail: t.toEmail,
      subject: t.subject,
      sentCount: t.sentCount,
      lastSentAt: t.lastSentAt,
      repliedAt: t.repliedAt,
      replyCategory: t.replyCategory,
      replySnippet: t.replySnippet,
      bouncedAt: t.bouncedAt,
      gmailThreadId: t.gmailThreadId,
    })),
    templateStats: await templateStats(threads),
    stats: {
      sentThisWeek: threads.filter((t) => t.lastSentAt >= monday).length,
      repliesThisWeek: threads.filter((t) => t.repliedAt && t.repliedAt >= monday).length,
      awaitingReply: threads.filter((t) => !t.repliedAt && !t.bouncedAt).length,
      bounced: threads.filter((t) => t.bouncedAt).length,
    },
    lastEmailedAt,
  });
}

type ThreadForStats = {
  repliedAt: Date | null;
  replyCategory: string | null;
  sends: { templateStepId: string | null; sentAt: Date }[];
};

/**
 * Per template: emails sent, replies, and positive replies. A reply is credited
 * to the template of the last email sent before it (out-of-office doesn't count).
 */
async function templateStats(threads: ThreadForStats[]) {
  const byTemplate = new Map<string, { sent: number; replies: number; interested: number }>();
  const bump = (id: string, key: "sent" | "replies" | "interested") => {
    const row = byTemplate.get(id) ?? { sent: 0, replies: 0, interested: 0 };
    row[key]++;
    byTemplate.set(id, row);
  };
  for (const t of threads) {
    for (const send of t.sends) bump(send.templateStepId ?? "none", "sent");
    if (!t.repliedAt || t.replyCategory === "out_of_office") continue;
    const credited = [...t.sends].reverse().find((s) => s.sentAt <= t.repliedAt!);
    if (!credited) continue;
    const id = credited.templateStepId ?? "none";
    bump(id, "replies");
    if (!t.replyCategory || t.replyCategory === "interested") bump(id, "interested");
  }
  const steps = await prisma.templateStep.findMany({
    where: { id: { in: Array.from(byTemplate.keys()).filter((k) => k !== "none") } },
    select: { id: true, label: true, cadence: { select: { name: true } } },
  });
  return Array.from(byTemplate.entries())
    .map(([id, row]) => {
      const step = steps.find((s) => s.id === id);
      return {
        templateStepId: id === "none" ? null : id,
        label: id === "none" ? "Written from scratch" : step ? `${step.cadence.name} — ${step.label}` : "(deleted template)",
        ...row,
        replyRate: row.sent ? Math.round((row.replies / row.sent) * 1000) / 10 : null,
        interestRate: row.sent ? Math.round((row.interested / row.sent) * 1000) / 10 : null,
      };
    })
    .sort((a, b) => b.sent - a.sent);
}
