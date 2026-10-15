"use client";

import { useEffect, useState } from "react";

type Targets = { contacted: number; responded: number; interested: number };
type Week = { weekStart: string; contacted: number; followUps: number; responded: number; interested: number };
type Averages = Record<"last4" | "allTime", Record<keyof Targets, number | null>>;
type OutreachData = {
  weeks: Week[];
  averages: Averages;
  targets: Targets;
  targetsUpdatedBy: string | null;
  trackingSince: string;
  pipelines: string[];
};

const METRICS: { key: keyof Targets; label: string; hint: string }[] = [
  { key: "contacted", label: "Contacted", hint: "New leads moved into Contacted" },
  { key: "responded", label: "Responded", hint: "Moved into any Responded… stage" },
  { key: "interested", label: "With interest", hint: "Moved into Responded with Interest (incl. For a Fee)" },
];

function weekLabel(weekStart: string): string {
  const start = new Date(`${weekStart}T00:00:00Z`);
  const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  return `${fmt(start)} – ${fmt(end)}`;
}

function pct(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—";
}

function TargetCell({ value, target }: { value: number; target: number }) {
  const hit = target > 0 && value >= target;
  return (
    <td className={`px-3 py-2 text-right tabular-nums ${hit ? "text-emerald-400" : value > 0 ? "text-zinc-200" : "text-zinc-600"}`}>
      {value}
      {hit && <span className="ml-1 text-[10px]">✓</span>}
    </td>
  );
}

export function WeeklyOutreachSection() {
  const [pipeline, setPipeline] = useState("");
  const [data, setData] = useState<OutreachData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Targets | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        const res = await fetch(`/api/crm/outreach${pipeline ? `?pipeline=${encodeURIComponent(pipeline)}` : ""}`);
        if (!res.ok) throw new Error(`Failed to load (${res.status})`);
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load weekly outreach");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pipeline]);

  async function saveTargets() {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await fetch("/api/crm/outreach", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targets: draft }),
      });
      if (!res.ok) throw new Error(`Failed to save (${res.status})`);
      const { targets } = await res.json();
      setData((prev) => (prev ? { ...prev, targets } : prev));
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save targets");
    } finally {
      setSaving(false);
    }
  }

  const thisWeek = data?.weeks[0];

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Weekly outreach</h2>
          <p className="mt-0.5 text-xs text-zinc-600">
            Counted from stage changes, Monday–Sunday. Each affiliate counts once per week, even with an overview copy.
            {data && ` Tracking since ${new Date(data.trackingSince).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}.`}
          </p>
        </div>
        <select
          value={pipeline}
          onChange={(e) => setPipeline(e.target.value)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-zinc-200 outline-none focus:ring-1 focus:ring-blue-500/50"
        >
          <option value="" className="bg-[#10141f]">All pipelines</option>
          {data?.pipelines.map((p) => (
            <option key={p} value={p} className="bg-[#10141f]">
              {p}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

      {!data ? (
        !error && <p className="text-sm text-zinc-500">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {METRICS.map((m) => {
              const value = thisWeek?.[m.key] ?? 0;
              const target = data.targets[m.key];
              const progress = target > 0 ? Math.min(100, (value / target) * 100) : 0;
              const hit = target > 0 && value >= target;
              return (
                <div key={m.key} className="rounded-2xl border border-white/[0.08] bg-[#10141f] px-5 py-4" title={m.hint}>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{m.label} this week</p>
                  <p className="mt-1.5 text-3xl font-semibold text-zinc-100">
                    {value}
                    <span className="ml-1 text-base font-normal text-zinc-500">/ {target}</span>
                  </p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                    <div className={`h-full ${hit ? "bg-emerald-500" : "bg-blue-500"}`} style={{ width: `${progress}%` }} />
                  </div>
                  <p className="mt-2 text-xs text-zinc-500">
                    Avg/week: {data.averages.last4[m.key] ?? "—"} (last 4) · {data.averages.allTime[m.key] ?? "—"} (all)
                  </p>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
            {editing && draft ? (
              <>
                <span>Weekly targets:</span>
                {METRICS.map((m) => (
                  <label key={m.key} className="flex items-center gap-1.5">
                    {m.label}
                    <input
                      type="number"
                      min={0}
                      value={draft[m.key]}
                      onChange={(e) => setDraft({ ...draft, [m.key]: Math.max(0, Number(e.target.value) || 0) })}
                      className="w-16 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-zinc-200 outline-none focus:ring-1 focus:ring-blue-500/50"
                    />
                  </label>
                ))}
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveTargets()}
                  className="rounded-md bg-blue-600 px-3 py-1 text-zinc-100 transition-colors hover:bg-blue-500 disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="rounded-md border border-white/10 px-3 py-1 text-zinc-300 transition-colors hover:bg-white/5"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <span>
                  Weekly targets: {data.targets.contacted} contacted · {data.targets.responded} responded · {data.targets.interested} with interest
                  {data.targetsUpdatedBy && ` (set by ${data.targetsUpdatedBy})`}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setDraft(data.targets);
                    setEditing(true);
                  }}
                  className="rounded-md border border-white/10 px-2 py-0.5 text-zinc-300 transition-colors hover:bg-white/5"
                >
                  Edit targets
                </button>
              </>
            )}
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#10141f]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-zinc-500">
                  <th className="px-3 py-2 text-left font-medium">Week</th>
                  <th className="px-3 py-2 text-right font-medium">Contacted</th>
                  <th className="px-3 py-2 text-right font-medium">Follow-ups</th>
                  <th className="px-3 py-2 text-right font-medium">Responded</th>
                  <th className="px-3 py-2 text-right font-medium">With interest</th>
                  <th className="px-3 py-2 text-right font-medium" title="Responded ÷ contacted that week">Response rate</th>
                  <th className="px-3 py-2 text-right font-medium" title="With interest ÷ contacted that week">Interest rate</th>
                </tr>
              </thead>
              <tbody>
                {data.weeks.map((w, i) => (
                  <tr key={w.weekStart} className="border-b border-white/[0.04] last:border-0">
                    <td className="px-3 py-2 text-zinc-300">
                      {weekLabel(w.weekStart)}
                      {i === 0 && <span className="ml-2 text-[10px] uppercase text-blue-400">this week</span>}
                    </td>
                    <TargetCell value={w.contacted} target={data.targets.contacted} />
                    <td className="px-3 py-2 text-right tabular-nums text-zinc-400">{w.followUps}</td>
                    <TargetCell value={w.responded} target={data.targets.responded} />
                    <TargetCell value={w.interested} target={data.targets.interested} />
                    <td className="px-3 py-2 text-right tabular-nums text-zinc-400">{pct(w.responded, w.contacted)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-zinc-400">{pct(w.interested, w.contacted)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
