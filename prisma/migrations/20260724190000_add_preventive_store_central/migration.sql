CREATE TABLE "ClientStoreProject" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "addressId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "floorPlanData" TEXT,
    "floorPlanFileName" TEXT,
    "floorPlanMimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientStoreProject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoreAsset" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "tag" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "location" TEXT,
    "specificationsJson" TEXT NOT NULL DEFAULT '{}',
    "notes" TEXT,
    "positionX" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "positionY" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreAsset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClientStoreProject_clientId_updatedAt_idx" ON "ClientStoreProject"("clientId", "updatedAt");
CREATE INDEX "StoreAsset_projectId_category_idx" ON "StoreAsset"("projectId", "category");

ALTER TABLE "ClientStoreProject"
ADD CONSTRAINT "ClientStoreProject_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClientStoreProject"
ADD CONSTRAINT "ClientStoreProject_addressId_fkey"
FOREIGN KEY ("addressId") REFERENCES "ClientAddress"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StoreAsset"
ADD CONSTRAINT "StoreAsset_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "ClientStoreProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
