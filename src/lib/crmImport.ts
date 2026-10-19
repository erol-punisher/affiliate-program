import { parseCsv } from "@/lib/csv";

export type ImportRow = {
  rowNumber: number; // 1-indexed data row (header is row 1), for error messages
  name: string;
  groupName: string;
  pipelineName: string;
  stageName: string;
  email: string | null;
  notes: string | null;
  username: string | null;
  firstName: string | null;
  country: string | null;
  whatsapp: string | null;
  followerCount: number | null;
  websiteUrl: string | null;
  referralLink: string | null;
  socialsUrl: string | null;
  closingDate: string | null;
  dateOfReachOut: string | null;
  affiliateManager: string | null;
  owner: string | null;
};

export type ImportRowError = { rowNumber: number; message: string };

export type ImportParseResult = { rows: ImportRow[]; errors: ImportRowError[] };

// Header matching is case-insensitive and tolerant of the real export's typo
// ("Affliate Name") since we don't control the source spreadsheet's headers.
const HEADER_ALIASES: Record<string, string[]> = {
  name: ["affliate name", "affiliate name"],
  groupName: ["pipeline"],
  pipelineName: ["sub-pipeline", "sub pipeline"],
  stageName: ["stage"],
  email: ["email of contact"],
  description: ["description"],
  username: ["username"],
  firstName: ["first name"],
  country: ["country"],
  whatsapp: ["wa"],
  followerCount: ["follower count"],
  websiteUrl: ["website url"],
  referralLink: ["referral link"],
  socialsUrl: ["url of socials"],
  closingDate: ["closing date"],
  dateOfReachOut: ["date of reach out"],
  affiliateManager: ["affiliate manager"],
  owner: ["affiliate owner"], // not "affiliate owner.id" — alias matching is exact, so the id column is untouched
  // Not on the Lead model — folded into notes below rather than silently dropped.
  trafficSource: ["traffic source"],
  codRelevance: ["cod relevance"],
  tag: ["tag"],
};

const REQUIRED_FIELDS = ["name", "groupName", "pipelineName", "stageName"] as const;

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase();
}

function buildHeaderIndex(headerRow: string[]): Record<string, number> {
  const normalized = headerRow.map(normalizeHeader);
  const index: Record<string, number> = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const colIndex = normalized.findIndex((h) => aliases.includes(h));
    if (colIndex !== -1) index[field] = colIndex;
  }
  return index;
}

function cell(row: string[], index: Record<string, number>, field: string): string | null {
  const i = index[field];
  if (i === undefined) return null;
  const value = row[i]?.trim() ?? "";
  return value === "" ? null : value;
}

/** Parses the affiliate-outreach CSV export into rows ready for CRM import. Pure — does no I/O. */
export function parseImportCsv(csvText: string): ImportParseResult {
  const table = parseCsv(csvText);
  if (table.length === 0) {
    return { rows: [], errors: [{ rowNumber: 0, message: "CSV is empty" }] };
  }

  const [headerRow, ...dataRows] = table;
  const index = buildHeaderIndex(headerRow);

  const missingColumns = REQUIRED_FIELDS.filter((f) => index[f] === undefined);
  if (missingColumns.length > 0) {
    return {
      rows: [],
      errors: [
        {
          rowNumber: 0,
          message: `CSV is missing required column(s): ${missingColumns.join(", ")}`,
        },
      ],
    };
  }

  const rows: ImportRow[] = [];
  const errors: ImportRowError[] = [];

  dataRows.forEach((raw, i) => {
    const rowNumber = i + 2; // +1 for the header row, +1 for 1-indexing

    const name = cell(raw, index, "name");
    const groupName = cell(raw, index, "groupName");
    const pipelineName = cell(raw, index, "pipelineName");
    const stageName = cell(raw, index, "stageName");

    if (!name || !groupName || !pipelineName || !stageName) {
      const missing = [
        !name && "name",
        !groupName && "pipeline",
        !pipelineName && "sub-pipeline",
        !stageName && "stage",
      ].filter(Boolean);
      errors.push({ rowNumber, message: `Missing ${missing.join(", ")} — row skipped` });
      return;
    }

    const followerCountRaw = cell(raw, index, "followerCount");
    const followerCountParsed = followerCountRaw ? Number(followerCountRaw.replace(/[^\d.-]/g, "")) : null;
    const followerCount = followerCountParsed !== null && Number.isFinite(followerCountParsed) ? followerCountParsed : null;

    const closingDateRaw = cell(raw, index, "closingDate");
    const closingDate = closingDateRaw && !Number.isNaN(new Date(closingDateRaw).getTime()) ? closingDateRaw : null;

    const dateOfReachOutRaw = cell(raw, index, "dateOfReachOut");
    const dateOfReachOut =
      dateOfReachOutRaw && !Number.isNaN(new Date(dateOfReachOutRaw).getTime()) ? dateOfReachOutRaw : null;

    const description = cell(raw, index, "description");
    const trafficSource = cell(raw, index, "trafficSource");
    const codRelevance = cell(raw, index, "codRelevance");
    const tag = cell(raw, index, "tag");
    const notesParts = [
      description,
      trafficSource ? `Traffic Source: ${trafficSource}` : null,
      codRelevance ? `COD Relevance: ${codRelevance}` : null,
      tag ? `Tag: ${tag}` : null,
    ].filter((p): p is string => p !== null);

    rows.push({
      rowNumber,
      name,
      groupName,
      pipelineName,
      stageName,
      email: cell(raw, index, "email"),
      notes: notesParts.length > 0 ? notesParts.join("\n") : null,
      username: cell(raw, index, "username"),
      firstName: cell(raw, index, "firstName"),
      country: cell(raw, index, "country"),
      whatsapp: cell(raw, index, "whatsapp"),
      followerCount,
      websiteUrl: cell(raw, index, "websiteUrl"),
      referralLink: cell(raw, index, "referralLink"),
      socialsUrl: cell(raw, index, "socialsUrl"),
      closingDate,
      dateOfReachOut,
      affiliateManager: cell(raw, index, "affiliateManager"),
      owner: cell(raw, index, "owner"),
    });
  });

  return { rows, errors };
}
