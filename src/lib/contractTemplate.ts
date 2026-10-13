import JSZip from "jszip";
import { readFile } from "fs/promises";
import path from "path";

const TEMPLATE_PATH = path.join(process.cwd(), "templates", "affiliate-contract-template.docx");

export type ContractFields = {
  talentName: string;
  talentAddress: string;
  talentRoleLine: string; // full phrase, e.g. "is an e-commerce mentor."
  talentEmail: string;
  effectiveDate: string; // as typed, e.g. "15/06/2026"
  referralSlug: string; // just the slug, e.g. "nocodeai" — the URL prefix is fixed
};

const REQUIRED_FIELDS: (keyof ContractFields)[] = [
  "talentName",
  "talentAddress",
  "talentRoleLine",
  "talentEmail",
  "effectiveDate",
  "referralSlug",
];

export function validateContractFields(body: unknown): { fields: ContractFields } | { error: string } {
  if (typeof body !== "object" || body === null) {
    return { error: "Invalid request body" };
  }
  const record = body as Record<string, unknown>;
  const fields: Partial<ContractFields> = {};

  for (const key of REQUIRED_FIELDS) {
    const value = record[key];
    if (typeof value !== "string" || !value.trim()) {
      return { error: `${key} is required` };
    }
    fields[key] = value.trim();
  }

  return { fields: fields as ContractFields };
}

/** Escapes a value for safe insertion into a Word document.xml text node. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const TOKEN_TO_FIELD: Record<string, keyof ContractFields> = {
  TALENT_NAME: "talentName",
  TALENT_ADDRESS: "talentAddress",
  TALENT_ROLE_LINE: "talentRoleLine",
  TALENT_EMAIL: "talentEmail",
  EFFECTIVE_DATE: "effectiveDate",
  REFERRAL_SLUG: "referralSlug",
};

/** Fills the master contract template with the given fields, returning the generated .docx as a Buffer. */
export async function generateContractDocx(fields: ContractFields): Promise<Buffer> {
  const templateBuffer = await readFile(TEMPLATE_PATH);
  const zip = await JSZip.loadAsync(templateBuffer);

  const documentXmlFile = zip.file("word/document.xml");
  if (!documentXmlFile) {
    throw new Error("Template is missing word/document.xml — it may not be a valid .docx file");
  }

  let xml = await documentXmlFile.async("string");

  for (const [token, field] of Object.entries(TOKEN_TO_FIELD)) {
    xml = xml.split(`{{${token}}}`).join(escapeXml(fields[field]));
  }

  const leftoverToken = xml.match(/\{\{[A-Z_]+\}\}/);
  if (leftoverToken) {
    throw new Error(`Template placeholder ${leftoverToken[0]} was not filled — template may have changed`);
  }

  zip.file("word/document.xml", xml);
  return zip.generateAsync({ type: "nodebuffer" });
}
