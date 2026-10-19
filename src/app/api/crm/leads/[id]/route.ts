import { NextRequest, NextResponse, after } from "next/server";
import { getSessionWithFreshToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseOptionalDate, parseOptionalInt, parseOptionalString } from "@/lib/crmLead";
import { recordStageEvent } from "@/lib/outreachStats";
import { relabelLeadThreads } from "@/lib/emailOutreach";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);

  const data: {
    name?: string;
    email?: string | null;
    notes?: string | null;
    stageId?: string;
    order?: number;
    username?: string | null;
    owner?: string | null;
    affiliateManager?: string | null;
    country?: string | null;
    whatsapp?: string | null;
    followerCount?: number | null;
    websiteUrl?: string | null;
    referralLink?: string | null;
    dateOfReachOut?: Date | null;
    socialsUrl?: string | null;
    closingDate?: Date | null;
  } = {};

  if (typeof body?.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body?.stageId === "string") data.stageId = body.stageId;
  if (typeof body?.order === "number") data.order = body.order;

  const email = parseOptionalString(body?.email);
  if (email !== undefined) data.email = email;
  const notes = parseOptionalString(body?.notes);
  if (notes !== undefined) data.notes = notes;
  const username = parseOptionalString(body?.username);
  if (username !== undefined) data.username = username;
  const owner = parseOptionalString(body?.owner);
  if (owner !== undefined) data.owner = owner;
  const affiliateManager = parseOptionalString(body?.affiliateManager);
  if (affiliateManager !== undefined) data.affiliateManager = affiliateManager;
  const country = parseOptionalString(body?.country);
  if (country !== undefined) data.country = country;
  const whatsapp = parseOptionalString(body?.whatsapp);
  if (whatsapp !== undefined) data.whatsapp = whatsapp;
  const followerCount = parseOptionalInt(body?.followerCount);
  if (followerCount !== undefined) data.followerCount = followerCount;
  const websiteUrl = parseOptionalString(body?.websiteUrl);
  if (websiteUrl !== undefined) data.websiteUrl = websiteUrl;
  const referralLink = parseOptionalString(body?.referralLink);
  if (referralLink !== undefined) data.referralLink = referralLink;
  const dateOfReachOut = parseOptionalDate(body?.dateOfReachOut);
  if (dateOfReachOut !== undefined) data.dateOfReachOut = dateOfReachOut;
  const socialsUrl = parseOptionalString(body?.socialsUrl);
  if (socialsUrl !== undefined) data.socialsUrl = socialsUrl;
  const closingDate = parseOptionalDate(body?.closingDate);
  if (closingDate !== undefined) data.closingDate = closingDate;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const lead = await prisma.$transaction(async (tx) => {
    const before = data.stageId
      ? await tx.lead.findUnique({ where: { id }, select: { stageId: true, stage: { select: { name: true } } } })
      : null;
    const updated = await tx.lead.update({ where: { id }, data });
    if (before && data.stageId && before.stageId !== data.stageId) {
      await recordStageEvent(tx, { leadId: id, toStageId: data.stageId, fromStageName: before.stage.name, actor: session.email });
    }
    return updated;
  });
  // Keep the lead's Gmail thread labels in step with its new stage.
  if (data.stageId) after(() => relabelLeadThreads(lead.sourceLeadId ?? lead.id));
  return NextResponse.json({ lead });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  await prisma.lead.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
