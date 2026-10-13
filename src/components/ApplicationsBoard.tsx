"use client";

import { useMemo, useState, useEffect } from "react";
import { detectColumnType, isNumericType, validateCellValue } from "@/lib/columnTypes";
import { decisionBadgeColor, detectColumnRole, parseAmount } from "@/lib/columnRoles";
import { ArrowLeftIcon, ColumnsIcon, DownloadIcon, RefreshIcon, SearchIcon, SortIcon, CheckIcon, XIcon } from "@/components/icons";
import { TopNav } from "@/components/TopNav";
import { CellDisplay } from "@/components/CellDisplay";

type SheetData = {
  headers: string[];
  rows: string[][];
};

type CellStatus = "idle" | "saving" | "saved" | "error";
type SortState = { col: number; dir: "asc" | "desc" } | null;

type Props = {
  userEmail: string;
};

const HIDDEN_COLUMNS_STORAGE_KEY = "applications.hiddenColumns.v1";

/** The 5 groups every application is sorted into, in display order — "" means no Decision set yet (Pending). */
const DECISION_GROUPS = [
  { key: "", label: "Pending", accent: "bg-zinc-500" },
  { key: "Request more info", label: "Request more info", accent: "bg-amber-500" },
  { key: "Accepted", label: "Accepted", accent: "bg-emerald-500" },
  { key: "Number not on WA", label: "Number not on WA", accent: "bg-slate-500" },
  { key: "Not accepted", label: "Not accepted", accent: "bg-red-500" },
];

function columnKey(header: string, index: number): string {
  return header.trim() ? header : `__col_${index}__`;
}

function loadHiddenColumns(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const saved = window.localStorage.getItem(HIDDEN_COLUMNS_STORAGE_KEY);
    if (saved) return new Set(JSON.parse(saved) as string[]);
  } catch {
    // ignore malformed/unavailable storage
  }
  return new Set();
}

function findColumnIndex(headers: string[], exactHeader: string): number {
  return headers.findIndex((h) => h.trim().toLowerCase() === exactHeader.toLowerCase());
}

