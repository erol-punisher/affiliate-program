// Pure stage rules for outreach (safe to import in the browser).

/** The stage a lead moves to after being reached out to again, or null if it shouldn't move. */
export function nextOutreachStage(stageName: string): string | null {
  const name = stageName.trim().toLowerCase();
  if (name.startsWith("affiliates in the pipeline")) return "Contacted";
  if (name === "contacted") return "Contacted (2)";
  if (name === "contacted (2)") return "Contacted (3)";
  return null;
}

/** Whether a reply from a lead in this stage should move them to "Responded with Interest". */
export function movesOnReply(stageName: string): boolean {
  const name = stageName.trim().toLowerCase();
  return name.startsWith("affiliates in the pipeline") || name === "contacted" || /^contacted \(\d+\)$/.test(name);
}
