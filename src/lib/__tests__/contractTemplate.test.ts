import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { generateContractDocx, validateContractFields, type ContractFields } from "../contractTemplate";

const VALID_FIELDS: ContractFields = {
  talentName: "Péter Kallós",
  talentAddress: "Faknó utca 20/b, Budapest, 1115, Hungary",
  talentRoleLine: "is an e-commerce mentor.",
  talentEmail: "kpeterb82@gmail.com",
  effectiveDate: "15/06/2026",
  referralSlug: "nocodeai",
};

describe("validateContractFields", () => {
  it("accepts a fully-populated body", () => {
    const result = validateContractFields(VALID_FIELDS);
    expect("fields" in result).toBe(true);
  });

  it("trims whitespace from every field", () => {
    const padded = Object.fromEntries(Object.entries(VALID_FIELDS).map(([k, v]) => [k, `  ${v}  `]));
    const result = validateContractFields(padded);
    expect("fields" in result && result.fields).toEqual(VALID_FIELDS);
  });

  it("rejects a missing field", () => {
    const { talentName: _talentName, ...rest } = VALID_FIELDS;
    const result = validateContractFields(rest);
    expect("error" in result).toBe(true);
  });

  it("rejects a blank field", () => {
    const result = validateContractFields({ ...VALID_FIELDS, talentEmail: "   " });
    expect("error" in result).toBe(true);
  });

  it("rejects a non-object body", () => {
    expect("error" in validateContractFields(null)).toBe(true);
    expect("error" in validateContractFields("x")).toBe(true);
  });
});

describe("generateContractDocx", () => {
  it("fills every placeholder and leaves no {{TOKEN}} behind", async () => {
    const buffer = await generateContractDocx(VALID_FIELDS);
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file("word/document.xml")!.async("string");

    expect(xml).not.toMatch(/\{\{[A-Z_]+\}\}/);
    expect(xml).toContain("Péter Kallós");
    expect(xml).toContain("Faknó utca 20/b, Budapest, 1115, Hungary");
    expect(xml).toContain("is an e-commerce mentor.");
    expect(xml).toContain("kpeterb82@gmail.com");
    expect(xml).toContain("15/06/2026");
    expect(xml).toContain("https://releas.it/codform/nocodeai");
  });

  it("XML-escapes special characters so an ampersand in a name can't break the document", async () => {
    const buffer = await generateContractDocx({ ...VALID_FIELDS, talentName: "Smith & Co" });
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file("word/document.xml")!.async("string");

    expect(xml).toContain("Smith &amp; Co");
    expect(xml).not.toContain("Smith & Co\"");
  });

  it("produces a valid zip (readable docx) every time", async () => {
    const buffer = await generateContractDocx(VALID_FIELDS);
    const zip = await JSZip.loadAsync(buffer); // throws if not a valid zip
    expect(zip.file("word/document.xml")).not.toBeNull();
    expect(zip.file("[Content_Types].xml")).not.toBeNull();
  });
});
