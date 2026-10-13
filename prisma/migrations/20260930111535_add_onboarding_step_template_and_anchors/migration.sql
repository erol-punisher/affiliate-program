-- CreateTable
CREATE TABLE "OnboardingStepTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "targetDays" INTEGER NOT NULL,
    "targetDaysAnchor" TEXT NOT NULL DEFAULT 'step_start',
    "isApprovalAnchor" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OnboardingStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "affiliateId" TEXT NOT NULL,
    "stepKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "owner" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "targetDays" INTEGER,
    "targetDaysAnchor" TEXT NOT NULL DEFAULT 'step_start',
    "isApprovalAnchor" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "autoCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OnboardingStep_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_OnboardingStep" ("affiliateId", "autoCompleted", "completedAt", "createdAt", "id", "label", "notes", "order", "owner", "startedAt", "status", "stepKey", "targetDays", "updatedAt") SELECT "affiliateId", "autoCompleted", "completedAt", "createdAt", "id", "label", "notes", "order", "owner", "startedAt", "status", "stepKey", "targetDays", "updatedAt" FROM "OnboardingStep";
DROP TABLE "OnboardingStep";
ALTER TABLE "new_OnboardingStep" RENAME TO "OnboardingStep";
CREATE INDEX "OnboardingStep_affiliateId_idx" ON "OnboardingStep"("affiliateId");
CREATE UNIQUE INDEX "OnboardingStep_affiliateId_stepKey_key" ON "OnboardingStep"("affiliateId", "stepKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingStepTemplate_key_key" ON "OnboardingStepTemplate"("key");
