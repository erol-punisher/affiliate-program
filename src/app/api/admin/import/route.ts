import { NextResponse } from "next/server";
import { getSessionWithFreshToken } from "@/lib/auth";
import { getSheetTitleByGid, getSheetValues, getSpreadsheetId } from "@/lib/sheets";
import { normalizeAffiliateRow, type RawAffiliateRow } from "@/lib/rules";
import { findDuplicateCandidates } from "@/lib/dedupe";
import { prisma } from "@/lib/db";

function getSheetGid(): string {
  const gid = process.env.SHEET_GID;
  if (!gid) throw new Error("SHEET_GID environment variable is not set");
  return gid;
}

/**
 * One-shot import: pulls every row from the configured Google Sheet, runs it
 * through Module A's normalization pipeline, and replaces the database's
 * affiliate/issue/duplicate tables with the result. Re-running this is safe
 * and idempotent — it's a full reset-and-reimport, not a merge.
 */
export async function POST() {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const spreadsheetId = getSpreadsheetId();
  const sheetTitle = await getSheetTitleByGid(session.accessToken, spreadsheetId, getSheetGid());
  const { headers, rows } = await getSheetValues(session.accessToken, spreadsheetId, sheetTitle);

  await prisma.auditLog.deleteMany();
  await prisma.issue.deleteMany();
  await prisma.duplicateCandidate.deleteMany();
  await prisma.affiliate.deleteMany();

  const ruleCounts: Record<string, number> = {};
  const failedRows: { sheetRowIndex: number; name: string; issues: string[] }[] = [];
  const dedupeInputs: { affiliateId: string; code: string | null; primaryEmail: string | null; phoneE164: string | null }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const rawRow: RawAffiliateRow = {};
    headers.forEach((header, colIndex) => {
      rawRow[header] = rows[i][colIndex];
    });

    const normalized = normalizeAffiliateRow(rawRow);

    const affiliate = await prisma.affiliate.create({
      data: {
        sheetRowIndex: i,
        raw: JSON.stringify(rawRow),
        name: normalized.name,
        commissionRate: normalized.commissionRate,
        commissionRaw: normalized.commissionRaw,
        tier: normalized.tier,
        tierRaw: normalized.tierRaw,
        tierConfidence: normalized.tierConfidence,
        status: normalized.status,
        statusRaw: normalized.statusRaw,
        statusFlagged: normalized.statusFlagged,
        language: normalized.language,
        languageRaw: normalized.languageRaw,
        countryCode: normalized.countryCode,
        countryCodeInferred: normalized.countryCodeInferred,
        phoneE164: normalized.phoneE164,
        phoneRaw: normalized.phoneRaw,
        emails: JSON.stringify(normalized.emails),
        importArtifacts: JSON.stringify(normalized.importArtifacts),
        healthScore: normalized.healthScore,
      },
    });

    if (normalized.issues.length > 0) {
      await prisma.issue.createMany({
        data: normalized.issues.map((issue) => ({
          affiliateId: affiliate.id,
          ruleId: issue.ruleId,
          severity: issue.severity,
          field: issue.field,
          message: issue.message,
        })),
      });

      for (const issue of normalized.issues) {
        ruleCounts[issue.ruleId] = (ruleCounts[issue.ruleId] ?? 0) + 1;
      }
      failedRows.push({
        sheetRowIndex: i,
        name: normalized.name || "(no name)",
        issues: normalized.issues.map((issue) => `${issue.ruleId}: ${issue.message}`),
      });
    }

    dedupeInputs.push({
      affiliateId: affiliate.id,
      code: (rawRow["Affiliate Code"] ?? "").trim().toLowerCase() || null,
      primaryEmail: normalized.emails.find((e) => e.isPrimary)?.address ?? null,
      phoneE164: normalized.phoneE164,
    });
  }

  const duplicates = findDuplicateCandidates(dedupeInputs);
  if (duplicates.length > 0) {
    await prisma.duplicateCandidate.createMany({
      data: duplicates.map((d) => ({
        affiliateAId: d.affiliateAId,
        affiliateBId: d.affiliateBId,
        matchType: d.matchType,
        matchConfidence: d.matchConfidence,
      })),
    });
  }

  return NextResponse.json({
    ok: true,
    totalRows: rows.length,
    rowsWithIssues: failedRows.length,
    ruleCounts,
    duplicateCandidates: {
      total: duplicates.length,
      byType: {
        code: duplicates.filter((d) => d.matchType === "code").length,
        email: duplicates.filter((d) => d.matchType === "email").length,
        phone: duplicates.filter((d) => d.matchType === "phone").length,
      },
    },
    failedRows,
  });
}
