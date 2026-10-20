"use client";

import { useEffect, useState } from "react";
import { CHANNEL_LABELS, OUTREACH_CHANNELS, parseChannels, type OutreachChannel } from "@/lib/outreachChannels";
import { CHANNEL_STYLE, ChannelIcon } from "@/components/OutreachChannels";

type OutreachEvent = {
  id: string;
  kind: string;
  toStageName: string;
  channels: string[];
  actor: string | null;
  createdAt: string;
};

const STEPS = ["1st reach-out", "2nd reach-out", "Final reach-out"] as const;

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function describe(e: OutreachEvent): string {
  const when = new Date(e.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const what = e.kind === "touch" ? "Logged as a DM" : `Moved to ${e.toStageName}`;
  return `${what} · ${when}${e.actor && !e.actor.includes(":") ? ` · ${e.actor}` : ""}`;
}

/**
 * Per-channel reach-out progress for one affiliate: a row for each channel it's been contacted
 * on, with three steps (1st, 2nd, final). The next step can be logged from here, the latest undone.
 */
export function LeadOutreachSection({ leadId, version, onChanged }: { leadId: string; version: number; onChanged: () => void }) {
  const [events, setEvents] = useState<OutreachEvent[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // channel being changed
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/crm/leads/${leadId}/outreach`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setEvents(d.events ?? []);
      })
      .catch(() => {
        if (!cancelled) setEvents([]);
      });
    return () => {
      cancelled = true;
    };
  }, [leadId, version, reload]);

  const byChannel = new Map<OutreachChannel, OutreachEvent[]>();
  for (const e of events ?? []) for (const c of parseChannels(e.channels)) byChannel.set(c, [...(byChannel.get(c) ?? []), e]);
  const rows = OUTREACH_CHANNELS.filter((c) => byChannel.has(c));
  const addable = OUTREACH_CHANNELS.filter((c) => !byChannel.has(c));

  async function run(channel: OutreachChannel, request: () => Promise<Response>) {
    setBusy(channel);
    setError(null);
    try {
      const res = await request();
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Failed (${res.status})`);
      }
      setAdding(false);
      setReload((n) => n + 1);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setBusy(null);
    }
  }

  const logNext = (channel: OutreachChannel) =>
    run(channel, () =>
      fetch(`/api/crm/leads/${leadId}/touch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channels: [channel] }),
      }),
    );

  const undo = (channel: OutreachChannel, event: OutreachEvent) => {
    const what = event.kind === "touch" ? "this logged reach-out" : `${CHANNEL_LABELS[channel]} from the move to ${event.toStageName} (the move itself stays)`;
    if (!window.confirm(`Undo ${what}?`)) return;
    void run(channel, () =>
      fetch(`/api/crm/leads/${leadId}/outreach?eventId=${encodeURIComponent(event.id)}&channel=${channel}`, { method: "DELETE" }),
    );
  };

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Outreach</h3>
        {addable.length > 0 && rows.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setAdding((v) => !v)}
              className="rounded-md border border-white/10 px-2.5 py-1 text-xs text-zinc-300 transition-colors hover:bg-white/5"
            >
              + Add channel
            </button>
            {adding && (
              <div className="absolute right-0 top-full z-10 mt-1.5 flex flex-col gap-0.5 rounded-xl border border-white/10 bg-[#10141f] p-1.5 shadow-2xl">
                {addable.map((c) => (
                  <button
                    key={c}
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void logNext(c)}
                    className="flex items-center gap-2 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-left text-sm text-zinc-200 transition-colors hover:bg-white/5"
                  >
                    <ChannelIcon channel={c} className="h-3.5 w-3.5" />
                    Log 1st reach-out on {CHANNEL_LABELS[c]}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {events === null ? (
        <p className="text-sm text-zinc-600">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 px-4 py-4">
          <p className="text-sm text-zinc-500">No reach-outs logged yet. Pick the channel of the first one:</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {OUTREACH_CHANNELS.map((c) => (
              <button
                key={c}
                type="button"
                disabled={busy !== null}
                onClick={() => void logNext(c)}
                className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:border-white/25 hover:text-zinc-100 disabled:opacity-50"
              >
                <ChannelIcon channel={c} className="h-3.5 w-3.5" />
                {CHANNEL_LABELS[c]}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {rows.map((channel) => (
            <ChannelRow
              key={channel}
              channel={channel}
              events={byChannel.get(channel) ?? []}
              busy={busy === channel}
              disabled={busy !== null}
              onLogNext={() => void logNext(channel)}
              onUndo={(e) => undo(channel, e)}
            />
          ))}
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </section>
  );
}

function ChannelRow({
  channel,
  events,
  busy,
  disabled,
  onLogNext,
  onUndo,
}: {
  channel: OutreachChannel;
  events: OutreachEvent[];
  busy: boolean;
  disabled: boolean;
  onLogNext: () => void;
  onUndo: (e: OutreachEvent) => void;
}) {
  const done = Math.min(events.length, STEPS.length);
  const extra = events.length - STEPS.length;
  const latest = events[events.length - 1];
  const style = CHANNEL_STYLE[channel];

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3.5">
      <div className="flex w-36 shrink-0 items-center gap-2.5">
        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full ring-1 ${style.badge}`}>
          <ChannelIcon channel={channel} className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-100">{CHANNEL_LABELS[channel]}</p>
          <p className="text-[11px] text-zinc-500">
            {done >= STEPS.length ? "Sequence complete" : `${done} of ${STEPS.length}`}
            {extra > 0 && ` · +${extra} more`}
          </p>
        </div>
      </div>

      <div className="flex min-w-[18rem] flex-1 items-start">
        {STEPS.map((label, i) => {
          const event = events[i];
          const isDone = i < done;
          const isNext = i === done;
          const isLatest = isDone && (extra > 0 ? false : i === done - 1);
          return (
            <div key={label} className="flex flex-1 items-start last:flex-none">
              <div className="group/step relative flex w-20 flex-col items-center text-center">
                {isDone ? (
                  <span
                    title={event ? describe(event) : undefined}
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white shadow-sm ${style.bar}`}
                  >
                    {i + 1}
                  </span>
                ) : isNext ? (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={onLogNext}
                    title={`Log ${label.toLowerCase()} on ${CHANNEL_LABELS[channel]}`}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-white/30 text-sm text-zinc-400 transition-all hover:scale-105 hover:border-white/60 hover:text-zinc-100 disabled:opacity-50"
                  >
                    {busy ? "…" : "+"}
                  </button>
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-xs text-zinc-700">{i + 1}</span>
                )}
                {isLatest && latest && (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onUndo(latest)}
                    title="Undo this reach-out"
                    className="absolute -top-1.5 left-1/2 ml-2.5 hidden h-4 w-4 items-center justify-center rounded-full border border-white/15 bg-[#10141f] text-[10px] leading-none text-zinc-400 hover:text-red-300 group-hover/step:flex"
                  >
                    ×
                  </button>
                )}
                <span className={`mt-1.5 text-[11px] ${isDone ? "text-zinc-300" : isNext ? "text-zinc-500" : "text-zinc-700"}`}>{label}</span>
                <span className="text-[11px] text-zinc-500">{isDone && event ? shortDate(event.createdAt) : isNext ? "Log" : " "}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`mt-4 h-0.5 flex-1 rounded-full ${i < done - 1 ? style.bar : "bg-white/10"}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
