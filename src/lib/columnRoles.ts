export type ColumnRole =
  | "name"
  | "email"
  | "status"
  | "code"
  | "revenue"
  | "commission"
  | "refund"
  | null;

/** Best-effort semantic role of a column, inferred from its header text. */
export function detectColumnRole(header: string): ColumnRole {
  const h = header.toLowerCase();
  if (h.includes("email")) return "email";
  if (h.includes("status")) return "status";
  if (h.includes("code")) return "code";
  if (h.includes("refund")) return "refund";
  if (h.includes("commission")) return "commission";
  if (h.includes("revenue") || h.includes("sales")) return "revenue";
  if (h.includes("name")) return "name";
  return null;
}

export function parseAmount(value: string): number {
  const n = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function isActiveStatus(value: string): boolean | null {
  const v = value.trim().toLowerCase();
  if (!v) return null;
  if (v.includes("inactive")) return false;
  if (v.includes("active")) return true;
  return null;
}
