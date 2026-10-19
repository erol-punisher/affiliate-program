import { NextResponse } from "next/server";
import { getSessionWithFreshToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { nextOutreachStage } from "@/lib/crmMoves";
import { addBusinessDays, getEmailSettings } from "@/lib/emailSafety";

/**
 * Follow-ups due: the latest dashboard thread per lead that got no real reply
 * (or only an out-of-office), hasn't bounced, whose lead is still in Contacted
 * or Contacted (2), and whose last email is older than the follow-up delay in
 * business days. Leads on the do-not-contact list are left out.
 */
export async function GET() {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { followUpDays } = await getEmailSettings();
  const now = new Date();

  const threads = await prisma.emailThread.findMany({
    where: {
      bouncedAt: null,
      leadId: { not: null },
      OR: [{ repliedAt: null }, { replyCategory: "out_of_office" }],
    },
    orderBy: { lastSentAt: "desc" },
    include: {
      lead: {
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
          stage: { select: { name: true, pipeline: { select: { name: true } } } },
        },
      },
    },
  });
  const suppressed = new Set((await prisma.suppressedContact.findMany({ select: { value: true } })).map((s) => s.value));

  const seen = new Set<string>();
  const due = [];
  for (const t of threads) {
    if (!t.lead || seen.has(t.lead.id)) continue;
    seen.add(t.lead.id);
    const next = nextOutreachStage(t.lead.stage.name);
    if (!next || t.lead.stage.name.toLowerCase().startsWith("affiliates in the pipeline")) continue;
    const dueAt = addBusinessDays(t.lastSentAt, followUpDays);
    if (dueAt > now) continue;
    const email = t.toEmail.toLowerCase();
    if (suppressed.has(email) || suppressed.has(email.split("@")[1] ?? "")) continue;
    due.push({
      threadId: t.id,
      ownerEmail: t.ownerEmail,
      subject: t.subject,
      lastSentAt: t.lastSentAt,
      dueAt,
      outOfOffice: t.replyCategory === "out_of_office",
      lead: { ...t.lead, stageName: t.lead.stage.name, pipeline: t.lead.stage.pipeline.name, nextStage: next },
    });
  }
  due.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  return NextResponse.json({ followUpDays, due });
}
