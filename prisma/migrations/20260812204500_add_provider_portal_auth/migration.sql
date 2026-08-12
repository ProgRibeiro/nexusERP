ALTER TABLE "Supplier"
ADD COLUMN "portalEmail" TEXT,
ADD COLUMN "portalPassword" TEXT,
ADD COLUMN "portalSalt" TEXT,
ADD COLUMN "portalActive" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "Supplier_portalEmail_key" ON "Supplier"("portalEmail");
