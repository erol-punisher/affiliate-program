"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TEMPLATE_VARIABLES, missingVariables, renderTemplate, unknownVariables, type TemplateLead } from "@/lib/emailTemplate";

export type EmailRecipient = {
  id: string;
  name: string;
  email: string | null;
  country: string | null;
  username: string | null;
  firstName?: string | null;
  followerCount?: number | null;
  websiteUrl?: string | null;
  socialsUrl?: string | null;
  referralLink?: string | null;
  stageName?: string | null;
  pipelineName?: string | null;
};

type Cadence = { id: string; name: string; steps: { id: string; label: string; content: string }[] };
type SendResult = { leadId: string; name: string; status: "sent" | "skipped" | "failed"; detail?: string };

const MAX_PER_SEND = 25;
const hasEmail = (r: EmailRecipient) => !!r.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email.trim());

export function EmailComposeModal({
  recipients,
  pipelineName,
  onClose,
  onSent,
}: {
  recipients: EmailRecipient[];
  pipelineName: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const [gmail, setGmail] = useState<{ connected: boolean; name: string; email: string } | null>(null);
  const [cadences, setCadences] = useState<Cadence[]>([]);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(recipients.filter(hasEmail).slice(0, MAX_PER_SEND).map((r) => r.id)),
  );
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [replyInThread, setReplyInThread] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SendResult[] | null>(null);
  const [templateStepId, setTemplateStepId] = useState<string | null>(null);
  const [icebreakers, setIcebreakers] = useState<Record<string, string>>({});
  const [suggesting, setSuggesting] = useState(false);
  const [usage, setUsage] = useState<{ sentToday: number; dailyCap: number } | null>(null);

  useEffect(() => {
    void fetch("/api/gmail/status")
      .then((r) => r.json())
      .then((d) => setGmail({ connected: !!d.connected, name: d.name ?? "", email: d.email ?? "" }))
      .catch(() => setGmail({ connected: false, name: "", email: "" }));
    void fetch("/api/email/settings")
      .then((r) => r.json())
      .then((d) => setUsage({ sentToday: d.sentToday ?? 0, dailyCap: d.settings?.dailyCap ?? 50 }))
      .catch(() => setUsage(null));
    void fetch("/api/templates/cadences")
      .then((r) => r.json())
      .then((d) => setCadences(d.cadences ?? []))
      .catch(() => setCadences([]));
  }, []);

  const withEmail = recipients.filter(hasEmail);
  const withoutEmail = recipients.length - withEmail.length;
  const [previewId, setPreviewId] = useState<string | null>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [lastField, setLastField] = useState<"subject" | "body">("body");

  const sender = useMemo(() => ({ name: gmail?.name ?? "", email: gmail?.email ?? "" }), [gmail]);
  const toLead = (r: EmailRecipient): TemplateLead => ({ ...r, pipelineName: r.pipelineName ?? pipelineName, icebreaker: icebreakers[r.id] ?? null });
  const selectedRecipients = recipients.filter((r) => selected.has(r.id));
  const previewRecipient = selectedRecipients.find((r) => r.id === previewId) ?? selectedRecipients[0];
  const preview = previewRecipient
    ? { subject: renderTemplate(subject, toLead(previewRecipient), sender), body: renderTemplate(body, toLead(previewRecipient), sender) }
    : null;

  // Across everyone selected: which variables come out empty (no fallback), and any unknown {{keys}}.
  const missingCounts = new Map<string, number>();
  for (const r of selectedRecipients) {
    for (const key of missingVariables(`${subject}\n${body}`, toLead(r), sender)) missingCounts.set(key, (missingCounts.get(key) ?? 0) + 1);
  }
  const unknown = unknownVariables(`${subject}\n${body}`);

  function insertVariable(key: string) {
    const token = `{{${key}}}`;
    const el = lastField === "subject" ? subjectRef.current : bodyRef.current;
    const current = lastField === "subject" ? subject : body;
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    const next = current.slice(0, start) + token + current.slice(end);
    if (lastField === "subject") setSubject(next);
    else setBody(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  const usesIcebreaker = /\{\{\s*icebreaker/i.test(`${subject}\n${body}`);
  const blocked = unknown.length > 0 || missingCounts.size > 0;
  const remainingToday = usage ? Math.max(0, usage.dailyCap - usage.sentToday) : null;

  async function suggestFirstLines() {
    setSuggesting(true);
    setError(null);
    try {
      const res = await fetch("/api/email/icebreakers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: Array.from(selected) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Failed (${res.status})`);
      setIcebreakers((prev) => ({ ...prev, ...(data.lines ?? {}) }));
      if (!usesIcebreaker) setBody((b) => (b.includes("{{icebreaker}}") ? b : b.replace(/^(Hi[^\n]*\n\n?)?/, (greeting) => `${greeting}{{icebreaker}}\n\n`)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't suggest first lines");
    } finally {
      setSuggesting(false);
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_PER_SEND) next.add(id);
      return next;
    });
  }

  async function send() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: Array.from(selected), subject, body, replyInThread, templateStepId, icebreakers }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.needsGmail) setGmail((prev) => ({ connected: false, name: prev?.name ?? "", email: prev?.email ?? "" }));
        throw new Error(data.error ?? `Failed (${res.status})`);
      }
      setResults(data.results ?? []);
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sending failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex bg-black/60"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !sending) onClose();
      }}
    >
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#10141f]">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <h2 className="text-sm font-semibold text-zinc-100">Email {recipients.length === 1 ? recipients[0].name : `${recipients.length} leads`}</h2>
          <button type="button" onClick={onClose} disabled={sending} className="text-sm text-zinc-500 hover:text-zinc-300">
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {gmail === null ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : !gmail.connected ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-zinc-300">
                Connect your Gmail once so emails go out from your own address and get CRM labels in your inbox.
              </p>
              <a href="/api/gmail/connect" className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-zinc-100 hover:bg-blue-500">
                Connect Gmail
              </a>
            </div>
          ) : results ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-zinc-300">
                Sent {results.filter((r) => r.status === "sent").length} · skipped {results.filter((r) => r.status === "skipped").length} · failed{" "}
                {results.filter((r) => r.status === "failed").length}
              </p>
              <ul className="flex flex-col gap-1 text-xs">
                {results.map((r) => (
                  <li key={r.leadId} className={r.status === "sent" ? "text-emerald-400" : r.status === "failed" ? "text-red-400" : "text-zinc-500"}>
                    {r.status === "sent" ? "✓" : r.status === "failed" ? "✕" : "–"} {r.name}
                    {r.detail && <span className="text-zinc-500"> — {r.detail}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <section>
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Recipients · {selected.size} selected
                  {withoutEmail > 0 && <span className="ml-1 normal-case text-zinc-600">({withoutEmail} without an email address)</span>}
                </h3>
                <div className="max-h-44 overflow-y-auto rounded-lg border border-white/10 bg-white/[0.02] p-2">
                  {recipients.map((r) => (
                    <label key={r.id} className={`flex items-center gap-2 px-1 py-0.5 text-xs ${hasEmail(r) ? "text-zinc-300" : "text-zinc-600"}`}>
                      <input type="checkbox" disabled={!hasEmail(r)} checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                      <span className="truncate">{r.name}</span>
                      <span className="truncate text-zinc-500">{r.email ?? "no email"}</span>
                    </label>
                  ))}
                </div>
                {withEmail.length > MAX_PER_SEND && (
                  <p className="mt-1 text-xs text-zinc-500">Up to {MAX_PER_SEND} per send — send the rest in another batch.</p>
                )}
              </section>

              {/* Editor on the left, live preview on the right (stacked on narrow screens) */}
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <section className="flex min-w-0 flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const step = cadences.flatMap((c) => c.steps).find((s) => s.id === e.target.value);
                      if (step) {
                        setTemplateStepId(step.id);
                        setBody(step.content);
                        if (!subject) setSubject(step.label);
                      }
                    }}
                    className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-300 outline-none"
                  >
                    <option value="" className="bg-[#10141f]">Use a template…</option>
                    {cadences.map((c) => (
                      <optgroup key={c.id} label={c.name} className="bg-[#10141f]">
                        {c.steps.map((s) => (
                          <option key={s.id} value={s.id} className="bg-[#10141f]">
                            {s.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) insertVariable(e.target.value);
                    }}
                    title={`Inserts at the cursor in the ${lastField}`}
                    className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-300 outline-none"
                  >
                    <option value="" className="bg-[#10141f]">Insert variable into {lastField}…</option>
                    {(["Lead", "You"] as const).map((group) => (
                      <optgroup key={group} label={group === "Lead" ? "Lead" : "You (sender)"} className="bg-[#10141f]">
                        {TEMPLATE_VARIABLES.filter((v) => v.group === group).map((v) => (
                          <option key={v.key} value={v.key} className="bg-[#10141f]">
                            {v.label} — {`{{${v.key}}}`}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <span className="text-[11px] text-zinc-600">
                    Fallback if empty: {"{{first_name|there}}"}
                  </span>
                </div>
                <input
                  ref={subjectRef}
                  value={subject}
                  onFocus={() => setLastField("subject")}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject (follow-ups reuse the earlier thread's subject)"
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-blue-500/50"
                />
                <textarea
                  ref={bodyRef}
                  value={body}
                  onFocus={() => setLastField("body")}
                  onChange={(e) => setBody(e.target.value)}
                  rows={20}
                  placeholder={"Hi {{first_name|there}},\n\n…"}
                  className="min-h-[24rem] flex-1 resize-y rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm leading-relaxed text-zinc-100 outline-none focus:ring-1 focus:ring-blue-500/50"
                />
                <label className="flex items-center gap-2 text-xs text-zinc-400">
                  <input type="checkbox" checked={replyInThread} onChange={(e) => setReplyInThread(e.target.checked)} />
                  If I&apos;ve emailed them before, send this as a reply in that thread
                </label>
              </section>

              {preview && previewRecipient ? (
                <section className="flex min-w-0 flex-col">
                  <div className="mb-1.5 flex items-center gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Preview for</h3>
                    <select
                      value={previewRecipient.id}
                      onChange={(e) => setPreviewId(e.target.value)}
                      className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-zinc-300 outline-none"
                    >
                      {selectedRecipients.map((r) => (
                        <option key={r.id} value={r.id} className="bg-[#10141f]">
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="min-h-[24rem] flex-1 overflow-y-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-white/[0.02] p-4 text-sm leading-relaxed text-zinc-300">
                    <p className="mb-2 font-medium text-zinc-100">{preview.subject || "(no subject)"}</p>
                    {preview.body}
                  </div>
                  {unknown.length > 0 && (
                    <p className="mt-1 text-xs text-amber-400">
                      Not a known variable (check the spelling): {unknown.map((k) => `{{${k}}}`).join(", ")}
                    </p>
                  )}
                  {Array.from(missingCounts).map(([key, count]) => (
                    <p key={key} className="mt-1 text-xs text-amber-400">
                      {`{{${key}}}`} is empty for {count} of {selectedRecipients.length}. Add a fallback like {`{{${key}|…}}`} or untick them.
                    </p>
                  ))}
                </section>
              ) : (
                <section className="flex min-h-[24rem] items-center justify-center rounded-lg border border-dashed border-white/10 text-sm text-zinc-600">
                  Tick at least one recipient to see a preview
                </section>
              )}
              </div>
              <section className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={suggesting || selected.size === 0}
                    onClick={() => void suggestFirstLines()}
                    className="rounded-md border border-white/10 px-2.5 py-1 text-xs text-zinc-300 hover:bg-white/5 disabled:opacity-40"
                  >
                    {suggesting ? "Writing first lines…" : "✨ Suggest first lines with AI"}
                  </button>
                  <span className="text-[11px] text-zinc-600">One personal opening line per person, used via {"{{icebreaker}}"} — check and edit each before sending.</span>
                </div>
                {Object.keys(icebreakers).length > 0 && (
                  <div className="flex max-h-48 flex-col gap-1.5 overflow-y-auto rounded-lg border border-white/10 bg-white/[0.02] p-2">
                    {selectedRecipients.map((r) => (
                      <label key={r.id} className="flex flex-col gap-0.5 text-xs">
                        <span className="text-zinc-500">{r.name}</span>
                        <input
                          value={icebreakers[r.id] ?? ""}
                          onChange={(e) => setIcebreakers((prev) => ({ ...prev, [r.id]: e.target.value }))}
                          placeholder="No line yet — write one or untick this person"
                          className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-100 outline-none focus:ring-1 focus:ring-blue-500/50"
                        />
                      </label>
                    ))}
                  </div>
                )}
              </section>

              <p className="text-xs text-zinc-500">
                After sending, each lead moves up one stage (Contacted → Contacted (2) → Contacted (3)) and the Gmail thread is labelled
                CRM / {pipelineName} / stage.
              </p>
            </div>
          )}
          {error && <p className="mt-3 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}
        </div>

        {gmail?.connected && !results && (
          <div className="flex items-center justify-end gap-2 border-t border-white/10 px-5 py-3">
            {usage && (
              <span className={`mr-auto text-xs ${remainingToday !== null && selected.size > remainingToday ? "text-amber-400" : "text-zinc-500"}`}>
                {usage.sentToday} of {usage.dailyCap} sent today
                {remainingToday !== null && selected.size > remainingToday && ` — only ${remainingToday} more will go out`}
              </span>
            )}
            {blocked && <span className="text-xs text-amber-400">Fix the variables above to send</span>}
            <button type="button" onClick={onClose} disabled={sending} className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-zinc-300 hover:bg-white/5">
              Cancel
            </button>
            <button
              type="button"
              disabled={sending || selected.size === 0 || !body.trim() || blocked || remainingToday === 0}
              title={blocked ? "Fix the highlighted variables first" : remainingToday === 0 ? "Daily email limit reached" : undefined}
              onClick={() => void send()}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-zinc-100 hover:bg-blue-500 disabled:opacity-50"
            >
              {sending ? `Sending… (about ${Math.ceil(selected.size * 1.5)}s)` : `Send to ${selected.size}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
