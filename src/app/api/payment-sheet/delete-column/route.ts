import { NextResponse } from "next/server";
import { getSessionWithFreshToken } from "@/lib/auth";
import { batchGetSheetValues, deleteColumns, listSheetTabs } from "@/lib/sheets";

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} environment variable is not set`);
  return value;
}

const BIDI_CONTROL_CHARS = /[​-‏‪-‮⁦-⁩﻿]/g;

/** Collapses all whitespace (including NBSP) to single spaces and strips invisible control/bidi marks. */
function normalizeHeader(value: string): string {
  return value
    .replace(BIDI_CONTROL_CHARS, "")
    .replace(/[\s ]+/g, " ")
    .trim()
    .toLowerCase();
}

export async function POST(request: Request) {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const rawHeaders: unknown = body?.headers ?? (body?.header ? [body.header] : null);

  if (!Array.isArray(rawHeaders) || rawHeaders.length === 0) {
    return NextResponse.json({ error: "headers (non-empty array) is required" }, { status: 400 });
  }

  const headers: string[] = rawHeaders.filter(
    (h): h is string => typeof h === "string" && h.trim() !== "",
  );
  if (headers.length === 0) {
    return NextResponse.json({ error: "headers (non-empty array) is required" }, { status: 400 });
  }

  const targets = headers.map(normalizeHeader);
  const spreadsheetId = getEnv("PAYMENT_SPREADSHEET_ID");
  const tabs = await listSheetTabs(session.accessToken, spreadsheetId);
  const allValues = await batchGetSheetValues(
    session.accessToken,
    spreadsheetId,
    tabs.map((tab) => tab.title),
  );

  const results = [];
  for (const tab of tabs) {
    const { headers: tabHeaders } = allValues[tab.title];
    const colIndices = tabHeaders
      .map((h, i) => ({ h: normalizeHeader(h), i }))
      .filter(({ h }) => targets.includes(h))
      .map(({ i }) => i);

    if (colIndices.length > 0) {
      await deleteColumns(session.accessToken, spreadsheetId, tab.gid, colIndices);
    }

    results.push({
      title: tab.title,
      gid: tab.gid,
      removedCount: colIndices.length,
      headersSeen: tabHeaders,
    });
  }

  const totalRemoved = results.reduce((sum, r) => sum + r.removedCount, 0);

  return NextResponse.json({ ok: true, targets, results, totalRemoved });
}
