const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

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
  const data = await sheetsFetch(
    accessToken,
    `/${spreadsheetId}?fields=sheets.properties`,
  );

  const sheet = (data.sheets as Array<{ properties: { sheetId: number; title: string } }>)
    .find((s) => String(s.properties.sheetId) === gid);

  if (!sheet) {
    throw new Error(`No sheet found with gid ${gid}`);
  }

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
  const data = await sheetsFetch(accessToken, `/${spreadsheetId}?fields=sheets.properties`);

  const sheets = data.sheets as Array<{ properties: { sheetId: number; title: string; index: number } }>;

  return sheets
    .slice()
    .sort((a, b) => a.properties.index - b.properties.index)
    .map((s) => ({ title: s.properties.title, gid: s.properties.sheetId }));
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

  return { headers, rows: normalizedRows };
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
}
