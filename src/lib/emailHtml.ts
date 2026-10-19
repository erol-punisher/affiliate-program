// Branded HTML email layout (Releasit look: logo, orange/blue rule, orange
// eyebrow greeting, headline + orange highlight, body, optional button).
// Table-based with inline styles so it renders in Gmail, Outlook and Apple Mail.
// Pure functions: used by the server to send and by the composer to preview.

import { RELEASIT_LOGO_PNG_BASE64 } from "@/lib/emailLogo";

export const LOGO_CID = "releasit-logo";

export type EmailColors = { accent: string; secondary: string; button: string };

/** Colour presets for the branded layout (accent = greeting/highlight/steps/main rule). */
export const COLOR_PRESETS: { key: string; label: string; colors: EmailColors }[] = [
  { key: "releasit", label: "Releasit (orange + blue)", colors: { accent: "#EE8B4F", secondary: "#2458D4", button: "#EE8B4F" } },
  { key: "blue", label: "Blue", colors: { accent: "#2458D4", secondary: "#EE8B4F", button: "#2458D4" } },
  { key: "navy", label: "Navy", colors: { accent: "#1E2A4A", secondary: "#EE8B4F", button: "#1E2A4A" } },
  { key: "green", label: "Green", colors: { accent: "#1F9D6B", secondary: "#2458D4", button: "#1F9D6B" } },
  { key: "purple", label: "Purple", colors: { accent: "#7C4DDB", secondary: "#EE8B4F", button: "#7C4DDB" } },
  { key: "red", label: "Red", colors: { accent: "#E0483E", secondary: "#1E2A4A", button: "#E0483E" } },
];
export const DEFAULT_COLORS = COLOR_PRESETS[0].colors;

const HEX = /^#[0-9a-f]{6}$/i;
/** Keeps only valid #rrggbb values (they go straight into style attributes). */
export function sanitizeColors(c: Partial<Record<keyof EmailColors, unknown>> | null | undefined): EmailColors {
  const pick = (v: unknown, d: string) => (typeof v === "string" && HEX.test(v.trim()) ? v.trim() : d);
  return { accent: pick(c?.accent, DEFAULT_COLORS.accent), secondary: pick(c?.secondary, DEFAULT_COLORS.secondary), button: pick(c?.button, DEFAULT_COLORS.button) };
}

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
  colors?: EmailColors;
  /** Sender's saved signature (already sanitized HTML); replaces the default name/email footer. */
  signatureHtml?: string | null;
  /** Legacy single button: goes before body block N; omitted/too large = after the body. Prefer [button: …](…) blocks in the body. */
  buttonPosition?: number | null;
};

export type RenderOptions = {
  /** Image src for the logo: embedded data URI by default (previews), `cid:releasit-logo` when sending with the inline attachment. */
  logoSrc?: string;
  /** Preview only: makes buttons draggable; a drop posts {type:"releasit-move-block", from, to} to the parent. */
  editable?: boolean;
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Escapes, then applies **bold** and turns bare URLs into links. */
function inlineText(text: string, link: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, `<strong style="color:${INK};">$1</strong>`)
    .replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, `<a href="$1" style="color:${link};text-decoration:underline;">$1</a>`);
}

const P_STYLE = `margin:0 0 18px 0;font-family:${FONT};font-size:16px;line-height:1.65;color:${TEXT};`;

/** A paragraph that is exactly `[button: Text](https://link)` becomes a CTA button. */
const BUTTON_BLOCK = /^\[button:\s*([^\]]+?)\s*\]\(\s*(https?:\/\/[^\s)]+)\s*\)$/i;

export const buttonSnippet = (label: string, url: string) => `[button: ${label.trim()}](${url.trim()})`;

/** Splits the message into blocks: a blank line starts a new one. */
export function splitBlocks(body: string): string[] {
  const trimmed = body.replace(/\r\n/g, "\n").trim();
  return trimmed ? trimmed.split(/\n\s*\n/) : [];
}

/** Moves block `from` so it sits before block `to` (to = blocks.length means the end). */
export function moveBlock(body: string, from: number, to: number): string {
  const blocks = splitBlocks(body);
  if (from < 0 || from >= blocks.length || to < 0 || to > blocks.length) return body;
  const [moved] = blocks.splice(from, 1);
  blocks.splice(to > from ? to - 1 : to, 0, moved);
  return blocks.join("\n\n");
}

/** Button blocks as "Text: link" lines, for plain-text emails. */
export function buttonsToPlainText(body: string): string {
  return body.replace(/^\[button:\s*([^\]]+?)\s*\]\(\s*(https?:\/\/[^\s)]+)\s*\)$/gim, "$1: $2");
}

