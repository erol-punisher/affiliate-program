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

/** Fresh access token for a connected mailbox. */
export async function gmailAccessToken(ownerEmail: string): Promise<string> {
  const connection = await prisma.gmailConnection.findUnique({ where: { email: ownerEmail } });
  if (!connection) throw new GmailNotConnectedError(ownerEmail);
  const tokens = await refreshAccessToken(decryptSecret(connection.encryptedRefreshToken));
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
  msg: { from: string; fromName?: string; to: string; subject: string; body: string; threadId?: string; inReplyTo?: string },
): Promise<{ id: string; threadId: string; messageId: string }> {
  const headers = [
    `From: ${msg.fromName ? `${encodeHeader(msg.fromName)} <${msg.from}>` : msg.from}`,
    `To: ${msg.to}`,
    `Subject: ${encodeHeader(msg.subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
  ];
  if (msg.inReplyTo) headers.push(`In-Reply-To: ${msg.inReplyTo}`, `References: ${msg.inReplyTo}`);
  const raw = `${headers.join("\r\n")}\r\n\r\n${Buffer.from(msg.body, "utf8").toString("base64")}`;
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

/** Earliest message in the thread sent by someone other than the mailbox owner, if any. */
export async function firstReplyAt(token: string, ownerEmail: string, threadId: string): Promise<Date | null> {
  const thread = await gmailFetch<{ messages?: { internalDate: string; payload: { headers: { name: string; value: string }[] } }[] }>(
    token,
    `/threads/${threadId}?format=metadata&metadataHeaders=From`,
  );
  for (const m of thread.messages ?? []) {
    const from = m.payload.headers.find((h) => h.name.toLowerCase() === "from")?.value ?? "";
    if (!from.toLowerCase().includes(ownerEmail.toLowerCase())) return new Date(Number(m.internalDate));
  }
  return null;
}

/** Gmail label name for a lead at a stage, e.g. "CRM/EuroAffiliates ReachOut/Contacted (2)". */
export function crmLabelName(pipelineName: string, stageName: string): string {
  const clean = (s: string) => s.replace(/\//g, "-").trim();
  return `${CRM_LABEL_ROOT}/${clean(pipelineName)}/${clean(stageName)}`;
}
