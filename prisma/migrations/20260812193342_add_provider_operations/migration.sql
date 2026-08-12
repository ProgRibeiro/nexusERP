-- DropIndex
DROP INDEX "Quote_proposalType_createdAt_idx";

-- AlterTable
ALTER TABLE "QuoteItem" ADD COLUMN     "supplierId" TEXT;

-- CreateTable
CREATE TABLE "ProviderJob" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "quoteItemId" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "accountsPayableId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'SERVIÇO',
    "costValue" DECIMAL(10,2) NOT NULL,
    "saleValue" DECIMAL(10,2) NOT NULL,
    "executionStatus" TEXT NOT NULL DEFAULT 'PENDENTE',
    "paymentStatus" TEXT NOT NULL DEFAULT 'BLOQUEADO',
    "scheduledDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "paymentDueDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProviderJob_quoteItemId_key" ON "ProviderJob"("quoteItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderJob_accountsPayableId_key" ON "ProviderJob"("accountsPayableId");

-- CreateIndex
CREATE INDEX "ProviderJob_supplierId_executionStatus_idx" ON "ProviderJob"("supplierId", "executionStatus");

-- CreateIndex
CREATE INDEX "ProviderJob_serviceOrderId_idx" ON "ProviderJob"("serviceOrderId");

-- CreateIndex
CREATE INDEX "ProviderJob_paymentStatus_paymentDueDate_idx" ON "ProviderJob"("paymentStatus", "paymentDueDate");

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderJob" ADD CONSTRAINT "ProviderJob_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderJob" ADD CONSTRAINT "ProviderJob_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderJob" ADD CONSTRAINT "ProviderJob_quoteItemId_fkey" FOREIGN KEY ("quoteItemId") REFERENCES "QuoteItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderJob" ADD CONSTRAINT "ProviderJob_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderJob" ADD CONSTRAINT "ProviderJob_accountsPayableId_fkey" FOREIGN KEY ("accountsPayableId") REFERENCES "AccountsPayable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
