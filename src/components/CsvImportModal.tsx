"use client";

import { useState } from "react";
import { XIcon } from "@/components/icons";

type RowResult = {
  rowNumber: number;
  name: string;
  groupName: string;
  pipelineName: string;
  stageName: string;
  action: "create" | "update";
  groupCreated: boolean;
  pipelineCreated: boolean;
  stageCreated: boolean;
};

type ImportRowError = { rowNumber: number; message: string };

type ImportResponse = {
  errors: ImportRowError[];
  results: RowResult[];
  summary: { created: number; updated: number; newGroups: number; newPipelines: number; newStages: number };
  committed: boolean;
};

type Props = {
  onClose: () => void;
  onImported: () => void;
};

export function CsvImportModal({ onClose, onImported }: Props) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(f: File) {
    setFileName(f.name);
    setPreview(null);
    setError(null);
    setCsvText(await f.text());
  }

  async function submit(commit: boolean) {
    if (!csvText) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/crm/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvText, commit }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Import failed");
      if (commit) {
        onImported();
      } else {
        setPreview(body);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }

  const newStructureCount = preview
    ? preview.summary.newGroups + preview.summary.newPipelines + preview.summary.newStages
    : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-white/10 bg-[#10141f] shadow-2xl shadow-black/60">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h3 className="text-sm font-semibold text-zinc-100">Import leads from CSV</h3>
          <button type="button" onClick={onClose} className="text-zinc-500 transition-colors hover:text-zinc-300">
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
            className="block w-full text-sm text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-700 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-100 hover:file:bg-blue-600"
          />
          <p className="mt-2 text-xs text-zinc-500">
            Matches rows to existing pipeline groups / sub-pipelines / stages by name (creating any that do not exist
            yet). A lead already present in that sub-pipeline (matched by name) gets its blank fields filled in
            instead of a duplicate — safe to re-run the same export.
          </p>

          {fileName && !preview && (
            <button
              type="button"
              disabled={loading || !csvText}
              onClick={() => void submit(false)}
              className="mt-4 rounded-lg bg-blue-700 px-3.5 py-1.5 text-sm font-medium text-zinc-100 transition-colors hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? "Reading…" : "Preview import"}
            </button>
          )}

          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

          {preview && (
            <div className="mt-4 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2 rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
                <p className="text-zinc-300">
                  <span className="font-semibold text-emerald-400">{preview.summary.created}</span> new leads
                </p>
                <p className="text-zinc-300">
                  <span className="font-semibold text-blue-400">{preview.summary.updated}</span> existing leads updated
                </p>
                <p className="col-span-2 text-zinc-400">
                  {newStructureCount === 0
                    ? "No new pipeline groups, sub-pipelines, or stages needed."
                    : `${preview.summary.newGroups} new pipeline group(s), ${preview.summary.newPipelines} new sub-pipeline(s), ${preview.summary.newStages} new stage(s).`}
                </p>
              </div>

              {preview.errors.length > 0 && (
                <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-yellow-400">
                    {preview.errors.length} row(s) skipped
                  </p>
                  <div className="max-h-32 overflow-y-auto text-xs text-yellow-200/80">
                    {preview.errors.map((e, i) => (
                      <p key={i}>
                        Row {e.rowNumber}: {e.message}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {preview.summary.created + preview.summary.updated === 0 && preview.errors.length === 0 && (
                <p className="text-sm text-zinc-500">Nothing to import — the CSV has no data rows.</p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/10 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-white/5"
          >
            Cancel
          </button>
          {preview && preview.summary.created + preview.summary.updated > 0 && (
            <button
              type="button"
              disabled={loading}
              onClick={() => void submit(true)}
              className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-sm font-medium text-zinc-100 transition-colors hover:bg-emerald-500 disabled:opacity-50"
            >
              {loading ? "Importing…" : "Confirm import"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
