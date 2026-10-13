-- CreateTable
CREATE TABLE "OnboardingActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stepId" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OnboardingActivity_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "OnboardingStep" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "OnboardingActivity_stepId_idx" ON "OnboardingActivity"("stepId");
