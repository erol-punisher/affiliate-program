export type ColumnType = "text" | "number" | "currency" | "percent" | "date";

const CURRENCY_RE = /^[+-]?[$€£]\s?[\d,]+(\.\d+)?$/;
const PERCENT_RE = /^[+-]?[\d,]+(\.\d+)?\s?%$/;
const NUMBER_RE = /^[+-]?[\d,]+(\.\d+)?$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$|^\d{1,2}\/\d{1,2}\/\d{2,4}$/;

function classifyValue(value: string): ColumnType | "empty" {
  const trimmed = value.trim();
  if (!trimmed) return "empty";
  if (CURRENCY_RE.test(trimmed)) return "currency";
  if (PERCENT_RE.test(trimmed)) return "percent";
  if (DATE_RE.test(trimmed)) return "date";
  if (NUMBER_RE.test(trimmed)) return "number";
  return "text";
}

/** Infers a column's type by majority vote across its non-empty sampled values. */
export function detectColumnType(values: string[]): ColumnType {
  const counts: Record<ColumnType, number> = {
    text: 0,
    number: 0,
    currency: 0,
    percent: 0,
    date: 0,
  };

  for (const value of values.slice(0, 50)) {
    const kind = classifyValue(value);
    if (kind === "empty") continue;
    counts[kind]++;
  }

  const total = counts.text + counts.number + counts.currency + counts.percent + counts.date;
  if (total === 0) return "text";

  const [topType, topCount] = (Object.entries(counts) as [ColumnType, number][]).sort(
    (a, b) => b[1] - a[1],
  )[0];

  // Require a clear majority before treating a column as typed; otherwise fall back to text.
  return topCount / total >= 0.7 ? topType : "text";
}

export function isNumericType(type: ColumnType): boolean {
  return type === "number" || type === "currency" || type === "percent";
}

/**
 * Validates a raw edit against the column's inferred type. Returns an error
 * message if invalid, or null if the value is acceptable to save.
 */
export function validateCellValue(value: string, type: ColumnType): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null; // clearing a cell is always allowed

  switch (type) {
    case "currency":
      return CURRENCY_RE.test(trimmed) || NUMBER_RE.test(trimmed)
        ? null
        : "Expected a currency amount, e.g. $1,200.50";
    case "percent":
      return PERCENT_RE.test(trimmed) || NUMBER_RE.test(trimmed)
        ? null
        : "Expected a percentage, e.g. 12.5%";
    case "number":
      return NUMBER_RE.test(trimmed) ? null : "Expected a number";
    case "date":
      return DATE_RE.test(trimmed) ? null : "Expected a date, e.g. 2026-09-16";
    case "text":
      return null;
  }
}
