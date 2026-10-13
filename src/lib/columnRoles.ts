export type ColumnRole =
  | "name"
  | "email"
  | "status"
  | "stage"
  | "decision"
  | "code"
  | "revenue"
  | "commission"
  | "refund"
  | "sensitive"
  | null;

/** Best-effort semantic role of a column, inferred from its header text. */
export function detectColumnRole(header: string): ColumnRole {
  const h = header.toLowerCase();
  if (h.includes("details")) return "sensitive";
  if (h.includes("email")) return "email";
  if (h.trim() === "stage") return "stage";
  if (h.trim() === "decision") return "decision";
  if (h.includes("status")) return "status";
  if (h.includes("code")) return "code";
  if (h.includes("refund")) return "refund";
  if (h.includes("commission")) return "commission";
  if (h.includes("revenue") || h.includes("sales")) return "revenue";
  // The real sheet's name column is titled exactly "Affiliate" (see src/lib/rules/index.ts),
  // not "Affiliate Name" — the generic "name" substring check below never matches it.
  if (h.trim() === "affiliate") return "name";
  if (h.includes("name")) return "name";
  return null;
}

const STAGE_BADGE_COLORS = [
  "border-blue-500/20 bg-blue-500/10 text-blue-300/90",
  "border-purple-500/20 bg-purple-500/10 text-purple-300/90",
  "border-amber-500/20 bg-amber-500/10 text-amber-300/90",
  "border-pink-500/20 bg-pink-500/10 text-pink-300/90",
  "border-teal-500/20 bg-teal-500/10 text-teal-300/90",
  "border-indigo-500/20 bg-indigo-500/10 text-indigo-300/90",
];

/** Deterministic badge color for a stage name, so the same stage always renders the same color without storing one. */
export function stageBadgeColor(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return STAGE_BADGE_COLORS[Math.abs(hash) % STAGE_BADGE_COLORS.length];
}

const DECISION_BADGE_COLORS: Record<string, string> = {
  accepted: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300/90",
  "not accepted": "border-red-500/20 bg-red-500/10 text-red-300/90",
  "request more info": "border-amber-500/20 bg-amber-500/10 text-amber-300/90",
  "number not on wa": "border-slate-500/20 bg-slate-500/10 text-slate-300/90",
};

/** Badge color for a Releasit affiliate application's Decision — a fixed, known vocabulary (unlike freeform stages). */
export function decisionBadgeColor(value: string): string {
  return DECISION_BADGE_COLORS[value.trim().toLowerCase()] ?? "border-white/10 bg-white/5 text-zinc-400";
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
