export type TemplateLead = { name: string; country: string | null; username: string | null; pipelineName: string };

export const TEMPLATE_PLACEHOLDERS = ["first_name", "name", "country", "username", "pipeline", "my_name"] as const;

/** Fills {{placeholders}}; unknown ones are left as-is so the preview shows them. */
export function renderTemplate(text: string, lead: TemplateLead, senderName: string): string {
  const firstName = lead.name.split(/[\s|,-]+/).filter(Boolean)[0] ?? lead.name;
  const values: Record<string, string> = {
    name: lead.name,
    first_name: firstName,
    country: lead.country ?? "",
    username: lead.username ?? "",
    pipeline: lead.pipelineName,
    my_name: senderName,
  };
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (match, key: string) => values[key.toLowerCase()] ?? match);
}
