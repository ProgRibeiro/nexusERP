ALTER TABLE "StoreAsset"
ADD COLUMN "assetType" TEXT,
ADD COLUMN "manufacturerCode" TEXT,
ADD COLUMN "unit" TEXT NOT NULL DEFAULT 'UN',
ADD COLUMN "criticality" TEXT NOT NULL DEFAULT 'NORMAL';

CREATE INDEX "StoreAsset_projectId_assetType_idx" ON "StoreAsset"("projectId", "assetType");
