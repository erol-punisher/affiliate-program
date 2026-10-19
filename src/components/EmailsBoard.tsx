"use client";

import { useEffect, useMemo, useState } from "react";
import { TopNav } from "@/components/TopNav";
import { MailIcon, RefreshIcon } from "@/components/icons";
import { EmailComposeModal, type EmailRecipient } from "@/components/EmailComposeModal";
import { PIPELINE_CATEGORIES } from "@/lib/pipelineCategory";

type Lead = EmailRecipient;
type Stage = { id: string; name: string; order: number; leads: Lead[] };
type Pipeline = { id: string; name: string; category: string | null; stages: Stage[] };
type Group = { id: string; name: string; pipelines: Pipeline[] };

type SentThread = {
  id: string;
  leadId: string | null;
  leadName: string;
  country: string | null;
  pipeline: string | null;
  stage: string | null;
  ownerEmail: string;
  toEmail: string;
  subject: string;
  sentCount: number;
  lastSentAt: string;
  repliedAt: string | null;
  gmailThreadId: string;
};
type Overview = {
  threads: SentThread[];
  stats: { sentThisWeek: number; repliesThisWeek: number; awaitingReply: number };
  lastEmailedAt: Record<string, string>;
};

const MAX_PER_SEND = 25;
const RECENT_DAYS = 7;
const hasEmail = (l: Lead) => !!l.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(l.email.trim());

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex-1 rounded-2xl border border-white/[0.08] bg-[#10141f] px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1.5 text-3xl font-semibold text-zinc-100">{value}</p>
    </div>
  );
}

