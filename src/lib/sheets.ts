const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

// Google Sheets reads are a slow external round trip (300ms-1s+), and every page load/tab
// switch was re-fetching live with no caching. This in-memory cache makes repeat reads within
// the TTL instant, while writes below invalidate the affected spreadsheet so edits stay correct.
// Kept on `globalThis` (like the Prisma client in db.ts) so it survives dev-mode HMR reloads.
type CacheEntry<T> = { value: T; expiresAt: number };
const globalForSheetsCache = globalThis as unknown as { sheetsCache?: Map<string, CacheEntry<unknown>> };
const sheetsCache = globalForSheetsCache.sheetsCache ?? new Map<string, CacheEntry<unknown>>();
globalForSheetsCache.sheetsCache = sheetsCache;

const METADATA_TTL_MS = 60_000; // tab lists / gid->title resolution rarely change
const VALUES_TTL_MS = 10_000; // actual cell data, balanced against staleness from direct Sheets edits

function getCached<T>(key: string): T | undefined {
  const entry = sheetsCache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    sheetsCache.delete(key);
    return undefined;
  }
  return entry.value as T;
}

function setCached<T>(key: string, value: T, ttlMs: number): void {
  sheetsCache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/** Drops every cached entry for a spreadsheet after a write, so the next read is live and later reads stay fast. */
function invalidateSpreadsheet(spreadsheetId: string): void {
  for (const key of sheetsCache.keys()) {
    if (key.includes(spreadsheetId)) sheetsCache.delete(key);
  }
}

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} environment variable is not set`);
  return value;
}

async function sheetsFetch(accessToken: string, path: string, init?: RequestInit) {
  const res = await fetch(`${SHEETS_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
    throw new Error(`Sheets API error (${res.status}): ${await res.text()}`);
  }

  return res.json();
}

export function getSpreadsheetId(): string {
  return getEnv("SPREADSHEET_ID");
}

export async function getSheetTitleByGid(
  accessToken: string,
  spreadsheetId: string,
  gid: string,
): Promise<string> {
  const cacheKey = `title:${spreadsheetId}:${gid}`;
  const cached = getCached<string>(cacheKey);
  if (cached !== undefined) return cached;

  const data = await sheetsFetch(
    accessToken,
    `/${spreadsheetId}?fields=sheets.properties`,
  );

  const sheet = (data.sheets as Array<{ properties: { sheetId: number; title: string } }>)
    .find((s) => String(s.properties.sheetId) === gid);

  if (!sheet) {
    throw new Error(`No sheet found with gid ${gid}`);
  }

  setCached(cacheKey, sheet.properties.title, METADATA_TTL_MS);
  return sheet.properties.title;
}

export type SheetTab = {
  title: string;
  gid: number;
};

export async function listSheetTabs(
  accessToken: string,
  spreadsheetId: string,
): Promise<SheetTab[]> {
  const cacheKey = `tabs:${spreadsheetId}`;
  const cached = getCached<SheetTab[]>(cacheKey);
  if (cached !== undefined) return cached;

  const data = await sheetsFetch(accessToken, `/${spreadsheetId}?fields=sheets.properties`);

  const sheets = data.sheets as Array<{ properties: { sheetId: number; title: string; index: number } }>;

  const tabs = sheets
    .slice()
    .sort((a, b) => a.properties.index - b.properties.index)
    .map((s) => ({ title: s.properties.title, gid: s.properties.sheetId }));

  setCached(cacheKey, tabs, METADATA_TTL_MS);
  return tabs;
}

