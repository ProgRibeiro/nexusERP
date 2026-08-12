ALTER TABLE "ServiceOrder"
ADD COLUMN "operationKind" TEXT NOT NULL DEFAULT 'AVULSA',
ADD COLUMN "referenceMonth" TEXT;

CREATE INDEX "ServiceOrder_contractId_referenceMonth_idx"
ON "ServiceOrder"("contractId", "referenceMonth");

CREATE INDEX "ServiceOrder_operationKind_referenceMonth_idx"
ON "ServiceOrder"("operationKind", "referenceMonth");

UPDATE "ServiceOrder"
SET "operationKind" = CASE
  WHEN "contractId" IS NOT NULL AND "type" = 'PREVENTIVA' THEN 'VISITA_PREVENTIVA'
  WHEN "contractId" IS NOT NULL THEN 'CHAMADO_CONTRATO'
  ELSE 'AVULSA'
END;

UPDATE "ServiceOrder"
SET "referenceMonth" = TO_CHAR(COALESCE("scheduledDate", "createdAt"), 'YYYY-MM')
WHERE "contractId" IS NOT NULL;
