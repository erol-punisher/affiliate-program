import type { Severity } from "./types";

const PENALTY: Record<Severity, number> = {
  blocker: 20,
  warning: 8,
  info: 2,
};

/** Simple deduction-based health score, 0-100, from a record's accumulated issues. */
export function computeHealthScore(issues: { severity: Severity }[]): number {
  const score = issues.reduce((acc, issue) => acc - PENALTY[issue.severity], 100);
  return Math.max(0, Math.min(100, score));
}
