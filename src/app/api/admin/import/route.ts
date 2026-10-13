import { NextResponse } from "next/server";
import { getSessionWithFreshToken } from "@/lib/auth";
import { getSheetTitleByGid, getSheetValues, getSpreadsheetId } from "@/lib/sheets";
import { normalizeAffiliateRow, type RawAffiliateRow } from "@/lib/rules";
import { findDuplicateCandidates } from "@/lib/dedupe";
import { buildAffiliateMatchIndex, findMatchingAffiliate } from "@/lib/affiliateImportMatch";
import { prisma } from "@/lib/db";

function getSheetGid(): string {
  const gid = process.env.SHEET_GID;
  if (!gid) throw new Error("SHEET_GID environment variable is not set");
  return gid;
}

/**
 * Syncs the database's affiliate records from the configured Google Sheet, running each row
 * through Module A's normalization pipeline. Each row updates its existing Affiliate record in
 * place (matched by email, falling back to exact name) rather than deleting and recreating
 * everything — a full wipe would cascade-delete onboarding checklists and issues for every
 * affiliate currently being tracked, which a routine re-sync must never do. Affiliates that exist
 * in the database but are no longer present in the sheet are left untouched, not deleted.
 */
export async function POST() {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const spreadsheetId = getSpreadsheetId();
  const sheetTitle = await getSheetTitleByGid(session.accessToken, spreadsheetId, getSheetGid());
  const { headers, rows } = await getSheetValues(session.accessToken, spreadsheetId, sheetTitle);

  const existing = await prisma.affiliate.findMany({ select: { id: true, name: true, emails: true } });
  const matchIndex = buildAffiliateMatchIndex(existing);
  const matchedIds = new Set<string>();

  const ruleCounts: Record<string, number> = {};
  const failedRows: { sheetRowIndex: number; name: string; issues: string[] }[] = [];
  const dedupeInputs: { affiliateId: string; code: string | null; primaryEmail: string | null; phoneE164: string | null }[] = [];

  let created = 0;
  let updated = 0;

  for (let i = 0; i < rows.length; i++) {
    const rawRow: RawAffiliateRow = {};
    headers.forEach((header, colIndex) => {
      rawRow[header] = rows[i][colIndex];
    });

    const normalized = normalizeAffiliateRow(rawRow);

    const data = {
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
    };

    const matched = findMatchingAffiliate(matchIndex, { name: normalized.name, emails: normalized.emails });

    let affiliateId: string;
    if (matched) {
      await prisma.affiliate.update({ where: { id: matched.id }, data });
      await prisma.issue.deleteMany({ where: { affiliateId: matched.id } });
      affiliateId = matched.id;
      matchedIds.add(affiliateId);
      updated++;
    } else {
      const affiliate = await prisma.affiliate.create({ data });
      affiliateId = affiliate.id;
      created++;
    }

    if (normalized.issues.length > 0) {
      await prisma.issue.createMany({
        data: normalized.issues.map((issue) => ({
          affiliateId,
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
      affiliateId,
      code: (rawRow["Affiliate Code"] ?? "").trim().toLowerCase() || null,
      primaryEmail: normalized.emails.find((e) => e.isPrimary)?.address ?? null,
      phoneE164: normalized.phoneE164,
    });
  }

  // Duplicate candidates are recomputed fresh every run — cheap, and not linked to onboarding.
  await prisma.duplicateCandidate.deleteMany();
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

  const untouched = existing.length - matchedIds.size;

  return NextResponse.json({
    ok: true,
    totalRows: rows.length,
    created,
    updated,
    untouched, // existing DB affiliates not found in this sheet pull — left as-is, not deleted
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
