import { prisma } from "@/lib/db";
import { refreshAccessToken } from "@/lib/googleOAuth";
import { decryptSecret } from "@/lib/secretBox";

export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.modify";
export const CRM_LABEL_ROOT = "CRM";
const API = "https://gmail.googleapis.com/gmail/v1/users/me";

export class GmailNotConnectedError extends Error {
  constructor(email: string) {
    super(`Gmail isn't connected for ${email}`);
  }
}

// Access tokens last ~1h; reuse them while this server instance is warm instead of refreshing per email.
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

/** Fresh access token for a connected mailbox. */
export async function gmailAccessToken(ownerEmail: string): Promise<string> {
  const connection = await prisma.gmailConnection.findUnique({ where: { email: ownerEmail } });
  if (!connection) {
    tokenCache.delete(ownerEmail);
    throw new GmailNotConnectedError(ownerEmail);
  }
  const cached = tokenCache.get(ownerEmail);
  if (cached && cached.expiresAt > Date.now()) return cached.token;
  const tokens = await refreshAccessToken(decryptSecret(connection.encryptedRefreshToken));
  tokenCache.set(ownerEmail, { token: tokens.access_token, expiresAt: Date.now() + (tokens.expires_in - 120) * 1000 });
  return tokens.access_token;
}

async function gmailFetch<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`Gmail ${init?.method ?? "GET"} ${path} failed (${res.status}): ${await res.text()}`);
  return res.status === 204 ? (undefined as T) : res.json();
}

