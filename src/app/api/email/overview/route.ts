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
      gmailThreadId: true,
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
      gmailThreadId: t.gmailThreadId,
    })),
    stats: {
      sentThisWeek: threads.filter((t) => t.lastSentAt >= monday).length,
      repliesThisWeek: threads.filter((t) => t.repliedAt && t.repliedAt >= monday).length,
      awaitingReply: threads.filter((t) => !t.repliedAt).length,
    },
    lastEmailedAt,
  });
}
