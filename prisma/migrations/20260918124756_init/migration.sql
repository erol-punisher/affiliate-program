-- CreateTable
CREATE TABLE "Affiliate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sheetRowIndex" INTEGER,
    "raw" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "commissionRate" REAL,
    "commissionRaw" TEXT,
    "tier" TEXT,
    "tierRaw" TEXT,
    "tierConfidence" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "statusRaw" TEXT,
    "statusFlagged" BOOLEAN NOT NULL DEFAULT false,
    "language" TEXT,
    "languageRaw" TEXT,
    "countryCode" TEXT,
    "countryCodeInferred" BOOLEAN NOT NULL DEFAULT false,
    "phoneE164" TEXT,
    "phoneRaw" TEXT,
    "emails" TEXT NOT NULL,
    "importArtifacts" TEXT NOT NULL,
    "healthScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Issue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "affiliateId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "assignee" TEXT,
    "resolutionNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    CONSTRAINT "Issue_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DuplicateCandidate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "affiliateAId" TEXT NOT NULL,
    "affiliateBId" TEXT NOT NULL,
    "matchType" TEXT NOT NULL,
    "matchConfidence" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DuplicateCandidate_affiliateAId_fkey" FOREIGN KEY ("affiliateAId") REFERENCES "Affiliate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DuplicateCandidate_affiliateBId_fkey" FOREIGN KEY ("affiliateBId") REFERENCES "Affiliate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "affiliateId" TEXT,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "field" TEXT,
    "beforeValue" TEXT,
    "afterValue" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Issue_affiliateId_idx" ON "Issue"("affiliateId");

-- CreateIndex
CREATE INDEX "Issue_status_idx" ON "Issue"("status");

-- CreateIndex
CREATE INDEX "DuplicateCandidate_status_idx" ON "DuplicateCandidate"("status");

-- CreateIndex
CREATE INDEX "AuditLog_affiliateId_idx" ON "AuditLog"("affiliateId");
