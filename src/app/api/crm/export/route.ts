import { NextResponse } from "next/server";
import { getSessionWithFreshToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CHANNEL_LABELS, parseChannels } from "@/lib/outreachChannels";

// Column names as Bigin's "Affiliate Information" export uses them (and the CRM's
// CSV import reads them), so the file goes straight into a Bigin import.
const COLUMNS = [
  "Affiliate Name",
  "Pipeline",
  "Sub-Pipeline",
  "Stage",
  "Email of Contact",
  "First Name",
  "Username",
  "Country",
  "WA",
  "Follower Count",
  "Website URL",
  "URL of Socials",
  "Referral Link",
  "Date of Reach Out",
  "Closing Date",
  "Affiliate Manager",
  "Affiliate Owner",
  "Description",
  "Outreach Channels",
] as const;

function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\r\n]/.test(s) || /^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

// Every affiliate in the CRM as a Bigin-ready CSV: one row per affiliate (mirrored
// overview copies are left out, so nobody appears twice), sorted by pipeline and stage.
export async function GET() {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const leads = await prisma.lead.findMany({
    where: { sourceLeadId: null },
    include: { stage: { select: { name: true, order: true, pipeline: { select: { name: true, order: true, pipelineGroup: { select: { name: true } } } } } } },
  });
  leads.sort(
    (a, b) =>
      a.stage.pipeline.order - b.stage.pipeline.order ||
      a.stage.pipeline.name.localeCompare(b.stage.pipeline.name) ||
      a.stage.order - b.stage.order ||
      a.name.localeCompare(b.name),
  );

  const rows = leads.map((l) => [
    l.name,
    l.stage.pipeline.pipelineGroup.name,
    l.stage.pipeline.name,
    l.stage.name,
    l.email,
    l.firstName,
    l.username,
    l.country,
    l.whatsapp,
    l.followerCount,
    l.websiteUrl,
    l.socialsUrl,
    l.referralLink,
    day(l.dateOfReachOut),
    day(l.closingDate),
    l.affiliateManager,
    l.owner,
    l.notes,
    parseChannels(l.outreachChannels).map((c) => CHANNEL_LABELS[c]).join(", "),
  ]);
  // BOM so Excel opens accents and Arabic correctly.
  const csv = "﻿" + [COLUMNS, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
  const filename = `releasit-affiliates-bigin-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
