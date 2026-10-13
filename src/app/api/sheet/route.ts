import { NextRequest, NextResponse } from "next/server";
import { getSessionWithFreshToken } from "@/lib/auth";
import {
  appendRow,
  deleteRow,
  getSheetTitleByGid,
  getSheetValues,
  getSpreadsheetId,
  updateCell,
} from "@/lib/sheets";
import { prisma } from "@/lib/db";

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

  const spreadsheetId = getSpreadsheetId();
  const sheetTitle = await getSheetTitleByGid(session.accessToken, spreadsheetId, getSheetGid());
  const data = await getSheetValues(session.accessToken, spreadsheetId, sheetTitle);

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const values = Array.isArray(body?.values) ? body.values : null;

  if (!values || values.length === 0 || !values.every((v: unknown) => typeof v === "string")) {
    return NextResponse.json({ error: "values (string array) is required" }, { status: 400 });
  }

  const spreadsheetId = getSpreadsheetId();
  const sheetTitle = await getSheetTitleByGid(session.accessToken, spreadsheetId, getSheetGid());
  await appendRow(session.accessToken, spreadsheetId, sheetTitle, values);

  return NextResponse.json({ ok: true });
}

export async function PATCH(request: NextRequest) {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const row = Number(body?.row);
  const col = Number(body?.col);
  const value = typeof body?.value === "string" ? body.value : undefined;

  if (!Number.isInteger(row) || row < 0 || !Number.isInteger(col) || col < 0 || value === undefined) {
    return NextResponse.json({ error: "row, col, and value are required" }, { status: 400 });
  }

  const spreadsheetId = getSpreadsheetId();
  const sheetTitle = await getSheetTitleByGid(session.accessToken, spreadsheetId, getSheetGid());
  await updateCell(session.accessToken, spreadsheetId, sheetTitle, row, col, value);

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const row = Number(body?.row);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!Number.isInteger(row) || row < 0) {
    return NextResponse.json({ error: "row is required" }, { status: 400 });
  }

  const spreadsheetId = getSpreadsheetId();
  await deleteRow(session.accessToken, spreadsheetId, Number(getSheetGid()), row);

  // Best-effort: this dashboard has no stable id linking a sheet row to a Prisma Affiliate record
  // (that table is a point-in-time import), so match on email first, then name, and hard-delete
  // that record too — otherwise onboarding/CRM data for a "deleted" affiliate would linger.
  let deletedAffiliateId: string | null = null;
  if (email || name) {
    // SQLite has no case-insensitive `contains` in Prisma, and email casing in the stored JSON
    // isn't guaranteed to match the sheet's — filter candidates in JS instead of in the query.
    const candidates = await prisma.affiliate.findMany({ select: { id: true, name: true, emails: true } });
    const emailLower = email.toLowerCase();
    const toDelete =
      (email && candidates.find((a) => a.emails.toLowerCase().includes(emailLower))) ||
      (name && candidates.find((a) => a.name.toLowerCase() === name.toLowerCase())) ||
      null;
    if (toDelete) {
      await prisma.affiliate.delete({ where: { id: toDelete.id } });
      deletedAffiliateId = toDelete.id;
    }
  }

  return NextResponse.json({ ok: true, deletedAffiliateId });
}