export async function createSheetTab(
  accessToken: string,
  spreadsheetId: string,
  title: string,
): Promise<number> {
  const data = await sheetsFetch(accessToken, `/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      requests: [{ addSheet: { properties: { title } } }],
    }),
  });

  invalidateSpreadsheet(spreadsheetId);
  return data.replies[0].addSheet.properties.sheetId as number;
}

export async function clearSheetValues(
  accessToken: string,
  spreadsheetId: string,
  sheetTitle: string,
): Promise<void> {
  const range = `'${sheetTitle}'!A1:ZZ10000`;
  await sheetsFetch(accessToken, `/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  invalidateSpreadsheet(spreadsheetId);
}

export async function writeSheetValues(
  accessToken: string,
  spreadsheetId: string,
  sheetTitle: string,
  values: string[][],
): Promise<void> {
  const range = `'${sheetTitle}'!A1`;
  await sheetsFetch(
    accessToken,
    `/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      body: JSON.stringify({ range, majorDimension: "ROWS", values }),
    },
  );
  invalidateSpreadsheet(spreadsheetId);
}

export type SheetData = {
  headers: string[];
  rows: string[][];
};

export async function getSheetValues(
  accessToken: string,
  spreadsheetId: string,
  sheetTitle: string,
): Promise<SheetData> {
  const cacheKey = `values:${spreadsheetId}:${sheetTitle}`;
  const cached = getCached<SheetData>(cacheKey);
  if (cached !== undefined) return cached;

  const range = `'${sheetTitle}'!A1:ZZ10000`;
  const data = await sheetsFetch(
    accessToken,
    `/${spreadsheetId}/values/${encodeURIComponent(range)}`,
  );

  const values: string[][] = data.values ?? [];
  const [headers = [], ...rows] = values;

  const normalizedRows = rows.map((row) =>
    headers.map((_, i) => row[i] ?? ""),
  );

  const result = { headers, rows: normalizedRows };
  setCached(cacheKey, result, VALUES_TTL_MS);
  return result;
}

/** Fetches many tabs' values in a single API call (vs. N separate calls), to avoid burning read quota. */
export async function batchGetSheetValues(
  accessToken: string,
  spreadsheetId: string,
  sheetTitles: string[],
): Promise<Record<string, SheetData>> {
  if (sheetTitles.length === 0) return {};

  const query = sheetTitles
    .map((title) => `ranges=${encodeURIComponent(`'${title}'!A1:ZZ10000`)}`)
    .join("&");
  const data = await sheetsFetch(accessToken, `/${spreadsheetId}/values:batchGet?${query}`);

  const valueRanges = data.valueRanges as Array<{ values?: string[][] }>;
  const result: Record<string, SheetData> = {};

  sheetTitles.forEach((title, i) => {
    const values = valueRanges[i]?.values ?? [];
    const [headers = [], ...rows] = values;
    const normalizedRows = rows.map((row) => headers.map((_, idx) => row[idx] ?? ""));
    result[title] = { headers, rows: normalizedRows };
  });

  return result;
}

export async function appendRow(
  accessToken: string,
  spreadsheetId: string,
  sheetTitle: string,
  values: string[],
): Promise<void> {
  const range = `'${sheetTitle}'!A1`;

  await sheetsFetch(
    accessToken,
    `/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      body: JSON.stringify({ range, majorDimension: "ROWS", values: [values] }),
    },
  );
  invalidateSpreadsheet(spreadsheetId);
}

export async function deleteRow(
  accessToken: string,
  spreadsheetId: string,
  sheetId: number,
  rowIndex: number, // 0-indexed data row, not counting header
): Promise<void> {
  const startIndex = rowIndex + 1; // +1 to skip header, batchUpdate row indices are 0-indexed
  await sheetsFetch(accessToken, `/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex,
              endIndex: startIndex + 1,
            },
          },
        },
      ],
    }),
  });
  invalidateSpreadsheet(spreadsheetId);
}

export async function deleteRows(
  accessToken: string,
  spreadsheetId: string,
  sheetId: number,
  rowIndices: number[], // 0-indexed data rows, not counting header
): Promise<void> {
  if (rowIndices.length === 0) return;

  // Descending order so each deletion doesn't shift the index of rows still queued for deletion.
  const descending = [...rowIndices].sort((a, b) => b - a);

  await sheetsFetch(accessToken, `/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      requests: descending.map((rowIndex) => {
        const startIndex = rowIndex + 1; // +1 to skip header
        return {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex,
              endIndex: startIndex + 1,
            },
          },
        };
      }),
    }),
  });
  invalidateSpreadsheet(spreadsheetId);
}

export async function deleteColumns(
  accessToken: string,
  spreadsheetId: string,
  sheetId: number,
  colIndices: number[], // 0-indexed columns
): Promise<void> {
  if (colIndices.length === 0) return;

  // Descending order so each deletion doesn't shift the index of columns still queued for deletion.
  const descending = [...colIndices].sort((a, b) => b - a);

  await sheetsFetch(accessToken, `/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      requests: descending.map((colIndex) => ({
        deleteDimension: {
          range: {
            sheetId,
            dimension: "COLUMNS",
            startIndex: colIndex,
            endIndex: colIndex + 1,
          },
        },
      })),
    }),
  });
  invalidateSpreadsheet(spreadsheetId);
}

function columnIndexToLetter(index: number): string {
  let letter = "";
  let n = index;
  do {
    letter = String.fromCharCode((n % 26) + 65) + letter;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letter;
}

/** Writes a header cell for a brand-new column (e.g. adding a "Stage" column the first time it's needed). */
export async function addHeaderColumn(
  accessToken: string,
  spreadsheetId: string,
  sheetTitle: string,
  colIndex: number,
  header: string,
): Promise<void> {
  const column = columnIndexToLetter(colIndex);
  const range = `'${sheetTitle}'!${column}1`;

  await sheetsFetch(
    accessToken,
    `/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      body: JSON.stringify({ range, values: [[header]] }),
    },
  );
  invalidateSpreadsheet(spreadsheetId);
}

export async function updateCell(
  accessToken: string,
  spreadsheetId: string,
  sheetTitle: string,
  rowIndex: number, // 0-indexed data row, not counting header
  colIndex: number, // 0-indexed column
  value: string,
): Promise<void> {
  const column = columnIndexToLetter(colIndex);
  const row = rowIndex + 2; // +1 for header, +1 for 1-indexing
  const range = `'${sheetTitle}'!${column}${row}`;

  await sheetsFetch(
    accessToken,
    `/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      body: JSON.stringify({ range, values: [[value]] }),
    },
  );
  invalidateSpreadsheet(spreadsheetId);
}
