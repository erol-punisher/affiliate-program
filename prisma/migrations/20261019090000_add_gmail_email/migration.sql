
-- CreateTable
CREATE TABLE "GmailConnection" (
    "email" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT NOT NULL,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmailConnection_pkey" PRIMARY KEY ("email")
);

-- CreateTable
CREATE TABLE "GmailLabel" (
    "ownerEmail" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gmailLabelId" TEXT NOT NULL,

    CONSTRAINT "GmailLabel_pkey" PRIMARY KEY ("ownerEmail","name")
);

-- CreateTable
CREATE TABLE "EmailThread" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "ownerEmail" TEXT NOT NULL,
    "gmailThreadId" TEXT NOT NULL,
    "lastMessageId" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "labelName" TEXT,
    "sentCount" INTEGER NOT NULL DEFAULT 1,
    "lastSentAt" TIMESTAMP(3) NOT NULL,
    "repliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailThread_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailThread_leadId_idx" ON "EmailThread"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailThread_ownerEmail_gmailThreadId_key" ON "EmailThread"("ownerEmail", "gmailThreadId");

-- AddForeignKey
ALTER TABLE "EmailThread" ADD CONSTRAINT "EmailThread_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

