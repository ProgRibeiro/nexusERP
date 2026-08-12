ALTER TABLE "CompletionReport" ADD COLUMN "executedServices" TEXT;
ALTER TABLE "CompletionReport" ADD COLUMN "pendingActions" TEXT;
ALTER TABLE "CompletionReport" ADD COLUMN "operationalResult" TEXT NOT NULL DEFAULT 'OPERACIONAL';
ALTER TABLE "CompletionReport" ADD COLUMN "clientRepresentative" TEXT;
