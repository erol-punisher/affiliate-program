"use client";

import { useEffect, useMemo, useState } from "react";
import { detectColumnType, isNumericType, validateCellValue } from "@/lib/columnTypes";
import { detectColumnRole, parseAmount } from "@/lib/columnRoles";
import { findEmptyRowIndices } from "@/lib/sheetCleanup";
import { formatMonthTitle } from "@/lib/monthTabs";
import { RefreshIcon, SortIcon, TrashIcon, PlusIcon, XIcon } from "@/components/icons";
import { TopNav } from "@/components/TopNav";
import { CellDisplay } from "@/components/CellDisplay";
import { Pagination } from "@/components/Pagination";

type CellStatus = "idle" | "saving" | "saved" | "error";

type SheetTab = {
  title: string;
  gid: number;
};

type PaymentSheetResponse = {
  tabs: SheetTab[];
  selected: SheetTab;
  headers: string[];
  rows: string[][];
};

type SortState = { col: number; dir: "asc" | "desc" } | null;

type Props = {
  userEmail: string;
};

export function PaymentRecords({ userEmail }: Props) {
  const [data, setData] = useState<PaymentSheetResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortState>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [loadingTab, setLoadingTab] = useState(false);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [showColumnManager, setShowColumnManager] = useState(false);
  const [columnsToDelete, setColumnsToDelete] = useState<Set<string>>(new Set());
  const [showUpload, setShowUpload] = useState(false);
  const [uploadMonth, setUploadMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [draftValue, setDraftValue] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [cellStatus, setCellStatus] = useState<Record<string, CellStatus>>({});
  const [cellErrors, setCellErrors] = useState<Record<string, { message: string; value: string }>>(
    {},
  );

  // colIndexMap[i] gives the original data.headers/data.rows column index for visible position i.
  const visible = useMemo(() => {
    if (!data) return null;

    const colIndexMap = data.headers
      .map((_, i) => i)
      .filter((i) => data.rows.some((row) => (row[i] ?? "").trim() !== ""));

    const headers = colIndexMap.map((i) => data.headers[i]);
    const emptyRowIndices = new Set(findEmptyRowIndices(data.headers, data.rows));
    const rows = data.rows
      .map((row, index) => ({ row, index }))
      .filter(({ index }) => !emptyRowIndices.has(index));

    return { headers, colIndexMap, rows };
  }, [data]);

  const columnTypes = useMemo(() => {
    if (!data) return [];
    return data.headers.map((_, colIndex) =>
      detectColumnType(data.rows.map((row) => row[colIndex] ?? "")),
    );
  }, [data]);

  const columnRoles = useMemo(() => {
    if (!data) return [];
    return data.headers.map((header) => detectColumnRole(header));
  }, [data]);

  useEffect(() => {
    void loadSheet();
  }, []);

  async function loadSheet(gid?: number) {
    setLoadError(null);
    setLoadingTab(true);
    try {
      const url = gid !== undefined ? `/api/payment-sheet?gid=${gid}` : "/api/payment-sheet";
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed to load payment records (${res.status})`);
      }
      setData(await res.json());
      setSort(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load payment records");
    } finally {
      setLoadingTab(false);
    }
  }

  function startEditing(rowIndex: number, colIndex: number, currentValue: string) {
    setEditingCell({ row: rowIndex, col: colIndex });
    setDraftValue(currentValue);
    setDraftError(null);
  }

  async function saveCell(rowIndex: number, colIndex: number, value: string, previousValue: string) {
    if (!data) return;
    const gid = data.selected.gid;
    const key = `${rowIndex}:${colIndex}`;

    setData((prev) => {
      if (!prev) return prev;
      const rows = prev.rows.map((r) => [...r]);
      rows[rowIndex][colIndex] = value;
      return { ...prev, rows };
    });
    setCellStatus((prev) => ({ ...prev, [key]: "saving" }));
    setCellErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

    try {
      const res = await fetch("/api/payment-sheet", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gid, row: rowIndex, col: colIndex, value }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Save failed (${res.status})`);
      }
      setCellStatus((prev) => ({ ...prev, [key]: "saved" }));
      setTimeout(() => {
        setCellStatus((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }, 1500);
    } catch (err) {
      setCellStatus((prev) => ({ ...prev, [key]: "error" }));
      setCellErrors((prev) => ({
        ...prev,
        [key]: { message: err instanceof Error ? err.message : "Save failed", value },
      }));
      setData((prev) => {
        if (!prev) return prev;
        const rows = prev.rows.map((r) => [...r]);
        rows[rowIndex][colIndex] = previousValue;
        return { ...prev, rows };
      });
    }
  }

  async function commitEdit() {
    if (!editingCell || !data) return;
    const { row: rowIndex, col: colIndex } = editingCell;
    const previousValue = data.rows[rowIndex][colIndex];

    const error = validateCellValue(draftValue, columnTypes[colIndex]);
    if (error) {
      setDraftError(error);
      return;
    }

    setEditingCell(null);
    setDraftError(null);

    if (draftValue === previousValue) return;
    await saveCell(rowIndex, colIndex, draftValue, previousValue);
  }

  function retryCell(rowIndex: number, colIndex: number) {
    if (!data) return;
    const key = `${rowIndex}:${colIndex}`;
    const failed = cellErrors[key];
    if (!failed) return;
    void saveCell(rowIndex, colIndex, failed.value, data.rows[rowIndex][colIndex]);
  }

  async function deleteEmptyRows() {
    const confirmed = window.confirm(
      "This permanently deletes every fully-blank row from all tabs in the payment spreadsheet. This cannot be undone from the app. Continue?",
    );
    if (!confirmed) return;

    setLoadError(null);
    setCleaningUp(true);
    try {
      const res = await fetch("/api/payment-sheet/cleanup", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed to delete empty rows (${res.status})`);
      }
      const body = await res.json();
      window.alert(`Deleted ${body.totalDeleted} empty row(s) across ${body.results.length} tab(s).`);
      await loadSheet(data?.selected.gid);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to delete empty rows");
    } finally {
      setCleaningUp(false);
    }
  }

  async function deleteColumnsEverywhere(headersToDelete: string[]) {
    if (headersToDelete.length === 0) return;
    const list = headersToDelete.map((h) => `"${h}"`).join(", ");
    const confirmed = window.confirm(
      `This permanently deletes ${list} from every tab in the payment spreadsheet. This cannot be undone from the app. Continue?`,
    );
    if (!confirmed) return;

    setLoadError(null);
    setCleaningUp(true);
    try {
      const res = await fetch("/api/payment-sheet/delete-column", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headers: headersToDelete }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed to delete columns (${res.status})`);
      }
      const body = await res.json();
      if (body.totalRemoved === 0) {
        const sample = body.results[0]?.headersSeen ?? [];
        window.alert(
          `Didn't find ${list} in any tab.\n\nHeaders in "${body.results[0]?.title}":\n${sample.map((h: string) => `"${h}"`).join("\n")}`,
        );
      } else {
        window.alert(
          `Removed ${body.totalRemoved} column(s) total across ${body.results.filter((r: { removedCount: number }) => r.removedCount > 0).length} of ${body.results.length} tab(s).`,
        );
      }
      setColumnsToDelete(new Set());
      setShowColumnManager(false);
      await loadSheet(data?.selected.gid);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to delete columns");
    } finally {
      setCleaningUp(false);
    }
  }

  async function submitUpload(csv: string, confirmOverwrite: boolean) {
    const res = await fetch("/api/payment-sheet/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: uploadMonth, csv, confirmOverwrite }),
    });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  }

  async function handleUpload() {
    if (!uploadFile) return;
    setUploadError(null);
    setUploading(true);
    try {
      const csv = await uploadFile.text();
      let { status, body } = await submitUpload(csv, false);

      if (status === 409) {
        const proceed = window.confirm(
          `"${formatMonthTitle(body.existingTitle)}" already has data in the sheet. Uploading will replace all of it with this CSV. Continue?`,
        );
        if (!proceed) {
          setUploading(false);
          return;
        }
        ({ status, body } = await submitUpload(csv, true));
      }

      if (status < 200 || status >= 300) {
        throw new Error(body.error ?? `Upload failed (${status})`);
      }

      await loadSheet(body.gid);
      setShowUpload(false);
      setUploadFile(null);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const sortedRows = useMemo(() => {
    if (!visible) return [];
    if (!sort) return visible.rows;

    const { col, dir } = sort;
    const factor = dir === "asc" ? 1 : -1;
    const numeric = isNumericType(columnTypes[col]);

    return [...visible.rows].sort((a, b) => {
      const av = a.row[col] ?? "";
      const bv = b.row[col] ?? "";
      if (numeric) return (parseAmount(av) - parseAmount(bv)) * factor;
      return av.localeCompare(bv) * factor;
    });
  }, [visible, sort, columnTypes]);

  useEffect(() => {
    setPage(1);
  }, [visible, sort]);

  const pagedRows = useMemo(
    () => sortedRows.slice((page - 1) * pageSize, page * pageSize),
    [sortedRows, page, pageSize],
  );

  function toggleSort(colIndex: number) {
    setSort((prev) => {
      if (!prev || prev.col !== colIndex) return { col: colIndex, dir: "asc" };
      if (prev.dir === "asc") return { col: colIndex, dir: "desc" };
      return null;
    });
  }

  const nameColIndex = columnRoles.indexOf("name");

  return (
    <div className="min-h-screen font-sans text-zinc-100">
      <TopNav userEmail={userEmail} />

      <main className="flex w-full flex-col gap-6 px-6 py-8">
        <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#10141f] shadow-2xl shadow-black/60">
          <div className="h-1 w-full bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500" />
          <div className="border-b border-white/10 px-6 py-5">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-100">Payment Records</h1>
            <p className="mt-0.5 text-sm text-zinc-500">Referrer payments tracked by month</p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-6 py-4">
            <div className="flex flex-wrap items-center gap-2">
              {data && data.tabs.length > 0 && (
                <select
                  value={data.selected.gid}
                  disabled={loadingTab}
                  onChange={(e) => void loadSheet(Number(e.target.value))}
                  className="rounded-lg border border-white/10 bg-white/5 px-3.5 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/[0.08] focus:outline-none focus:ring-1 focus:ring-blue-500/50 disabled:opacity-50"
                >
                  {data.tabs.map((tab) => (
                    <option key={tab.gid} value={tab.gid} className="bg-[#10141f] text-zinc-200">
                      {formatMonthTitle(tab.title)}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowUpload((v) => !v)}
                className="flex items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/10 px-3.5 py-2 text-sm text-blue-300/90 transition-colors hover:bg-blue-500/20"
              >
                <PlusIcon className="h-4 w-4" />
                Upload CSV
              </button>
              <button
                type="button"
                onClick={() => setShowColumnManager((v) => !v)}
                className="flex items-center gap-2 rounded-lg border border-red-500/20 px-3.5 py-2 text-sm text-red-300/90 transition-colors hover:bg-red-500/10"
              >
                <TrashIcon className="h-4 w-4" />
                Remove columns
              </button>
              <button
                type="button"
                onClick={() => void deleteEmptyRows()}
                disabled={cleaningUp}
                className="flex items-center gap-2 rounded-lg border border-red-500/20 px-3.5 py-2 text-sm text-red-300/90 transition-colors hover:bg-red-500/10 disabled:opacity-50"
              >
                <TrashIcon className="h-4 w-4" />
                {cleaningUp ? "Deleting…" : "Delete empty rows"}
              </button>
              <button
                type="button"
                onClick={() => void loadSheet(data?.selected.gid)}
                className="flex items-center gap-2 rounded-lg border border-white/10 px-3.5 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/5"
              >
                <RefreshIcon className="h-4 w-4" />
                Refresh
              </button>
            </div>
          </div>

          {showColumnManager && visible && (
            <div className="border-b border-white/10 bg-white/[0.02] px-6 py-4">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                Select columns to remove from every tab
              </p>
              <div className="flex flex-wrap gap-2">
                {visible.headers.map((header) => {
                  if (!header) return null;
                  const checked = columnsToDelete.has(header);
                  return (
                    <label
                      key={header}
                      className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        checked
                          ? "border-red-500/40 bg-red-500/15 text-red-300"
                          : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setColumnsToDelete((prev) => {
                            const next = new Set(prev);
                            if (next.has(header)) next.delete(header);
                            else next.add(header);
                            return next;
                          });
                        }}
                        className="h-3.5 w-3.5 cursor-pointer"
                      />
                      {header}
                    </label>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void deleteColumnsEverywhere([...columnsToDelete])}
                  disabled={columnsToDelete.size === 0 || cleaningUp}
                  className="rounded-lg border border-red-500/30 bg-red-500/20 px-3.5 py-2 text-sm text-red-200 transition-colors hover:bg-red-500/30 disabled:opacity-50"
                >
                  {cleaningUp
                    ? "Deleting…"
                    : `Delete ${columnsToDelete.size || ""} selected column(s)`}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowColumnManager(false);
                    setColumnsToDelete(new Set());
                  }}
                  className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-zinc-500 transition-colors hover:text-zinc-300"
                >
                  <XIcon className="h-4 w-4" />
                  Cancel
                </button>
              </div>
            </div>
          )}

          {showUpload && (
            <div className="flex flex-wrap items-end gap-3 border-b border-white/10 bg-white/[0.02] px-6 py-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">Month</label>
                <input
                  type="month"
                  value={uploadMonth}
                  onChange={(e) => setUploadMonth(e.target.value)}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">CSV file</label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                  className="text-sm text-zinc-300 file:mr-3 file:rounded-lg file:border file:border-white/10 file:bg-white/5 file:px-3 file:py-1.5 file:text-sm file:text-zinc-300 hover:file:bg-white/10"
                />
              </div>
              <button
                type="button"
                onClick={() => void handleUpload()}
                disabled={!uploadFile || uploading}
                className="flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/20 px-3.5 py-2 text-sm text-blue-200 transition-colors hover:bg-blue-500/30 disabled:opacity-50"
              >
                {uploading ? "Uploading…" : "Upload"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowUpload(false);
                  setUploadFile(null);
                  setUploadError(null);
                }}
                className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-zinc-500 transition-colors hover:text-zinc-300"
              >
                <XIcon className="h-4 w-4" />
                Cancel
              </button>
              {uploadError && <p className="w-full text-sm text-red-400">{uploadError}</p>}
            </div>
          )}

          {loadError && (
            <p className="mx-6 mt-4 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {loadError}
            </p>
          )}

          {!visible && !loadError && (
            <div className="p-6">
              <div className="animate-pulse space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-10 rounded-md bg-white/5" />
                ))}
              </div>
            </div>
          )}

          {visible && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02]">
                    <th className="w-12 px-4 py-3.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                      #
                    </th>
                    {visible.headers.map((header, i) => {
                      const colIndex = visible.colIndexMap[i];
                      return (
                        <th
                          key={colIndex}
                          className={`group/col select-none whitespace-nowrap px-6 py-3.5 text-xs font-medium uppercase tracking-wide text-zinc-500 ${
                            isNumericType(columnTypes[colIndex]) ? "text-right" : "text-left"
                          }`}
                        >
                          <span className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => toggleSort(colIndex)}
                              className={`inline-flex items-center gap-1 transition-colors hover:text-zinc-300 ${
                                isNumericType(columnTypes[colIndex]) ? "flex-row-reverse" : ""
                              }`}
                            >
                              {header || `Column ${colIndex + 1}`}
                              <SortIcon
                                className={`h-3.5 w-3.5 ${
                                  sort?.col === colIndex ? "text-blue-300/80" : "text-zinc-600"
                                }`}
                              />
                            </button>
                            {header && (
                              <button
                                type="button"
                                title={`Delete "${header}" column from every tab`}
                                onClick={() => void deleteColumnsEverywhere([header])}
                                className="opacity-0 transition-opacity hover:text-red-300 group-hover/col:opacity-100"
                              >
                                <XIcon className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {pagedRows.map(({ row, index: rowIndex }, localPosition) => {
                    const position = (page - 1) * pageSize + localPosition;
                    return (
                    <tr
                      key={rowIndex}
                      className={`transition-colors hover:bg-white/[0.04] ${
                        localPosition % 2 === 1 ? "bg-white/[0.012]" : ""
                      }`}
                    >
                      <td className="w-12 px-4 py-3.5 text-zinc-500">{position + 1}</td>
                      {visible.colIndexMap.map((colIndex) => {
                        const cell = row[colIndex] ?? "";
                        const isEditing =
                          editingCell?.row === rowIndex && editingCell?.col === colIndex;
                        const key = `${rowIndex}:${colIndex}`;
                        const status = cellStatus[key];
                        const cellError = cellErrors[key];
                        const numeric = isNumericType(columnTypes[colIndex]);
                        const role = columnRoles[colIndex];
                        const isCurrency = columnTypes[colIndex] === "currency";

                        return (
                          <td
                            key={colIndex}
                            className={`relative min-w-[10rem] px-6 py-3.5 ${
                              status === "error" ? "bg-red-500/10" : ""
                            }`}
                            onClick={() => !isEditing && startEditing(rowIndex, colIndex, cell)}
                          >
                            {isEditing ? (
                              <div>
                                <input
                                  autoFocus
                                  value={draftValue}
                                  onChange={(e) => {
                                    setDraftValue(e.target.value);
                                    setDraftError(null);
                                  }}
                                  onBlur={() => void commitEdit()}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") void commitEdit();
                                    if (e.key === "Escape") {
                                      setEditingCell(null);
                                      setDraftError(null);
                                    }
                                  }}
                                  className={`w-full rounded border bg-[#0f141f] px-1.5 py-1 text-sm text-zinc-100 outline-none ${
                                    numeric ? "text-right" : "text-left"
                                  } ${draftError ? "border-red-400/70" : "border-blue-500/70"}`}
                                />
                                {draftError && (
                                  <p className="absolute left-0 top-full z-10 mt-1 w-max max-w-xs rounded-md border border-red-500/30 bg-red-950 px-2 py-1 text-xs text-red-200 shadow-lg">
                                    {draftError}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <CellDisplay
                                value={cell}
                                role={role}
                                numeric={numeric}
                                currency={isCurrency}
                                nameSeed={nameColIndex !== -1 ? row[nameColIndex] || cell : cell}
                              />
                            )}
                            {status === "saving" && (
                              <span className="absolute right-2 top-2 text-[10px] text-zinc-500">
                                saving…
                              </span>
                            )}
                            {status === "error" && cellError && (
                              <div className="absolute left-0 top-full z-10 mt-1 flex w-max max-w-xs items-center gap-2 rounded-md border border-red-500/30 bg-red-950 px-2 py-1 text-xs text-red-200 shadow-lg">
                                <span>{cellError.message}</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    retryCell(rowIndex, colIndex);
                                  }}
                                  className="whitespace-nowrap underline underline-offset-2 hover:no-underline"
                                >
                                  Retry
                                </button>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                    );
                  })}
                </tbody>
              </table>
              <Pagination
                page={page}
                pageSize={pageSize}
                total={sortedRows.length}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
              />
              {sortedRows.length === 0 && (
                <p className="px-6 py-6 text-sm text-zinc-500">No payment records found.</p>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
