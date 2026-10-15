
-- CreateTable
CREATE TABLE "LeadStageEvent" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "rootLeadId" TEXT NOT NULL,
    "pipelineName" TEXT NOT NULL,
    "fromStageName" TEXT,
    "toStageName" TEXT NOT NULL,
    "actor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadStageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "LeadStageEvent_createdAt_idx" ON "LeadStageEvent"("createdAt");

-- CreateIndex
CREATE INDEX "LeadStageEvent_rootLeadId_idx" ON "LeadStageEvent"("rootLeadId");

-- AddForeignKey
ALTER TABLE "LeadStageEvent" ADD CONSTRAINT "LeadStageEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

