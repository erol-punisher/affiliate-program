export type TemplateLead = {
  name: string;
  /** Real first name for greetings; when empty, {{first_name}} is empty (use a fallback). */
  firstName?: string | null;
  country: string | null;
  username: string | null;
  pipelineName: string;
  stageName?: string | null;
  followerCount?: number | null;
  websiteUrl?: string | null;
  socialsUrl?: string | null;
  referralLink?: string | null;
  /** Approved AI-suggested opening line for this lead (only set at send time). */
  icebreaker?: string | null;
};

export type TemplateSender = { name: string; email: string };

type Variable = {
  key: string;
  label: string;
  group: "Lead" | "You";
  value: (lead: TemplateLead, sender: TemplateSender) => string;
};

const firstWord = (s: string) => s.split(/[\s|,-]+/).filter(Boolean)[0] ?? s;

export const TEMPLATE_VARIABLES: Variable[] = [
  // Only a real first name (set on the lead); channel/brand names don't count — use {{first_name|there}} for those.
  { key: "first_name", label: "First name", group: "Lead", value: (l) => l.firstName?.trim() ?? "" },
  { key: "icebreaker", label: "AI first line (generate & approve first)", group: "Lead", value: (l) => l.icebreaker ?? "" },
  { key: "name", label: "Full name / channel", group: "Lead", value: (l) => l.name },
  { key: "country", label: "Country", group: "Lead", value: (l) => l.country ?? "" },
  { key: "username", label: "Username", group: "Lead", value: (l) => l.username ?? "" },
  { key: "followers", label: "Followers / subscribers", group: "Lead", value: (l) => (l.followerCount ? l.followerCount.toLocaleString("en-US") : "") },
  { key: "website", label: "Website", group: "Lead", value: (l) => l.websiteUrl ?? "" },
  { key: "socials", label: "Social / channel link", group: "Lead", value: (l) => l.socialsUrl ?? "" },
  { key: "referral_link", label: "Referral link", group: "Lead", value: (l) => l.referralLink ?? "" },
  { key: "pipeline", label: "Pipeline", group: "Lead", value: (l) => l.pipelineName },
  { key: "stage", label: "Current stage", group: "Lead", value: (l) => l.stageName ?? "" },
  { key: "my_name", label: "Your full name", group: "You", value: (_l, s) => s.name },
  { key: "my_first_name", label: "Your first name", group: "You", value: (_l, s) => firstWord(s.name) },
  { key: "my_email", label: "Your email", group: "You", value: (_l, s) => s.email },
];

// {{ key }} or {{ key | fallback }}
const TOKEN = /\{\{\s*([a-z_]+)\s*(?:\|\s*([^}]*?)\s*)?\}\}/gi;

/**
 * Fills {{variables}}. `{{key|fallback}}` uses the fallback when the value is
 * empty; unknown keys are left as written so the preview shows them.
 */
export function renderTemplate(text: string, lead: TemplateLead, sender: TemplateSender): string {
  return text.replace(TOKEN, (match, key: string, fallback: string | undefined) => {
    const variable = TEMPLATE_VARIABLES.find((v) => v.key === key.toLowerCase());
    if (!variable) return match;
    const value = variable.value(lead, sender).trim();
    return value || fallback || "";
  });
}

/** Variables used without a fallback that come out empty for this lead (e.g. ["country"]). */
export function missingVariables(text: string, lead: TemplateLead, sender: TemplateSender): string[] {
  const missing = new Set<string>();
  for (const [, key, fallback] of text.matchAll(TOKEN)) {
    const variable = TEMPLATE_VARIABLES.find((v) => v.key === key.toLowerCase());
    if (variable && fallback === undefined && !variable.value(lead, sender).trim()) missing.add(variable.key);
  }
  return Array.from(missing);
}

/** {{keys}} that aren't known variables (likely typos). */
export function unknownVariables(text: string): string[] {
  const unknown = new Set<string>();
  for (const [, key] of text.matchAll(TOKEN)) {
    if (!TEMPLATE_VARIABLES.some((v) => v.key === key.toLowerCase())) unknown.add(key);
  }
  return Array.from(unknown);
}
