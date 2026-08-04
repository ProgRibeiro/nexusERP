-- Formulários de campo versionados. A estrutura antiga em checklistJson é
-- mantida para compatibilidade e passa a receber um espelho das respostas.

CREATE TABLE "FormTemplate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'GERAL',
    "serviceType" TEXT,
    "assetCategory" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FormTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FormVersion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FormVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FormSection" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "FormSection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FormQuestion" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "helpText" TEXT,
    "type" TEXT NOT NULL DEFAULT 'CHECKBOX',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "optionsJson" TEXT NOT NULL DEFAULT '[]',
    "measurementDefinitionId" TEXT,
    CONSTRAINT "FormQuestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FormSubmission" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "submittedById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FormSubmission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FormAnswer" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "valueText" TEXT,
    "valueNumber" DOUBLE PRECISION,
    "valueBoolean" BOOLEAN,
    "valueJson" TEXT,
    "notApplicable" BOOLEAN NOT NULL DEFAULT false,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FormAnswer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FormTemplate_code_key" ON "FormTemplate"("code");
CREATE UNIQUE INDEX "FormVersion_templateId_version_key" ON "FormVersion"("templateId", "version");
CREATE INDEX "FormVersion_status_publishedAt_idx" ON "FormVersion"("status", "publishedAt");
CREATE INDEX "FormSection_versionId_position_idx" ON "FormSection"("versionId", "position");
CREATE UNIQUE INDEX "FormQuestion_sectionId_code_key" ON "FormQuestion"("sectionId", "code");
CREATE INDEX "FormQuestion_sectionId_position_idx" ON "FormQuestion"("sectionId", "position");
CREATE INDEX "FormQuestion_measurementDefinitionId_idx" ON "FormQuestion"("measurementDefinitionId");
CREATE UNIQUE INDEX "FormSubmission_visitId_versionId_key" ON "FormSubmission"("visitId", "versionId");
CREATE INDEX "FormSubmission_serviceOrderId_status_idx" ON "FormSubmission"("serviceOrderId", "status");
CREATE INDEX "FormSubmission_submittedById_updatedAt_idx" ON "FormSubmission"("submittedById", "updatedAt");
CREATE UNIQUE INDEX "FormAnswer_submissionId_questionId_key" ON "FormAnswer"("submissionId", "questionId");
CREATE INDEX "FormAnswer_questionId_idx" ON "FormAnswer"("questionId");

ALTER TABLE "FormVersion" ADD CONSTRAINT "FormVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "FormTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FormSection" ADD CONSTRAINT "FormSection_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "FormVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FormQuestion" ADD CONSTRAINT "FormQuestion_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "FormSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FormQuestion" ADD CONSTRAINT "FormQuestion_measurementDefinitionId_fkey" FOREIGN KEY ("measurementDefinitionId") REFERENCES "MeasurementDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "FormVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "ServiceVisit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FormAnswer" ADD CONSTRAINT "FormAnswer_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "FormSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FormAnswer" ADD CONSTRAINT "FormAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "FormQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Modelos iniciais publicados. Os IDs determinísticos permitem repetir a
-- lógica com segurança em restaurações e ambientes Linux novos.
INSERT INTO "FormTemplate" ("id", "code", "name", "description", "category", "assetCategory", "active", "updatedAt") VALUES
  (md5('nx-form-hvac')::uuid::text, 'CHECKLIST_HVAC', 'Atendimento HVAC/R', 'Inspeção, higienização, diagnóstico e medições de climatização e refrigeração.', 'HVAC', 'CLIMATIZACAO', true, CURRENT_TIMESTAMP),
  (md5('nx-form-eletrica')::uuid::text, 'CHECKLIST_ELETRICA', 'Atendimento elétrico', 'Segurança, quadro, conexões, proteção e medições elétricas.', 'ELETRICA', 'ELETRICA', true, CURRENT_TIMESTAMP),
  (md5('nx-form-geral')::uuid::text, 'CHECKLIST_GERAL', 'Atendimento técnico geral', 'Verificação operacional aplicável a serviços sem categoria técnica específica.', 'GERAL', NULL, true, CURRENT_TIMESTAMP);