function buttonHtml(label: string, url: string, color: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:12px auto 28px auto;"><tr>
<td style="border-radius:6px;background:${color};">
<a href="${escapeHtml(url)}" style="display:inline-block;padding:16px 36px;font-family:${FONT};font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:6px;">${escapeHtml(label)}</a>
</td></tr></table>`;
}

/** One block → HTML: paragraph, "- " bullet list, "1. " numbered step, or a [button: …](…) CTA. */
function blockHtml(block: string, colors: EmailColors): string {
  const inline = (t: string) => inlineText(t, colors.secondary);
  const btn = block.trim().match(BUTTON_BLOCK);
  if (btn) return buttonHtml(btn[1], btn[2], colors.button);
  const lines = block.split("\n").map((l) => l.trimEnd());
  if (lines.every((l) => /^\s*[-•*]\s+/.test(l))) {
    const items = lines.map((l) => `<li style="margin:0 0 8px 0;">${inline(l.replace(/^\s*[-•*]\s+/, ""))}</li>`).join("");
    return `<ul style="${P_STYLE}padding-left:22px;">${items}</ul>`;
  }
  const step = lines[0].match(/^\s*(\d+)[.)]\s+(.*)$/);
  if (step) {
    const [, num, title] = step;
    const rest = lines.slice(1);
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 6px 0;"><tr>
<td valign="middle" style="width:38px;height:38px;border-radius:19px;background:${colors.accent};color:#ffffff;font-family:${FONT};font-size:15px;font-weight:bold;text-align:center;">${num}</td>
<td valign="middle" style="padding-left:16px;font-family:${FONT};font-size:18px;font-weight:bold;line-height:1.35;color:${INK};">${inline(title)}</td>
</tr></table>${rest.length ? `<p style="${P_STYLE}">${rest.map(inline).join("<br>")}</p>` : ""}`;
  }
  return `<p style="${P_STYLE}">${lines.map(inline).join("<br>")}</p>`;
}

export function bodyBlocks(body: string, colors: EmailColors = DEFAULT_COLORS): string[] {
  return splitBlocks(body).map((b) => blockHtml(b, colors));
}

export function bodyToHtml(body: string, colors: EmailColors = DEFAULT_COLORS): string {
  return bodyBlocks(body, colors).join("\n");
}

const EDIT_SCRIPT = `<style>
.rd-drop{height:6px;margin:2px 0;border-radius:4px;transition:all .1s}
body.rd-dragging .rd-drop{height:26px;border:2px dashed #b9c3d6;background:#f4f7fc}
body.rd-dragging .rd-drop.rd-over{border-color:#2458D4;background:#e3ebfb}
.rd-btn{cursor:grab;outline:1px dashed transparent;outline-offset:4px;border-radius:8px}
.rd-btn:hover{outline-color:#b9c3d6}
.rd-btn:hover::after{content:"Drag to move this button";display:block;text-align:center;font:12px Helvetica,Arial,sans-serif;color:#8a8a8a;margin:-18px 0 10px 0}
</style><script>
(function(){
  var from=null;
  document.querySelectorAll('.rd-btn').forEach(function(btn){
    btn.addEventListener('click',function(e){e.preventDefault();});
    btn.addEventListener('dragstart',function(e){from=Number(btn.getAttribute('data-block'));e.dataTransfer.setData('text/plain','button');e.dataTransfer.effectAllowed='move';setTimeout(function(){document.body.classList.add('rd-dragging');},0);});
    btn.addEventListener('dragend',function(){document.body.classList.remove('rd-dragging');});
  });
  document.querySelectorAll('.rd-drop').forEach(function(z){
    z.addEventListener('dragover',function(e){e.preventDefault();z.classList.add('rd-over');});
    z.addEventListener('dragleave',function(){z.classList.remove('rd-over');});
    z.addEventListener('drop',function(e){e.preventDefault();z.classList.remove('rd-over');document.body.classList.remove('rd-dragging');
      if(from!==null)parent.postMessage({type:'releasit-move-block',from:from,to:Number(z.getAttribute('data-pos'))},'*');from=null;});
  });
})();
</script>`;

