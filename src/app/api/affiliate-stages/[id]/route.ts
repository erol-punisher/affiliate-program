import { NextRequest, NextResponse } from "next/server";
import { getSessionWithFreshToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSheetTitleByGid, getSpreadsheetId } from "@/lib/sheets";
import { clearStageInSheet, renameStageInSheet } from "@/lib/affiliateStageSheet";

function getSheetGid(): string {
  const gid = process.env.SHEET_GID;
  if (!gid) throw new Error("SHEET_GID environment variable is not set");
  return gid;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);

  const existing = await prisma.affiliateStage.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Stage not found" }, { status: 404 });
  }

  const data: { name?: string; order?: number } = {};

  const name = typeof body?.name === "string" ? body.name.trim() : undefined;
  if (name) data.name = name;

  if (typeof body?.order === "number") data.order = Math.trunc(body.order);

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const stage = await prisma.affiliateStage.update({ where: { id }, data });

  if (data.name && data.name !== existing.name) {
    try {
      const spreadsheetId = getSpreadsheetId();
      const sheetTitle = await getSheetTitleByGid(session.accessToken, spreadsheetId, getSheetGid());
      await renameStageInSheet(session.accessToken, spreadsheetId, sheetTitle, existing.name, data.name);
    } catch (err) {
      console.error("Failed to sync stage rename to sheet:", err);
    }
  }

  return NextResponse.json({ stage });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.affiliateStage.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Stage not found" }, { status: 404 });
  }

  try {
    const spreadsheetId = getSpreadsheetId();
    const sheetTitle = await getSheetTitleByGid(session.accessToken, spreadsheetId, getSheetGid());
    await clearStageInSheet(session.accessToken, spreadsheetId, sheetTitle, existing.name);
  } catch (err) {
    console.error("Failed to sync stage delete to sheet:", err);
  }

  await prisma.affiliateStage.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
