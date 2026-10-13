"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { TopNav } from "@/components/TopNav";
import { CheckIcon, PencilIcon, PlusIcon, TrashIcon, XIcon } from "@/components/icons";
import { ONBOARDING_STEP_STATUS_LABEL, type OnboardingStepAnchor, type OnboardingStepStatus } from "@/lib/onboardingSteps";
import { computeOnboardingMetrics, getCurrentStepStatus, type CurrentStepStatus } from "@/lib/onboardingStatus";

type OnboardingActivityEntry = {
  id: string;
  actor: string;
  message: string;
  createdAt: string;
};

type OnboardingStep = {
  id: string;
  affiliateId: string;
  stepKey: string;
  label: string;
  order: number;
  status: OnboardingStepStatus;
  owner: string | null;
  startedAt: string | null;
  completedAt: string | null;
  targetDays: number | null;
  targetDaysAnchor: OnboardingStepAnchor;
  isApprovalAnchor: boolean;
  notes: string | null;
  autoCompleted: boolean;
  activity: OnboardingActivityEntry[];
};

type OnboardingAffiliate = {
  id: string;
  name: string;
  tier: string | null;
  status: string;
  countryCode: string | null;
  firstInstallAt: string | null;
  firstPaidMerchantAt: string | null;
  onboardingSteps: OnboardingStep[];
};

type Candidate = {
  id: string;
  name: string;
  tier: string | null;
  status: string;
};

type TemplateStep = {
  id: string;
  key: string;
  label: string;
  order: number;
  targetDays: number;
  targetDaysAnchor: OnboardingStepAnchor;
  isApprovalAnchor: boolean;
};

type VisualState = "done" | "current" | "overdue" | "skipped" | "not_started";

const VISUAL_CLASSES: Record<VisualState, string> = {
  done: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
  current: "border-blue-500/40 bg-blue-500/15 text-blue-300",
  overdue: "border-red-500/40 bg-red-500/15 text-red-300",
  skipped: "border-white/10 border-dashed bg-white/[0.03] text-zinc-500",
  not_started: "border-white/10 bg-white/5 text-zinc-500",
}; // grey = not started, green = done, blue = current, red = overdue (skipped gets its own dashed grey look)

const VISUAL_DOT_CLASSES: Record<VisualState, string> = {
  done: "bg-emerald-400",
  current: "bg-blue-400",
  overdue: "bg-red-400",
  skipped: "bg-zinc-600",
  not_started: "bg-zinc-600",
};

const APPROVAL_STEP_KEY = "approved_manager_assigned";
const DAY_MS = 24 * 60 * 60 * 1000;

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function toDateInputValue(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** Per-box color: only the affiliate's actual current step (from getCurrentStepStatus) can be "current"/"overdue" — every step after it is just "not started" until its turn comes. */
function getVisualState(step: OnboardingStep, current: CurrentStepStatus): VisualState {
  if (step.status === "done") return "done";
  if (step.status === "skipped") return "skipped";
  if (!current.graduated && current.stepKey === step.stepKey) {
    return current.overdue ? "overdue" : "current";
  }
  return "not_started";
}

function stepSubtext(step: OnboardingStep, current: CurrentStepStatus): string {
  if (step.status === "done") return step.completedAt ? formatDate(step.completedAt) : "Done";
  if (step.status === "skipped") return "Skipped";

  const isCurrent = !current.graduated && current.stepKey === step.stepKey;
  if (!isCurrent || current.graduated) {
    return step.targetDays !== null ? `Target: ${step.targetDays}d` : "No target";
  }

  if (current.daysSinceReference === null || step.targetDays === null) {
    return step.targetDays !== null ? `Target: ${step.targetDays}d` : "No target";
  }

  const remaining = step.targetDays - current.daysSinceReference;
  if (remaining < 0) return `${Math.abs(remaining)}d overdue`;
  if (remaining === 0) return "Due today";
  return `${remaining}d remaining`;
}

/** Magnitude of overdueness for sorting — 0 (or less) for anything that isn't currently overdue. */
function overdueDays(steps: OnboardingStep[], current: CurrentStepStatus): number {
  if (current.graduated || !current.overdue || current.daysSinceReference === null) return 0;
  const step = steps.find((s) => s.stepKey === current.stepKey);
  if (!step || step.targetDays === null) return 0;
  return current.daysSinceReference - step.targetDays;
}

function daySinceApprovalLabel(steps: OnboardingStep[]): string {
  const approval = steps.find((s) => s.stepKey === APPROVAL_STEP_KEY);
  if (!approval?.completedAt) return "Not yet approved";
  const days = Math.floor((Date.now() - new Date(approval.completedAt).getTime()) / DAY_MS);
  return `Day ${days}`;
}

const AFFILIATE_MANAGERS = ["Erol", "Kenneth", "Angelica", "Kemal", "Felipe"];

function assignedManager(steps: OnboardingStep[]): string {
  const approval = steps.find((s) => s.stepKey === APPROVAL_STEP_KEY);
  return approval?.owner || "Unassigned";
}

const LEGEND: { visual: VisualState; label: string }[] = [
  { visual: "done", label: "Done" },
  { visual: "current", label: "Current step" },
  { visual: "overdue", label: "Overdue" },
  { visual: "not_started", label: "Not started" },
  { visual: "skipped", label: "Skipped" },
];

type StatusFilter = "all" | "on_track" | "overdue" | "graduated";
type SortMode = "default" | "most_overdue";

function matchesStatusFilter(current: CurrentStepStatus, filter: StatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "graduated") return current.graduated;
  if (filter === "overdue") return !current.graduated && current.overdue;
  return !current.graduated && !current.overdue; // on_track
}

