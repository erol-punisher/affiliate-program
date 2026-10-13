import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import fs from "fs";

const adapter = new PrismaBetterSqlite3({ url: "./dev.db" });
const prisma = new PrismaClient({ adapter });

/**
 * One-time export of every table, in dependency order, so the matching import
 * script can recreate everything (including relations) on the new Postgres
 * database with identical ids. Run this BEFORE switching schema.prisma's
 * datasource away from sqlite.
 */
async function main() {
  const data = {
    affiliateStage: await prisma.affiliateStage.findMany(),
    onboardingStepTemplate: await prisma.onboardingStepTemplate.findMany(),
    affiliate: await prisma.affiliate.findMany(),
    issue: await prisma.issue.findMany(),
    duplicateCandidate: await prisma.duplicateCandidate.findMany(),
    auditLog: await prisma.auditLog.findMany(),
    onboardingStep: await prisma.onboardingStep.findMany(),
    onboardingActivity: await prisma.onboardingActivity.findMany(),
    pipelineGroup: await prisma.pipelineGroup.findMany(),
    pipeline: await prisma.pipeline.findMany(),
    stage: await prisma.stage.findMany(),
    lead: await prisma.lead.findMany(),
  };

  const outPath = `${__dirname}/sqlite-export-${new Date().toISOString().slice(0, 10)}.json`;
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2));

  console.log("Exported:");
  for (const [table, rows] of Object.entries(data)) {
    console.log(`  ${table}: ${rows.length} rows`);
  }
  console.log(`\nWritten to ${outPath}`);
}

main().finally(() => prisma.$disconnect());
