import { describe, expect, it } from "vitest";
import { parseImportCsv } from "../crmImport";

const HEADER_COLUMNS = [
  "Pipeline ID",
  "Affliate Name",
  "Closing Date",
  "Stage",
  "Description",
  "Pipeline",
  "Record Creation Source ID",
  "Representative Name",
  "Referral link",
  "Email of Contact",
  "WA",
  "Country",
  "Sub-Pipeline",
  "Username",
  "Follower Count",
  "URL of Socials",
  "Website URL",
  "Traffic Source",
  "COD Relevance",
  "Affiliate Manager",
];

/** Builds one CSV row from named fields, defaulting every unspecified column to empty — avoids hand-counting commas. */
function row(fields: Partial<Record<(typeof HEADER_COLUMNS)[number], string>>): string {
  return HEADER_COLUMNS.map((col) => {
    const value = fields[col] ?? "";
    return value.includes(",") ? `"${value}"` : value;
  }).join(",");
}

function csvWithRows(rows: string[]): string {
  return [HEADER_COLUMNS.join(","), ...rows].join("\n");
}

describe("parseImportCsv", () => {
  it("maps a well-formed row to an ImportRow", () => {
    const csv = csvWithRows([
      row({
        "Affliate Name": "Iban Picon Pro",
        Stage: "Contacted ",
        Pipeline: "Affiliates",
        "Sub-Pipeline": "EuroAffiliates ReachOut",
        Country: "Spanish LATAM",
        "URL of Socials": "instagram.com/ibanpiconpro",
        "Website URL": "https://youtube.com/@ibanpiconpro",
        "COD Relevance": "High",
        "Affiliate Manager": "Erol",
      }),
    ]);

    const { rows, errors } = parseImportCsv(csv);

    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: "Iban Picon Pro",
      groupName: "Affiliates",
      pipelineName: "EuroAffiliates ReachOut",
      stageName: "Contacted",
      country: "Spanish LATAM",
      socialsUrl: "instagram.com/ibanpiconpro",
      websiteUrl: "https://youtube.com/@ibanpiconpro",
      affiliateManager: "Erol",
      email: null,
    });
  });

  it("tolerates the real export's 'Affliate Name' header typo", () => {
    const csv = csvWithRows([
      row({ "Affliate Name": "Test Person", Stage: "Contacted", Pipeline: "Affiliates", "Sub-Pipeline": "EuroAffiliates ReachOut" }),
    ]);
    const { errors } = parseImportCsv(csv);
    expect(errors).toEqual([]);
  });

  it("folds unmapped Traffic Source / COD Relevance into notes without dropping the Description", () => {
    const csv = csvWithRows([
      row({
        "Affliate Name": "Somebody",
        Stage: "Contacted",
        Pipeline: "Affiliates",
        "Sub-Pipeline": "EuroAffiliates ReachOut",
        Description: "A real description",
        "Traffic Source": "High traffic",
        "COD Relevance": "High",
      }),
    ]);
    const { rows } = parseImportCsv(csv);
    expect(rows[0].notes).toBe("A real description\nTraffic Source: High traffic\nCOD Relevance: High");
  });

  it("omits notes entirely when Description/Traffic Source/COD Relevance are all blank", () => {
    const csv = csvWithRows([
      row({ "Affliate Name": "Somebody", Stage: "Contacted", Pipeline: "Affiliates", "Sub-Pipeline": "EuroAffiliates ReachOut" }),
    ]);
    const { rows } = parseImportCsv(csv);
    expect(rows[0].notes).toBeNull();
  });

  it("parses a numeric follower count and ignores non-numeric junk", () => {
    const csv = csvWithRows([
      row({
        "Affliate Name": "Somebody",
        Stage: "Contacted",
        Pipeline: "Affiliates",
        "Sub-Pipeline": "EuroAffiliates ReachOut",
        "Follower Count": "12345",
      }),
    ]);
    const { rows } = parseImportCsv(csv);
    expect(rows[0].followerCount).toBe(12345);
  });

  it("flags a row missing the affiliate name as an error and skips it", () => {
    const csv = csvWithRows([
      row({ Stage: "Contacted", Pipeline: "Affiliates", "Sub-Pipeline": "EuroAffiliates ReachOut" }),
    ]);
    const { rows, errors } = parseImportCsv(csv);
    expect(rows).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/name/);
  });

  it("flags a row missing the sub-pipeline as an error, without dropping other valid rows", () => {
    const badRow = row({ "Affliate Name": "No Subpipeline", Stage: "Contacted", Pipeline: "Affiliates" });
    const goodRow = row({
      "Affliate Name": "Good Row",
      Stage: "Contacted",
      Pipeline: "Affiliates",
      "Sub-Pipeline": "EuroAffiliates ReachOut",
    });
    const { rows, errors } = parseImportCsv(csvWithRows([badRow, goodRow]));
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Good Row");
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/sub-pipeline/);
  });

  it("handles a quoted field with an embedded comma (real export has this)", () => {
    const csv = csvWithRows([
      row({
        "Affliate Name": "Marcos Balmain | Shopify, IA y Ecommerce",
        Stage: "Contacted",
        Pipeline: "Affiliates",
        "Sub-Pipeline": "EuroAffiliates ReachOut",
      }),
    ]);
    const { rows, errors } = parseImportCsv(csv);
    expect(errors).toEqual([]);
    expect(rows[0].name).toBe("Marcos Balmain | Shopify, IA y Ecommerce");
  });

  it("reports a top-level error when required columns are missing entirely", () => {
    const { rows, errors } = parseImportCsv("Name,Notes\nSomebody,hi");
    expect(rows).toEqual([]);
    expect(errors[0].message).toMatch(/missing required column/i);
  });

  it("returns an error for an empty CSV", () => {
    const { rows, errors } = parseImportCsv("");
    expect(rows).toEqual([]);
    expect(errors[0].message).toMatch(/empty/i);
  });
});
