import { NextRequest, NextResponse } from "next/server";
import { getSessionWithFreshToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseOptionalDate, parseOptionalInt, parseOptionalString } from "@/lib/crmLead";

export async function POST(request: NextRequest) {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const stageId = typeof body?.stageId === "string" ? body.stageId : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!stageId || !name) {
    return NextResponse.json({ error: "stageId and name are required" }, { status: 400 });
  }

  const maxOrder = await prisma.lead.aggregate({
    where: { stageId },
    _max: { order: true },
  });

  const lead = await prisma.lead.create({
    data: {
      stageId,
      name,
      order: (maxOrder._max.order ?? -1) + 1,
      email: parseOptionalString(body?.email) ?? null,
      notes: parseOptionalString(body?.notes) ?? null,
      username: parseOptionalString(body?.username) ?? null,
      owner: parseOptionalString(body?.owner) ?? null,
      affiliateManager: parseOptionalString(body?.affiliateManager) ?? null,
      country: parseOptionalString(body?.country) ?? null,
      whatsapp: parseOptionalString(body?.whatsapp) ?? null,
      followerCount: parseOptionalInt(body?.followerCount) ?? null,
      websiteUrl: parseOptionalString(body?.websiteUrl) ?? null,
      referralLink: parseOptionalString(body?.referralLink) ?? null,
      dateOfReachOut: parseOptionalDate(body?.dateOfReachOut) ?? null,
      socialsUrl: parseOptionalString(body?.socialsUrl) ?? null,
      closingDate: parseOptionalDate(body?.closingDate) ?? null,
    },
  });

  return NextResponse.json({ lead });
}
