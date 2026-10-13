-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Lead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "notes" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "sourceLeadId" TEXT,
    "username" TEXT,
    "owner" TEXT,
    "affiliateManager" TEXT,
    "country" TEXT,
    "whatsapp" TEXT,
    "followerCount" INTEGER,
    "websiteUrl" TEXT,
    "referralLink" TEXT,
    "dateOfReachOut" DATETIME,
    "socialsUrl" TEXT,
    "closingDate" DATETIME,
    "stageId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Lead_sourceLeadId_fkey" FOREIGN KEY ("sourceLeadId") REFERENCES "Lead" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Lead_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Lead" ("affiliateManager", "closingDate", "country", "createdAt", "dateOfReachOut", "email", "followerCount", "id", "name", "notes", "order", "owner", "referralLink", "socialsUrl", "stageId", "updatedAt", "username", "websiteUrl", "whatsapp") SELECT "affiliateManager", "closingDate", "country", "createdAt", "dateOfReachOut", "email", "followerCount", "id", "name", "notes", "order", "owner", "referralLink", "socialsUrl", "stageId", "updatedAt", "username", "websiteUrl", "whatsapp" FROM "Lead";
DROP TABLE "Lead";
ALTER TABLE "new_Lead" RENAME TO "Lead";
CREATE INDEX "Lead_stageId_idx" ON "Lead"("stageId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
