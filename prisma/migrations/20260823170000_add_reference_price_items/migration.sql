CREATE TABLE "ReferencePriceItem" (
  "id" TEXT NOT NULL,
  "base" TEXT NOT NULL,
  "sourceOrganization" TEXT,
  "state" TEXT,
  "referenceMonth" TEXT,
  "regime" TEXT,
  "itemType" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "unit" TEXT,
  "unitPrice" DECIMAL(14,4) NOT NULL,
  "metadataJson" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReferencePriceItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReferencePriceItem_base_referenceMonth_code_state_regime_key" ON "ReferencePriceItem"("base", "referenceMonth", "code", "state", "regime");
CREATE INDEX "ReferencePriceItem_base_referenceMonth_idx" ON "ReferencePriceItem"("base", "referenceMonth");
CREATE INDEX "ReferencePriceItem_code_idx" ON "ReferencePriceItem"("code");
CREATE INDEX "ReferencePriceItem_description_idx" ON "ReferencePriceItem"("description");
