"use client";

import { Fragment, useEffect, useState, type KeyboardEvent } from "react";
import { CHANNEL_LABELS, OUTREACH_CHANNELS, type OutreachChannel } from "@/lib/outreachChannels";
import { CHANNEL_STYLE, ChannelBadges, ChannelIcon } from "@/components/OutreachChannels";

type Targets = { contacted: number; responded: number };
type Week = { weekStart: string; contacted: number; responded: number };
type Averages = Record<"last4" | "allTime", Record<keyof Targets, number | null>>;
type ContactedLead = { id: string; name: string; country: string | null; pipeline: string; owner: string | null; channels: string[] };
type ChannelCounts = Record<OutreachChannel | "untagged", number>;
type OutreachData = {
  weeks: Week[];
  contactedByWeek: Record<string, ContactedLead[]>;
  respondedByWeek: Record<string, ContactedLead[]>;
  channelCounts: Record<string, ChannelCounts>;
  averages: Averages;
  targets: Targets;
  targetsUpdatedBy: string | null;
  trackingSince: string;
  pipelines: string[];
};

// Contacted is reported as a plain count; only responses with interest have a weekly target.
const METRICS: { key: keyof Targets; label: string; hint: string; hasTarget: boolean }[] = [
  { key: "contacted", label: "Contacted", hint: "Moved into Contacted, Contacted (2) or Contacted (3), or a logged DM", hasTarget: false },
  { key: "responded", label: "Responded with interest", hint: "Moved into Responded with Interest (incl. For a Fee)", hasTarget: true },
];
const TARGETED = METRICS.filter((m) => m.hasTarget);

function weekLabel(weekStart: string): string {
  const start = new Date(`${weekStart}T00:00:00Z`);
  const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  return `${fmt(start)} – ${fmt(end)}`;
}

function pct(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—";
}

/**
 * A progress bar split by channel: the filled part is contacted ÷ target, divided in proportion
 * to how many affiliates were reached on each channel (untagged in grey).
 */
function ChannelBar({ counts, progress, hit }: { counts: ChannelCounts | undefined; progress: number; hit: boolean }) {
  const parts = [
    ...OUTREACH_CHANNELS.map((c) => ({ key: c, n: counts?.[c] ?? 0, cls: CHANNEL_STYLE[c].bar })),
    { key: "untagged", n: counts?.untagged ?? 0, cls: "bg-white/25" },
  ].filter((p) => p.n > 0);
  const total = parts.reduce((sum, p) => sum + p.n, 0);
  return (
    <div className={`mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-white/5 ${hit ? "ring-1 ring-emerald-500/60" : ""}`}>
      {total === 0 ? (
        <div className={`h-full ${hit ? "bg-emerald-500" : "bg-blue-500"}`} style={{ width: `${progress}%` }} />
      ) : (
        parts.map((p) => <div key={p.key} className={`h-full ${p.cls}`} style={{ width: `${(progress * p.n) / total}%` }} />)
      )}
    </div>
  );
}