export function ApplicationsBoard({ userEmail }: Props) {
  const [data, setData] = useState<SheetData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(loadHiddenColumns);
  const [isColumnsMenuOpen, setIsColumnsMenuOpen] = useState(false);
  const [sort, setSort] = useState<SortState>(null);
  const [search, setSearch] = useState("");
  const [reviewerFilter, setReviewerFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [draftValue, setDraftValue] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [cellStatus, setCellStatus] = useState<Record<string, CellStatus>>({});
  const [cellErrors, setCellErrors] = useState<Record<string, { message: string; value: string }>>({});

  const columnTypes = useMemo(() => {
    if (!data) return [];
    return data.headers.map((_, colIndex) => detectColumnType(data.rows.map((row) => row[colIndex] ?? "")));
  }, [data]);

  const columnRoles = useMemo(() => {
    if (!data) return [];
    return data.headers.map((header) => detectColumnRole(header));
  }, [data]);

  const nameColIndex = useMemo(() => (data ? columnRoles.indexOf("name") : -1), [data, columnRoles]);
  const decisionColIndex = useMemo(() => (data ? columnRoles.indexOf("decision") : -1), [data, columnRoles]);
  const reviewerColIndex = useMemo(() => (data ? findColumnIndex(data.headers, "Reviewer") : -1), [data]);
  const countryColIndex = useMemo(() => (data ? findColumnIndex(data.headers, "Country") : -1), [data]);

  useEffect(() => {
    void loadSheet();
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(HIDDEN_COLUMNS_STORAGE_KEY, JSON.stringify([...hiddenColumns]));
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
    return data.headers.map((_, index) => index).filter((index) => !hiddenColumns.has(columnKey(data.headers[index], index)));
  }, [data, hiddenColumns]);

  async function loadSheet() {
    setLoadError(null);
    try {
      const res = await fetch("/api/applications");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed to load applications (${res.status})`);
      }
      setData(await res.json());
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load applications");
    }
  }

  const reviewers = useMemo(() => {
    if (!data || reviewerColIndex === -1) return [];
    return Array.from(new Set(data.rows.map((r) => r[reviewerColIndex]).filter(Boolean))).sort();
  }, [data, reviewerColIndex]);

  const countries = useMemo(() => {
    if (!data || countryColIndex === -1) return [];
    return Array.from(new Set(data.rows.map((r) => r[countryColIndex]).filter(Boolean))).sort();
  }, [data, countryColIndex]);

  const filteredRows = useMemo(() => {
    if (!data) return [];
    let base = data.rows.map((row, index) => ({ row, index }));

    const query = search.trim().toLowerCase();
    if (query) {
      base =
        nameColIndex !== -1
          ? base.filter(({ row }) => (row[nameColIndex] ?? "").toLowerCase().includes(query))
          : base.filter(({ row }) => row.some((cell) => cell.toLowerCase().includes(query)));
    }

    if (reviewerFilter && reviewerColIndex !== -1) {
      base = base.filter(({ row }) => row[reviewerColIndex] === reviewerFilter);
    }
    if (countryFilter && countryColIndex !== -1) {
      base = base.filter(({ row }) => row[countryColIndex] === countryFilter);
    }

    if (!sort) return base;
    const { col, dir } = sort;
    const factor = dir === "asc" ? 1 : -1;
    const numeric = isNumericType(columnTypes[col]);

    return [...base].sort((a, b) => {
      const av = a.row[col] ?? "";
      const bv = b.row[col] ?? "";
      if (numeric) return (parseAmount(av) - parseAmount(bv)) * factor;
      return av.localeCompare(bv) * factor;
    });
  }, [data, sort, columnTypes, search, nameColIndex, reviewerFilter, reviewerColIndex, countryFilter, countryColIndex]);

  const groupedRows = useMemo(() => {
    const groups = new Map<string, { row: string[]; index: number }[]>();
    for (const g of DECISION_GROUPS) groups.set(g.key, []);

    for (const entry of filteredRows) {
      const raw = decisionColIndex !== -1 ? (entry.row[decisionColIndex] ?? "").trim() : "";
      const matched = DECISION_GROUPS.find((g) => g.key.toLowerCase() === raw.toLowerCase());
      const bucket = groups.get(matched?.key ?? "");
      bucket?.push(entry);
    }
    return groups;
  }, [filteredRows, decisionColIndex]);

  const activeGroupRows = useMemo(
    () => (selectedGroup !== null ? (groupedRows.get(selectedGroup) ?? []) : []),
    [groupedRows, selectedGroup],
  );

  function exportCsv() {
    if (!data || selectedGroup === null) return;
    const escapeCell = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
    const lines = [data.headers, ...activeGroupRows.map(({ row }) => row)].map((cols) => cols.map(escapeCell).join(","));
    const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `applications-${selectedGroup || "pending"}-${new Date().toISOString().slice(0, 10)}.csv`;
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
      const res = await fetch("/api/applications", {
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
      setCellErrors((prev) => ({ ...prev, [key]: { message: err instanceof Error ? err.message : "Save failed", value } }));
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

  const DECISION_OPTIONS = ["Accepted", "Not accepted", "Request more info", "Number not on WA"];

  const selectedGroupMeta = DECISION_GROUPS.find((g) => g.key === selectedGroup) ?? null;

  return (
    <div className="min-h-screen font-sans text-zinc-100">
      <TopNav userEmail={userEmail} />

      <main className="flex w-full flex-col gap-6 px-6 py-8">
        <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#10141f] shadow-2xl shadow-black/60">
          <div className="h-1 w-full bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500" />
          <div className="border-b border-white/10 px-6 py-5">
            {selectedGroup !== null && (
              <button
                type="button"
                onClick={() => setSelectedGroup(null)}
                className="mb-3 flex items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-zinc-200"
              >
                <ArrowLeftIcon className="h-3.5 w-3.5" />
                All categories
              </button>
            )}
            <h1 className="text-xl font-semibold tracking-tight text-zinc-100">
              Affiliate Applications
              {selectedGroupMeta && <span className="text-zinc-500"> / {selectedGroupMeta.label}</span>}
            </h1>
            <p className="mt-0.5 text-sm text-zinc-500">
              Submissions from the Releasit affiliate program application form
            </p>
          </div>

          {selectedGroup !== null && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-6 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full max-w-xs">
                  <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search applicants..."
                    className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                  />
                </div>
                {reviewers.length > 0 && (
                  <select
                    value={reviewerFilter}
                    onChange={(e) => setReviewerFilter(e.target.value)}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 outline-none focus:ring-1 focus:ring-blue-500/50"
                  >
                    <option value="" className="bg-[#10141f]">All reviewers</option>
                    {reviewers.map((r) => (
                      <option key={r} value={r} className="bg-[#10141f]">{r}</option>
                    ))}
                  </select>
                )}
                {countries.length > 0 && (
                  <select
                    value={countryFilter}
                    onChange={(e) => setCountryFilter(e.target.value)}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 outline-none focus:ring-1 focus:ring-blue-500/50"
                  >
                    <option value="" className="bg-[#10141f]">All countries</option>
                    {countries.map((c) => (
                      <option key={c} value={c} className="bg-[#10141f]">{c}</option>
                    ))}
                  </select>
                )}
              </div>
              <div className="flex items-center gap-2">
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
                  disabled={!data || activeGroupRows.length === 0}
                  className="flex items-center gap-2 rounded-lg border border-white/10 px-3.5 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <DownloadIcon className="h-4 w-4" />
                  Export CSV
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
                      <div className="fixed inset-0 z-10" onClick={() => setIsColumnsMenuOpen(false)} />
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
                                  visible ? "border-blue-500 bg-blue-600" : "border-white/20 bg-transparent"
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
          )}

          {loadError && (
            <p className="mx-6 mt-4 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">{loadError}</p>
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
        </div>

        {data && selectedGroup === null && (
          <div className="flex min-h-[75vh] flex-wrap items-center justify-between gap-y-10 py-12">
            {DECISION_GROUPS.map((group) => {
              const count = groupedRows.get(group.key)?.length ?? 0;
              return (
                <button
                  key={group.key}
                  type="button"
                  onClick={() => setSelectedGroup(group.key)}
                  className={`flex aspect-square w-[18vw] min-w-[180px] max-w-[280px] flex-col items-center justify-center gap-3 rounded-full border-2 text-center transition-transform hover:scale-105 ${decisionBadgeColor(group.key)}`}
                >
                  <span className="text-5xl font-semibold">{count}</span>
                  <span className="px-6 text-sm font-medium leading-tight">{group.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {data && selectedGroup !== null && (
          <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#10141f] shadow-xl shadow-black/40">
            {selectedGroupMeta && <div className={`h-1 w-full ${selectedGroupMeta.accent}`} />}
            <div className="overflow-x-auto">
              {activeGroupRows.length === 0 ? (
                <p className="px-6 py-6 text-sm text-zinc-600">No applications in this category.</p>
              ) : (
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.02]">
                      <th className="w-12 px-4 py-3.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">#</th>
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
                              <SortIcon className={`h-3.5 w-3.5 ${sort?.col === i ? "text-blue-300/80" : "text-zinc-600"}`} />
                            </button>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {activeGroupRows.map(({ row, index: rowIndex }, localPosition) => (
                              <tr
                                key={rowIndex}
                                className={`group transition-colors hover:bg-white/[0.04] ${localPosition % 2 === 1 ? "bg-white/[0.012]" : ""}`}
                              >
                                <td className="w-12 px-4 py-3.5 text-zinc-500">{localPosition + 1}</td>
                                {visibleColumnIndices.map((colIndex) => {
                                  const cell = row[colIndex] ?? "";
                                  const isEditing = editingCell?.row === rowIndex && editingCell?.col === colIndex;
                                  const key = `${rowIndex}:${colIndex}`;
                                  const status = cellStatus[key];
                                  const cellError = cellErrors[key];
                                  const numeric = isNumericType(columnTypes[colIndex]);
                                  const role = columnRoles[colIndex];
                                  const isCurrency = columnTypes[colIndex] === "currency";

                                  return (
                                    <td
                                      key={colIndex}
                                      className={`relative min-w-[10rem] px-6 py-3.5 ${status === "error" ? "bg-red-500/10" : ""}`}
                                      onClick={() => !isEditing && startEditing(rowIndex, colIndex, cell)}
                                    >
                                      {isEditing && role === "decision" ? (
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
                                          <option value="" className="bg-[#10141f]">Pending</option>
                                          {DECISION_OPTIONS.map((d) => (
                                            <option key={d} value={d} className="bg-[#10141f]">{d}</option>
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
                                          nameSeed={nameColIndex !== -1 ? row[nameColIndex] || cell : cell}
                                        />
                                      )}
                                      {status === "saving" && (
                                        <span className="absolute right-2 top-2 text-[10px] text-zinc-500">saving…</span>
                                      )}
                                      {status === "error" && cellError && (
                                        <div className="absolute left-0 top-full z-10 flex w-max max-w-xs items-center gap-2 rounded-md border border-red-500/30 bg-red-950 px-2 py-1 text-xs text-red-200 shadow-lg">
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
                            ))}
                          </tbody>
                        </table>
              )}
            </div>
          </div>
        )}
      </main>

      {selectedGroup !== null && (
        <button
          type="button"
          onClick={() => setSelectedGroup(null)}
          title="Back to categories"
          className="fixed bottom-8 right-8 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-white shadow-2xl shadow-black/50 transition-transform hover:scale-110 hover:bg-red-500"
        >
          <XIcon className="h-7 w-7" />
        </button>
      )}
    </div>
  );
}
