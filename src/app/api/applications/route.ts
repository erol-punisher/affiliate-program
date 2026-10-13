import { NextRequest, NextResponse } from "next/server";
import { getSessionWithFreshToken } from "@/lib/auth";
import { getSheetTitleByGid, getSheetValues, updateCell } from "@/lib/sheets";

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} environment variable is not set`);
  return value;
}

export async function GET() {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const spreadsheetId = getEnv("APPLICATIONS_SPREADSHEET_ID");
  const sheetTitle = await getSheetTitleByGid(session.accessToken, spreadsheetId, getEnv("APPLICATIONS_SHEET_GID"));
  const data = await getSheetValues(session.accessToken, spreadsheetId, sheetTitle);

  return NextResponse.json(data);
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

  const spreadsheetId = getEnv("APPLICATIONS_SPREADSHEET_ID");
  const sheetTitle = await getSheetTitleByGid(session.accessToken, spreadsheetId, getEnv("APPLICATIONS_SHEET_GID"));
  await updateCell(session.accessToken, spreadsheetId, sheetTitle, row, col, value);

  return NextResponse.json({ ok: true });
}
