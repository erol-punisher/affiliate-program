"use client";

import { useEffect, useState } from "react";
import { TopNav } from "@/components/TopNav";

type Props = {
  userEmail: string;
};

type DocumentationEntry = {
  id: string;
  title: string;
  content: string;
  author: string | null;
  createdAt: string;
  updatedAt: string;
};

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "YYYY-MM" for last month, to default the month-report picker to the most recently completed month. */
function defaultReportMonth(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function DocumentationBoard({ userEmail }: Props) {
  const [entries, setEntries] = useState<DocumentationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const [reportMonth, setReportMonth] = useState(defaultReportMonth);
  const [generatingReport, setGeneratingReport] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/documentation");
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      const data = await res.json();
      setEntries(data.entries ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documentation");
    } finally {
      setLoading(false);
    }
  }

  function openNewForm() {
    setEditingId(null);
    setTitle("");
    setContent("");
    setShowForm(true);
  }

  function openEditForm(entry: DocumentationEntry) {
    setEditingId(entry.id);
    setTitle(entry.title);
    setContent(entry.content);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setTitle("");
    setContent("");
  }

  async function save() {
    if (!title.trim() || !content.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const url = editingId ? `/api/documentation/${editingId}` : "/api/documentation";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), content: content.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed to save (${res.status})`);
      }
      closeForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save entry");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this entry? This can't be undone.")) return;
    setError(null);
    try {
      const res = await fetch(`/api/documentation/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Failed to delete (${res.status})`);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete entry");
    }
  }

  async function generateReport() {
    const [yearStr, monthStr] = reportMonth.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    if (!year || !month || generatingReport) return;

    setGeneratingReport(true);
    setError(null);
    try {
      const res = await fetch("/api/documentation/monthly-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed to generate report (${res.status})`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate monthly report");
    } finally {
      setGeneratingReport(false);
    }
  }

  return (
    <div className="min-h-screen font-sans text-zinc-100">
      <TopNav userEmail={userEmail} />

      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-100">Documentation</h1>
            <p className="mt-0.5 text-sm text-zinc-500">SOPs, process notes, and decisions — newest first</p>
          </div>
          <button
            type="button"
            onClick={openNewForm}
            className="whitespace-nowrap rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-zinc-100 transition-colors hover:bg-blue-600"
          >
            New entry
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#10141f] px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-zinc-200">Monthly report</p>
            <p className="mt-0.5 text-xs text-zinc-500">
              CRM entries added and affiliates who started onboarding, for a given month. Re-generating a month
              updates its existing entry instead of duplicating it.
            </p>
          </div>
          <input
            type="month"
            value={reportMonth}
            onChange={(e) => setReportMonth(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-blue-500/50"
          />
          <button
            type="button"
            onClick={() => void generateReport()}
            disabled={!reportMonth || generatingReport}
            className="whitespace-nowrap rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generatingReport ? "Generating…" : "Generate report"}
          </button>
        </div>

        {error && (
          <p className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
        )}

        {showForm && (
          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#10141f] shadow-2xl shadow-black/60">
            <div className="h-1 w-full bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500" />
            <div className="flex flex-col gap-4 px-6 py-5">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Title</span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. How we approve new affiliate applications"
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-blue-500/50"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Content</span>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write the entry..."
                  rows={10}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-blue-500/50"
                />
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={!title.trim() || !content.trim() || saving}
                  className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-zinc-100 transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Saving…" : editingId ? "Save changes" : "Create entry"}
                </button>
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/5"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : entries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center text-sm text-zinc-500">
            No documentation yet. Click &quot;New entry&quot; to write the first one.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#10141f] shadow-xl shadow-black/40"
              >
                <div className="flex items-start justify-between gap-4 px-6 py-5">
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-zinc-100">{entry.title}</h2>
                    <p className="mt-1 text-xs text-zinc-500">
                      {formatTimestamp(entry.createdAt)}
                      {entry.author ? ` · ${entry.author}` : ""}
                      {entry.updatedAt !== entry.createdAt ? ` · edited ${formatTimestamp(entry.updatedAt)}` : ""}
                    </p>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">{entry.content}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEditForm(entry)}
                      className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/5"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(entry.id)}
                      className="rounded-lg border border-red-500/20 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
