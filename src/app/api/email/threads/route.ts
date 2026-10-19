import { NextRequest, NextResponse } from "next/server";
import { getSessionWithFreshToken } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Email history for a lead (a copy resolves to its original).
export async function GET(request: NextRequest) {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const leadId = request.nextUrl.searchParams.get("leadId") ?? "";
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true, sourceLeadId: true } });
  if (!lead) return NextResponse.json({ threads: [] });
  const threads = await prisma.emailThread.findMany({
    where: { leadId: lead.sourceLeadId ?? lead.id },
    orderBy: { lastSentAt: "desc" },
    select: { id: true, ownerEmail: true, toEmail: true, subject: true, sentCount: true, lastSentAt: true, repliedAt: true, labelName: true, gmailThreadId: true },
  });
  return NextResponse.json({ threads });
}
