import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import fs from "fs";
import path from "path";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/** JSON.parse reviver — turns every ISO-8601 timestamp string back into a real Date for Prisma. */
function dateReviver(_key: string, value: unknown) {
  return typeof value === "string" && ISO_DATE_RE.test(value) ? new Date(value) : value;
}

/**
 * One-time import of the JSON snapshot produced by export-sqlite-data.ts, run once against the
 * new Postgres database (after `prisma migrate dev` has created its schema) to carry over every
 * real record — affiliates, onboarding progress, CRM leads — with identical ids and relations.
 */
async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: npx tsx scripts/import-postgres-data.ts <path-to-export.json>");
    process.exit(1);
  }

  const raw = fs.readFileSync(path.resolve(file), "utf8");
  const data = JSON.parse(raw, dateReviver);

  // Parent tables first, then whatever references them — same order the export used.
  const order: [string, keyof typeof prisma][] = [
    ["affiliateStage", "affiliateStage"],
    ["onboardingStepTemplate", "onboardingStepTemplate"],
    ["affiliate", "affiliate"],
    ["issue", "issue"],
    ["duplicateCandidate", "duplicateCandidate"],
    ["auditLog", "auditLog"],
    ["onboardingStep", "onboardingStep"],
    ["onboardingActivity", "onboardingActivity"],
    ["pipelineGroup", "pipelineGroup"],
    ["pipeline", "pipeline"],
    ["stage", "stage"],
    ["lead", "lead"],
    ["allowedUser", "allowedUser"],
    ["documentationEntry", "documentationEntry"],
    ["templateCadence", "templateCadence"],
    ["templateStep", "templateStep"],
  ];

  for (const [key, model] of order) {
    const rows = data[key] ?? [];
    if (rows.length === 0) {
      console.log(`${key}: 0 rows, skipping`);
      continue;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma[model] as any).createMany({ data: rows });
    console.log(`${key}: imported ${rows.length} rows`);
  }

  console.log("\nImport complete.");
}

main().finally(() => prisma.$disconnect());
