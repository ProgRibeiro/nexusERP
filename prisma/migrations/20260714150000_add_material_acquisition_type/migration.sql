-- This field existed in the Prisma model but was missing from the historical
-- PostgreSQL migration, which made reads of ServiceOrderMaterial fail.
ALTER TABLE "ServiceOrderMaterial"
ADD COLUMN "acquisitionType" TEXT NOT NULL DEFAULT 'ESTOQUE';
