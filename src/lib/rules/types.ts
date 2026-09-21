export type Severity = "blocker" | "warning" | "info";

export type FieldIssue = {
  ruleId: string;
  severity: Severity;
  field: string;
  message: string;
};

export type NormalizationResult<T> = {
  value: T;
  raw: string | null;
  issues: FieldIssue[];
};
