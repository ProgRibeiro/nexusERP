-- Garante que uma instalação limpa possua a fundação de NFS-e antes da
-- migration de endurecimento de tenant/RLS. É idempotente para instalações
-- antigas onde as tabelas já tenham sido criadas pelo script legado.

CREATE TABLE IF NOT EXISTS "NfseRecord" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001',
  "serviceOrderId" TEXT,
  "clientId" TEXT NOT NULL,
  "environment" TEXT NOT NULL DEFAULT 'homologation',
  "dpsSeries" TEXT NOT NULL DEFAULT '1',
  "dpsNumber" INTEGER NOT NULL,
  "dpsCompetence" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
  "serviceValue" DECIMAL(12,2) NOT NULL,
  "cTribNac" TEXT NOT NULL,
  "cTribMun" TEXT,
  "cNBS" TEXT,
  "accessKey" TEXT,
  "nfseNumber" TEXT,
  "requestXml" TEXT,
  "responseXml" TEXT,
  "authorizedXml" TEXT,
  "visualizationUrl" TEXT,
  "nationalVisualizationUrl" TEXT,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "createdBy" TEXT,
  "confirmedBy" TEXT,
  "sentAt" TIMESTAMP(3),
  "authorizedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "cancelReasonCode" TEXT,
  "cancelReasonDesc" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NfseRecord_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NfseRecord_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "NfseRecord_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "NfseRecord_tenantId_idx" ON "NfseRecord"("tenantId");
CREATE INDEX IF NOT EXISTS "NfseRecord_serviceOrderId_idx" ON "NfseRecord"("serviceOrderId");
CREATE INDEX IF NOT EXISTS "NfseRecord_clientId_idx" ON "NfseRecord"("clientId");
CREATE INDEX IF NOT EXISTS "NfseRecord_status_idx" ON "NfseRecord"("status");

CREATE TABLE IF NOT EXISTS "DpsSequence" (
  "series" TEXT NOT NULL,
  "lastNumber" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DpsSequence_pkey" PRIMARY KEY ("series")
);
