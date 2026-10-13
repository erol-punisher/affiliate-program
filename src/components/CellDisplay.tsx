"use client";

import { useState } from "react";
import { decisionBadgeColor, detectColumnRole, isActiveStatus, parseAmount, stageBadgeColor } from "@/lib/columnRoles";
import { TagIcon } from "@/components/icons";

const LONG_VALUE_THRESHOLD = 80;

const AVATAR_COLORS = ["bg-blue-600/70", "bg-indigo-600/70", "bg-sky-600/70", "bg-cyan-600/70"];

function avatarColor(seed: string): string {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/** Renders one table cell's resting (non-editing) display, styled by its detected semantic role and type. */
export function CellDisplay({
  value,
  role,
  numeric,
  currency,
  nameSeed,
}: {
  value: string;
  role: ReturnType<typeof detectColumnRole>;
  numeric: boolean;
  currency: boolean;
  nameSeed: string;
}) {
  if (role === "name") {
    const initial = value.trim().charAt(0).toUpperCase() || "?";
    return (
      <div className="flex cursor-text items-center gap-3">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ring-1 ring-white/10 ${avatarColor(
            nameSeed || value,
          )}`}
        >
          {initial}
        </span>
        <span className="whitespace-nowrap font-medium text-zinc-100">
          {value || <span className="font-normal text-zinc-500">&mdash;</span>}
        </span>
      </div>
    );
  }

  if (role === "email") {
    return (
      <span className="whitespace-nowrap text-zinc-400">
        {value || <span className="text-zinc-600">&mdash;</span>}
      </span>
    );
  }

  if (role === "status") {
    const active = isActiveStatus(value);
    return (
      <span
        className={`inline-flex cursor-text items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
          active === true
            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300/90"
            : "border-white/10 bg-white/5 text-zinc-400"
        }`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            active === true ? "bg-emerald-500/80" : active === false ? "bg-zinc-500" : "bg-zinc-600"
          }`}
        />
        {value || <span className="text-zinc-600">&mdash;</span>}
      </span>
    );
  }

  if (role === "stage") {
    if (!value) {
      return <span className="text-zinc-600">No stage</span>;
    }
    return (
      <span
        className={`inline-flex cursor-pointer items-center rounded-full border px-2.5 py-1 text-xs font-medium ${stageBadgeColor(value)}`}
      >
        {value}
      </span>
    );
  }

  if (role === "decision") {
    return (
      <span
        className={`inline-flex cursor-text items-center rounded-full border px-2.5 py-1 text-xs font-medium ${decisionBadgeColor(value)}`}
      >
        {value || "Pending"}
      </span>
    );
  }

  if (role === "sensitive") {
    return value ? <LongTextCell value={value} /> : <span className="text-zinc-600">&mdash;</span>;
  }

  if (role === "code" && value) {
    return (
      <span
        title={value}
        className="inline-flex max-w-[12rem] cursor-text items-center gap-1.5 whitespace-nowrap rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-300/80"
      >
        <TagIcon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{value}</span>
      </span>
    );
  }

  if (currency) {
    const amount = parseAmount(value);
    return (
      <span
        className={`block cursor-text text-right tabular-nums ${
          amount !== 0 ? "text-emerald-300/90" : "text-zinc-500"
        }`}
      >
        {value || <span className="text-zinc-600">&mdash;</span>}
      </span>
    );
  }

  if (!numeric && (value.includes("\n") || value.length > LONG_VALUE_THRESHOLD)) {
    return <LongTextCell value={value} />;
  }

  return (
    <span
      className={`block cursor-text text-zinc-300 ${numeric ? "text-right tabular-nums" : "text-left"}`}
    >
      {value || <span className="text-zinc-600">&mdash;</span>}
    </span>
  );
}

function LongTextCell({ value }: { value: string }) {
  const [expanded, setExpanded] = useState(false);

  if (expanded) {
    return (
      <div className="max-w-md">
        <p className="whitespace-pre-wrap text-zinc-300">{value}</p>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(false);
          }}
          className="mt-2 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:bg-white/10"
        >
          Hide
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setExpanded(true);
      }}
      className="inline-flex items-center rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300/90 hover:bg-blue-500/20"
    >
      View information
    </button>
  );
}
