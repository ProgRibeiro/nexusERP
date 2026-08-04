ALTER TABLE "StoreAsset"
ADD COLUMN "parentAssetId" TEXT;

ALTER TABLE "ServiceOrder"
ADD COLUMN "storeProjectId" TEXT,
ADD COLUMN "storeAssetId" TEXT,
ADD COLUMN "requestSource" TEXT NOT NULL DEFAULT 'INTERNO',
ADD COLUMN "requesterName" TEXT,
ADD COLUMN "requesterEmail" TEXT,
ADD COLUMN "requesterPhone" TEXT;

CREATE TABLE "StoreAssetPhoto" (
  "id" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "dataUrl" TEXT NOT NULL,
  "fileName" TEXT,
  "mimeType" TEXT,
  "caption" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoreAssetPhoto_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StorePortal" (
  "id" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "allowTicketCreation" BOOLEAN NOT NULL DEFAULT true,
  "lastAccessAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StorePortal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StoreAsset_parentAssetId_idx" ON "StoreAsset"("parentAssetId");
CREATE INDEX "StoreAssetPhoto_assetId_createdAt_idx" ON "StoreAssetPhoto"("assetId", "createdAt");
CREATE INDEX "ServiceOrder_storeProjectId_idx" ON "ServiceOrder"("storeProjectId");
CREATE INDEX "ServiceOrder_storeAssetId_idx" ON "ServiceOrder"("storeAssetId");
CREATE UNIQUE INDEX "StorePortal_contractId_key" ON "StorePortal"("contractId");
CREATE UNIQUE INDEX "StorePortal_token_key" ON "StorePortal"("token");

ALTER TABLE "StoreAsset" ADD CONSTRAINT "StoreAsset_parentAssetId_fkey" FOREIGN KEY ("parentAssetId") REFERENCES "StoreAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoreAssetPhoto" ADD CONSTRAINT "StoreAssetPhoto_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "StoreAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_storeProjectId_fkey" FOREIGN KEY ("storeProjectId") REFERENCES "ClientStoreProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_storeAssetId_fkey" FOREIGN KEY ("storeAssetId") REFERENCES "StoreAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StorePortal" ADD CONSTRAINT "StorePortal_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
