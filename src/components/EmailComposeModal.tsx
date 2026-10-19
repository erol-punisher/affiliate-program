"use client";

import { useEffect, useMemo, useState } from "react";
import { TEMPLATE_PLACEHOLDERS, renderTemplate } from "@/lib/emailTemplate";

export type EmailRecipient = {
  id: string;
  name: string;
  email: string | null;
  country: string | null;
  username: string | null;
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
  const [gmail, setGmail] = useState<{ connected: boolean; name: string } | null>(null);
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

  useEffect(() => {
    void fetch("/api/gmail/status")
      .then((r) => r.json())
      .then((d) => setGmail({ connected: !!d.connected, name: d.name ?? "" }))
      .catch(() => setGmail({ connected: false, name: "" }));
    void fetch("/api/templates/cadences")
      .then((r) => r.json())
      .then((d) => setCadences(d.cadences ?? []))
      .catch(() => setCadences([]));
  }, []);

  const withEmail = recipients.filter(hasEmail);
  const withoutEmail = recipients.length - withEmail.length;
  const firstSelected = recipients.find((r) => selected.has(r.id));
  const senderName = gmail?.name ?? "";
  const preview = useMemo(() => {
    if (!firstSelected) return null;
    const lead = { name: firstSelected.name, country: firstSelected.country, username: firstSelected.username, pipelineName };
    return { subject: renderTemplate(subject, lead, senderName), body: renderTemplate(body, lead, senderName) };
  }, [firstSelected, subject, body, pipelineName, senderName]);
  const unknownPlaceholder = preview && /\{\{[^}]*\}\}/.test(preview.subject + preview.body);

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
        body: JSON.stringify({ leadIds: Array.from(selected), subject, body, replyInThread }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.needsGmail) setGmail({ connected: false, name: senderName });
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !sending) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-white/10 bg-[#10141f] shadow-2xl">
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
                <div className="max-h-36 overflow-y-auto rounded-lg border border-white/10 bg-white/[0.02] p-2">
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

              <section className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const step = cadences.flatMap((c) => c.steps).find((s) => s.id === e.target.value);
                      if (step) {
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
                  <span className="text-[11px] text-zinc-600">
                    Fields: {TEMPLATE_PLACEHOLDERS.map((p) => `{{${p}}}`).join(" ")}
                  </span>
                </div>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject (follow-ups reuse the earlier thread's subject)"
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-blue-500/50"
                />
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={8}
                  placeholder={"Hi {{first_name}},\n\n…"}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-blue-500/50"
                />
                <label className="flex items-center gap-2 text-xs text-zinc-400">
                  <input type="checkbox" checked={replyInThread} onChange={(e) => setReplyInThread(e.target.checked)} />
                  If I&apos;ve emailed them before, send this as a reply in that thread
                </label>
              </section>

              {preview && (
                <section>
                  <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">Preview for {firstSelected?.name}</h3>
                  <div className="whitespace-pre-wrap rounded-lg border border-white/10 bg-white/[0.02] p-3 text-xs text-zinc-300">
                    <p className="mb-2 font-medium text-zinc-100">{preview.subject || "(no subject)"}</p>
                    {preview.body}
                  </div>
                  {unknownPlaceholder && <p className="mt-1 text-xs text-amber-400">Some {"{{fields}}"} aren&apos;t recognised and will be sent as written.</p>}
                </section>
              )}
              <p className="text-xs text-zinc-500">
                After sending, each lead moves up one stage (Contacted → Contacted (2) → Contacted (3)) and the Gmail thread is labelled
                CRM / {pipelineName} / stage.
              </p>
            </div>
          )}
          {error && <p className="mt-3 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}
        </div>

        {gmail?.connected && !results && (
          <div className="flex justify-end gap-2 border-t border-white/10 px-5 py-3">
            <button type="button" onClick={onClose} disabled={sending} className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-zinc-300 hover:bg-white/5">
              Cancel
            </button>
            <button
              type="button"
              disabled={sending || selected.size === 0 || !body.trim()}
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
