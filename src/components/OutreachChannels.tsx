"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CHANNEL_LABELS, OUTREACH_CHANNELS, parseChannels, type OutreachChannel } from "@/lib/outreachChannels";

type IconProps = { className?: string };

export function InstagramIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="3.8" />
      <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function LinkedInIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M5.2 8.8h3v10h-3zM6.7 4.2a1.75 1.75 0 1 1 0 3.5 1.75 1.75 0 0 1 0-3.5zM10.3 8.8h2.9v1.4h.04c.4-.76 1.38-1.56 2.85-1.56 3.04 0 3.6 2 3.6 4.6v5.56h-3v-4.93c0-1.18-.02-2.7-1.64-2.7-1.65 0-1.9 1.28-1.9 2.6v5.03h-2.85z" />
    </svg>
  );
}

export function EnvelopeIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </svg>
  );
}

export function ChatIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 11.5a7.5 7.5 0 0 1-11 6.6L4 19.5l1.4-4.6A7.5 7.5 0 1 1 20 11.5z" />
    </svg>
  );
}

function DotsIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="6" cy="12" r="1.9" />
      <circle cx="12" cy="12" r="1.9" />
      <circle cx="18" cy="12" r="1.9" />
    </svg>
  );
}

export function ChannelIcon({ channel, className }: { channel: OutreachChannel; className?: string }) {
  if (channel === "email") return <EnvelopeIcon className={className} />;
  if (channel === "instagram") return <InstagramIcon className={className} />;
  if (channel === "linkedin") return <LinkedInIcon className={className} />;
  return <DotsIcon className={className} />;
}

/** Badge colours per channel: [unselected-ish badge, selected chip, solid bar segment]. */
export const CHANNEL_STYLE: Record<OutreachChannel, { badge: string; chip: string; bar: string }> = {
  email: {
    badge: "bg-sky-500/15 text-sky-300 ring-sky-400/30",
    chip: "border-sky-400/60 bg-sky-500/20 text-sky-100",
    bar: "bg-sky-400",
  },
  instagram: {
    badge: "bg-pink-500/15 text-pink-300 ring-pink-400/30",
    chip: "border-pink-400/60 bg-gradient-to-r from-fuchsia-500/25 to-orange-400/25 text-pink-100",
    bar: "bg-gradient-to-r from-fuchsia-500 to-orange-400",
  },
  linkedin: {
    badge: "bg-[#0A66C2]/25 text-[#70b5f9] ring-[#0A66C2]/50",
    chip: "border-[#0A66C2] bg-[#0A66C2]/30 text-blue-100",
    bar: "bg-[#0A66C2]",
  },
  other: {
    badge: "bg-white/10 text-zinc-300 ring-white/15",
    chip: "border-zinc-400/50 bg-white/15 text-zinc-100",
    bar: "bg-zinc-400",
  },
};

/** The channels a lead has been reached on, as small round badges. */
export function ChannelBadges({ channels, size = "sm" }: { channels: string[]; size?: "sm" | "md" }) {
  const list = parseChannels(channels);
  if (list.length === 0) return null;
  const box = size === "md" ? "h-6 w-6" : "h-5 w-5";
  const icon = size === "md" ? "h-3.5 w-3.5" : "h-3 w-3";
  return (
    <div className="flex items-center gap-1" title={`Reached via ${list.map((c) => CHANNEL_LABELS[c]).join(", ")}`}>
      {list.map((c) => (
        <span key={c} className={`inline-flex ${box} items-center justify-center rounded-full ring-1 ${CHANNEL_STYLE[c].badge}`}>
          <ChannelIcon channel={c} className={icon} />
        </span>
      ))}
    </div>
  );
}

const LAST_CHANNELS_KEY = "crm.lastOutreachChannels";

export function lastUsedChannels(): OutreachChannel[] {
  try {
    return parseChannels(JSON.parse(window.localStorage.getItem(LAST_CHANNELS_KEY) ?? "[]"));
  } catch {
    return [];
  }
}

export function rememberChannels(channels: OutreachChannel[]) {
  try {
    if (channels.length > 0) window.localStorage.setItem(LAST_CHANNELS_KEY, JSON.stringify(channels));
  } catch {
    // Storage blocked: the picker just won't preselect next time.
  }
}

/**
 * A floating bar asking which channel(s) were used. Several can be picked; 1–4 toggle them,
 * Enter confirms, Esc skips.
 */
export function ChannelPicker({
  title,
  hint,
  initial,
  confirmLabel,
  requireOne = false,
  busy = false,
  error,
  onConfirm,
  onSkip,
}: {
  title: ReactNode;
  hint?: ReactNode;
  initial: OutreachChannel[];
  confirmLabel: string;
  requireOne?: boolean;
  busy?: boolean;
  error?: string | null;
  onConfirm: (channels: OutreachChannel[]) => void;
  onSkip: () => void;
}) {
  const [picked, setPicked] = useState<Set<OutreachChannel>>(() => new Set(initial));
  const ordered = OUTREACH_CHANNELS.filter((c) => picked.has(c));
  const canConfirm = !busy && (!requireOne || ordered.length > 0);

  const toggle = (c: OutreachChannel) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });

  // Latest values for the key handler without re-binding it on every toggle.
  const latest = useRef({ ordered, canConfirm, onConfirm, onSkip });
  useEffect(() => {
    latest.current = { ordered, canConfirm, onConfirm, onSkip };
  });
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;
      const { ordered, canConfirm, onConfirm, onSkip } = latest.current;
      if (e.key === "Escape") {
        e.preventDefault();
        onSkip();
      } else if (e.key === "Enter" && canConfirm) {
        e.preventDefault();
        onConfirm(ordered);
      } else if (/^[1-9]$/.test(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const c = OUTREACH_CHANNELS[Number(e.key) - 1];
        if (c) toggle(c);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="fixed bottom-6 left-1/2 z-[60] w-[min(44rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-white/10 bg-[#10141f]/95 px-4 py-3.5 shadow-2xl shadow-black/50 backdrop-blur">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <p className="min-w-0 truncate text-sm font-medium text-zinc-100">{title}</p>
        {hint && <p className="text-xs text-zinc-500">{hint}</p>}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {OUTREACH_CHANNELS.map((c, i) => {
          const on = picked.has(c);
          return (
            <button
              key={c}
              type="button"
              onClick={() => toggle(c)}
              aria-pressed={on}
              title={`${CHANNEL_LABELS[c]} (${i + 1})`}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-all duration-150 ${
                on ? `${CHANNEL_STYLE[c].chip} shadow-sm` : "border-white/10 text-zinc-400 hover:border-white/25 hover:text-zinc-200"
              }`}
            >
              <ChannelIcon channel={c} className="h-3.5 w-3.5" />
              {CHANNEL_LABELS[c]}
              {on && <span className="text-[10px] opacity-80">✓</span>}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={onSkip} className="rounded-md px-2.5 py-1.5 text-xs text-zinc-500 hover:text-zinc-300">
            Skip <span className="text-zinc-600">esc</span>
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => onConfirm(ordered)}
            className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-40"
          >
            {busy ? "Saving…" : confirmLabel}
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
