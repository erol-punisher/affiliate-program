"use client";

import { useMemo, useState } from "react";
import type { ColumnType } from "@/lib/columnTypes";
import { validateCellValue } from "@/lib/columnTypes";
import type { ColumnRole } from "@/lib/columnRoles";
import { XIcon } from "@/components/icons";

type Props = {
  headers: string[];
  columnTypes: ColumnType[];
  columnRoles: ColumnRole[];
  existingRows: string[][];
  initialValues?: string[];
  title?: string;
  submitLabel?: string;
  submittingLabel?: string;
  submitting: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (values: string[]) => void;
};

type Section = { title: string; columns: number[] };

function buildSections(headers: string[], types: ColumnType[], roles: ColumnRole[]): Section[] {
  const basic: number[] = [];
  const status: number[] = [];
  const numeric: number[] = [];
  const other: number[] = [];

  headers.forEach((_, i) => {
    if (roles[i] === "name" || roles[i] === "email" || roles[i] === "code") {
      basic.push(i);
    } else if (roles[i] === "status") {
      status.push(i);
    } else if (
      roles[i] === "revenue" ||
      roles[i] === "commission" ||
      roles[i] === "refund" ||
      types[i] === "currency" ||
      types[i] === "percent" ||
      types[i] === "number" ||
      types[i] === "date"
    ) {
      numeric.push(i);
    } else {
      other.push(i);
    }
  });

  return [
    { title: "Basic info", columns: basic },
    { title: "Status", columns: status },
    { title: "Financials & dates", columns: numeric },
    { title: "Other details", columns: other },
  ].filter((section) => section.columns.length > 0);
}

export function AddAffiliateModal({
  headers,
  columnTypes,
  columnRoles,
  existingRows,
  initialValues,
  title = "Add affiliate",
  submitLabel = "Add affiliate",
  submittingLabel = "Adding…",
  submitting,
  error,
  onCancel,
  onSubmit,
}: Props) {
  const [values, setValues] = useState<string[]>(
    () => initialValues ?? headers.map(() => ""),
  );
  const [fieldErrors, setFieldErrors] = useState<(string | null)[]>(() => headers.map(() => null));

  const sections = useMemo(
    () => buildSections(headers, columnTypes, columnRoles),
    [headers, columnTypes, columnRoles],
  );

  const statusOptions = useMemo(() => {
    const options = new Map<string, string>();
    columnRoles.forEach((role, colIndex) => {
      if (role !== "status") return;
      for (const row of existingRows) {
        const v = (row[colIndex] ?? "").trim();
        if (v) options.set(v.toLowerCase(), v);
      }
    });
    return [...options.values()].sort();
  }, [columnRoles, existingRows]);

  function setValue(index: number, value: string) {
    setValues((prev) => prev.map((v, i) => (i === index ? value : v)));
    setFieldErrors((prev) => prev.map((e, i) => (i === index ? null : e)));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errors = headers.map((_, i) => validateCellValue(values[i], columnTypes[i]));
    if (errors.some(Boolean)) {
      setFieldErrors(errors);
      return;
    }
    onSubmit(values);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-affiliate-title"
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-white/10 bg-[#0b0f19] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 id="add-affiliate-title" className="text-lg font-semibold text-zinc-100">
            {title}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="rounded-md p-1.5 text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
            {error && (
              <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
            )}

            {sections.map((section) => (
              <fieldset key={section.title} className="space-y-3">
                <legend className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  {section.title}
                </legend>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {section.columns.map((colIndex) => {
                    const id = `field-${colIndex}`;
                    const label = headers[colIndex] || `Column ${colIndex + 1}`;
                    const role = columnRoles[colIndex];
                    const fieldError = fieldErrors[colIndex];

                    return (
                      <div key={colIndex} className="flex flex-col gap-1">
                        <label htmlFor={id} className="text-sm text-zinc-300">
                          {label}
                        </label>
                        {role === "status" && statusOptions.length > 0 ? (
                          <select
                            id={id}
                            value={values[colIndex]}
                            onChange={(e) => setValue(colIndex, e.target.value)}
                            className={`rounded-md border bg-[#0f141f] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-blue-500/70 ${
                              fieldError ? "border-red-400/70" : "border-white/10"
                            }`}
                          >
                            <option value="">Select…</option>
                            {statusOptions.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            id={id}
                            type={role === "email" ? "email" : "text"}
                            value={values[colIndex]}
                            onChange={(e) => setValue(colIndex, e.target.value)}
                            aria-invalid={fieldError ? true : undefined}
                            aria-describedby={fieldError ? `${id}-error` : undefined}
                            className={`rounded-md border bg-[#0f141f] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-blue-500/70 ${
                              fieldError ? "border-red-400/70" : "border-white/10"
                            }`}
                          />
                        )}
                        {fieldError && (
                          <p id={`${id}-error`} className="text-xs text-red-400/90">
                            {fieldError}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-white/10 px-6 py-4">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-blue-600 disabled:opacity-50"
            >
              {submitting ? submittingLabel : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
