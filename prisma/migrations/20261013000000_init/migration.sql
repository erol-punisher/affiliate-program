-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "AllowedUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "addedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AllowedUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentationEntry" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "author" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentationEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateCadence" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateCadence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateStep" (
    "id" TEXT NOT NULL,
    "cadenceId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateStage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Affiliate" (
    "id" TEXT NOT NULL,
    "sheetRowIndex" INTEGER,
    "raw" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "commissionRate" DOUBLE PRECISION,
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
    "firstInstallAt" TIMESTAMP(3),
    "firstPaidMerchantAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Affiliate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Issue" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "assignee" TEXT,
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DuplicateCandidate" (
    "id" TEXT NOT NULL,
    "affiliateAId" TEXT NOT NULL,
    "affiliateBId" TEXT NOT NULL,
    "matchType" TEXT NOT NULL,
    "matchConfidence" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DuplicateCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "field" TEXT,
    "beforeValue" TEXT,
    "afterValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingStepTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "targetDays" INTEGER NOT NULL,
    "targetDaysAnchor" TEXT NOT NULL DEFAULT 'step_start',
    "isApprovalAnchor" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingStepTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingStep" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "stepKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "owner" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "targetDays" INTEGER,
    "targetDaysAnchor" TEXT NOT NULL DEFAULT 'step_start',
    "isApprovalAnchor" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "autoCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingActivity" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnboardingActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipelineGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PipelineGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pipeline" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "pipelineGroupId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pipeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "color" TEXT,
    "pipelineId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Stage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
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
    "dateOfReachOut" TIMESTAMP(3),
    "socialsUrl" TEXT,
    "closingDate" TIMESTAMP(3),
    "stageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AllowedUser_email_key" ON "AllowedUser"("email");

-- CreateIndex
CREATE INDEX "TemplateStep_cadenceId_idx" ON "TemplateStep"("cadenceId");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateStage_name_key" ON "AffiliateStage"("name");

-- CreateIndex
CREATE INDEX "Issue_affiliateId_idx" ON "Issue"("affiliateId");

-- CreateIndex
CREATE INDEX "Issue_status_idx" ON "Issue"("status");

-- CreateIndex
CREATE INDEX "DuplicateCandidate_status_idx" ON "DuplicateCandidate"("status");

-- CreateIndex
CREATE INDEX "AuditLog_affiliateId_idx" ON "AuditLog"("affiliateId");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingStepTemplate_key_key" ON "OnboardingStepTemplate"("key");

-- CreateIndex
CREATE INDEX "OnboardingStep_affiliateId_idx" ON "OnboardingStep"("affiliateId");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingStep_affiliateId_stepKey_key" ON "OnboardingStep"("affiliateId", "stepKey");

-- CreateIndex
CREATE INDEX "OnboardingActivity_stepId_idx" ON "OnboardingActivity"("stepId");

-- CreateIndex
CREATE INDEX "Pipeline_pipelineGroupId_idx" ON "Pipeline"("pipelineGroupId");

-- CreateIndex
CREATE INDEX "Stage_pipelineId_idx" ON "Stage"("pipelineId");

-- CreateIndex
CREATE INDEX "Lead_stageId_idx" ON "Lead"("stageId");

-- AddForeignKey
ALTER TABLE "TemplateStep" ADD CONSTRAINT "TemplateStep_cadenceId_fkey" FOREIGN KEY ("cadenceId") REFERENCES "TemplateCadence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuplicateCandidate" ADD CONSTRAINT "DuplicateCandidate_affiliateAId_fkey" FOREIGN KEY ("affiliateAId") REFERENCES "Affiliate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuplicateCandidate" ADD CONSTRAINT "DuplicateCandidate_affiliateBId_fkey" FOREIGN KEY ("affiliateBId") REFERENCES "Affiliate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingStep" ADD CONSTRAINT "OnboardingStep_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingActivity" ADD CONSTRAINT "OnboardingActivity_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "OnboardingStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pipeline" ADD CONSTRAINT "Pipeline_pipelineGroupId_fkey" FOREIGN KEY ("pipelineGroupId") REFERENCES "PipelineGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stage" ADD CONSTRAINT "Stage_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_sourceLeadId_fkey" FOREIGN KEY ("sourceLeadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

