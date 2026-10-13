import { NextRequest, NextResponse } from "next/server";
import { getSessionWithFreshToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSheetTitleByGid, getSheetValues, getSpreadsheetId } from "@/lib/sheets";
import { ensureStageColumn } from "@/lib/affiliateStageSheet";

function getSheetGid(): string {
  const gid = process.env.SHEET_GID;
  if (!gid) throw new Error("SHEET_GID environment variable is not set");
  return gid;
}

export async function GET() {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const stages = await prisma.affiliateStage.findMany({ orderBy: { order: "asc" } });
  return NextResponse.json({ stages });
}

export async function POST(request: NextRequest) {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const existing = await prisma.affiliateStage.findMany({ select: { order: true } });
  const order = existing.length > 0 ? Math.max(...existing.map((s) => s.order)) + 1 : 0;

  const stage = await prisma.affiliateStage.create({ data: { name, order } });

  // Best-effort: make sure the sheet has somewhere to store this assignment. The stage
  // definition itself is already saved regardless, so a transient Sheets API failure here
  // shouldn't be reported as the whole request having failed.
  try {
    const spreadsheetId = getSpreadsheetId();
    const sheetTitle = await getSheetTitleByGid(session.accessToken, spreadsheetId, getSheetGid());
    const { headers } = await getSheetValues(session.accessToken, spreadsheetId, sheetTitle);
    await ensureStageColumn(session.accessToken, spreadsheetId, sheetTitle, headers);
  } catch (err) {
    console.error("Failed to ensure Stage column in sheet:", err);
  }

  return NextResponse.json({ stage });
}