/** "9 · 4 · 1" with channel icons; untagged shown as a muted count. */
function ChannelCountsInline({ counts }: { counts: ChannelCounts | undefined }) {
  if (!counts) return <span className="text-zinc-600">—</span>;
  const shown = OUTREACH_CHANNELS.filter((c) => counts[c] > 0);
  if (shown.length === 0 && counts.untagged === 0) return <span className="text-zinc-600">—</span>;
  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-x-2.5 gap-y-1">
      {shown.map((c) => (
        <span key={c} className="inline-flex items-center gap-1" title={`${counts[c]} via ${CHANNEL_LABELS[c]}`}>
          <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full ring-1 ${CHANNEL_STYLE[c].badge}`}>
            <ChannelIcon channel={c} className="h-2.5 w-2.5" />
          </span>
          <span className="tabular-nums text-zinc-300">{counts[c]}</span>
        </span>
      ))}
      {counts.untagged > 0 && (
        <span className="tabular-nums text-zinc-600" title={`${counts.untagged} without a channel`}>
          +{counts.untagged} untagged
        </span>
      )}
    </span>
  );
}

/**
 * Who responded with interest this week and the channel(s) each response came through.
 * Clicking a channel turns it on or off for that affiliate.
 */
function RespondedList({ leads, onChange }: { leads: ContactedLead[]; onChange: (id: string, channels: string[]) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(lead: ContactedLead, channel: OutreachChannel) {
    const next = lead.channels.includes(channel) ? lead.channels.filter((c) => c !== channel) : [...lead.channels, channel];
    setBusy(lead.id);
    setError(null);
    try {
      const res = await fetch(`/api/crm/leads/${lead.id}/outreach`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responseChannels: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Failed (${res.status})`);
      }
      onChange(lead.id, next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#10141f] px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Responded with interest this week · responded via</p>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      {leads.length === 0 ? (
        <p className="mt-2 text-xs text-zinc-500">No responses with interest yet this week.</p>
      ) : (
        <ol className="mt-2 flex flex-col divide-y divide-white/[0.04]">
          {leads.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 py-2 text-sm">
              <span className="min-w-0">
                <span className="text-zinc-100">{l.name}</span>
                {l.country && <span className="text-zinc-500"> ({l.country})</span>}
                <span className="text-xs text-zinc-500"> · {l.pipeline}</span>
              </span>
              <span className={`flex items-center gap-1.5 ${busy === l.id ? "opacity-50" : ""}`}>
                {OUTREACH_CHANNELS.map((c) => {
                  const on = l.channels.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      disabled={busy === l.id}
                      onClick={() => void toggle(l, c)}
                      title={on ? `Responded via ${CHANNEL_LABELS[c]} (click to remove)` : `Mark as responded via ${CHANNEL_LABELS[c]}`}
                      aria-pressed={on}
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full ring-1 transition-opacity ${
                        on ? CHANNEL_STYLE[c].badge : "text-zinc-600 ring-white/10 opacity-50 hover:opacity-100"
                      }`}
                    >
                      <ChannelIcon channel={c} className="h-3.5 w-3.5" />
                    </button>
                  );
                })}
                {l.channels.length === 0 && <span className="ml-1 text-xs text-zinc-600">Pick a channel</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
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
  const [openWeek, setOpenWeek] = useState<string | null>(null);
  const [showResponded, setShowResponded] = useState(false);

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

  function setResponseChannels(leadId: string, channels: string[]) {
    setData((prev) => {
      if (!prev || !thisWeek) return prev;
      const list = (prev.respondedByWeek[thisWeek.weekStart] ?? []).map((l) => (l.id === leadId ? { ...l, channels } : l));
      return { ...prev, respondedByWeek: { ...prev.respondedByWeek, [thisWeek.weekStart]: list } };
    });
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Weekly outreach</h2>
          <p className="mt-0.5 text-xs text-zinc-600">
            Counted from stage changes and logged DMs, Monday–Sunday. Contacted includes follow-ups; each affiliate counts once per week, even with an overview copy.
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {METRICS.map((m) => {
              const value = thisWeek?.[m.key] ?? 0;
              const target = m.hasTarget ? data.targets[m.key] : 0;
              // Without a target the contacted bar is just the channel split of this week's total.
              const progress = m.hasTarget ? (target > 0 ? Math.min(100, (value / target) * 100) : 0) : value > 0 ? 100 : 0;
              const hit = target > 0 && value >= target;
              const clickable = m.key === "responded";
              return (
                <div
                  key={m.key}
                  className={`rounded-2xl border bg-[#10141f] px-5 py-4 ${
                    clickable
                      ? `cursor-pointer transition-colors hover:border-white/20 ${showResponded ? "border-white/20" : "border-white/[0.08]"}`
                      : "border-white/[0.08]"
                  }`}
                  title={clickable ? `${m.hint}. Click to see who responded and how.` : m.hint}
                  {...(clickable && {
                    role: "button",
                    tabIndex: 0,
                    "aria-expanded": showResponded,
                    onClick: () => setShowResponded((v) => !v),
                    onKeyDown: (e: KeyboardEvent) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setShowResponded((v) => !v);
                      }
                    },
                  })}
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{m.label} this week</p>
                  <p className="mt-1.5 text-3xl font-semibold text-zinc-100">
                    {value}
                    {m.hasTarget && <span className="ml-1 text-base font-normal text-zinc-500">/ {target}</span>}
                  </p>
                  {m.key === "contacted" ? (
                    <ChannelBar counts={thisWeek ? data.channelCounts[thisWeek.weekStart] : undefined} progress={progress} hit={hit} />
                  ) : (
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                      <div className={`h-full ${hit ? "bg-emerald-500" : "bg-blue-500"}`} style={{ width: `${progress}%` }} />
                    </div>
                  )}
                  {m.key === "contacted" && thisWeek && data.channelCounts[thisWeek.weekStart] && (
                    <div className="mt-2 flex justify-start text-xs">
                      <ChannelCountsInline counts={data.channelCounts[thisWeek.weekStart]} />
                    </div>
                  )}
                  {clickable && thisWeek && (data.respondedByWeek[thisWeek.weekStart]?.length ?? 0) > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
                      {OUTREACH_CHANNELS.map((c) => {
                        const n = data.respondedByWeek[thisWeek.weekStart].filter((l) => l.channels.includes(c)).length;
                        return n > 0 ? (
                          <span key={c} className="inline-flex items-center gap-1" title={`${n} responded via ${CHANNEL_LABELS[c]}`}>
                            <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full ring-1 ${CHANNEL_STYLE[c].badge}`}>
                              <ChannelIcon channel={c} className="h-2.5 w-2.5" />
                            </span>
                            <span className="tabular-nums text-zinc-300">{n}</span>
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}
                  <p className="mt-2 text-xs text-zinc-500">
                    Avg/week: {data.averages.last4[m.key] ?? "—"} (last 4) · {data.averages.allTime[m.key] ?? "—"} (all)
                    {clickable && <span className="ml-2 text-zinc-400">{showResponded ? "Hide list ▴" : "Show who ▾"}</span>}
                  </p>
                </div>
              );
            })}
          </div>

          {showResponded && thisWeek && (
            <RespondedList leads={data.respondedByWeek[thisWeek.weekStart] ?? []} onChange={setResponseChannels} />
          )}

          <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
            {editing && draft ? (
              <>
                <span>Weekly target:</span>
                {TARGETED.map((m) => (
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
                  Weekly target: {data.targets.responded} responded with interest
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
                  <th className="px-3 py-2 text-right font-medium" title="Affiliates contacted on each channel; one reached on two channels counts in both">
                    Channels
                  </th>
                  <th className="px-3 py-2 text-right font-medium">With interest</th>
                  <th className="px-3 py-2 text-right font-medium" title="Responded with interest ÷ contacted that week">Interest rate</th>
                </tr>
              </thead>
              <tbody>
                {data.weeks.map((w, i) => {
                  const isOpen = openWeek === w.weekStart;
                  const contacted = data.contactedByWeek[w.weekStart] ?? [];
                  return (
                    <Fragment key={w.weekStart}>
                      <tr
                        onClick={() => setOpenWeek(isOpen ? null : w.weekStart)}
                        className="cursor-pointer border-b border-white/[0.04] transition-colors last:border-0 hover:bg-white/[0.03]"
                      >
                        <td className="px-3 py-2 text-zinc-300">
                          <span className={`mr-1.5 inline-block text-[10px] text-zinc-500 transition-transform ${isOpen ? "rotate-90" : ""}`}>▶</span>
                          {weekLabel(w.weekStart)}
                          {i === 0 && <span className="ml-2 text-[10px] uppercase text-blue-400">this week</span>}
                        </td>
                        <TargetCell value={w.contacted} target={0} />
                        <td className="px-3 py-2 text-right text-xs">
                          <ChannelCountsInline counts={data.channelCounts[w.weekStart]} />
                        </td>
                        <TargetCell value={w.responded} target={data.targets.responded} />
                        <td className="px-3 py-2 text-right tabular-nums text-zinc-400">{pct(w.responded, w.contacted)}</td>
                      </tr>
                      {isOpen && (
                        <tr className="border-b border-white/[0.04] bg-white/[0.02]">
                          <td colSpan={5} className="px-6 py-3">
                            {contacted.length === 0 ? (
                              <p className="text-xs text-zinc-500">No one reached out to this week.</p>
                            ) : (
                              <ol className="flex list-decimal flex-col gap-1 pl-5 text-xs text-zinc-300 marker:text-zinc-600">
                                {contacted.map((l) => (
                                  <li key={l.id}>
                                    <span className="text-zinc-100">{l.name}</span>
                                    {l.country && <span className="text-zinc-500"> ({l.country})</span>}
                                    <span className="text-zinc-600"> - </span>
                                    {l.pipeline}
                                    <span className="text-zinc-600"> - </span>
                                    <span className={l.owner ? "" : "text-zinc-500"}>{l.owner ?? "No owner"}</span>
                                    {l.channels.length > 0 && (
                                      <span className="ml-2 inline-flex align-middle">
                                        <ChannelBadges channels={l.channels} />
                                      </span>
                                    )}
                                  </li>
                                ))}
                              </ol>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
