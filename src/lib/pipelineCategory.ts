export const PIPELINE_CATEGORIES = [
  { value: "regional", label: "Regional" },
  { value: "campaign", label: "Marketing campaigns" },
] as const;

export type PipelineCategory = (typeof PIPELINE_CATEGORIES)[number]["value"];

/** A valid category, null to clear it (main overview pipeline), or undefined when not provided. */
export function parsePipelineCategory(value: unknown): PipelineCategory | null | undefined {
  if (value === undefined) return undefined;
  return PIPELINE_CATEGORIES.some((c) => c.value === value) ? (value as PipelineCategory) : null;
}
