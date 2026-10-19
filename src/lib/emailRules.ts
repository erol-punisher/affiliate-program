// Pure email rules shared by the server and the browser (no database access).

export type EmailSettings = { dailyCap: number; followUpDays: number };
export const DEFAULT_EMAIL_SETTINGS: EmailSettings = { dailyCap: 50, followUpDays: 4 };
/** Another teammate emailing the same lead within this window blocks a send. */
export const TEAMMATE_WINDOW_DAYS = 14;

export const REPLY_CATEGORIES = [
  { value: "interested", label: "Interested" },
  { value: "not_interested", label: "Not interested" },
  { value: "out_of_office", label: "Out of office" },
  { value: "wrong_person", label: "Wrong person" },
  { value: "unsubscribe", label: "Unsubscribe" },
] as const;
export type ReplyCategory = (typeof REPLY_CATEGORIES)[number]["value"];
export const isReplyCategory = (v: unknown): v is ReplyCategory => REPLY_CATEGORIES.some((c) => c.value === v);

export function parseEmailSettings(value: string | null | undefined): EmailSettings {
  try {
    const parsed = value ? JSON.parse(value) : {};
    const int = (v: unknown, min: number, max: number, fallback: number) =>
      typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;
    return {
      dailyCap: int(parsed.dailyCap, 1, 500, DEFAULT_EMAIL_SETTINGS.dailyCap),
      followUpDays: int(parsed.followUpDays, 1, 30, DEFAULT_EMAIL_SETTINGS.followUpDays),
    };
  } catch {
    return DEFAULT_EMAIL_SETTINGS;
  }
}

/** Adds n business days (Mon–Fri) to a date. */
export function addBusinessDays(from: Date, n: number): Date {
  const d = new Date(from);
  let left = n;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) left--;
  }
  return d;
}

export const emailDomain = (email: string) => email.trim().toLowerCase().split("@")[1] ?? "";

const UNSUBSCRIBE = /\b(unsubscribe|remove me|take me off|stop (emailing|contacting|sending)|do not (contact|email)|don't (contact|email)|opt.?out)\b/i;
const NOT_INTERESTED = /\b(not interested|no thanks|no thank you|not a fit|not for (us|me)|we('ll| will) pass|no,? thanks)\b/i;

/** Best-effort category from the reply text; null when it isn't clear (treated as interested). */
export function suggestReplyCategory(snippet: string): ReplyCategory | null {
  if (UNSUBSCRIBE.test(snippet)) return "unsubscribe";
  if (NOT_INTERESTED.test(snippet)) return "not_interested";
  return null;
}
