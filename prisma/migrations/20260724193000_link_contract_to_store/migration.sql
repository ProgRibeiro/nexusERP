ALTER TABLE "Contract" ADD COLUMN "addressId" TEXT;
ALTER TABLE "ClientStoreProject" ADD COLUMN "contractId" TEXT;

CREATE INDEX "Contract_addressId_idx" ON "Contract"("addressId");
CREATE INDEX "ClientStoreProject_contractId_idx" ON "ClientStoreProject"("contractId");

ALTER TABLE "Contract"
ADD CONSTRAINT "Contract_addressId_fkey"
FOREIGN KEY ("addressId") REFERENCES "ClientAddress"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ClientStoreProject"
ADD CONSTRAINT "ClientStoreProject_contractId_fkey"
FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
