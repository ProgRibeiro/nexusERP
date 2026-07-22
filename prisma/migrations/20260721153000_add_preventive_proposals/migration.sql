ALTER TABLE "Quote"
ADD COLUMN "proposalType" TEXT NOT NULL DEFAULT 'AVULSA',
ADD COLUMN "preventivePlanJson" TEXT;

CREATE INDEX "Quote_proposalType_createdAt_idx"
ON "Quote"("proposalType", "createdAt" DESC);
