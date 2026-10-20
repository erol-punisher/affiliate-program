
-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "outreachChannels" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "LeadStageEvent" ADD COLUMN     "channels" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'stage';


-- Backfill: moves into a Contacted stage that followed an email sent from the
-- dashboard (within 3 days before, or just after for older auto-moves) were by email.
UPDATE "LeadStageEvent" e
SET "channels" = ARRAY['email']::TEXT[]
WHERE (lower(trim(e."toStageName")) = 'contacted' OR lower(trim(e."toStageName")) ~ '^contacted \(\d+\)$')
  AND EXISTS (
    SELECT 1 FROM "EmailSend" s
    WHERE s."leadId" = e."rootLeadId"
      AND s."sentAt" BETWEEN e."createdAt" - INTERVAL '3 days' AND e."createdAt" + INTERVAL '1 hour'
  );

UPDATE "Lead" l
SET "outreachChannels" = ARRAY['email']::TEXT[]
WHERE EXISTS (
  SELECT 1 FROM "LeadStageEvent" e
  WHERE e."rootLeadId" = COALESCE(l."sourceLeadId", l."id") AND 'email' = ANY(e."channels")
);
