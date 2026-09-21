import { detectColumnType } from "./columnTypes";
import { detectColumnRole } from "./columnRoles";

/**
 * Finds rows with no real payment content: the row's identifying columns
 * (the first column, any currency/number column, any email column) are all
 * blank. Flag columns like "Done?" or "Payable on Tipalti?" don't count as
 * content on their own, so a row with only one of those filled in is still
 * treated as empty.
 */
export function findEmptyRowIndices(headers: string[], rows: string[][]): number[] {
  const identityCols = new Set<number>([0]);

  headers.forEach((header, i) => {
    const type = detectColumnType(rows.map((row) => row[i] ?? ""));
    if (type === "currency" || type === "number") identityCols.add(i);
    if (detectColumnRole(header) === "email") identityCols.add(i);
  });

  return rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => [...identityCols].every((i) => (row[i] ?? "").trim() === ""))
    .map(({ index }) => index);
}
