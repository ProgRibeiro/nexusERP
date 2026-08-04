ALTER TABLE "Contract" ADD COLUMN "contactId" TEXT;

CREATE INDEX "Contract_contactId_idx" ON "Contract"("contactId");

ALTER TABLE "Contract"
ADD CONSTRAINT "Contract_contactId_fkey"
FOREIGN KEY ("contactId") REFERENCES "ClientContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
