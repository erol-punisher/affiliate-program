import { NextResponse } from "next/server";
import { getSessionWithFreshToken } from "@/lib/auth";
import {
  clearSheetValues,
  createSheetTab,
  listSheetTabs,
  writeSheetValues,
} from "@/lib/sheets";
import { parseCsv } from "@/lib/csv";
import { parseMonthTitle } from "@/lib/monthTabs";

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} environment variable is not set`);
  return value;
}

export async function POST(request: Request) {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const month: string | undefined = body?.month;
  const csv: string | undefined = body?.csv;
  const confirmOverwrite: boolean = body?.confirmOverwrite === true;

  if (!month || !csv) {
    return NextResponse.json({ error: "Missing month or csv" }, { status: 400 });
  }

  const requested = parseMonthTitle(month);
  if (!requested) {
    return NextResponse.json({ error: `"${month}" is not a valid YYYY-MM month` }, { status: 400 });
  }

  const rows = parseCsv(csv);
  if (rows.length < 2) {
    return NextResponse.json({ error: "CSV needs a header row and at least one data row" }, { status: 400 });
  }

  const spreadsheetId = getEnv("PAYMENT_SPREADSHEET_ID");
  const tabs = await listSheetTabs(session.accessToken, spreadsheetId);

  const existingTab = tabs.find((tab) => {
    const parsed = parseMonthTitle(tab.title);
    return parsed && parsed.year === requested.year && parsed.month === requested.month;
  });

  if (existingTab && !confirmOverwrite) {
    return NextResponse.json(
      { conflict: true, existingTitle: existingTab.title, existingGid: existingTab.gid },
      { status: 409 },
    );
  }

  let title: string;
  let gid: number;

  if (existingTab) {
    title = existingTab.title;
    gid = existingTab.gid;
    await clearSheetValues(session.accessToken, spreadsheetId, title);
  } else {
    title = month;
    gid = await createSheetTab(session.accessToken, spreadsheetId, title);
  }

  await writeSheetValues(session.accessToken, spreadsheetId, title, rows);

  return NextResponse.json({ ok: true, title, gid, rowCount: rows.length - 1 });
}
