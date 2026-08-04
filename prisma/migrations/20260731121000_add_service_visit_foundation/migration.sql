-- Fundação aditiva da operação de campo. Nenhum campo legado é removido:
-- OS, técnicos, fotos e medições textuais continuam disponíveis durante a transição.

CREATE TABLE "ServiceVisit" (
    "id" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'ATENDIMENTO',
    "status" TEXT NOT NULL DEFAULT 'NAO_AGENDADA',
    "scheduledStart" TIMESTAMP(3),
    "scheduledEnd" TIMESTAMP(3),
    "windowStart" TIMESTAMP(3),
    "windowEnd" TIMESTAMP(3),
    "estimatedDurationMinutes" INTEGER NOT NULL DEFAULT 60,
    "acceptedAt" TIMESTAMP(3),
    "travelStartedAt" TIMESTAMP(3),
    "arrivedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "result" TEXT,
    "returnReason" TEXT,
    "notes" TEXT,
    "checkinLatitude" DOUBLE PRECISION,
    "checkinLongitude" DOUBLE PRECISION,
    "checkoutLatitude" DOUBLE PRECISION,
    "checkoutLongitude" DOUBLE PRECISION,
    "sourceVisitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ServiceVisit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VisitTechnician" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'TECNICO',
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VisitTechnician_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VisitStatusHistory" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "oldStatus" TEXT NOT NULL,
    "newStatus" TEXT NOT NULL,
    "changedById" TEXT,
    "justification" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VisitStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TimeEntry" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "durationMin" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LocationEvent" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LocationEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServiceOrderAsset" (
    "id" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "storeAssetId" TEXT,
    "clientEquipmentId" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "problem" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServiceOrderAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "visitId" TEXT,
    "storeAssetId" TEXT,
    "clientEquipmentId" TEXT,
    "authorId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'FOTO',
    "stage" TEXT,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "sha256" TEXT,
    "caption" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "capturedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MeasurementDefinition" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "minValue" DOUBLE PRECISION,
    "maxValue" DOUBLE PRECISION,
    "decimals" INTEGER NOT NULL DEFAULT 2,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MeasurementDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MeasurementReading" (
    "id" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "visitId" TEXT,
    "storeAssetId" TEXT,
    "clientEquipmentId" TEXT,
    "recordedById" TEXT,
    "value" DOUBLE PRECISION NOT NULL,
    "rawValue" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NORMAL',
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MeasurementReading_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SequenceCounter" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SequenceCounter_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "ServiceVisit_status_scheduledStart_idx" ON "ServiceVisit"("status", "scheduledStart");
CREATE INDEX "ServiceVisit_sourceVisitId_idx" ON "ServiceVisit"("sourceVisitId");
CREATE UNIQUE INDEX "ServiceVisit_serviceOrderId_number_key" ON "ServiceVisit"("serviceOrderId", "number");
CREATE INDEX "VisitTechnician_userId_createdAt_idx" ON "VisitTechnician"("userId", "createdAt");
CREATE UNIQUE INDEX "VisitTechnician_visitId_userId_key" ON "VisitTechnician"("visitId", "userId");
CREATE INDEX "VisitStatusHistory_visitId_changedAt_idx" ON "VisitStatusHistory"("visitId", "changedAt");
CREATE INDEX "TimeEntry_visitId_startedAt_idx" ON "TimeEntry"("visitId", "startedAt");
CREATE INDEX "TimeEntry_userId_startedAt_idx" ON "TimeEntry"("userId", "startedAt");
CREATE INDEX "LocationEvent_visitId_createdAt_idx" ON "LocationEvent"("visitId", "createdAt");
CREATE INDEX "ServiceOrderAsset_storeAssetId_idx" ON "ServiceOrderAsset"("storeAssetId");
CREATE INDEX "ServiceOrderAsset_clientEquipmentId_idx" ON "ServiceOrderAsset"("clientEquipmentId");
CREATE UNIQUE INDEX "ServiceOrderAsset_serviceOrderId_storeAssetId_key" ON "ServiceOrderAsset"("serviceOrderId", "storeAssetId");
CREATE UNIQUE INDEX "ServiceOrderAsset_serviceOrderId_clientEquipmentId_key" ON "ServiceOrderAsset"("serviceOrderId", "clientEquipmentId");
CREATE INDEX "Evidence_serviceOrderId_createdAt_idx" ON "Evidence"("serviceOrderId", "createdAt");
CREATE INDEX "Evidence_visitId_createdAt_idx" ON "Evidence"("visitId", "createdAt");
CREATE INDEX "Evidence_storeAssetId_idx" ON "Evidence"("storeAssetId");
CREATE INDEX "Evidence_clientEquipmentId_idx" ON "Evidence"("clientEquipmentId");
CREATE UNIQUE INDEX "MeasurementDefinition_code_key" ON "MeasurementDefinition"("code");
CREATE INDEX "MeasurementReading_serviceOrderId_recordedAt_idx" ON "MeasurementReading"("serviceOrderId", "recordedAt");
CREATE INDEX "MeasurementReading_visitId_recordedAt_idx" ON "MeasurementReading"("visitId", "recordedAt");
CREATE INDEX "MeasurementReading_storeAssetId_recordedAt_idx" ON "MeasurementReading"("storeAssetId", "recordedAt");
CREATE INDEX "MeasurementReading_clientEquipmentId_recordedAt_idx" ON "MeasurementReading"("clientEquipmentId", "recordedAt");

ALTER TABLE "ServiceVisit" ADD CONSTRAINT "ServiceVisit_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceVisit" ADD CONSTRAINT "ServiceVisit_sourceVisitId_fkey" FOREIGN KEY ("sourceVisitId") REFERENCES "ServiceVisit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VisitTechnician" ADD CONSTRAINT "VisitTechnician_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "ServiceVisit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VisitTechnician" ADD CONSTRAINT "VisitTechnician_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VisitStatusHistory" ADD CONSTRAINT "VisitStatusHistory_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "ServiceVisit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VisitStatusHistory" ADD CONSTRAINT "VisitStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "ServiceVisit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LocationEvent" ADD CONSTRAINT "LocationEvent_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "ServiceVisit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LocationEvent" ADD CONSTRAINT "LocationEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceOrderAsset" ADD CONSTRAINT "ServiceOrderAsset_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceOrderAsset" ADD CONSTRAINT "ServiceOrderAsset_storeAssetId_fkey" FOREIGN KEY ("storeAssetId") REFERENCES "StoreAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceOrderAsset" ADD CONSTRAINT "ServiceOrderAsset_clientEquipmentId_fkey" FOREIGN KEY ("clientEquipmentId") REFERENCES "ClientEquipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "ServiceVisit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_storeAssetId_fkey" FOREIGN KEY ("storeAssetId") REFERENCES "StoreAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_clientEquipmentId_fkey" FOREIGN KEY ("clientEquipmentId") REFERENCES "ClientEquipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MeasurementReading" ADD CONSTRAINT "MeasurementReading_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "MeasurementDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MeasurementReading" ADD CONSTRAINT "MeasurementReading_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeasurementReading" ADD CONSTRAINT "MeasurementReading_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "ServiceVisit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MeasurementReading" ADD CONSTRAINT "MeasurementReading_storeAssetId_fkey" FOREIGN KEY ("storeAssetId") REFERENCES "StoreAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MeasurementReading" ADD CONSTRAINT "MeasurementReading_clientEquipmentId_fkey" FOREIGN KEY ("clientEquipmentId") REFERENCES "ClientEquipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MeasurementReading" ADD CONSTRAINT "MeasurementReading_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Cria uma visita inicial para cada OS existente e preserva a situação atual.
INSERT INTO "ServiceVisit" (
  "id", "serviceOrderId", "number", "kind", "status", "scheduledStart",
  "scheduledEnd", "estimatedDurationMinutes", "travelStartedAt", "startedAt",
  "completedAt", "cancelledAt", "result", "createdAt", "updatedAt"
)
SELECT
  md5(so."id" || ':visit:1')::uuid::text,
  so."id",
  1,
  CASE WHEN so."type" = 'RETORNO' THEN 'RETORNO' ELSE 'ATENDIMENTO' END,
  CASE
    WHEN so."status" IN ('AGENDADA', 'AGENDADO') THEN 'AGENDADA'
    WHEN so."status" = 'DESLOCAMENTO' THEN 'EM_DESLOCAMENTO'
    WHEN so."status" IN ('EXECUCAO', 'EM_EXECUCAO') THEN 'EM_EXECUCAO'
    WHEN so."status" = 'PAUSADA' THEN 'PAUSADA'
    WHEN so."status" IN ('AGUARDANDO_PECA', 'AGUARDANDO_CLIENTE', 'RETORNO') THEN 'IMPEDIDA'
    WHEN so."status" IN ('CONCLUIDA', 'CONCLUIDO', 'RELATORIO_ENVIADO', 'REVISAO', 'FATURAMENTO', 'FATURADA', 'FATURADO') THEN 'CONCLUIDA'
    WHEN so."status" IN ('CANCELADA', 'CANCELADO') THEN 'CANCELADA'
    ELSE 'NAO_AGENDADA'
  END,
  so."scheduledDate",
  CASE WHEN so."scheduledDate" IS NOT NULL THEN so."scheduledDate" + INTERVAL '60 minutes' ELSE NULL END,
  60,
  CASE WHEN so."status" = 'DESLOCAMENTO' THEN so."updatedAt" ELSE NULL END,
  CASE WHEN so."status" IN ('EXECUCAO', 'EM_EXECUCAO') THEN so."updatedAt" ELSE NULL END,
  CASE WHEN so."status" IN ('CONCLUIDA', 'CONCLUIDO', 'RELATORIO_ENVIADO', 'REVISAO', 'FATURAMENTO', 'FATURADA', 'FATURADO') THEN COALESCE(so."completedAt", so."updatedAt") ELSE NULL END,
  CASE WHEN so."status" IN ('CANCELADA', 'CANCELADO') THEN so."updatedAt" ELSE NULL END,
  CASE WHEN so."status" IN ('CONCLUIDA', 'CONCLUIDO', 'RELATORIO_ENVIADO', 'REVISAO', 'FATURAMENTO', 'FATURADA', 'FATURADO') THEN 'RESOLVIDO' ELSE NULL END,
  so."createdAt",
  so."updatedAt"
FROM "ServiceOrder" so;

INSERT INTO "VisitTechnician" ("id", "visitId", "userId", "role", "createdAt")
SELECT
  md5(sot."id" || ':visit-technician')::uuid::text,
  md5(sot."serviceOrderId" || ':visit:1')::uuid::text,
  sot."userId",
  'TECNICO',
  CURRENT_TIMESTAMP
FROM "ServiceOrderTechnician" sot;

INSERT INTO "VisitStatusHistory" ("id", "visitId", "oldStatus", "newStatus", "justification", "changedAt")
SELECT
  md5(sv."id" || ':migration-history')::uuid::text,
  sv."id",
  'LEGADO',
  sv."status",
  'Visita inicial criada automaticamente a partir do histórico existente da OS.',
  sv."createdAt"
FROM "ServiceVisit" sv;

-- Espelha as fotos legadas em evidências contextualizadas sem apagar o registro original.
INSERT INTO "Evidence" (
  "id", "serviceOrderId", "visitId", "kind", "stage", "fileUrl",
  "caption", "capturedAt", "createdAt"
)
SELECT
  md5(sop."id" || ':evidence')::uuid::text,
  sop."serviceOrderId",
  md5(sop."serviceOrderId" || ':visit:1')::uuid::text,
  'FOTO',
  CASE WHEN sop."step" = 'EVIDENCIA' THEN 'DIAGNOSTICO' ELSE sop."step" END,
  sop."url",
  sop."caption",
  sop."uploadedAt",
  sop."uploadedAt"
FROM "ServiceOrderPhoto" sop;

-- O ativo principal legado passa a compor a relação muitos-para-muitos da OS.
INSERT INTO "ServiceOrderAsset" ("id", "serviceOrderId", "storeAssetId", "isPrimary", "createdAt")
SELECT
  md5(so."id" || ':' || so."storeAssetId" || ':asset-link')::uuid::text,
  so."id",
  so."storeAssetId",
  true,
  so."createdAt"
FROM "ServiceOrder" so
WHERE so."storeAssetId" IS NOT NULL;

-- Catálogo inicial de medições estruturadas usado pela primeira versão mobile.
INSERT INTO "MeasurementDefinition" ("id", "code", "name", "category", "unit", "decimals", "active", "createdAt", "updatedAt") VALUES
  (md5('nx:measurement:tensao')::uuid::text, 'TENSAO', 'Tensão elétrica', 'ELETRICA', 'V', 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('nx:measurement:corrente')::uuid::text, 'CORRENTE', 'Corrente elétrica', 'ELETRICA', 'A', 2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('nx:measurement:pressao')::uuid::text, 'PRESSAO', 'Pressão de trabalho', 'CLIMATIZACAO', 'PSI', 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('nx:measurement:temperatura')::uuid::text, 'TEMPERATURA', 'Temperatura', 'CLIMATIZACAO', '°C', 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Inicializa o contador transacional no maior código anual já existente.
INSERT INTO "SequenceCounter" ("key", "value", "updatedAt")
SELECT
  'SERVICE_ORDER:' || EXTRACT(YEAR FROM CURRENT_DATE)::text,
  COALESCE(MAX(NULLIF(split_part("code", '-', 3), '')::integer), 0),
  CURRENT_TIMESTAMP
FROM "ServiceOrder"
WHERE "code" LIKE ('OS-' || EXTRACT(YEAR FROM CURRENT_DATE)::text || '-%');
