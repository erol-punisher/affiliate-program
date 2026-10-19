import sanitizeHtml from "sanitize-html";
import { prisma } from "@/lib/db";

// Each sender's email signature (HTML), stored in AppSetting under "signature:<email>".
const key = (email: string) => `signature:${email.toLowerCase()}`;
const API = "https://gmail.googleapis.com/gmail/v1/users/me";

/** Keeps formatting, links and images; drops scripts, event handlers and non-http(s)/mailto/tel links. */
export function cleanSignatureHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags.filter((t) => t !== "iframe"),
      "img",
      "span",
      "font",
      "center",
    ],
    allowedAttributes: {
      "*": ["style", "align", "valign", "width", "height", "color", "dir", "bgcolor", "border", "cellpadding", "cellspacing"],
      a: ["href", "target", "rel", "style"],
      img: ["src", "alt", "width", "height", "style", "border"],
      font: ["face", "size", "color", "style"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["http", "https"] },
  }).trim();
}

/** Plain-text version for the text/plain part. */
export function signatureToText(html: string): string {
  return sanitizeHtml(html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/?(p|div|tr|li|h[1-6])(\s[^>]*)?>/gi, "\n"), { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

export async function getSignature(email: string): Promise<string> {
  const row = await prisma.appSetting.findUnique({ where: { key: key(email) } });
  return row?.value ?? "";
}

export async function saveSignature(email: string, html: string): Promise<string> {
  const clean = cleanSignatureHtml(html);
  if (!clean) {
    await prisma.appSetting.deleteMany({ where: { key: key(email) } });
    return "";
  }
  await prisma.appSetting.upsert({
    where: { key: key(email) },
    create: { key: key(email), value: clean, updatedBy: email },
    update: { value: clean, updatedBy: email },
  });
  return clean;
}

/** The signature set in Gmail for this address (or the primary send-as address). */
export async function fetchGmailSignature(token: string, email: string): Promise<string> {
  const res = await fetch(`${API}/settings/sendAs`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Gmail sendAs list failed (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as { sendAs?: { sendAsEmail: string; isPrimary?: boolean; signature?: string }[] };
  const list = data.sendAs ?? [];
  const match = list.find((s) => s.sendAsEmail.toLowerCase() === email.toLowerCase()) ?? list.find((s) => s.isPrimary);
  return match?.signature ?? "";
}
