import { NextResponse } from "next/server";
import { getSessionWithFreshToken } from "@/lib/auth";
import { batchGetSheetValues, deleteRows, listSheetTabs } from "@/lib/sheets";
import { findEmptyRowIndices } from "@/lib/sheetCleanup";

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} environment variable is not set`);
  return value;
}

export async function POST() {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const spreadsheetId = getEnv("PAYMENT_SPREADSHEET_ID");
  const tabs = await listSheetTabs(session.accessToken, spreadsheetId);
  const allValues = await batchGetSheetValues(
    session.accessToken,
    spreadsheetId,
    tabs.map((tab) => tab.title),
  );

  const results = [];
  for (const tab of tabs) {
    const { headers, rows } = allValues[tab.title];
    const emptyRowIndices = findEmptyRowIndices(headers, rows);

    if (emptyRowIndices.length > 0) {
      await deleteRows(session.accessToken, spreadsheetId, tab.gid, emptyRowIndices);
    }

    results.push({ title: tab.title, gid: tab.gid, deletedCount: emptyRowIndices.length });
  }

  const totalDeleted = results.reduce((sum, r) => sum + r.deletedCount, 0);

  return NextResponse.json({ ok: true, results, totalDeleted });
}
