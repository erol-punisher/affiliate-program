import { NextRequest, NextResponse } from "next/server";
import { getSessionWithFreshToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildMonthlyReportContent, buildMonthlyReportTitle, computeMonthlyStats } from "@/lib/monthlyStats";

export async function POST(request: NextRequest) {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const year = Number(body?.year);
  const month = Number(body?.month);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "year and month (1-12) are required" }, { status: 400 });
  }

  const stats = await computeMonthlyStats(year, month);
  const title = buildMonthlyReportTitle(year, month);
  const content = buildMonthlyReportContent(stats);

  const existing = await prisma.documentationEntry.findFirst({ where: { title } });
  const entry = existing
    ? await prisma.documentationEntry.update({
        where: { id: existing.id },
        data: { content, author: session.email },
      })
    : await prisma.documentationEntry.create({
        data: { title, content, author: session.email },
      });

  return NextResponse.json({ entry });
}
