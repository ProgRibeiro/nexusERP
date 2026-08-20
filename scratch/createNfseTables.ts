import { prisma } from "../src/lib/db";

async function main() {
  console.log("Criando tabelas NfseRecord e DpsSequence caso não existam...");

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "NfseRecord" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001',
      "serviceOrderId" TEXT REFERENCES "ServiceOrder"("id") ON DELETE SET NULL,
      "clientId" TEXT NOT NULL REFERENCES "Client"("id") ON DELETE CASCADE,
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
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "DpsSequence" (
      "series" TEXT PRIMARY KEY,
      "lastNumber" INTEGER NOT NULL DEFAULT 0,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log("Tabelas NfseRecord e DpsSequence criadas com sucesso!");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
