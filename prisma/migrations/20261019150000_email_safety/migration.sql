
-- AlterTable
ALTER TABLE "EmailThread" ADD COLUMN     "bouncedAt" TIMESTAMP(3),
ADD COLUMN     "ignoreRepliesBefore" TIMESTAMP(3),
ADD COLUMN     "replyCategory" TEXT,
ADD COLUMN     "replySnippet" TEXT;

-- CreateTable
CREATE TABLE "EmailSend" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "ownerEmail" TEXT NOT NULL,
    "leadId" TEXT,
    "templateStepId" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailSend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuppressedContact" (
    "id" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "addedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuppressedContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailSend_ownerEmail_sentAt_idx" ON "EmailSend"("ownerEmail", "sentAt");

-- CreateIndex
CREATE INDEX "EmailSend_templateStepId_idx" ON "EmailSend"("templateStepId");

-- CreateIndex
CREATE UNIQUE INDEX "SuppressedContact_value_key" ON "SuppressedContact"("value");

-- AddForeignKey
ALTER TABLE "EmailSend" ADD CONSTRAINT "EmailSend_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "EmailThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

