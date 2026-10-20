// How a lead was reached out to (safe to import in the browser).

export const OUTREACH_CHANNELS = ["email", "instagram", "linkedin", "whatsapp", "other"] as const;
export type OutreachChannel = (typeof OUTREACH_CHANNELS)[number];

export const CHANNEL_LABELS: Record<OutreachChannel, string> = {
  email: "Email",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  whatsapp: "WhatsApp",
  other: "Other",
};

/** Known channels from untrusted input, de-duplicated, in the canonical order. */
export function parseChannels(value: unknown): OutreachChannel[] {
  if (!Array.isArray(value)) return [];
  const wanted = new Set(value.filter((v): v is string => typeof v === "string").map((v) => v.toLowerCase()));
  return OUTREACH_CHANNELS.filter((c) => wanted.has(c));
}

/** Union of several channel lists, in the canonical order. */
export function mergeChannels(...lists: readonly string[][]): OutreachChannel[] {
  return parseChannels(lists.flat());
}

/** The platform a socials URL points at, for the open-profile shortcut. */
export function socialPlatform(url: string | null | undefined): "instagram" | "linkedin" | "whatsapp" | "other" | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  const host = (() => {
    try {
      return new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`).hostname.toLowerCase();
    } catch {
      return "";
    }
  })();
  if (!host) return null;
  if (host === "instagram.com" || host.endsWith(".instagram.com") || host === "instagr.am") return "instagram";
  if (host === "linkedin.com" || host.endsWith(".linkedin.com") || host === "lnkd.in") return "linkedin";
  if (host === "wa.me" || host.endsWith(".whatsapp.com")) return "whatsapp";
  return "other";
}

/** A wa.me chat link for a WhatsApp number (any formatting, international), or null if it isn't one. */
export function whatsappHref(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (/^https?:\/\/(wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com)\//i.test(trimmed)) return trimmed;
  const digits = trimmed.replace(/^00/, "").replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15 ? `https://wa.me/${digits}` : null;
}

/** An absolute URL for a socials field that may lack the scheme, or null if it isn't a URL. */
export function profileHref(url: string | null | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(href).hostname.includes(".") ? href : null;
  } catch {
    return null;
  }
}
