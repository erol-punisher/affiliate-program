import { NextRequest, NextResponse } from "next/server";
import { getSessionWithFreshToken } from "@/lib/auth";
import { getSheetTitleByGid, getSheetValues, listSheetTabs, updateCell } from "@/lib/sheets";

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} environment variable is not set`);
  return value;
}

export async function GET(request: NextRequest) {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const spreadsheetId = getEnv("PAYMENT_SPREADSHEET_ID");
  const defaultGid = getEnv("PAYMENT_SHEET_GID");

  const tabs = await listSheetTabs(session.accessToken, spreadsheetId);

  const { searchParams } = new URL(request.url);
  const requestedGid = searchParams.get("gid") ?? defaultGid;
  const selected = tabs.find((tab) => String(tab.gid) === requestedGid) ?? tabs[0];

  if (!selected) {
    return NextResponse.json({ error: "No tabs found in payment spreadsheet" }, { status: 404 });
  }

  const data = await getSheetValues(session.accessToken, spreadsheetId, selected.title);

  return NextResponse.json({ tabs, selected, ...data });
}

export async function PATCH(request: NextRequest) {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const gid = Number(body?.gid);
  const row = Number(body?.row);
  const col = Number(body?.col);
  const value = typeof body?.value === "string" ? body.value : undefined;

  if (
    !Number.isInteger(gid) ||
    !Number.isInteger(row) ||
    row < 0 ||
    !Number.isInteger(col) ||
    col < 0 ||
    value === undefined
  ) {
    return NextResponse.json({ error: "gid, row, col, and value are required" }, { status: 400 });
  }

  const spreadsheetId = getEnv("PAYMENT_SPREADSHEET_ID");
  const sheetTitle = await getSheetTitleByGid(session.accessToken, spreadsheetId, String(gid));
  await updateCell(session.accessToken, spreadsheetId, sheetTitle, row, col, value);

  return NextResponse.json({ ok: true });
}
