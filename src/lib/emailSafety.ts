import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { emailDomain, parseEmailSettings, type EmailSettings } from "@/lib/emailRules";

export * from "@/lib/emailRules";

const SETTINGS_KEY = "emailSettings";

export async function getEmailSettings(): Promise<EmailSettings> {
  return parseEmailSettings((await prisma.appSetting.findUnique({ where: { key: SETTINGS_KEY } }))?.value);
}

export async function saveEmailSettings(settings: EmailSettings, by: string) {
  const value = JSON.stringify(parseEmailSettings(JSON.stringify(settings)));
  await prisma.appSetting.upsert({ where: { key: SETTINGS_KEY }, update: { value, updatedBy: by }, create: { key: SETTINGS_KEY, value, updatedBy: by } });
}

/** The suppression entry blocking this address (exact email or its domain), if any. */
export async function findSuppression(email: string) {
  const value = email.trim().toLowerCase();
  return prisma.suppressedContact.findFirst({ where: { OR: [{ value, kind: "email" }, { value: emailDomain(value), kind: "domain" }] } });
}

export async function suppressEmail(
  db: Prisma.TransactionClient | typeof prisma,
  email: string,
  reason: string,
  addedBy: string | null,
) {
  const value = email.trim().toLowerCase();
  if (!value.includes("@")) return;
  await db.suppressedContact.upsert({ where: { value }, update: {}, create: { value, kind: "email", reason, addedBy } });
}
