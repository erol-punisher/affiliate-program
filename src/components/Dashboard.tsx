"use client";

import { useMemo, useState, useEffect } from "react";
import { detectColumnType, isNumericType, validateCellValue } from "@/lib/columnTypes";
import { detectColumnRole, parseAmount } from "@/lib/columnRoles";
import { CheckIcon, ColumnsIcon, DownloadIcon, PencilIcon, PlusIcon, RefreshIcon, SearchIcon, SortIcon, TrashIcon, XIcon } from "@/components/icons";
import { AddAffiliateModal } from "@/components/AddAffiliateModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TopNav } from "@/components/TopNav";
import { CellDisplay } from "@/components/CellDisplay";
import { Pagination } from "@/components/Pagination";

type SheetData = {
  headers: string[];
  rows: string[][];
};

type CellStatus = "idle" | "saving" | "saved" | "error";
type SortState = { col: number; dir: "asc" | "desc" } | null;

type AffiliateStage = { id: string; name: string; order: number };

type ImportResult = {
  totalRows: number;
  created: number;
  updated: number;
  untouched: number;
  rowsWithIssues: number;
  ruleCounts: Record<string, number>;
  duplicateCandidates: { total: number; byType: { code: number; email: number; phone: number } };
};

type Props = {
  userEmail: string;
};

const HIDDEN_COLUMNS_STORAGE_KEY = "affiliateDashboard.hiddenColumns.v2";
const DEFAULT_HIDDEN_COLUMNS = [
  "Check if Active Affiliate",
  "Result of Checking",
  "In INIT Sheet",
  "Contact Link",
  "Community Size",
  "Paid Community Price",
  "Socials",
  "Other Info",
  "Contract Template",
];

function columnKey(header: string, index: number): string {
  return header.trim() ? header : `__col_${index}__`;
}

function loadHiddenColumns(): Set<string> {
  if (typeof window === "undefined") return new Set(DEFAULT_HIDDEN_COLUMNS);
  try {
    const saved = window.localStorage.getItem(HIDDEN_COLUMNS_STORAGE_KEY);
    if (saved) return new Set(JSON.parse(saved) as string[]);
  } catch {
    // ignore malformed/unavailable storage
  }
  return new Set(DEFAULT_HIDDEN_COLUMNS);
}

