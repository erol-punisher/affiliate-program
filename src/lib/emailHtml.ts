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
  /** Button goes before body block N (0 = right under the headline); omitted/too large = after the body. */
  buttonPosition?: number | null;
};

export type RenderOptions = {
  /** Image src for the logo: embedded data URI by default (previews), `cid:releasit-logo` when sending with the inline attachment. */
  logoSrc?: string;
  /** Preview only: makes the button draggable and posts {type:"releasit-button-pos", position} to the parent. */
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

/** Plain-text body → HTML blocks: paragraphs, "- " bullet lists, and "1. " numbered steps with orange badges. */
export function bodyBlocks(body: string, colors: EmailColors = DEFAULT_COLORS): string[] {
  const trimmed = body.replace(/\r\n/g, "\n").trim();
  if (!trimmed) return [];
  const inline = (t: string) => inlineText(t, colors.secondary);
  return trimmed
    .split(/\n\s*\n/)
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
<td valign="middle" style="width:38px;height:38px;border-radius:19px;background:${colors.accent};color:#ffffff;font-family:${FONT};font-size:15px;font-weight:bold;text-align:center;">${num}</td>
<td valign="middle" style="padding-left:16px;font-family:${FONT};font-size:18px;font-weight:bold;line-height:1.35;color:${INK};">${inline(title)}</td>
</tr></table>${rest ? `<p style="${P_STYLE}">${lines.slice(1).map(inline).join("<br>")}</p>` : ""}`;
      }
      return `<p style="${P_STYLE}">${lines.map(inline).join("<br>")}</p>`;
    });
}

export function bodyToHtml(body: string, colors: EmailColors = DEFAULT_COLORS): string {
  return bodyBlocks(body, colors).join("\n");
}

const EDIT_SCRIPT = `<style>
.rd-drop{height:6px;margin:2px 0;border-radius:4px;transition:all .1s}
body.rd-dragging .rd-drop{height:26px;border:2px dashed #b9c3d6;background:#f4f7fc}
body.rd-dragging .rd-drop.rd-over{border-color:#2458D4;background:#e3ebfb}
.rd-btn{cursor:grab;outline:1px dashed transparent;outline-offset:6px;border-radius:8px}
.rd-btn:hover{outline-color:#b9c3d6}
.rd-btn[data-tip]:hover::after{content:attr(data-tip);display:block;text-align:center;font:12px Helvetica,Arial,sans-serif;color:#8a8a8a;margin-top:6px}
</style><script>
(function(){
  var btn=document.querySelector('.rd-btn');if(!btn)return;
  btn.addEventListener('click',function(e){e.preventDefault();});
  btn.addEventListener('dragstart',function(e){e.dataTransfer.setData('text/plain','button');e.dataTransfer.effectAllowed='move';setTimeout(function(){document.body.classList.add('rd-dragging');},0);});
  btn.addEventListener('dragend',function(){document.body.classList.remove('rd-dragging');});
  document.querySelectorAll('.rd-drop').forEach(function(z){
    z.addEventListener('dragover',function(e){e.preventDefault();z.classList.add('rd-over');});
    z.addEventListener('dragleave',function(){z.classList.remove('rd-over');});
    z.addEventListener('drop',function(e){e.preventDefault();document.body.classList.remove('rd-dragging');
      parent.postMessage({type:'releasit-button-pos',position:Number(z.getAttribute('data-pos'))},'*');});
  });
})();
</script>`;

export function renderBrandedEmail(e: BrandedEmail, opts: RenderOptions = {}): string {
  const colors = e.colors ?? DEFAULT_COLORS;
  const logoSrc = opts.logoSrc ?? `data:image/png;base64,${RELEASIT_LOGO_PNG_BASE64}`;
  const blocks = bodyBlocks(e.body, colors);
  const hasButton = !!(e.buttonLabel && e.buttonUrl);
  const pos = e.buttonPosition == null || e.buttonPosition < 0 || e.buttonPosition > blocks.length ? blocks.length : Math.floor(e.buttonPosition);

  const buttonTable = hasButton
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;"><tr>
<td style="border-radius:6px;background:${colors.button};">
<a href="${escapeHtml(e.buttonUrl!)}" style="display:inline-block;padding:16px 36px;font-family:${FONT};font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:6px;">${escapeHtml(e.buttonLabel!)}</a>
</td></tr></table>`
    : "";
  const button = hasButton
    ? `<tr><td align="center" style="padding:12px 0 28px 0;">${
        opts.editable ? `<div class="rd-btn" draggable="true" data-tip="Drag me to move the button">${buttonTable}</div>` : buttonTable
      }</td></tr>`
    : "";
  const drop = (i: number) => (opts.editable && hasButton ? `<tr><td><div class="rd-drop" data-pos="${i}"></div></td></tr>` : "");

  let content = "";
  for (let i = 0; i <= blocks.length; i++) {
    if (i === pos) content += button;
    else content += drop(i);
    if (i < blocks.length) content += `<tr><td>${blocks[i]}</td></tr>\n`;
  }

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

<tr><td style="padding:0 0 14px 0;font-family:${FONT};font-size:13px;font-weight:bold;letter-spacing:4px;text-transform:uppercase;color:${colors.accent};">${escapeHtml(e.greeting)}</td></tr>

<tr><td style="padding:0 0 22px 0;font-family:${FONT};font-size:30px;font-weight:bold;line-height:1.3;color:${INK};">${escapeHtml(e.headline)}${
    e.highlight ? `<br><span style="color:${colors.accent};">${escapeHtml(e.highlight)}</span>` : ""
  }</td></tr>

${content}

<tr><td style="padding:22px 0 0 0;border-top:1px solid #e6e6e6;font-family:${FONT};font-size:14px;line-height:1.6;color:${TEXT};">
${escapeHtml(e.senderName)}<br><span style="color:${MUTED};">Releasit · ${escapeHtml(e.senderEmail)}</span>
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
  const blocks = e.body.replace(/\r\n/g, "\n").trim().replace(/\*\*(.+?)\*\*/g, "$1").split(/\n\s*\n/).filter(Boolean);
  if (e.buttonLabel && e.buttonUrl) {
    const pos = e.buttonPosition == null || e.buttonPosition < 0 || e.buttonPosition > blocks.length ? blocks.length : Math.floor(e.buttonPosition);
    blocks.splice(pos, 0, `${e.buttonLabel}: ${e.buttonUrl}`);
  }
  const parts = [`${e.greeting},`, [e.headline, e.highlight].filter(Boolean).join(" "), ...blocks];
  parts.push(`${e.senderName}\nReleasit · ${e.senderEmail}`, `Not the right fit? Just reply "no thanks" and we won't email you again.`);
  return parts.join("\n\n");
}
