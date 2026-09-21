import { detectColumnRole, isActiveStatus, parseAmount } from "@/lib/columnRoles";
import { TagIcon } from "@/components/icons";

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

  return (
    <span
      className={`block cursor-text text-zinc-300 ${numeric ? "text-right tabular-nums" : "text-left"}`}
    >
      {value || <span className="text-zinc-600">&mdash;</span>}
    </span>
  );
}
