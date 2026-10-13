-- CreateTable
CREATE TABLE "OnboardingStep" (
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
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OnboardingStep_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "OnboardingStep_affiliateId_idx" ON "OnboardingStep"("affiliateId");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingStep_affiliateId_stepKey_key" ON "OnboardingStep"("affiliateId", "stepKey");
