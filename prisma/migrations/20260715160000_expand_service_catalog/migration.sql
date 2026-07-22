ALTER TABLE "Service"
  ADD COLUMN "category" TEXT,
  ADD COLUMN "maintenanceType" TEXT,
  ADD COLUMN "billingUnit" TEXT DEFAULT 'Serviço',
  ADD COLUMN "estimatedHours" DOUBLE PRECISION;
