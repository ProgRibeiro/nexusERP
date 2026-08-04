ALTER TABLE "ServiceOrder"
ADD COLUMN "purchaseOrder" TEXT,
ADD COLUMN "billingMirrorJson" JSONB;