function encodeHeader(value: string): string {
  // RFC 2047 so non-ASCII subjects/names (é, ć, ğ…) survive.
  return /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

/** Sends a plain-text email; pass threadId + inReplyTo to send it as a reply in an existing thread. */
export async function sendGmail(
  token: string,
  msg: { from: string; fromName?: string; to: string; subject: string; body: string; html?: string;
    /** Images referenced from the HTML as cid:<cid>, sent as inline attachments. */
    inlineImages?: { cid: string; contentType: string; base64: string; filename: string }[];
    threadId?: string;
    inReplyTo?: string;
  },
): Promise<{ id: string; threadId: string; messageId: string }> {
  // base64 wrapped at 76 chars, as MIME expects
  const b64 = (text: string) => Buffer.from(text, "utf8").toString("base64").replace(/.{76}/g, "$&\r\n");
  const headers = [
    `From: ${msg.fromName ? `${encodeHeader(msg.fromName)} <${msg.from}>` : msg.from}`,
    `To: ${msg.to}`,
    `Subject: ${encodeHeader(msg.subject)}`,
    "MIME-Version: 1.0",
  ];
  if (msg.inReplyTo) headers.push(`In-Reply-To: ${msg.inReplyTo}`, `References: ${msg.inReplyTo}`);
  let raw: string;
  if (msg.html) {
    // Plain-text + HTML alternatives: clients show the HTML, text-only clients and filters get the text.
    const boundary = `alt_${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    const part = (type: string, content: string) =>
      `--${boundary}\r\nContent-Type: ${type}; charset="UTF-8"\r\nContent-Transfer-Encoding: base64\r\n\r\n${b64(content)}\r\n`;
    let htmlPart = part("text/html", msg.html);
    if (msg.inlineImages?.length) {
      // text/html + its images wrapped in multipart/related so cid: references resolve.
      const rel = `rel_${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
      const images = msg.inlineImages
        .map(
          (img) =>
            `--${rel}\r\nContent-Type: ${img.contentType}; name="${img.filename}"\r\nContent-Transfer-Encoding: base64\r\nContent-ID: <${img.cid}>\r\nContent-Disposition: inline; filename="${img.filename}"\r\n\r\n${img.base64.replace(/.{76}/g, "$&\r\n")}\r\n`,
        )
        .join("");
      htmlPart =
        `--${boundary}\r\nContent-Type: multipart/related; boundary="${rel}"\r\n\r\n` +
        `--${rel}\r\nContent-Type: text/html; charset="UTF-8"\r\nContent-Transfer-Encoding: base64\r\n\r\n${b64(msg.html)}\r\n` +
        `${images}--${rel}--\r\n`;
    }
    raw = `${headers.join("\r\n")}\r\n\r\n${part("text/plain", msg.body)}${htmlPart}--${boundary}--`;
  } else {
    headers.push('Content-Type: text/plain; charset="UTF-8"', "Content-Transfer-Encoding: base64");
    raw = `${headers.join("\r\n")}\r\n\r\n${b64(msg.body)}`;
  }
  const sent = await gmailFetch<{ id: string; threadId: string }>(token, "/messages/send", {
    method: "POST",
    body: JSON.stringify({ raw: Buffer.from(raw, "utf8").toString("base64url"), threadId: msg.threadId }),
  });
  const meta = await gmailFetch<{ payload: { headers: { name: string; value: string }[] } }>(
    token,
    `/messages/${sent.id}?format=metadata&metadataHeaders=Message-ID`,
  );
  const messageId = meta.payload.headers.find((h) => h.name.toLowerCase() === "message-id")?.value ?? "";
  return { ...sent, messageId };
}

/** Gmail label id for `name` in this mailbox, creating it (and its parents) if needed. */
export async function ensureGmailLabel(token: string, ownerEmail: string, name: string): Promise<string> {
  const cached = await prisma.gmailLabel.findUnique({ where: { ownerEmail_name: { ownerEmail, name } } });
  if (cached) return cached.gmailLabelId;

  const { labels = [] } = await gmailFetch<{ labels?: { id: string; name: string }[] }>(token, "/labels");
  const parts = name.split("/");
  let id = "";
  for (let i = 1; i <= parts.length; i++) {
    const partial = parts.slice(0, i).join("/");
    const existing = labels.find((l) => l.name === partial);
    id =
      existing?.id ??
      (
        await gmailFetch<{ id: string }>(token, "/labels", {
          method: "POST",
          body: JSON.stringify({ name: partial, labelListVisibility: "labelShow", messageListVisibility: "show" }),
        })
      ).id;
  }
  await prisma.gmailLabel.upsert({
    where: { ownerEmail_name: { ownerEmail, name } },
    update: { gmailLabelId: id },
    create: { ownerEmail, name, gmailLabelId: id },
  });
  return id;
}

/** Puts exactly one CRM stage label on a thread, removing any other CRM labels it had. */
export async function setThreadCrmLabel(token: string, ownerEmail: string, threadId: string, labelName: string) {
  const addId = await ensureGmailLabel(token, ownerEmail, labelName);
  const others = await prisma.gmailLabel.findMany({
    where: { ownerEmail, name: { startsWith: `${CRM_LABEL_ROOT}/` }, NOT: { name: labelName } },
    select: { gmailLabelId: true, name: true },
  });
  // Only strip leaf (pipeline/stage) labels, never the parent folders.
  const removeIds = others.filter((l) => l.name.split("/").length >= 3).map((l) => l.gmailLabelId);
  await gmailFetch(token, `/threads/${threadId}/modify`, {
    method: "POST",
    body: JSON.stringify({ addLabelIds: [addId], removeLabelIds: removeIds }),
  });
}

export type ThreadActivity = {
  /** First real reply from the other side (not an auto-reply or bounce). */
  reply: { at: Date; snippet: string } | null;
  /** First automatic reply (out of office / vacation responder) seen, if no real reply yet. */
  autoReply: { at: Date; snippet: string } | null;
  /** Delivery failure notice from a mail server. */
  bounce: { at: Date } | null;
};

const AUTO_REPLY_SUBJECT = /out of (the )?office|automatic reply|auto.?reply|autoreply|abwesend|abwesenheit|fuera de la oficina|respuesta autom|absence|ausente|réponse automatique|risposta automatica|vacation|on leave/i;

/** Reads a thread's messages (headers + snippet) and classifies what came back from the other side. */
export async function analyzeThread(
  token: string,
  ownerEmail: string,
  threadId: string,
  ignoreBefore?: Date | null,
): Promise<ThreadActivity> {
  const thread = await gmailFetch<{
    messages?: { internalDate: string; snippet?: string; payload: { headers: { name: string; value: string }[] } }[];
  }>(token, `/threads/${threadId}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Auto-Submitted&metadataHeaders=X-Autoreply&metadataHeaders=X-Autorespond&metadataHeaders=Precedence`);

  const result: ThreadActivity = { reply: null, autoReply: null, bounce: null };
  for (const m of thread.messages ?? []) {
    const at = new Date(Number(m.internalDate));
    if (ignoreBefore && at <= ignoreBefore) continue;
    const header = (name: string) => m.payload.headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
    const from = header("From").toLowerCase();
    if (from.includes(ownerEmail.toLowerCase())) continue;
    const snippet = (m.snippet ?? "").slice(0, 300);

    if (/mailer-daemon|postmaster|mail delivery (subsystem|system)/i.test(from)) {
      result.bounce ??= { at };
      continue;
    }
    const autoSubmitted = header("Auto-Submitted");
    const isAuto =
      (autoSubmitted !== "" && autoSubmitted.toLowerCase() !== "no") ||
      header("X-Autoreply") !== "" ||
      header("X-Autorespond") !== "" ||
      /auto_reply|bulk/i.test(header("Precedence")) ||
      AUTO_REPLY_SUBJECT.test(header("Subject"));
    if (isAuto) {
      result.autoReply ??= { at, snippet };
      continue;
    }
    result.reply = { at, snippet };
    break;
  }
  return result;
}

/** Gmail label name for a lead at a stage, e.g. "CRM/EuroAffiliates ReachOut/Contacted (2)". */
export function crmLabelName(pipelineName: string, stageName: string): string {
  const clean = (s: string) => s.replace(/\//g, "-").trim();
  return `${CRM_LABEL_ROOT}/${clean(pipelineName)}/${clean(stageName)}`;
}