export function renderBrandedEmail(e: BrandedEmail, opts: RenderOptions = {}): string {
  const colors = e.colors ?? DEFAULT_COLORS;
  const logoSrc = opts.logoSrc ?? `data:image/png;base64,${RELEASIT_LOGO_PNG_BASE64}`;
  const raw = splitBlocks(e.body);
  // Older single-button fields: added as a button block at buttonPosition (default: end).
  if (e.buttonLabel && e.buttonUrl) {
    const pos = e.buttonPosition == null || e.buttonPosition < 0 || e.buttonPosition > raw.length ? raw.length : Math.floor(e.buttonPosition);
    raw.splice(pos, 0, buttonSnippet(e.buttonLabel, e.buttonUrl));
  }
  const isButton = raw.map((b) => BUTTON_BLOCK.test(b.trim()));
  const draggable = opts.editable && isButton.some(Boolean);
  const drop = (i: number) => (draggable ? `<tr><td><div class="rd-drop" data-pos="${i}"></div></td></tr>` : "");

  let content = "";
  raw.forEach((block, i) => {
    content += drop(i);
    const html = blockHtml(block, colors);
    content += `<tr><td>${draggable && isButton[i] ? `<div class="rd-btn" draggable="true" data-block="${i}">${html}</div>` : html}</td></tr>\n`;
  });
  content += drop(raw.length);

  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(e.headline)}</title></head>
<body style="margin:0;padding:0;background:#ffffff;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:630px;">

<tr><td style="padding:0 0 26px 0;">
<img src="${escapeHtml(logoSrc)}" width="140" height="29" alt="Releasit" style="display:block;border:0;width:140px;height:auto;">
</td></tr>

<tr><td style="padding:0 0 34px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="68%" style="height:5px;line-height:5px;font-size:0;background:${colors.accent};border-radius:3px;">&nbsp;</td>
<td width="6%" style="font-size:0;">&nbsp;</td>
<td width="26%" style="height:5px;line-height:5px;font-size:0;background:${colors.secondary};border-radius:3px;">&nbsp;</td>
</tr></table>
</td></tr>

${e.greeting.trim() ? `<tr><td style="padding:0 0 14px 0;font-family:${FONT};font-size:13px;font-weight:bold;letter-spacing:4px;text-transform:uppercase;color:${colors.accent};">${escapeHtml(e.greeting)}</td></tr>` : ""}

<tr><td style="padding:0 0 22px 0;font-family:${FONT};font-size:30px;font-weight:bold;line-height:1.3;color:${INK};">${escapeHtml(e.headline)}${
    e.highlight ? `<br><span style="color:${colors.accent};">${escapeHtml(e.highlight)}</span>` : ""
  }</td></tr>

${content}

<tr><td style="padding:22px 0 0 0;border-top:1px solid #e6e6e6;font-family:${FONT};font-size:14px;line-height:1.6;color:${TEXT};">
${e.signatureHtml ? e.signatureHtml : `${escapeHtml(e.senderName)}<br><span style="color:${MUTED};">Releasit · ${escapeHtml(e.senderEmail)}</span>`}
</td></tr>
<tr><td style="padding:18px 0 0 0;font-family:${FONT};font-size:12px;line-height:1.5;color:${MUTED};">
Not the right fit? Just reply &ldquo;no thanks&rdquo; and we won&rsquo;t email you again.
</td></tr>

</table>
</td></tr>
</table>
${opts.editable ? EDIT_SCRIPT : ""}
</body></html>`;
}

/** Plain-text version sent alongside the HTML (helps deliverability and text-only clients). */
export function brandedToPlainText(e: BrandedEmail): string {
  const blocks = splitBlocks(e.body.replace(/\*\*(.+?)\*\*/g, "$1"));
  if (e.buttonLabel && e.buttonUrl) {
    const pos = e.buttonPosition == null || e.buttonPosition < 0 || e.buttonPosition > blocks.length ? blocks.length : Math.floor(e.buttonPosition);
    blocks.splice(pos, 0, buttonSnippet(e.buttonLabel, e.buttonUrl));
  }
  const parts = [e.greeting.trim() ? `${e.greeting.trim()},` : "", [e.headline, e.highlight].filter(Boolean).join(" "), ...blocks.map(buttonsToPlainText)];
  parts.push(`${e.senderName}\nReleasit · ${e.senderEmail}`, `Not the right fit? Just reply "no thanks" and we won't email you again.`);
  return parts.filter(Boolean).join("\n\n");
}

/**
 * Plain layout as simple HTML (looks like a normal Gmail message) so a signature
 * with formatting/images can be attached. Buttons become "Text: link" lines.
 */
export function renderPlainEmail(body: string, signatureHtml: string): string {
  const paragraphs = splitBlocks(buttonsToPlainText(body))
    .map((b) => `<div>${b.split("\n").map((l) => inlineText(l, "#1a73e8")).join("<br>")}</div><div><br></div>`)
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"></head><body>
<div dir="ltr" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222222;">${paragraphs}<div>-- </div><div class="gmail_signature">${signatureHtml}</div></div>
</body></html>`;
}