type Props = {
  userEmail: string;
};

export function OnboardingBoard({ userEmail }: Props) {
  const [affiliates, setAffiliates] = useState<OnboardingAffiliate[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showStartPanel, setShowStartPanel] = useState(false);
  const [candidateQuery, setCandidateQuery] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [starting, setStarting] = useState(false);
  const latestCandidateQuery = useRef("");

  const [editingStep, setEditingStep] = useState<OnboardingStep | null>(null);
  const [savingStep, setSavingStep] = useState(false);

  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [templateSteps, setTemplateSteps] = useState<TemplateStep[] | null>(null);

  const [managerFilter, setManagerFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("default");

  useEffect(() => {
    void loadAffiliates();
  }, []);

  async function loadAffiliates() {
    setLoadError(null);
    try {
      const res = await fetch("/api/onboarding");
      if (!res.ok) throw new Error(`Failed to load onboarding (${res.status})`);
      const body = await res.json();
      setAffiliates(body.affiliates ?? []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load onboarding");
    }
  }

  async function searchCandidates(q: string) {
    setCandidateQuery(q);
    latestCandidateQuery.current = q;
    try {
      const res = await fetch(`/api/onboarding/candidates?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error();
      const body = await res.json();
      // A faster later keystroke's response may have already arrived — never let a slower,
      // now-stale request overwrite it.
      if (latestCandidateQuery.current !== q) return;
      setCandidates(body.affiliates ?? []);
    } catch {
      if (latestCandidateQuery.current === q) setCandidates([]);
    }
  }

  async function startOnboarding(affiliateId: string) {
    setStarting(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ affiliateId }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Failed to start onboarding");
      setShowStartPanel(false);
      setCandidateQuery("");
      setCandidates([]);
      await loadAffiliates();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to start onboarding");
    } finally {
      setStarting(false);
    }
  }

  async function updateStep(stepId: string, affiliateId: string, patch: Record<string, string | number | null>) {
    setAffiliates((prev) =>
      prev?.map((a) => {
        if (a.id !== affiliateId) return a;
        return {
          ...a,
          onboardingSteps: a.onboardingSteps.map((s) => (s.id === stepId ? ({ ...s, ...patch } as OnboardingStep) : s)),
        };
      }) ?? null,
    );

    try {
      const res = await fetch(`/api/onboarding/steps/${stepId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
      const body = await res.json();
      setAffiliates((prev) =>
        prev?.map((a) => {
          if (a.id !== affiliateId) return a;
          return { ...a, onboardingSteps: a.onboardingSteps.map((s) => (s.id === stepId ? body.step : s)) };
        }) ?? null,
      );
      setEditingStep((prev) => (prev?.id === stepId ? body.step : prev));
    } catch {
      setLoadError("Failed to save step — reloading");
      await loadAffiliates();
    }
  }

  async function updateAffiliateEvents(affiliateId: string, patch: Record<string, string | null>) {
    setAffiliates((prev) => prev?.map((a) => (a.id === affiliateId ? ({ ...a, ...patch } as OnboardingAffiliate) : a)) ?? null);

    try {
      const res = await fetch(`/api/onboarding/affiliates/${affiliateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
      const body = await res.json();
      // Replace the whole record — auto-completion may have changed one or more steps too.
      setAffiliates((prev) => prev?.map((a) => (a.id === affiliateId ? body.affiliate : a)) ?? null);
    } catch {
      setLoadError("Failed to save — reloading");
      await loadAffiliates();
    }
  }

  async function removeFromOnboarding(affiliateId: string) {
    const previous = affiliates;
    setAffiliates((prev) => prev?.filter((a) => a.id !== affiliateId) ?? null);
    setEditingStep((prev) => (prev?.affiliateId === affiliateId ? null : prev));

    try {
      const res = await fetch(`/api/onboarding/affiliates/${affiliateId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      setLoadError("Failed to remove affiliate — reloading");
      setAffiliates(previous);
      await loadAffiliates();
    }
  }

  async function addStep(affiliateId: string, label: string) {
    try {
      const res = await fetch("/api/onboarding/steps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ affiliateId, label }),
      });
      if (!res.ok) throw new Error();
      const body = await res.json();
      setAffiliates(
        (prev) =>
          prev?.map((a) => (a.id === affiliateId ? { ...a, onboardingSteps: [...a.onboardingSteps, body.step] } : a)) ??
          null,
      );
    } catch {
      setLoadError("Failed to add step — reloading");
      await loadAffiliates();
    }
  }

  async function deleteStep(step: OnboardingStep) {
    setAffiliates(
      (prev) =>
        prev?.map((a) =>
          a.id === step.affiliateId
            ? { ...a, onboardingSteps: a.onboardingSteps.filter((s) => s.id !== step.id) }
            : a,
        ) ?? null,
    );
    setEditingStep((prev) => (prev?.id === step.id ? null : prev));

    try {
      const res = await fetch(`/api/onboarding/steps/${step.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      setLoadError("Failed to delete step — reloading");
      await loadAffiliates();
    }
  }

  async function reorderSteps(affiliateId: string, orderedStepIds: string[]) {
    setAffiliates(
      (prev) =>
        prev?.map((a) => {
          if (a.id !== affiliateId) return a;
          const byId = new Map(a.onboardingSteps.map((s) => [s.id, s]));
          const reordered = orderedStepIds
            .map((id, i) => {
              const s = byId.get(id);
              return s ? { ...s, order: i } : null;
            })
            .filter((s): s is OnboardingStep => s !== null);
          return { ...a, onboardingSteps: reordered };
        }) ?? null,
    );

    try {
      const results = await Promise.all(
        orderedStepIds.map((id, i) =>
          fetch(`/api/onboarding/steps/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ order: i }),
          }),
        ),
      );
      if (results.some((r) => !r.ok)) throw new Error();
    } catch {
      setLoadError("Failed to save step order — reloading");
      await loadAffiliates();
    }
  }

  async function loadTemplate() {
    try {
      const res = await fetch("/api/onboarding/template");
      if (!res.ok) throw new Error();
      const body = await res.json();
      setTemplateSteps(body.template ?? []);
    } catch {
      setTemplateSteps([]);
    }
  }

  async function addTemplateStep(label: string) {
    try {
      const res = await fetch("/api/onboarding/template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      if (!res.ok) throw new Error();
      const body = await res.json();
      setTemplateSteps((prev) => [...(prev ?? []), body.step]);
    } catch {
      await loadTemplate();
    }
  }

  async function updateTemplateStep(id: string, patch: Record<string, string | number | boolean | null>) {
    // Setting the approval anchor clears it on every other row server-side — a single-row merge
    // would leave stale local state, so just reload the whole list for that patch.
    const affectsOtherRows = "isApprovalAnchor" in patch;

    if (!affectsOtherRows) {
      setTemplateSteps((prev) => prev?.map((s) => (s.id === id ? ({ ...s, ...patch } as TemplateStep) : s)) ?? null);
    }

    try {
      const res = await fetch(`/api/onboarding/template/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
      if (affectsOtherRows) {
        await loadTemplate();
      } else {
        const body = await res.json();
        setTemplateSteps((prev) => prev?.map((s) => (s.id === id ? body.step : s)) ?? null);
      }
    } catch {
      await loadTemplate();
    }
  }

  async function deleteTemplateStep(id: string) {
    setTemplateSteps((prev) => prev?.filter((s) => s.id !== id) ?? null);
    try {
      const res = await fetch(`/api/onboarding/template/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      await loadTemplate();
    }
  }

  async function reorderTemplateSteps(orderedIds: string[]) {
    setTemplateSteps(
      (prev) => {
        if (!prev) return prev;
        const byId = new Map(prev.map((s) => [s.id, s]));
        return orderedIds.map((id, i) => ({ ...byId.get(id)!, order: i }));
      },
    );
    try {
      const results = await Promise.all(
        orderedIds.map((id, i) =>
          fetch(`/api/onboarding/template/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ order: i }),
          }),
        ),
      );
      if (results.some((r) => !r.ok)) throw new Error();
    } catch {
      await loadTemplate();
    }
  }

  const managers = useMemo(() => {
    if (!affiliates) return [];
    return Array.from(new Set(affiliates.map((a) => assignedManager(a.onboardingSteps)))).sort();
  }, [affiliates]);

  const regions = useMemo(() => {
    if (!affiliates) return [];
    return Array.from(new Set(affiliates.map((a) => a.countryCode).filter((c): c is string => !!c))).sort();
  }, [affiliates]);

  const visibleAffiliates = useMemo(() => {
    if (!affiliates) return [];

    const withStatus = affiliates.map((affiliate) => ({
      affiliate,
      current: getCurrentStepStatus(affiliate.onboardingSteps),
    }));

    const filtered = withStatus.filter(({ affiliate, current }) => {
      if (managerFilter && assignedManager(affiliate.onboardingSteps) !== managerFilter) return false;
      if (regionFilter && affiliate.countryCode !== regionFilter) return false;
      if (!matchesStatusFilter(current, statusFilter)) return false;
      return true;
    });

    if (sortMode === "most_overdue") {
      filtered.sort(
        (a, b) =>
          overdueDays(b.affiliate.onboardingSteps, b.current) - overdueDays(a.affiliate.onboardingSteps, a.current),
      );
    }

    return filtered.map((x) => x.affiliate);
  }, [affiliates, managerFilter, regionFilter, statusFilter, sortMode]);

  const metrics = useMemo(
    () => computeOnboardingMetrics(visibleAffiliates.map((a) => a.onboardingSteps)),
    [visibleAffiliates],
  );

  return (
    <div className="flex min-h-full flex-col">
      <TopNav userEmail={userEmail} />

      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-zinc-100">Onboarding</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setShowTemplateManager(true);
                void loadTemplate();
              }}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-white/5"
            >
              <PencilIcon className="h-3.5 w-3.5" />
              Manage template
            </button>
            <button
              type="button"
              onClick={() => setShowStartPanel(true)}
              className="flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-1.5 text-sm font-medium text-zinc-100 transition-colors hover:bg-blue-600"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              Start onboarding
            </button>
          </div>
        </div>

        {loadError && (
          <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-400">{loadError}</p>
        )}

        {affiliates !== null && affiliates.length > 0 && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <MetricCard label="In onboarding" value={metrics.inOnboardingCount} />
            <MetricCard label="Overdue" value={metrics.overdueCount} accent={metrics.overdueCount > 0 ? "red" : undefined} />
            <MetricCard
              label="Avg. days to first install"
              value={metrics.avgDaysApprovalToFirstInstall !== null ? `${metrics.avgDaysApprovalToFirstInstall}d` : "—"}
              caption="Approval → Day 30 milestone"
            />
            <MetricCard
              label="Reached Day 90 (6mo)"
              value={metrics.day90RecentRate !== null ? `${metrics.day90RecentRate.percent}%` : "—"}
              caption={
                metrics.day90RecentRate !== null
                  ? `${metrics.day90RecentRate.reached} of ${metrics.day90RecentRate.eligible} eligible`
                  : "No affiliates eligible yet"
              }
            />
          </div>
        )}

        {affiliates !== null && affiliates.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={managerFilter}
              onChange={(e) => setManagerFilter(e.target.value)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-zinc-200 outline-none focus:ring-1 focus:ring-blue-500/50"
            >
              <option value="" className="bg-[#10141f]">All managers</option>
              {managers.map((m) => (
                <option key={m} value={m} className="bg-[#10141f]">{m}</option>
              ))}
            </select>

            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-zinc-200 outline-none focus:ring-1 focus:ring-blue-500/50"
            >
              <option value="" className="bg-[#10141f]">All regions</option>
              {regions.map((r) => (
                <option key={r} value={r} className="bg-[#10141f]">{r}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-zinc-200 outline-none focus:ring-1 focus:ring-blue-500/50"
            >
              <option value="all" className="bg-[#10141f]">All statuses</option>
              <option value="on_track" className="bg-[#10141f]">On track</option>
              <option value="overdue" className="bg-[#10141f]">Overdue</option>
              <option value="graduated" className="bg-[#10141f]">Graduated</option>
            </select>

            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="ml-auto rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-zinc-200 outline-none focus:ring-1 focus:ring-blue-500/50"
            >
              <option value="default" className="bg-[#10141f]">Sort: Default</option>
              <option value="most_overdue" className="bg-[#10141f]">Sort: Most overdue first</option>
            </select>
          </div>
        )}

        {affiliates === null ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : affiliates.length === 0 ? (
          <p className="text-sm text-zinc-500">No affiliates are being onboarded yet.</p>
        ) : visibleAffiliates.length === 0 ? (
          <p className="text-sm text-zinc-500">No affiliates match these filters.</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {visibleAffiliates.map((a) => (
              <AffiliateOnboardingCard
                key={a.id}
                affiliate={a}
                onSelectStep={setEditingStep}
                onUpdateEvents={(affiliateId, patch) => void updateAffiliateEvents(affiliateId, patch)}
                onUpdateStep={(stepId, affiliateId, patch) => void updateStep(stepId, affiliateId, patch)}
                onAddStep={(affiliateId, label) => void addStep(affiliateId, label)}
                onReorderSteps={(affiliateId, orderedIds) => void reorderSteps(affiliateId, orderedIds)}
                onRemove={(affiliateId) => void removeFromOnboarding(affiliateId)}
              />
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-white/10 bg-[#10141f] px-5 py-4">
          {LEGEND.map((item) => (
            <div key={item.visual} className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${VISUAL_DOT_CLASSES[item.visual]}`} />
              <span className="text-xs text-zinc-400">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {showStartPanel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowStartPanel(false);
          }}
        >
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#10141f] shadow-2xl shadow-black/60">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <h3 className="text-sm font-semibold text-zinc-100">Start onboarding</h3>
              <button
                type="button"
                onClick={() => setShowStartPanel(false)}
                className="text-zinc-500 transition-colors hover:text-zinc-300"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5">
              <input
                autoFocus
                type="text"
                value={candidateQuery}
                onChange={(e) => void searchCandidates(e.target.value)}
                placeholder="Search affiliates by name…"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-blue-500/50"
              />
              <div className="mt-3 max-h-64 divide-y divide-white/5 overflow-y-auto">
                {candidates.length === 0 ? (
                  <p className="py-3 text-sm text-zinc-500">
                    {candidateQuery ? "No matches." : "Type to search affiliates not yet onboarding."}
                  </p>
                ) : (
                  candidates.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      disabled={starting}
                      onClick={() => void startOnboarding(c.id)}
                      className="block w-full px-1 py-2.5 text-left text-sm text-zinc-200 transition-colors hover:bg-white/5 disabled:opacity-50"
                    >
                      {c.name}
                      {c.tier && <span className="ml-2 text-xs text-zinc-500">Tier {c.tier}</span>}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {editingStep && (
        <StepSidePanel
          step={editingStep}
          saving={savingStep}
          onClose={() => setEditingStep(null)}
          onUpdate={async (patch) => {
            setSavingStep(true);
            await updateStep(editingStep.id, editingStep.affiliateId, patch);
            setSavingStep(false);
          }}
          onDelete={() => void deleteStep(editingStep)}
        />
      )}

      {showTemplateManager && (
        <TemplateManagerModal
          steps={templateSteps}
          onClose={() => setShowTemplateManager(false)}
          onAdd={(label) => void addTemplateStep(label)}
          onUpdate={(id, patch) => void updateTemplateStep(id, patch)}
          onDelete={(id) => void deleteTemplateStep(id)}
          onReorder={(orderedIds) => void reorderTemplateSteps(orderedIds)}
        />
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  caption,
  accent,
}: {
  label: string;
  value: number | string;
  caption?: string;
  accent?: "red";
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#10141f] px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${accent === "red" ? "text-red-400" : "text-zinc-100"}`}>{value}</p>
      {caption && <p className="mt-0.5 text-xs text-zinc-500">{caption}</p>}
    </div>
  );
}

function AutoTag() {
  return (
    <span
      title="Completed automatically from a recorded event, not by a person"
      className="shrink-0 rounded border border-current/30 px-1 py-px text-[9px] font-semibold uppercase tracking-wide opacity-80"
    >
      Auto
    </span>
  );
}

function AffiliateOnboardingCard({
  affiliate,
  onSelectStep,
  onUpdateEvents,
  onUpdateStep,
  onAddStep,
  onReorderSteps,
  onRemove,
}: {
  affiliate: OnboardingAffiliate;
  onSelectStep: (step: OnboardingStep) => void;
  onUpdateEvents: (affiliateId: string, patch: Record<string, string | null>) => void;
  onUpdateStep: (stepId: string, affiliateId: string, patch: Record<string, string | null>) => void;
  onAddStep: (affiliateId: string, label: string) => void;
  onReorderSteps: (affiliateId: string, orderedStepIds: string[]) => void;
  onRemove: (affiliateId: string) => void;
}) {
  const steps = affiliate.onboardingSteps;
  const current = getCurrentStepStatus(steps);
  // The manager lives on the approval step's owner, same as the step panel and the manager filter.
  const approvalStep = steps.find((s) => s.stepKey === APPROVAL_STEP_KEY);
  const manager = approvalStep?.owner ?? "";
  const managerOptions = manager && !AFFILIATE_MANAGERS.includes(manager) ? [...AFFILIATE_MANAGERS, manager] : AFFILIATE_MANAGERS;

  const [draggedStepId, setDraggedStepId] = useState<string | null>(null);
  const [dragOverStepId, setDragOverStepId] = useState<string | null>(null);
  const [addingStep, setAddingStep] = useState(false);
  const [newStepLabel, setNewStepLabel] = useState("");
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  function handleDrop(targetStepId: string) {
    if (!draggedStepId || draggedStepId === targetStepId) return;
    const ids = steps.map((s) => s.id);
    const fromIndex = ids.indexOf(draggedStepId);
    const toIndex = ids.indexOf(targetStepId);
    if (fromIndex === -1 || toIndex === -1) return;
    const [moved] = ids.splice(fromIndex, 1);
    ids.splice(toIndex, 0, moved);
    onReorderSteps(affiliate.id, ids);
  }

  function submitNewStep() {
    const label = newStepLabel.trim();
    if (label) onAddStep(affiliate.id, label);
    setNewStepLabel("");
    setAddingStep(false);
  }

  return (
    <div className="flex flex-col rounded-xl border border-white/10 bg-[#10141f]">
      <div className="border-b border-white/10 px-5 py-4">
        <div className="flex items-start justify-between gap-2">
          <h2 className="truncate text-base font-semibold text-zinc-100">{affiliate.name}</h2>
          <div className="flex shrink-0 items-center gap-1.5">
            {current.graduated ? (
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                Graduated
              </span>
            ) : current.overdue ? (
              <span className="rounded-full border border-red-500/30 bg-red-500/15 px-2 py-0.5 text-[10px] font-medium text-red-300">
                Overdue
              </span>
            ) : null}
            {confirmingRemove ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onRemove(affiliate.id)}
                  className="rounded-md bg-red-600 px-2 py-1 text-[10px] font-medium text-zinc-100 transition-colors hover:bg-red-500"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingRemove(false)}
                  className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-zinc-300 transition-colors hover:bg-white/5"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                title="Remove from onboarding"
                onClick={() => setConfirmingRemove(true)}
                className="text-zinc-600 transition-colors hover:text-red-400"
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
          {approvalStep ? (
            <select
              value={manager}
              onChange={(e) => onUpdateStep(approvalStep.id, affiliate.id, { owner: e.target.value || null })}
              title="Affiliate manager"
              className={`-mx-1 cursor-pointer rounded border border-transparent bg-transparent px-1 py-0.5 text-xs outline-none transition-colors hover:border-white/10 hover:bg-white/5 focus:ring-1 focus:ring-blue-500/50 ${manager ? "text-zinc-300" : "text-zinc-500"}`}
            >
              <option value="" className="bg-[#10141f]">Unassigned</option>
              {managerOptions.map((m) => (
                <option key={m} value={m} className="bg-[#10141f]">
                  {m}
                </option>
              ))}
            </select>
          ) : (
            <span>{assignedManager(steps)}</span>
          )}
          {affiliate.countryCode && (
            <>
              <span className="text-zinc-700">·</span>
              <span>{affiliate.countryCode}</span>
            </>
          )}
          <span className="text-zinc-700">·</span>
          <span className="font-medium text-zinc-400">{daySinceApprovalLabel(steps)}</span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wide text-zinc-600">First install</span>
            <input
              type="date"
              defaultValue={toDateInputValue(affiliate.firstInstallAt)}
              onChange={(e) => onUpdateEvents(affiliate.id, { firstInstallAt: e.target.value || null })}
              className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-300 outline-none focus:ring-1 focus:ring-blue-500/50"
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wide text-zinc-600">First paid merchant</span>
            <input
              type="date"
              defaultValue={toDateInputValue(affiliate.firstPaidMerchantAt)}
              onChange={(e) => onUpdateEvents(affiliate.id, { firstPaidMerchantAt: e.target.value || null })}
              className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-300 outline-none focus:ring-1 focus:ring-blue-500/50"
            />
          </label>
        </div>
      </div>

      <div className="flex flex-col px-5 py-5">
        {steps.map((step, i) => {
          const visual = getVisualState(step, current);
          const isDragged = draggedStepId === step.id;
          const isHovered = draggedStepId !== null && draggedStepId !== step.id && dragOverStepId === step.id;
          return (
            <div key={step.id} className="flex flex-col items-stretch">
              <button
                type="button"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  setDraggedStepId(step.id);
                }}
                onDragEnd={() => {
                  setDraggedStepId(null);
                  setDragOverStepId(null);
                }}
                onDragOver={(e) => {
                  if (draggedStepId && draggedStepId !== step.id) {
                    e.preventDefault();
                    if (dragOverStepId !== step.id) setDragOverStepId(step.id);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(step.id);
                  setDraggedStepId(null);
                  setDragOverStepId(null);
                }}
                onClick={() => onSelectStep(step)}
                className={`flex cursor-grab items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-all duration-150 active:cursor-grabbing ${
                  isDragged
                    ? "scale-95 opacity-40"
                    : isHovered
                      ? "scale-[1.02] ring-2 ring-blue-500/50"
                      : "hover:scale-[1.02]"
                } ${VISUAL_CLASSES[visual]}`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {visual === "done" && <CheckIcon className="h-3.5 w-3.5 shrink-0" />}
                  <span className="truncate text-xs font-medium">{step.label}</span>
                  {step.autoCompleted && <AutoTag />}
                </span>
                <span className="shrink-0 text-[11px] opacity-80">{stepSubtext(step, current)}</span>
              </button>
              {i < steps.length - 1 && (
                <div className="flex justify-center py-0.5">
                  <div className={`h-3 w-0.5 rounded-full ${visual === "done" ? "bg-emerald-500/50" : "bg-white/15"}`} />
                </div>
              )}
            </div>
          );
        })}

        {addingStep ? (
          <div className="mt-2 flex items-center gap-1.5">
            <input
              autoFocus
              type="text"
              value={newStepLabel}
              onChange={(e) => setNewStepLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitNewStep();
                if (e.key === "Escape") {
                  setAddingStep(false);
                  setNewStepLabel("");
                }
              }}
              onBlur={() => {
                if (newStepLabel.trim()) submitNewStep();
                else setAddingStep(false);
              }}
              placeholder="New step label…"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-100 outline-none focus:ring-1 focus:ring-blue-500/50"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAddingStep(true)}
            className="mt-2 flex items-center justify-center gap-1 rounded-lg border border-dashed border-white/10 px-3 py-2 text-xs text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300"
          >
            <PlusIcon className="h-3 w-3" />
            Add step
          </button>
        )}
      </div>
    </div>
  );
}

const STATUS_PILL_CLASSES: Record<OnboardingStepStatus, string> = {
  not_started: "border-white/10 bg-white/5 text-zinc-400",
  in_progress: "border-blue-500/30 bg-blue-500/15 text-blue-300",
  done: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
  skipped: "border-zinc-500/20 bg-zinc-500/10 text-zinc-500",
};

function StepSidePanel({
  step,
  saving,
  onClose,
  onUpdate,
  onDelete,
}: {
  step: OnboardingStep;
  saving: boolean;
  onClose: () => void;
  onUpdate: (patch: Record<string, string | number | null>) => Promise<void>;
  onDelete: () => void;
}) {
  const [owner, setOwner] = useState(step.owner ?? "");
  const [notes, setNotes] = useState(step.notes ?? "");
  const [label, setLabel] = useState(step.label);
  const [targetDays, setTargetDays] = useState(step.targetDays !== null ? String(step.targetDays) : "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex h-full w-full max-w-md flex-col overflow-hidden border-l border-white/10 bg-[#10141f] shadow-2xl shadow-black/60">
        <div className="h-1 w-full shrink-0 bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500" />

        <div className="shrink-0 border-b border-white/10 px-6 py-5">
          <div className="flex items-start justify-between gap-3">
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={() => {
                if (label.trim() && label !== step.label) void onUpdate({ label: label.trim() });
                else setLabel(step.label);
              }}
              className="min-w-0 flex-1 rounded-md bg-transparent text-base font-semibold text-zinc-100 outline-none focus:ring-1 focus:ring-blue-500/50"
            />
            <button type="button" onClick={onClose} className="shrink-0 text-zinc-500 transition-colors hover:text-zinc-200">
              <XIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_PILL_CLASSES[step.status]}`}
            >
              {ONBOARDING_STEP_STATUS_LABEL[step.status]}
            </span>
            {step.autoCompleted && <AutoTag />}
          </div>

          <div className="mt-3 flex items-center gap-2">
            {(step.status === "not_started" || step.status === "in_progress") && (
              <>
                {step.status === "not_started" && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void onUpdate({ status: "in_progress" })}
                    className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-sm font-medium text-blue-300 transition-colors hover:bg-blue-500/20 disabled:opacity-50"
                  >
                    In Progress
                  </button>
                )}
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void onUpdate({ status: "done", completedAt: new Date().toISOString() })}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-zinc-100 transition-colors hover:bg-emerald-500 disabled:opacity-50"
                >
                  Mark done
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void onUpdate({ status: "skipped" })}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-white/5 disabled:opacity-50"
                >
                  Mark skipped
                </button>
              </>
            )}
            {(step.status === "done" || step.status === "skipped") && (
              <button
                type="button"
                disabled={saving}
                onClick={() => void onUpdate({ status: "in_progress", completedAt: null })}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-white/5 disabled:opacity-50"
              >
                Reopen
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <section className="mb-6">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Owner</h3>
            <input
              type="text"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              onBlur={() => {
                if (owner !== (step.owner ?? "")) void onUpdate({ owner: owner || null });
              }}
              placeholder="Unassigned"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-blue-500/50"
            />
          </section>

          <section className="mb-6 grid grid-cols-2 gap-4">
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Started</h3>
              <p className="text-sm text-zinc-300">{formatDate(step.startedAt)}</p>
            </div>
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Completed</h3>
              <p className="text-sm text-zinc-300">{formatDate(step.completedAt)}</p>
            </div>
          </section>

          <section className="mb-6 grid grid-cols-2 gap-4">
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Target days</h3>
              <input
                type="number"
                min={0}
                value={targetDays}
                onChange={(e) => setTargetDays(e.target.value)}
                onBlur={() => {
                  const parsed = targetDays.trim() === "" ? null : Number(targetDays);
                  if (parsed !== step.targetDays && (parsed === null || Number.isFinite(parsed))) {
                    void onUpdate({ targetDays: parsed });
                  }
                }}
                placeholder="No target"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-blue-500/50"
              />
            </div>
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Measured from</h3>
              <select
                value={step.targetDaysAnchor}
                onChange={(e) => void onUpdate({ targetDaysAnchor: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-blue-500/50"
              >
                <option value="step_start" className="bg-[#10141f]">Previous step</option>
                <option value="approval" className="bg-[#10141f]">Approval date</option>
              </select>
            </div>
          </section>

          <section className="mb-6">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Notes</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => {
                if (notes !== (step.notes ?? "")) void onUpdate({ notes: notes || null });
              }}
              rows={3}
              placeholder="Add a note…"
              className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-blue-500/50"
            />
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Activity</h3>
            {step.activity.length === 0 ? (
              <p className="text-sm text-zinc-600">No activity yet.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {step.activity.map((entry) => (
                  <div key={entry.id} className="text-sm">
                    <p className="text-zinc-300">{entry.message}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {entry.actor} · {formatDateTime(entry.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="mt-8 border-t border-white/10 pt-5">
            {confirmingDelete ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2.5">
                <p className="text-xs text-red-300">Delete this step? This can&apos;t be undone.</p>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={onDelete}
                    className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-zinc-100 transition-colors hover:bg-red-500"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    className="rounded-md border border-white/10 px-2.5 py-1 text-xs text-zinc-300 transition-colors hover:bg-white/5"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="flex items-center gap-1.5 text-xs text-zinc-500 transition-colors hover:text-red-400"
              >
                <TrashIcon className="h-3.5 w-3.5" />
                Delete step
              </button>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function TemplateManagerModal({
  steps,
  onClose,
  onAdd,
  onUpdate,
  onDelete,
  onReorder,
}: {
  steps: TemplateStep[] | null;
  onClose: () => void;
  onAdd: (label: string) => void;
  onUpdate: (id: string, patch: Record<string, string | number | boolean | null>) => void;
  onDelete: (id: string) => void;
  onReorder: (orderedIds: string[]) => void;
}) {
  const [newLabel, setNewLabel] = useState("");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  function handleDrop(targetId: string) {
    if (!draggedId || draggedId === targetId || !steps) return;
    const ids = steps.map((s) => s.id);
    const fromIndex = ids.indexOf(draggedId);
    const toIndex = ids.indexOf(targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    const [moved] = ids.splice(fromIndex, 1);
    ids.splice(toIndex, 0, moved);
    onReorder(ids);
  }

  function submitNewStep() {
    const label = newLabel.trim();
    if (label) onAdd(label);
    setNewLabel("");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-white/10 bg-[#10141f] shadow-2xl shadow-black/60">
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">Manage onboarding template</h3>
            <p className="mt-0.5 text-xs text-zinc-500">
              Changes apply to affiliates who start onboarding from now on. Existing checklists aren&apos;t rewritten —
              edit those individually from their card.
            </p>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 text-zinc-500 transition-colors hover:text-zinc-200">
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {steps === null ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : (
            <div className="flex flex-col gap-2">
              {steps.map((step) => {
                const isDragged = draggedId === step.id;
                const isHovered = draggedId !== null && draggedId !== step.id && dragOverId === step.id;
                return (
                  <div
                    key={step.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      setDraggedId(step.id);
                    }}
                    onDragEnd={() => {
                      setDraggedId(null);
                      setDragOverId(null);
                    }}
                    onDragOver={(e) => {
                      if (draggedId && draggedId !== step.id) {
                        e.preventDefault();
                        if (dragOverId !== step.id) setDragOverId(step.id);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleDrop(step.id);
                      setDraggedId(null);
                      setDragOverId(null);
                    }}
                    className={`flex cursor-grab items-center gap-3 rounded-lg border px-3 py-2.5 transition-all duration-150 active:cursor-grabbing ${
                      isDragged
                        ? "scale-95 border-white/10 opacity-40"
                        : isHovered
                          ? "scale-[1.01] border-blue-500/50 ring-2 ring-blue-500/40"
                          : "border-white/10 bg-white/[0.02]"
                    }`}
                  >
                    <input
                      type="text"
                      defaultValue={step.label}
                      onBlur={(e) => {
                        const label = e.target.value.trim();
                        if (label && label !== step.label) onUpdate(step.id, { label });
                        else e.target.value = step.label;
                      }}
                      className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm text-zinc-100 outline-none focus:border-white/10 focus:bg-white/5"
                    />
                    <input
                      type="number"
                      min={0}
                      defaultValue={step.targetDays}
                      onBlur={(e) => {
                        const parsed = e.target.value.trim() === "" ? 0 : Number(e.target.value);
                        if (Number.isFinite(parsed) && parsed !== step.targetDays) onUpdate(step.id, { targetDays: parsed });
                      }}
                      title="Target days"
                      className="w-16 shrink-0 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-300 outline-none focus:ring-1 focus:ring-blue-500/50"
                    />
                    <select
                      value={step.targetDaysAnchor}
                      onChange={(e) => onUpdate(step.id, { targetDaysAnchor: e.target.value })}
                      title="Measured from"
                      className="shrink-0 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-300 outline-none focus:ring-1 focus:ring-blue-500/50"
                    >
                      <option value="step_start" className="bg-[#10141f]">Prev. step</option>
                      <option value="approval" className="bg-[#10141f]">Approval</option>
                    </select>
                    <label
                      title="Other steps measure 'Approval' target days from this step's completion"
                      className="flex shrink-0 items-center gap-1 text-[10px] text-zinc-500"
                    >
                      <input
                        type="radio"
                        name="approval-anchor"
                        checked={step.isApprovalAnchor}
                        onChange={() => onUpdate(step.id, { isApprovalAnchor: true })}
                        className="accent-blue-600"
                      />
                      Approval step
                    </label>
                    {confirmingDeleteId === step.id ? (
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            onDelete(step.id);
                            setConfirmingDeleteId(null);
                          }}
                          className="rounded-md bg-red-600 px-2 py-1 text-[10px] font-medium text-zinc-100 transition-colors hover:bg-red-500"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingDeleteId(null)}
                          className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-zinc-300 transition-colors hover:bg-white/5"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmingDeleteId(step.id)}
                        className="shrink-0 text-zinc-500 transition-colors hover:text-red-400"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}

              <div className="mt-2 flex items-center gap-1.5">
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitNewStep();
                  }}
                  placeholder="New step label…"
                  className="w-full rounded-lg border border-dashed border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-blue-500/50"
                />
                <button
                  type="button"
                  onClick={submitNewStep}
                  className="flex shrink-0 items-center gap-1 rounded-lg bg-blue-700 px-3 py-2 text-xs font-medium text-zinc-100 transition-colors hover:bg-blue-600"
                >
                  <PlusIcon className="h-3 w-3" />
                  Add
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