INSERT INTO "FormVersion" ("id", "templateId", "version", "status", "publishedAt", "updatedAt") VALUES
  (md5('nx-form-hvac-v1')::uuid::text, md5('nx-form-hvac')::uuid::text, 1, 'PUBLICADO', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('nx-form-eletrica-v1')::uuid::text, md5('nx-form-eletrica')::uuid::text, 1, 'PUBLICADO', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('nx-form-geral-v1')::uuid::text, md5('nx-form-geral')::uuid::text, 1, 'PUBLICADO', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "FormSection" ("id", "versionId", "title", "description", "position") VALUES
  (md5('nx-form-hvac-v1-seguranca')::uuid::text, md5('nx-form-hvac-v1')::uuid::text, 'Segurança e inspeção inicial', 'Confirme as condições antes da intervenção.', 1),
  (md5('nx-form-hvac-v1-servico')::uuid::text, md5('nx-form-hvac-v1')::uuid::text, 'Sistema de climatização', 'Verificações do equipamento e do ambiente.', 2),
  (md5('nx-form-hvac-v1-medicoes')::uuid::text, md5('nx-form-hvac-v1')::uuid::text, 'Medições', 'Registre valores aferidos com instrumentos.', 3),
  (md5('nx-form-eletrica-v1-seguranca')::uuid::text, md5('nx-form-eletrica-v1')::uuid::text, 'Segurança elétrica', 'Confirmações obrigatórias antes de abrir o quadro.', 1),
  (md5('nx-form-eletrica-v1-quadro')::uuid::text, md5('nx-form-eletrica-v1')::uuid::text, 'Quadro e circuitos', 'Inspeção dos componentes, conexões e identificação.', 2),
  (md5('nx-form-eletrica-v1-medicoes')::uuid::text, md5('nx-form-eletrica-v1')::uuid::text, 'Medições elétricas', 'Valores aferidos no circuito atendido.', 3),
  (md5('nx-form-geral-v1-inspecao')::uuid::text, md5('nx-form-geral-v1')::uuid::text, 'Inspeção e execução', 'Confirmações mínimas para qualquer atendimento.', 1);

INSERT INTO "FormQuestion" ("id", "sectionId", "code", "label", "helpText", "type", "required", "position", "optionsJson", "measurementDefinitionId") VALUES
  (md5('hvac-seg-desenergizado')::uuid::text, md5('nx-form-hvac-v1-seguranca')::uuid::text, 'DESENERGIZADO', 'Equipamento desligado e desenergizado', NULL, 'CHECKBOX', true, 1, '[]', NULL),
  (md5('hvac-seg-inspecao')::uuid::text, md5('nx-form-hvac-v1-seguranca')::uuid::text, 'INSPECAO_VISUAL', 'Inspeção visual e condição de acesso registradas', NULL, 'CHECKBOX', true, 2, '[]', NULL),
  (md5('hvac-serv-filtros')::uuid::text, md5('nx-form-hvac-v1-servico')::uuid::text, 'FILTROS', 'Filtros e serpentinas verificados ou higienizados', NULL, 'CHECKBOX', true, 1, '[]', NULL),
  (md5('hvac-serv-dreno')::uuid::text, md5('nx-form-hvac-v1-servico')::uuid::text, 'DRENO', 'Dreno e bandeja sem obstrução ou vazamento', NULL, 'CHECKBOX', true, 2, '[]', NULL),
  (md5('hvac-serv-vazamento')::uuid::text, md5('nx-form-hvac-v1-servico')::uuid::text, 'VAZAMENTO', 'Teste de vazamento executado', NULL, 'CHECKBOX', true, 3, '[]', NULL),
  (md5('hvac-serv-condicao')::uuid::text, md5('nx-form-hvac-v1-servico')::uuid::text, 'CONDICAO_FINAL', 'Condição final do equipamento', NULL, 'SELECT', true, 4, '["OPERACIONAL","OPERACIONAL_COM_RESSALVA","INOPERANTE"]', NULL),
  (md5('hvac-med-tensao')::uuid::text, md5('nx-form-hvac-v1-medicoes')::uuid::text, 'TENSAO', 'Tensão elétrica', NULL, 'MEASUREMENT', false, 1, '[]', (SELECT "id" FROM "MeasurementDefinition" WHERE "code" = 'TENSAO')),
  (md5('hvac-med-corrente')::uuid::text, md5('nx-form-hvac-v1-medicoes')::uuid::text, 'CORRENTE', 'Corrente elétrica', NULL, 'MEASUREMENT', false, 2, '[]', (SELECT "id" FROM "MeasurementDefinition" WHERE "code" = 'CORRENTE')),
  (md5('hvac-med-pressao')::uuid::text, md5('nx-form-hvac-v1-medicoes')::uuid::text, 'PRESSAO', 'Pressão do sistema', NULL, 'MEASUREMENT', false, 3, '[]', (SELECT "id" FROM "MeasurementDefinition" WHERE "code" = 'PRESSAO')),
  (md5('hvac-med-temp')::uuid::text, md5('nx-form-hvac-v1-medicoes')::uuid::text, 'TEMPERATURA', 'Temperatura de insuflamento', NULL, 'MEASUREMENT', false, 4, '[]', (SELECT "id" FROM "MeasurementDefinition" WHERE "code" = 'TEMPERATURA')),
  (md5('eletrica-seg-desenergizado')::uuid::text, md5('nx-form-eletrica-v1-seguranca')::uuid::text, 'DESENERGIZADO', 'Circuito desenergizado e ausência de tensão confirmada', NULL, 'CHECKBOX', true, 1, '[]', NULL),
  (md5('eletrica-seg-epi')::uuid::text, md5('nx-form-eletrica-v1-seguranca')::uuid::text, 'EPI', 'EPI e ferramentas isoladas conferidos', NULL, 'CHECKBOX', true, 2, '[]', NULL),
  (md5('eletrica-quadro-aperto')::uuid::text, md5('nx-form-eletrica-v1-quadro')::uuid::text, 'APERTO', 'Conexões e barramentos inspecionados', NULL, 'CHECKBOX', true, 1, '[]', NULL),
  (md5('eletrica-quadro-protecao')::uuid::text, md5('nx-form-eletrica-v1-quadro')::uuid::text, 'PROTECAO', 'Disjuntores, DR e DPS verificados', NULL, 'CHECKBOX', true, 2, '[]', NULL),
  (md5('eletrica-quadro-id')::uuid::text, md5('nx-form-eletrica-v1-quadro')::uuid::text, 'IDENTIFICACAO', 'Circuitos identificados e quadro sem aquecimento anormal', NULL, 'CHECKBOX', true, 3, '[]', NULL),
  (md5('eletrica-med-tensao')::uuid::text, md5('nx-form-eletrica-v1-medicoes')::uuid::text, 'TENSAO', 'Tensão medida', NULL, 'MEASUREMENT', true, 1, '[]', (SELECT "id" FROM "MeasurementDefinition" WHERE "code" = 'TENSAO')),
  (md5('eletrica-med-corrente')::uuid::text, md5('nx-form-eletrica-v1-medicoes')::uuid::text, 'CORRENTE', 'Corrente medida', NULL, 'MEASUREMENT', false, 2, '[]', (SELECT "id" FROM "MeasurementDefinition" WHERE "code" = 'CORRENTE')),
  (md5('geral-inspecao')::uuid::text, md5('nx-form-geral-v1-inspecao')::uuid::text, 'INSPECAO', 'Inspeção visual do local e do item atendido realizada', NULL, 'CHECKBOX', true, 1, '[]', NULL),
  (md5('geral-execucao')::uuid::text, md5('nx-form-geral-v1-inspecao')::uuid::text, 'EXECUCAO', 'Serviço executado e área deixada em condição segura', NULL, 'CHECKBOX', true, 2, '[]', NULL),
  (md5('geral-condicao')::uuid::text, md5('nx-form-geral-v1-inspecao')::uuid::text, 'CONDICAO_FINAL', 'Condição final', NULL, 'SELECT', true, 3, '["OPERACIONAL","OPERACIONAL_COM_RESSALVA","INOPERANTE"]', NULL),
  (md5('geral-observacao')::uuid::text, md5('nx-form-geral-v1-inspecao')::uuid::text, 'OBSERVACAO', 'Observações adicionais', NULL, 'LONG_TEXT', false, 4, '[]', NULL);

-- Cada visita existente recebe um rascunho do modelo mais adequado. O campo
-- legado continua intacto e será espelhado quando a submissão for concluída.
INSERT INTO "FormSubmission" (
  "id", "versionId", "serviceOrderId", "visitId", "status", "startedAt", "createdAt", "updatedAt"
)
SELECT
  md5(sv."id" || ':default-form')::uuid::text,
  CASE
    WHEN upper(COALESCE(so."type", '')) LIKE '%ELETR%' THEN md5('nx-form-eletrica-v1')::uuid::text
    WHEN upper(COALESCE(sa."category", '')) IN ('ELETRICA', 'ILUMINACAO') THEN md5('nx-form-eletrica-v1')::uuid::text
    WHEN upper(COALESCE(sa."category", '')) IN ('CLIMATIZACAO', 'REFRIGERACAO', 'HVAC') THEN md5('nx-form-hvac-v1')::uuid::text
    WHEN upper(COALESCE(so."type", '')) IN ('PREVENTIVA', 'PMOC') THEN md5('nx-form-hvac-v1')::uuid::text
    ELSE md5('nx-form-geral-v1')::uuid::text
  END,
  so."id",
  sv."id",
  'RASCUNHO',
  sv."createdAt",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "ServiceVisit" sv
JOIN "ServiceOrder" so ON so."id" = sv."serviceOrderId"
LEFT JOIN "StoreAsset" sa ON sa."id" = so."storeAssetId";
