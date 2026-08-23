-- Add the client billing preferences used by the billing and client modules.
ALTER TABLE "Client"
ADD COLUMN "defaultPaymentTerms" TEXT,
ADD COLUMN "billingGroup" TEXT;

-- Allow standalone invoices and persist their payment conditions/notes.
ALTER TABLE "Invoice"
ALTER COLUMN "serviceOrderId" DROP NOT NULL,
ADD COLUMN "paymentTerms" TEXT,
ADD COLUMN "notes" TEXT;
