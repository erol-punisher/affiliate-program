import { addHeaderColumn, getSheetValues, updateCell } from "@/lib/sheets";

const STAGE_HEADER = "Stage";

/** Finds the "Stage" column (exact, case-insensitive, trimmed) if it exists in the sheet's headers. */
export function findStageColumnIndex(headers: string[]): number {
  return headers.findIndex((h) => h.trim().toLowerCase() === STAGE_HEADER.toLowerCase());
}

/** Adds the "Stage" column to the sheet if it doesn't already exist, returning its index either way. */
export async function ensureStageColumn(
  accessToken: string,
  spreadsheetId: string,
  sheetTitle: string,
  headers: string[],
): Promise<number> {
  const existing = findStageColumnIndex(headers);
  if (existing !== -1) return existing;

  const newIndex = headers.length;
  await addHeaderColumn(accessToken, spreadsheetId, sheetTitle, newIndex, STAGE_HEADER);
  return newIndex;
}

/** Renames every cell in the sheet's Stage column that matches `oldName` to `newName` — keeps existing assignments in sync when a stage is renamed. */
export async function renameStageInSheet(
  accessToken: string,
  spreadsheetId: string,
  sheetTitle: string,
  oldName: string,
  newName: string,
): Promise<void> {
  const { headers, rows } = await getSheetValues(accessToken, spreadsheetId, sheetTitle);
  const colIndex = findStageColumnIndex(headers);
  if (colIndex === -1) return;

  const target = oldName.trim().toLowerCase();
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    if ((rows[rowIndex][colIndex] ?? "").trim().toLowerCase() === target) {
      await updateCell(accessToken, spreadsheetId, sheetTitle, rowIndex, colIndex, newName);
    }
  }
}

/** Blanks every cell in the sheet's Stage column that matches `name` — used when that stage is deleted. */
export async function clearStageInSheet(
  accessToken: string,
  spreadsheetId: string,
  sheetTitle: string,
  name: string,
): Promise<void> {
  const { headers, rows } = await getSheetValues(accessToken, spreadsheetId, sheetTitle);
  const colIndex = findStageColumnIndex(headers);
  if (colIndex === -1) return;

  const target = name.trim().toLowerCase();
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    if ((rows[rowIndex][colIndex] ?? "").trim().toLowerCase() === target) {
      await updateCell(accessToken, spreadsheetId, sheetTitle, rowIndex, colIndex, "");
    }
  }
}
