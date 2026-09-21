import type { NormalizationResult } from "./types";

export const STATUS_MAP = "STATUS_MAP";
export const STATUS_JUNK = "STATUS_JUNK";
export const STATUS_BLANK = "STATUS_BLANK";

export type Status = "ACTIVE" | "ACTIVE_NO_CONTRACT" | "INACTIVE" | "UNKNOWN";

export type StatusResult = NormalizationResult<Status> & { flagged: boolean };

export function normalizeStatus(raw: string | null | undefined): StatusResult {
  const trimmed = (raw ?? "").trim();
  const key = trimmed.toUpperCase().replace(/\s+/g, " ");

  if (!trimmed) {
    return {
      value: "UNKNOWN",
      raw: raw ?? null,
      flagged: true,
      issues: [{ ruleId: STATUS_BLANK, severity: "warning", field: "status", message: "Status is blank" }],
    };
  }

  if (key === "ACTIVE (NO CONTRACT)") {
    return { value: "ACTIVE_NO_CONTRACT", raw: trimmed, flagged: false, issues: [] };
  }
  if (key === "ACTIVE") {
    return { value: "ACTIVE", raw: trimmed, flagged: false, issues: [] };
  }
  if (key === "INACTIVE") {
    return { value: "INACTIVE", raw: trimmed, flagged: false, issues: [] };
  }

  return {
    value: "UNKNOWN",
    raw: trimmed,
    flagged: true,
    issues: [
      {
        ruleId: STATUS_JUNK,
        severity: "blocker",
        field: "status",
        message: `Unrecognized status value "${trimmed}"`,
      },
    ],
  };
}
