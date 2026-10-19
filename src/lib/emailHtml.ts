// Branded HTML email layout (Releasit look: logo, orange/blue rule, orange
// eyebrow greeting, headline + orange highlight, body, optional button).
// Table-based with inline styles so it renders in Gmail, Outlook and Apple Mail.
// Pure functions: used by the server to send and by the composer to preview.

export const EMAIL_ASSET_BASE = "https://affiliate-dashboard-fawn.vercel.app/email";

const ORANGE = "#EE8B4F";
const BLUE = "#2458D4";
const INK = "#111111";
const TEXT = "#3d3d3d";
const MUTED = "#8a8a8a";
const FONT = "Helvetica, Arial, sans-serif";

export type BrandedEmail = {
  greeting: string; // e.g. "Hi Erol" (shown as the orange eyebrow)
  headline: string;
  highlight?: string; // orange second line under the headline
  body: string; // plain text: blank line = new paragraph, "- " bullets, "1. " steps, **bold**, links
  buttonLabel?: string;
  buttonUrl?: string;
  senderName: string;
  senderEmail: string;
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Escapes, then applies **bold** and turns bare URLs into links. */
function inline(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, `<strong style="color:${INK};">$1</strong>`)
    .replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, `<a href="$1" style="color:${BLUE};text-decoration:underline;">$1</a>`);
}

const P_STYLE = `margin:0 0 18px 0;font-family:${FONT};font-size:16px;line-height:1.65;color:${TEXT};`;

/** Plain-text body → HTML blocks: paragraphs, "- " bullet lists, and "1. " numbered steps with orange badges. */
export function bodyToHtml(body: string): string {
  const blocks = body.replace(/\r\n/g, "\n").trim().split(/\n\s*\n/);
  return blocks
    .map((block) => {
      const lines = block.split("\n").map((l) => l.trimEnd());
      if (lines.every((l) => /^\s*[-•*]\s+/.test(l))) {
        const items = lines.map((l) => `<li style="margin:0 0 8px 0;">${inline(l.replace(/^\s*[-•*]\s+/, ""))}</li>`).join("");
        return `<ul style="${P_STYLE}padding-left:22px;">${items}</ul>`;
      }
      const step = lines[0].match(/^\s*(\d+)[.)]\s+(.*)$/);
      if (step) {
        const [, num, title] = step;
        const rest = lines.slice(1).join("<br>");
        return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 6px 0;"><tr>
<td valign="middle" style="width:38px;height:38px;border-radius:19px;background:${ORANGE};color:#ffffff;font-family:${FONT};font-size:15px;font-weight:bold;text-align:center;">${num}</td>
<td valign="middle" style="padding-left:16px;font-family:${FONT};font-size:18px;font-weight:bold;line-height:1.35;color:${INK};">${inline(title)}</td>
</tr></table>${rest ? `<p style="${P_STYLE}">${lines.slice(1).map(inline).join("<br>")}</p>` : ""}`;
      }
      return `<p style="${P_STYLE}">${lines.map(inline).join("<br>")}</p>`;
    })
    .join("\n");
}

export function renderBrandedEmail(e: BrandedEmail): string {
  const button =
    e.buttonLabel && e.buttonUrl
      ? `<tr><td align="center" style="padding:12px 0 28px 0;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="border-radius:6px;background:${ORANGE};">
<a href="${escapeHtml(e.buttonUrl)}" style="display:inline-block;padding:16px 36px;font-family:${FONT};font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:6px;">${escapeHtml(e.buttonLabel)}</a>
</td></tr></table></td></tr>`
      : "";

  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(e.headline)}</title></head>
<body style="margin:0;padding:0;background:#ffffff;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:630px;">

<tr><td style="padding:0 0 26px 0;">
<img src="${EMAIL_ASSET_BASE}/releasit-logo.png" width="140" height="29" alt="Releasit" style="display:block;border:0;width:140px;height:auto;">
</td></tr>

<tr><td style="padding:0 0 34px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="68%" style="height:5px;line-height:5px;font-size:0;background:${ORANGE};border-radius:3px;">&nbsp;</td>
<td width="6%" style="font-size:0;">&nbsp;</td>
<td width="26%" style="height:5px;line-height:5px;font-size:0;background:${BLUE};border-radius:3px;">&nbsp;</td>
</tr></table>
</td></tr>

<tr><td style="padding:0 0 14px 0;font-family:${FONT};font-size:13px;font-weight:bold;letter-spacing:4px;text-transform:uppercase;color:${ORANGE};">${escapeHtml(e.greeting)}</td></tr>

<tr><td style="padding:0 0 22px 0;font-family:${FONT};font-size:30px;font-weight:bold;line-height:1.3;color:${INK};">${escapeHtml(e.headline)}${
    e.highlight ? `<br><span style="color:${ORANGE};">${escapeHtml(e.highlight)}</span>` : ""
  }</td></tr>

<tr><td>${bodyToHtml(e.body)}</td></tr>

${button}

<tr><td style="padding:22px 0 0 0;border-top:1px solid #e6e6e6;font-family:${FONT};font-size:14px;line-height:1.6;color:${TEXT};">
${escapeHtml(e.senderName)}<br><span style="color:${MUTED};">Releasit · ${escapeHtml(e.senderEmail)}</span>
</td></tr>
<tr><td style="padding:18px 0 0 0;font-family:${FONT};font-size:12px;line-height:1.5;color:${MUTED};">
Not the right fit? Just reply &ldquo;no thanks&rdquo; and we won&rsquo;t email you again.
</td></tr>

</table>
</td></tr>
</table>
</body></html>`;
}

/** Plain-text version sent alongside the HTML (helps deliverability and text-only clients). */
export function brandedToPlainText(e: BrandedEmail): string {
  const parts = [`${e.greeting},`, [e.headline, e.highlight].filter(Boolean).join(" "), e.body.replace(/\*\*(.+?)\*\*/g, "$1")];
  if (e.buttonLabel && e.buttonUrl) parts.push(`${e.buttonLabel}: ${e.buttonUrl}`);
  parts.push(`${e.senderName}\nReleasit · ${e.senderEmail}`, `Not the right fit? Just reply "no thanks" and we won't email you again.`);
  return parts.join("\n\n");
}
