// The default affiliate onboarding checklist is editable at runtime — see the
// OnboardingStepTemplate model and the /api/onboarding/template routes. This
// file now only holds the shared types and helpers around that data, plus the
// per-affiliate step logic (status labels, activity-log diffing, key
// generation for custom steps).
//
// `targetDays` is measured from when the step starts, except where
// `targetDaysAnchor` is "approval", which means "N days after the affiliate
// was approved" rather than from this step's own start.

export type OnboardingStepAnchor = "step_start" | "approval";

export type OnboardingStepTemplateItem = {
  key: string;
  label: string;
  order: number;
  targetDays: number;
  targetDaysAnchor: OnboardingStepAnchor;
  isApprovalAnchor: boolean;
};

/** Turns a step label into a URL/key-safe slug, e.g. "Send W-9 form!" -> "send_w_9_form". */
function slugify(label: string): string {
  return (
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "step"
  );
}

/** Builds a stepKey that doesn't collide with any key in `existingKeys` — appends a numeric suffix if needed. */
export function generateUniqueStepKey(label: string, existingKeys: Iterable<string>): string {
  const taken = new Set(existingKeys);
  const base = slugify(label);
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}_${n}`)) n++;
  return `${base}_${n}`;
}

export type OnboardingStepStatus = "not_started" | "in_progress" | "done" | "skipped";

export const ONBOARDING_STEP_STATUSES: OnboardingStepStatus[] = ["not_started", "in_progress", "done", "skipped"];

export const ONBOARDING_STEP_STATUS_LABEL: Record<OnboardingStepStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  done: "Done",
  skipped: "Skipped",
};

type StepSnapshot = {
  status: OnboardingStepStatus;
  owner: string | null;
  notes: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  targetDays: number | null;
  label: string;
};

function formatActivityDate(value: Date | null): string {
  if (!value) return "—";
  return value.toISOString().slice(0, 10);
}

/** Human-readable "what changed" lines for an OnboardingStep update, one per field that actually changed — used to write the activity log. */
export function describeStepChanges(before: StepSnapshot, after: Partial<StepSnapshot>): string[] {
  const messages: string[] = [];

  if (after.status !== undefined && after.status !== before.status) {
    messages.push(`Status changed to ${ONBOARDING_STEP_STATUS_LABEL[after.status]}`);
  }
  if (after.label !== undefined && after.label !== before.label) {
    messages.push(`Renamed to "${after.label}"`);
  }
  if (after.owner !== undefined && after.owner !== before.owner) {
    messages.push(after.owner ? `Owner set to ${after.owner}` : "Owner cleared");
  }
  if (after.notes !== undefined && after.notes !== before.notes) {
    messages.push(after.notes ? "Notes updated" : "Notes cleared");
  }
  if (after.startedAt !== undefined && after.startedAt?.getTime() !== before.startedAt?.getTime()) {
    messages.push(after.startedAt ? `Started date set to ${formatActivityDate(after.startedAt)}` : "Started date cleared");
  }
  if (after.completedAt !== undefined && after.completedAt?.getTime() !== before.completedAt?.getTime()) {
    messages.push(
      after.completedAt ? `Completed date set to ${formatActivityDate(after.completedAt)}` : "Completed date cleared",
    );
  }
  if (after.targetDays !== undefined && after.targetDays !== before.targetDays) {
    messages.push(after.targetDays !== null ? `Target days changed to ${after.targetDays}` : "Target days cleared");
  }

  return messages;
}

/** Row data (minus affiliateId, which the caller supplies) for seeding a fresh onboarding checklist from the current template. */
export function buildOnboardingStepRows(template: OnboardingStepTemplateItem[], owner?: string | null) {
  return template.map((step) => ({
    stepKey: step.key,
    label: step.label,
    order: step.order,
    targetDays: step.targetDays,
    targetDaysAnchor: step.targetDaysAnchor,
    isApprovalAnchor: step.isApprovalAnchor,
    status: "not_started" as OnboardingStepStatus,
    owner: owner ?? null,
  }));
}
