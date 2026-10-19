import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";

export type IcebreakerLead = {
  id: string;
  name: string;
  country: string | null;
  followerCount: number | null;
  socialsUrl: string | null;
  websiteUrl: string | null;
  notes: string | null;
  pipeline: string;
};

const OutputSchema = z.object({
  lines: z.array(z.object({ leadId: z.string(), line: z.string() })),
});

const SYSTEM = `You write the opening line of cold outreach emails from Releasit, a Shopify app company (COD form, upsells and bundles for cash-on-delivery stores), to ecommerce creators we'd like as affiliates.

For each lead, write ONE sentence (max 30 words) that opens the email. It must reference something specific and true about that creator taken from the data given (their channel focus, audience size, country/market, or the evidence note). Never invent facts, numbers, video titles or achievements that aren't in the data. If the data is thin, keep the line short and general rather than making something up. Write in English, warm and peer-to-peer, no flattery clichés ("I love your content"), no emojis, no greeting (the template already says "Hi {{first_name}}"), and don't pitch Releasit in this line.`;

/** Suggests one personalised opening line per lead. Returns leadId -> line. */
export async function suggestIcebreakers(leads: IcebreakerLead[]): Promise<Record<string, string>> {
  const client = new Anthropic();
  const data = leads.map((l) => ({
    leadId: l.id,
    name: l.name,
    country: l.country,
    followers: l.followerCount,
    channel: l.socialsUrl,
    website: l.websiteUrl,
    pipeline: l.pipeline,
    note: l.notes?.slice(0, 600) ?? null,
  }));

  const response = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(OutputSchema) },
    system: SYSTEM,
    messages: [{ role: "user", content: `Leads (JSON):\n${JSON.stringify(data, null, 1)}\n\nReturn one line per leadId.` }],
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) return {};
  const known = new Set(leads.map((l) => l.id));
  const lines: Record<string, string> = {};
  for (const { leadId, line } of response.parsed_output.lines) {
    if (known.has(leadId) && line.trim()) lines[leadId] = line.trim();
  }
  return lines;
}
