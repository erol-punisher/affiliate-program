"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TopNav } from "@/components/TopNav";
import { ArrowLeftIcon } from "@/components/icons";

type Props = {
  userEmail: string;
};

type StageBreakdown = {
  stageId: string;
  name: string;
  color: string | null;
  order: number;
  count: number;
};

type Outcomes = {
  total: number;
  won: number;
  lost: number;
  open: number;
  conversionRate: number | null;
  winRate: number | null;
};

type PipelineAnalytics = Outcomes & {
  pipelineId: string;
  pipelineName: string;
  stages: StageBreakdown[];
};

type GroupAnalytics = {
  groupId: string;
  groupName: string;
  overview: Outcomes & { avgOpenAgeDays: number | null; avgDaysToWinApprox: number | null };
  pipelines: PipelineAnalytics[];
};

const STAGE_COLOR: Record<string, string> = {
  green: "bg-emerald-500",
  red: "bg-red-500",
};
const DEFAULT_STAGE_COLOR = "bg-blue-500/60";

function OverviewCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex-1 rounded-2xl border border-white/[0.08] bg-[#10141f] px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1.5 text-3xl font-semibold text-zinc-100">{value}</p>
      {sub && <p className="mt-1 text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}

function StageBar({ stages, total }: { stages: StageBreakdown[]; total: number }) {
  const visible = stages.filter((s) => s.count > 0);
  if (total === 0 || visible.length === 0) {
    return <div className="h-3 w-full rounded-full bg-white/5" />;
  }
  return (
    <div className="flex h-3 w-full overflow-hidden rounded-full bg-white/5">
      {visible.map((s) => (
        <div
          key={s.stageId}
          title={`${s.name}: ${s.count}`}
          style={{ width: `${(s.count / total) * 100}%` }}
          className={STAGE_COLOR[s.color ?? ""] ?? DEFAULT_STAGE_COLOR}
        />
      ))}
    </div>
  );
}

export function CrmAnalyticsBoard({ userEmail }: Props) {
  const [groups, setGroups] = useState<GroupAnalytics[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setError(null);
    try {
      const res = await fetch("/api/crm/analytics");
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      const data = await res.json();
      setGroups(data.groups ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    }
  }

  return (
    <div className="min-h-screen font-sans text-zinc-100">
      <TopNav userEmail={userEmail} />

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
        <div>
          <Link
            href="/crm"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-300"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" /> Back to CRM
          </Link>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-zinc-100">Pipeline analytics</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Stage distribution and win/loss conversion across your pipelines
          </p>
        </div>

        {error && (
          <p className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
        )}

        {!groups && !error ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : (
          groups?.map((group) => (
            <div key={group.groupId} className="flex flex-col gap-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                {group.groupName} — overview (deduplicated across any overview pipeline, e.g. Affiliates Standard)
              </h2>

              <div className="flex flex-wrap gap-4">
                <OverviewCard label="Total affiliates" value={String(group.overview.total)} />
                <OverviewCard
                  label="Won"
                  value={String(group.overview.won)}
                  sub={group.overview.winRate !== null ? `${group.overview.winRate}% of total` : undefined}
                />
                <OverviewCard label="Lost" value={String(group.overview.lost)} />
                <OverviewCard label="Still open" value={String(group.overview.open)} />
                <OverviewCard
                  label="Conversion rate"
                  value={group.overview.conversionRate !== null ? `${group.overview.conversionRate}%` : "—"}
                  sub="won ÷ (won + lost)"
                />
                <OverviewCard
                  label="Avg. open lead age"
                  value={group.overview.avgOpenAgeDays !== null ? `${group.overview.avgOpenAgeDays}d` : "—"}
                />
              </div>
              <p className="-mt-2 text-xs text-zinc-600">
                Avg. days to win (approx.):{" "}
                {group.overview.avgDaysToWinApprox !== null ? `${group.overview.avgDaysToWinApprox}d` : "not enough data"}{" "}
                — estimated from each lead&apos;s last edit, since stage-change history isn&apos;t tracked yet, so this
                is directional rather than exact.
              </p>

              <div className="flex flex-col gap-3">
                {group.pipelines
                  .slice()
                  .sort((a, b) => b.total - a.total)
                  .map((pipeline) => (
                    <div
                      key={pipeline.pipelineId}
                      className="rounded-2xl border border-white/[0.08] bg-[#10141f] px-5 py-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-medium text-zinc-200">{pipeline.pipelineName}</h3>
                        <div className="flex items-center gap-3 text-xs text-zinc-500">
                          <span>{pipeline.total} leads</span>
                          <span className="text-emerald-400">{pipeline.won} won</span>
                          <span className="text-red-400">{pipeline.lost} lost</span>
                          <span>
                            {pipeline.conversionRate !== null ? `${pipeline.conversionRate}% conversion` : "no closed leads yet"}
                          </span>
                        </div>
                      </div>
                      <div className="mt-3">
                        <StageBar stages={pipeline.stages} total={pipeline.total} />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                        {pipeline.stages
                          .filter((s) => s.count > 0)
                          .map((s) => (
                            <span key={s.stageId} className="flex items-center gap-1.5">
                              <span className={`h-2 w-2 rounded-full ${STAGE_COLOR[s.color ?? ""] ?? DEFAULT_STAGE_COLOR}`} />
                              {s.name}: {s.count}
                            </span>
                          ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}