export function EmailsBoard({ userEmail }: { userEmail: string }) {
  const [gmailConnected, setGmailConnected] = useState<boolean | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState<string | null>(null);

  const [pipelineId, setPipelineId] = useState("");
  const [stageId, setStageId] = useState("");
  const [hideRecent, setHideRecent] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [composing, setComposing] = useState(false);
  const [sentFilter, setSentFilter] = useState<"all" | "awaiting" | "replied">("all");
  const [openedAt] = useState(() => Date.now());

  async function loadOverview() {
    try {
      const res = await fetch("/api/email/overview");
      if (!res.ok) throw new Error(`Failed to load emails (${res.status})`);
      setOverview(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load emails");
    }
  }

  async function loadGroups() {
    try {
      const res = await fetch("/api/crm/groups");
      if (!res.ok) throw new Error(`Failed to load pipelines (${res.status})`);
      const data = await res.json();
      setGroups(data.groups ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pipelines");
    }
  }

  useEffect(() => {
    void fetch("/api/gmail/status")
      .then((r) => r.json())
      .then((d) => setGmailConnected(!!d.connected))
      .catch(() => setGmailConnected(false));
    // Deferred a tick so the loaders' state updates don't run synchronously inside the effect.
    void Promise.resolve().then(() => {
      void loadOverview();
      void loadGroups();
    });
  }, []);

  async function checkReplies() {
    setSyncing(true);
    setSyncNote(null);
    try {
      const res = await fetch("/api/email/sync?force=1", { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Reply check failed");
      setSyncNote(
        d.skipped === "recent"
          ? "Checked less than a minute ago."
          : `Checked ${d.checked} threads · ${d.replies} new ${d.replies === 1 ? "reply" : "replies"} · ${d.moved} moved to Responded with Interest.`,
      );
      await Promise.all([loadOverview(), loadGroups()]);
    } catch (err) {
      setSyncNote(err instanceof Error ? err.message : "Reply check failed");
    } finally {
      setSyncing(false);
    }
  }

  const pipelines = useMemo(() => groups?.flatMap((g) => g.pipelines) ?? [], [groups]);
  const pipeline = pipelines.find((p) => p.id === pipelineId) ?? null;
  const stage = pipeline?.stages.find((s) => s.id === stageId) ?? null;

  const candidates = useMemo(() => {
    if (!pipeline) return [];
    const stages = stage ? [stage] : pipeline.stages;
    const cutoff = openedAt - RECENT_DAYS * 24 * 60 * 60 * 1000;
    return stages
      .flatMap((s) => s.leads.map((l) => ({ ...l, stageName: s.name })))
      .filter(hasEmail)
      .filter((l) => {
        if (!hideRecent) return true;
        const last = overview?.lastEmailedAt[l.id];
        return !last || new Date(last).getTime() < cutoff;
      });
  }, [pipeline, stage, hideRecent, overview, openedAt]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_PER_SEND) next.add(id);
      return next;
    });
  }

  const visibleThreads = (overview?.threads ?? []).filter((t) =>
    sentFilter === "all" ? true : sentFilter === "replied" ? !!t.repliedAt : !t.repliedAt,
  );

  return (
    <div className="min-h-screen font-sans text-zinc-100">
      <TopNav userEmail={userEmail} />

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-100">Emails</h1>
            <p className="mt-0.5 text-sm text-zinc-500">
              Email leads from your Gmail. Sending moves them up a stage; replies move them to Responded with Interest.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {gmailConnected === false && (
              <a href="/api/gmail/connect" className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-zinc-100 hover:bg-blue-500">
                <MailIcon className="h-3.5 w-3.5" /> Connect Gmail
              </a>
            )}
            {gmailConnected && (
              <>
                <span className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 px-3 py-1.5 text-sm text-emerald-300">
                  <MailIcon className="h-3.5 w-3.5" /> Gmail connected
                </span>
                <button
                  type="button"
                  disabled={syncing}
                  onClick={() => void checkReplies()}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-white/5 disabled:opacity-50"
                >
                  <RefreshIcon className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                  {syncing ? "Checking…" : "Check for replies now"}
                </button>
              </>
            )}
          </div>
        </div>

        {syncNote && <p className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-300">{syncNote}</p>}
        {error && <p className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

        <div className="flex flex-wrap gap-4">
          <StatCard label="Emails sent this week" value={overview?.stats.sentThisWeek ?? "—"} />
          <StatCard label="Replies this week" value={overview?.stats.repliesThisWeek ?? "—"} />
          <StatCard label="Awaiting reply" value={overview?.stats.awaitingReply ?? "—"} />
        </div>

        {/* New email */}
        <section className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-[#10141f] px-5 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">New email</h2>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={pipelineId}
              onChange={(e) => {
                setPipelineId(e.target.value);
                setStageId("");
                setSelected(new Set());
              }}
              className="w-64 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-zinc-200 outline-none focus:ring-1 focus:ring-blue-500/50"
            >
              <option value="" className="bg-[#10141f]">Choose a pipeline…</option>
              {pipelines
                .filter((p) => !PIPELINE_CATEGORIES.some((c) => c.value === p.category))
                .map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#10141f]">
                    {p.name}
                  </option>
                ))}
              {PIPELINE_CATEGORIES.map((c) => (
                <optgroup key={c.value} label={c.label} className="bg-[#10141f]">
                  {pipelines
                    .filter((p) => p.category === c.value)
                    .map((p) => (
                      <option key={p.id} value={p.id} className="bg-[#10141f]">
                        {p.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
            <select
              value={stageId}
              disabled={!pipeline}
              onChange={(e) => {
                setStageId(e.target.value);
                setSelected(new Set());
              }}
              className="w-56 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-zinc-200 outline-none focus:ring-1 focus:ring-blue-500/50 disabled:opacity-40"
            >
              <option value="" className="bg-[#10141f]">All stages</option>
              {pipeline?.stages.map((s) => (
                <option key={s.id} value={s.id} className="bg-[#10141f]">
                  {s.name} ({s.leads.filter(hasEmail).length})
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-xs text-zinc-400">
              <input type="checkbox" checked={hideRecent} onChange={(e) => setHideRecent(e.target.checked)} />
              Hide anyone emailed in the last {RECENT_DAYS} days
            </label>
          </div>

          {!groups ? (
            <p className="text-sm text-zinc-500">Loading pipelines…</p>
          ) : !pipeline ? (
            <p className="text-sm text-zinc-500">Choose a pipeline (and optionally a stage) to see who you can email.</p>
          ) : candidates.length === 0 ? (
            <p className="text-sm text-zinc-500">No leads with an email address here{hideRecent ? " who haven't been emailed recently" : ""}.</p>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>
                  {candidates.length} with an email · {selected.size} selected (max {MAX_PER_SEND} per send)
                </span>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setSelected(new Set(candidates.slice(0, MAX_PER_SEND).map((l) => l.id)))} className="hover:text-zinc-300">
                    Select first {Math.min(MAX_PER_SEND, candidates.length)}
                  </button>
                  <button type="button" onClick={() => setSelected(new Set())} className="hover:text-zinc-300">
                    Clear
                  </button>
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto rounded-lg border border-white/10">
                <table className="w-full text-sm">
                  <tbody>
                    {candidates.map((l) => (
                      <tr key={l.id} onClick={() => toggle(l.id)} className="cursor-pointer border-b border-white/[0.04] last:border-0 hover:bg-white/[0.03]">
                        <td className="w-8 px-3 py-1.5">
                          <input type="checkbox" readOnly checked={selected.has(l.id)} />
                        </td>
                        <td className="px-2 py-1.5 text-zinc-100">
                          {l.name}
                          {l.country && <span className="text-zinc-500"> ({l.country})</span>}
                        </td>
                        <td className="px-2 py-1.5 text-xs text-zinc-500">{l.email}</td>
                        <td className="px-2 py-1.5 text-xs text-zinc-400">{l.stageName}</td>
                        <td className="px-3 py-1.5 text-right text-xs text-zinc-600">
                          {overview?.lastEmailedAt[l.id] ? `emailed ${formatDate(overview.lastEmailedAt[l.id])}` : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={selected.size === 0}
                  onClick={() => setComposing(true)}
                  className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm text-zinc-100 hover:bg-blue-500 disabled:opacity-40"
                >
                  <MailIcon className="h-3.5 w-3.5" /> Write email to {selected.size}
                </button>
              </div>
            </>
          )}
        </section>

        {/* Sent & replies */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Sent &amp; replies</h2>
            <div className="flex gap-1 text-xs">
              {(["all", "awaiting", "replied"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setSentFilter(f)}
                  className={`rounded-md border px-2.5 py-1 ${sentFilter === f ? "border-blue-500/60 bg-blue-500/15 text-zinc-100" : "border-white/10 text-zinc-400 hover:bg-white/5"}`}
                >
                  {f === "all" ? "All" : f === "awaiting" ? "Awaiting reply" : "Replied"}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#10141f]">
            {!overview ? (
              <p className="px-5 py-4 text-sm text-zinc-500">Loading…</p>
            ) : visibleThreads.length === 0 ? (
              <p className="px-5 py-4 text-sm text-zinc-500">No emails here yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-zinc-500">
                    <th className="px-3 py-2 text-left font-medium">Lead</th>
                    <th className="px-3 py-2 text-left font-medium">Pipeline · stage</th>
                    <th className="px-3 py-2 text-left font-medium">Subject</th>
                    <th className="px-3 py-2 text-left font-medium">Last sent</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {visibleThreads.map((t) => (
                    <tr key={t.id} className="border-b border-white/[0.04] last:border-0">
                      <td className="px-3 py-2 text-zinc-100">
                        {t.leadName}
                        {t.country && <span className="text-zinc-500"> ({t.country})</span>}
                        <p className="text-xs text-zinc-600">{t.toEmail}</p>
                      </td>
                      <td className="px-3 py-2 text-xs text-zinc-400">
                        {t.pipeline ?? "—"}
                        {t.stage && <span className="text-zinc-500"> · {t.stage}</span>}
                      </td>
                      <td className="max-w-xs truncate px-3 py-2 text-xs text-zinc-300">
                        {t.subject}
                        {t.sentCount > 1 && <span className="text-zinc-500"> ({t.sentCount} emails)</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-zinc-400">{formatDate(t.lastSentAt)}</td>
                      <td className="px-3 py-2 text-xs">
                        {t.repliedAt ? (
                          <span className="text-emerald-400">Replied {formatDate(t.repliedAt)}</span>
                        ) : (
                          <span className="text-zinc-500">Awaiting reply</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-xs">
                        <a
                          href={`https://mail.google.com/mail/u/${encodeURIComponent(t.ownerEmail)}/#all/${t.gmailThreadId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-400 hover:text-blue-300"
                        >
                          Open in Gmail
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </main>

      {composing && pipeline && (
        <EmailComposeModal
          recipients={candidates.filter((l) => selected.has(l.id))}
          pipelineName={pipeline.name}
          onClose={() => setComposing(false)}
          onSent={() => {
            setSelected(new Set());
            void loadOverview();
            void loadGroups();
          }}
        />
      )}
    </div>
  );
}