export function Dashboard({ userEmail }: Props) {
  const [data, setData] = useState<SheetData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [isAddingRow, setIsAddingRow] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [editRowIndex, setEditRowIndex] = useState<number | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(loadHiddenColumns);
  const [isColumnsMenuOpen, setIsColumnsMenuOpen] = useState(false);
  const [sort, setSort] = useState<SortState>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [draftValue, setDraftValue] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [cellStatus, setCellStatus] = useState<Record<string, CellStatus>>({});
  const [cellErrors, setCellErrors] = useState<Record<string, { message: string; value: string }>>(
    {},
  );
  const [stages, setStages] = useState<AffiliateStage[] | null>(null);
  const [showStageManager, setShowStageManager] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

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
    void loadStages();
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        HIDDEN_COLUMNS_STORAGE_KEY,
        JSON.stringify([...hiddenColumns]),
      );
    } catch {
      // ignore unavailable storage (e.g. private browsing)
    }
  }, [hiddenColumns]);

  function toggleColumnVisibility(key: string) {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const visibleColumnIndices = useMemo(() => {
    if (!data) return [];
    return data.headers
      .map((header, index) => index)
      .filter((index) => !hiddenColumns.has(columnKey(data.headers[index], index)));
  }, [data, hiddenColumns]);

  async function loadSheet() {
    setLoadError(null);
    try {
      const res = await fetch("/api/sheet");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed to load sheet (${res.status})`);
      }
      setData(await res.json());
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load sheet");
    }
  }

  async function runImport() {
    setIsImporting(true);
    setImportError(null);
    try {
      const res = await fetch("/api/admin/import", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Import failed (${res.status})`);
      }
      setImportResult(await res.json());
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setIsImporting(false);
    }
  }

  async function loadStages() {
    try {
      const res = await fetch("/api/affiliate-stages");
      if (!res.ok) throw new Error();
      const body = await res.json();
      setStages(body.stages ?? []);
    } catch {
      setStages([]);
    }
  }

  async function addStage(name: string) {
    try {
      const res = await fetch("/api/affiliate-stages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error();
      const body = await res.json();
      setStages((prev) => [...(prev ?? []), body.stage]);
      // The "Stage" column may have just been created for the first time.
      await loadSheet();
    } catch {
      await loadStages();
    }
  }

  async function updateStage(id: string, patch: Record<string, string | number>) {
    setStages((prev) => prev?.map((s) => (s.id === id ? ({ ...s, ...patch } as AffiliateStage) : s)) ?? null);
    try {
      const res = await fetch(`/api/affiliate-stages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
      if ("name" in patch) await loadSheet(); // renamed cells were bulk-synced server-side
    } catch {
      await loadStages();
    }
  }

  async function deleteStage(id: string) {
    setStages((prev) => prev?.filter((s) => s.id !== id) ?? null);
    try {
      const res = await fetch(`/api/affiliate-stages/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      await loadSheet(); // cleared cells were bulk-synced server-side
    } catch {
      await loadStages();
    }
  }

  async function reorderStages(orderedIds: string[]) {
    setStages((prev) => {
      if (!prev) return prev;
      const byId = new Map(prev.map((s) => [s.id, s]));
      return orderedIds.map((id, i) => ({ ...byId.get(id)!, order: i }));
    });
    try {
      const results = await Promise.all(
        orderedIds.map((id, i) =>
          fetch(`/api/affiliate-stages/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ order: i }),
          }),
        ),
      );
      if (results.some((r) => !r.ok)) throw new Error();
    } catch {
      await loadStages();
    }
  }

  const filteredRows = useMemo(() => {
    if (!data) return [];
    let base = data.rows.map((row, index) => ({ row, index }));

    const nameCol = columnRoles.indexOf("name");
    const query = search.trim().toLowerCase();
    if (query) {
      // Match on the affiliate's name only — not every column (manager, notes, email, etc.),
      // which produced confusing, unrelated results for a search meant to find a person by name.
      base =
        nameCol !== -1
          ? base.filter(({ row }) => (row[nameCol] ?? "").toLowerCase().includes(query))
          : base.filter(({ row }) => row.some((cell) => cell.toLowerCase().includes(query)));
    }

    const defaultSortCol = nameCol !== -1 ? nameCol : 0;
    const effectiveSort =
      sort ?? (data.headers.length > 0 ? { col: defaultSortCol, dir: "asc" as const } : null);
    if (!effectiveSort) return base;

    const { col, dir } = effectiveSort;
    const factor = dir === "asc" ? 1 : -1;
    const numeric = isNumericType(columnTypes[col]);

    return [...base].sort((a, b) => {
      const av = a.row[col] ?? "";
      const bv = b.row[col] ?? "";
      if (numeric) return (parseAmount(av) - parseAmount(bv)) * factor;
      return av.localeCompare(bv) * factor;
    });
  }, [data, sort, columnTypes, columnRoles, search]);

  useEffect(() => {
    setPage(1);
  }, [data, sort, hiddenColumns, search]);

  const pagedRows = useMemo(
    () => filteredRows.slice((page - 1) * pageSize, page * pageSize),
    [filteredRows, page, pageSize],
  );

  function toggleRowSelected(rowIndex: number) {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowIndex)) next.delete(rowIndex);
      else next.add(rowIndex);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedRows((prev) => {
      const allSelected = filteredRows.every(({ index }) => prev.has(index));
      return allSelected ? new Set() : new Set(filteredRows.map(({ index }) => index));
    });
  }

  function exportCsv() {
    if (!data) return;
    const escapeCell = (value: string) =>
      /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
    const lines = [data.headers, ...filteredRows.map(({ row }) => row)].map((cols) =>
      cols.map(escapeCell).join(","),
    );
    const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `affiliates-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function toggleSort(colIndex: number) {
    setSort((prev) => {
      if (!prev || prev.col !== colIndex) return { col: colIndex, dir: "asc" };
      if (prev.dir === "asc") return { col: colIndex, dir: "desc" };
      return null;
    });
  }

  function startEditing(rowIndex: number, colIndex: number, currentValue: string) {
    setEditingCell({ row: rowIndex, col: colIndex });
    setDraftValue(currentValue);
    setDraftError(null);
  }

  async function saveCell(rowIndex: number, colIndex: number, value: string, previousValue: string) {
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
      const res = await fetch("/api/sheet", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ row: rowIndex, col: colIndex, value }),
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

  async function submitNewAffiliate(values: string[]) {
    if (!data || isAddingRow) return;
    setAddError(null);
    setIsAddingRow(true);

    try {
      const res = await fetch("/api/sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed to add affiliate (${res.status})`);
      }

      setData((prev) => (prev ? { ...prev, rows: [...prev.rows, values] } : prev));
      setIsAddModalOpen(false);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add affiliate");
    } finally {
      setIsAddingRow(false);
    }
  }

  async function submitEditAffiliate(values: string[]) {
    if (!data || editRowIndex === null || isSavingEdit) return;
    const rowIndex = editRowIndex;
    const previousRow = data.rows[rowIndex];
    setEditError(null);
    setIsSavingEdit(true);

    try {
      const changedCols = values
        .map((value, colIndex) => ({ value, colIndex }))
        .filter(({ value, colIndex }) => value !== previousRow[colIndex]);

      for (const { value, colIndex } of changedCols) {
        const res = await fetch("/api/sheet", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ row: rowIndex, col: colIndex, value }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Failed to save changes (${res.status})`);
        }
      }

      setData((prev) => {
        if (!prev) return prev;
        const rows = prev.rows.map((r) => [...r]);
        rows[rowIndex] = values;
        return { ...prev, rows };
      });
      setEditRowIndex(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setIsSavingEdit(false);
    }
  }

  function editSelectedAffiliate() {
    if (selectedRows.size !== 1) return;
    const [rowIndex] = selectedRows;
    setEditRowIndex(rowIndex);
    setEditError(null);
  }

  function requestDeleteSelected() {
    if (selectedRows.size === 0) return;
    setIsConfirmingDelete(true);
  }

  async function confirmDeleteSelected() {
    if (!data || selectedRows.size === 0 || isDeleting) return;

    setDeleteError(null);
    setIsDeleting(true);

    const emailColIndex = columnRoles.indexOf("email");
    const nameColIndexForDelete = columnRoles.indexOf("name");

    try {
      // Delete from the bottom up so earlier row indices stay valid mid-batch.
      const rowIndices = [...selectedRows].sort((a, b) => b - a);
      for (const rowIndex of rowIndices) {
        const res = await fetch("/api/sheet", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            row: rowIndex,
            email: emailColIndex !== -1 ? data.rows[rowIndex][emailColIndex] : undefined,
            name: nameColIndexForDelete !== -1 ? data.rows[rowIndex][nameColIndexForDelete] : undefined,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Failed to delete affiliate (${res.status})`);
        }
      }
      setSelectedRows(new Set());
      setIsConfirmingDelete(false);
      await loadSheet();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete affiliates");
      setIsConfirmingDelete(false);
    } finally {
      setIsDeleting(false);
    }
  }

  const nameColIndex = columnRoles.indexOf("name");

  return (
    <div className="min-h-screen font-sans text-zinc-100">
      <TopNav userEmail={userEmail} />

      <main className="flex w-full flex-col gap-6 px-6 py-8">
        <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#10141f] shadow-2xl shadow-black/60">
          <div className="h-1 w-full bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500" />
          <div className="border-b border-white/10 px-6 py-5">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-100">Affiliates</h1>
            <p className="mt-0.5 text-sm text-zinc-500">Manage your affiliates</p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-6 py-4">
            <div className="relative w-full max-w-xs">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search affiliates..."
                className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                disabled={!data}
                className="flex items-center gap-2 whitespace-nowrap rounded-lg bg-blue-700 px-3.5 py-2 text-sm font-medium text-zinc-100 shadow-lg shadow-blue-950/50 transition-colors hover:bg-blue-600 disabled:opacity-50"
              >
                <PlusIcon className="h-4 w-4" />
                Add affiliate
              </button>
              <button
                type="button"
                onClick={() => void loadSheet()}
                className="flex items-center gap-2 rounded-lg border border-white/10 px-3.5 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/5"
              >
                <RefreshIcon className="h-4 w-4" />
                Refresh
              </button>
              <button
                type="button"
                onClick={exportCsv}
                disabled={!data || filteredRows.length === 0}
                className="flex items-center gap-2 rounded-lg border border-white/10 px-3.5 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <DownloadIcon className="h-4 w-4" />
                Export CSV
              </button>
              <button
                type="button"
                onClick={() => setShowStageManager(true)}
                className="flex items-center gap-2 rounded-lg border border-white/10 px-3.5 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/5"
              >
                <PencilIcon className="h-4 w-4" />
                Manage stages
              </button>
              <button
                type="button"
                onClick={() => void runImport()}
                disabled={isImporting}
                title="Syncs the database (used by Onboarding and CRM) from this sheet — new affiliates become available, existing ones are refreshed. Doesn't delete anyone."
                className="flex items-center gap-2 rounded-lg border border-white/10 px-3.5 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshIcon className="h-4 w-4" />
                {isImporting ? "Importing…" : "Import affiliates"}
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsColumnsMenuOpen((prev) => !prev)}
                  disabled={!data}
                  className="flex items-center gap-2 rounded-lg border border-white/10 px-3.5 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ColumnsIcon className="h-4 w-4" />
                  Columns
                </button>
                {isColumnsMenuOpen && data && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setIsColumnsMenuOpen(false)}
                    />
                    <div className="absolute right-0 top-full z-20 mt-2 max-h-80 w-64 overflow-y-auto rounded-lg border border-white/10 bg-[#10141f] p-1.5 shadow-2xl shadow-black/60">
                      {data.headers.map((header, i) => {
                        const label = header || `Column ${i + 1}`;
                        const key = columnKey(header, i);
                        const visible = !hiddenColumns.has(key);
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => toggleColumnVisibility(key)}
                            className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-zinc-300 transition-colors hover:bg-white/5"
                          >
                            <span
                              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                visible
                                  ? "border-blue-500 bg-blue-600"
                                  : "border-white/20 bg-transparent"
                              }`}
                            >
                              {visible && <CheckIcon className="h-3 w-3 text-white" />}
                            </span>
                            <span className="truncate">{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {selectedRows.size > 0 && (
            <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-blue-500/[0.06] px-6 py-3">
              <span className="text-sm text-zinc-300">
                {selectedRows.size} selected
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={editSelectedAffiliate}
                  disabled={selectedRows.size !== 1}
                  title={selectedRows.size !== 1 ? "Select exactly one row to edit" : undefined}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={requestDeleteSelected}
                  disabled={isDeleting}
                  className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-sm text-red-400 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isDeleting ? "Deleting…" : "Delete"}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRows(new Set())}
                  className="rounded-lg px-3 py-1.5 text-sm text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {loadError && (
            <p className="mx-6 mt-4 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {loadError}
            </p>
          )}

          {deleteError && (
            <p className="mx-6 mt-4 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {deleteError}
            </p>
          )}

          {importError && (
            <p className="mx-6 mt-4 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {importError}
            </p>
          )}

          {!data && !loadError && (
            <div className="p-6">
              <div className="animate-pulse space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-10 rounded-md bg-white/5" />
                ))}
              </div>
            </div>
          )}

          {data && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02]">
                    <th className="w-12 px-4 py-3.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                      #
                    </th>
                    <th className="w-10 px-4 py-3.5">
                      <input
                        type="checkbox"
                        aria-label="Select all rows"
                        checked={
                          filteredRows.length > 0 &&
                          filteredRows.every(({ index }) => selectedRows.has(index))
                        }
                        ref={(el) => {
                          if (el) {
                            el.indeterminate =
                              filteredRows.some(({ index }) => selectedRows.has(index)) &&
                              !filteredRows.every(({ index }) => selectedRows.has(index));
                          }
                        }}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 cursor-pointer appearance-none rounded-full border border-white/20 bg-transparent checked:border-blue-600 checked:bg-blue-600"
                      />
                    </th>
                    {visibleColumnIndices.map((i) => {
                      const header = data.headers[i];
                      return (
                        <th
                          key={i}
                          className={`select-none whitespace-nowrap px-6 py-3.5 text-xs font-medium uppercase tracking-wide text-zinc-500 ${
                            isNumericType(columnTypes[i]) ? "text-right" : "text-left"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleSort(i)}
                            className={`inline-flex items-center gap-1 transition-colors hover:text-zinc-300 ${
                              isNumericType(columnTypes[i]) ? "flex-row-reverse" : ""
                            }`}
                          >
                            {header || `Column ${i + 1}`}
                            <SortIcon
                              className={`h-3.5 w-3.5 ${
                                sort?.col === i ? "text-blue-300/80" : "text-zinc-600"
                              }`}
                            />
                          </button>
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
                      className={`group transition-colors hover:bg-white/[0.04] ${
                        localPosition % 2 === 1 ? "bg-white/[0.012]" : ""
                      }`}
                    >
                      <td className="w-12 px-4 py-3.5 text-zinc-500">{position + 1}</td>
                      <td className="w-10 px-4 py-3.5">
                        <input
                          type="checkbox"
                          aria-label={`Select row ${position + 1}`}
                          checked={selectedRows.has(rowIndex)}
                          onChange={() => toggleRowSelected(rowIndex)}
                          disabled={isDeleting}
                          className="h-4 w-4 cursor-pointer appearance-none rounded-full border border-white/20 bg-transparent checked:border-blue-600 checked:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                      </td>
                      {visibleColumnIndices.map((colIndex) => {
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
                            {isEditing && role === "stage" ? (
                              <select
                                autoFocus
                                value={cell}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setEditingCell(null);
                                  if (value !== cell) void saveCell(rowIndex, colIndex, value, cell);
                                }}
                                onBlur={() => setEditingCell(null)}
                                className="w-full rounded border border-blue-500/70 bg-[#0f141f] px-1.5 py-1 text-sm text-zinc-100 outline-none"
                              >
                                <option value="" className="bg-[#10141f]">No stage</option>
                                {(stages ?? []).map((s) => (
                                  <option key={s.id} value={s.name} className="bg-[#10141f]">
                                    {s.name}
                                  </option>
                                ))}
                              </select>
                            ) : isEditing ? (
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
                                nameSeed={
                                  nameColIndex !== -1 ? row[nameColIndex] || cell : cell
                                }
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
                total={filteredRows.length}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
              />
              {filteredRows.length === 0 && (
                <p className="px-6 py-6 text-sm text-zinc-500">No matching rows.</p>
              )}
            </div>
          )}
        </div>
      </main>

      {isAddModalOpen && data && (
        <AddAffiliateModal
          headers={data.headers}
          columnTypes={columnTypes}
          columnRoles={columnRoles}
          existingRows={data.rows}
          submitting={isAddingRow}
          error={addError}
          onCancel={() => {
            setIsAddModalOpen(false);
            setAddError(null);
          }}
          onSubmit={(values) => void submitNewAffiliate(values)}
        />
      )}

      {editRowIndex !== null && data && (
        <AddAffiliateModal
          headers={data.headers}
          columnTypes={columnTypes}
          columnRoles={columnRoles}
          existingRows={data.rows}
          initialValues={data.rows[editRowIndex]}
          title="Edit affiliate"
          submitLabel="Save changes"
          submittingLabel="Saving…"
          submitting={isSavingEdit}
          error={editError}
          onCancel={() => {
            setEditRowIndex(null);
            setEditError(null);
          }}
          onSubmit={(values) => void submitEditAffiliate(values)}
        />
      )}

      {isConfirmingDelete && (
        <ConfirmDialog
          title="Delete affiliate?"
          message={`Delete ${selectedRows.size} affiliate${
            selectedRows.size > 1 ? "s" : ""
          }? This removes them from the sheet and permanently deletes their tracked data (onboarding, issues, etc.) if any exists. This cannot be undone.`}
          confirmLabel="Delete"
          confirmingLabel="Deleting…"
          confirming={isDeleting}
          onCancel={() => setIsConfirmingDelete(false)}
          onConfirm={() => void confirmDeleteSelected()}
        />
      )}

      {showStageManager && (
        <StageManagerModal
          stages={stages}
          onClose={() => setShowStageManager(false)}
          onAdd={(name) => void addStage(name)}
          onUpdate={(id, patch) => void updateStage(id, patch)}
          onDelete={(id) => void deleteStage(id)}
          onReorder={(orderedIds) => void reorderStages(orderedIds)}
        />
      )}

      {importResult && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setImportResult(null);
          }}
        >
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#10141f] shadow-2xl shadow-black/60">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <h3 className="text-sm font-semibold text-zinc-100">Import complete</h3>
              <button
                type="button"
                onClick={() => setImportResult(null)}
                className="text-zinc-500 transition-colors hover:text-zinc-300"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-col gap-3 p-5 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">Rows read</p>
                  <p className="mt-0.5 text-lg font-semibold text-zinc-100">{importResult.totalRows}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">New affiliates</p>
                  <p className="mt-0.5 text-lg font-semibold text-emerald-300">{importResult.created}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">Updated</p>
                  <p className="mt-0.5 text-lg font-semibold text-blue-300">{importResult.updated}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">Rows with issues</p>
                  <p className="mt-0.5 text-lg font-semibold text-amber-300">{importResult.rowsWithIssues}</p>
                </div>
              </div>
              {importResult.untouched > 0 && (
                <p className="text-xs text-zinc-500">
                  {importResult.untouched} affiliate{importResult.untouched === 1 ? "" : "s"} already in the
                  database weren&apos;t found in this sheet pull — left untouched, not deleted.
                </p>
              )}
              {importResult.duplicateCandidates.total > 0 && (
                <p className="text-xs text-zinc-500">
                  {importResult.duplicateCandidates.total} possible duplicate pair
                  {importResult.duplicateCandidates.total === 1 ? "" : "s"} flagged (by code/email/phone).
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StageManagerModal({
  stages,
  onClose,
  onAdd,
  onUpdate,
  onDelete,
  onReorder,
}: {
  stages: AffiliateStage[] | null;
  onClose: () => void;
  onAdd: (name: string) => void;
  onUpdate: (id: string, patch: Record<string, string | number>) => void;
  onDelete: (id: string) => void;
  onReorder: (orderedIds: string[]) => void;
}) {
  const [newName, setNewName] = useState("");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  function handleDrop(targetId: string) {
    if (!draggedId || draggedId === targetId || !stages) return;
    const ids = stages.map((s) => s.id);
    const fromIndex = ids.indexOf(draggedId);
    const toIndex = ids.indexOf(targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    const [moved] = ids.splice(fromIndex, 1);
    ids.splice(toIndex, 0, moved);
    onReorder(ids);
  }

  function submitNewStage() {
    const name = newName.trim();
    if (name) onAdd(name);
    setNewName("");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-white/10 bg-[#10141f] shadow-2xl shadow-black/60">
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">Manage affiliate stages</h3>
            <p className="mt-0.5 text-xs text-zinc-500">
              Custom pipeline stages for affiliates, stored in a &quot;Stage&quot; column in the sheet. Renaming
              or deleting a stage updates every affiliate currently assigned to it.
            </p>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 text-zinc-500 transition-colors hover:text-zinc-200">
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {stages === null ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : (
            <div className="flex flex-col gap-2">
              {stages.length === 0 && (
                <p className="pb-2 text-sm text-zinc-500">No stages yet — add one below.</p>
              )}
              {stages.map((stage) => {
                const isDragged = draggedId === stage.id;
                const isHovered = draggedId !== null && draggedId !== stage.id && dragOverId === stage.id;
                return (
                  <div
                    key={stage.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      setDraggedId(stage.id);
                    }}
                    onDragEnd={() => {
                      setDraggedId(null);
                      setDragOverId(null);
                    }}
                    onDragOver={(e) => {
                      if (draggedId && draggedId !== stage.id) {
                        e.preventDefault();
                        if (dragOverId !== stage.id) setDragOverId(stage.id);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleDrop(stage.id);
                      setDraggedId(null);
                      setDragOverId(null);
                    }}
                    className={`flex cursor-grab items-center gap-3 rounded-lg border px-3 py-2.5 transition-all duration-150 active:cursor-grabbing ${
                      isDragged
                        ? "scale-95 border-white/10 opacity-40"
                        : isHovered
                          ? "scale-[1.01] border-blue-500/50 ring-2 ring-blue-500/40"
                          : "border-white/10 bg-white/[0.02]"
                    }`}
                  >
                    <input
                      type="text"
                      defaultValue={stage.name}
                      onBlur={(e) => {
                        const name = e.target.value.trim();
                        if (name && name !== stage.name) onUpdate(stage.id, { name });
                        else e.target.value = stage.name;
                      }}
                      className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm text-zinc-100 outline-none focus:border-white/10 focus:bg-white/5"
                    />
                    {confirmingDeleteId === stage.id ? (
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            onDelete(stage.id);
                            setConfirmingDeleteId(null);
                          }}
                          className="rounded-md bg-red-600 px-2 py-1 text-[10px] font-medium text-zinc-100 transition-colors hover:bg-red-500"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingDeleteId(null)}
                          className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-zinc-300 transition-colors hover:bg-white/5"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmingDeleteId(stage.id)}
                        className="shrink-0 text-zinc-500 transition-colors hover:text-red-400"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}

              <div className="mt-2 flex items-center gap-1.5">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitNewStage();
                  }}
                  placeholder="New stage name…"
                  className="w-full rounded-lg border border-dashed border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-blue-500/50"
                />
                <button
                  type="button"
                  onClick={submitNewStage}
                  className="flex shrink-0 items-center gap-1 rounded-lg bg-blue-700 px-3 py-2 text-xs font-medium text-zinc-100 transition-colors hover:bg-blue-600"
                >
                  <PlusIcon className="h-3 w-3" />
                  Add
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
