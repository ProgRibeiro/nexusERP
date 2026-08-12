ALTER TABLE "ServiceOrder" ADD COLUMN "serviceCategory" TEXT NOT NULL DEFAULT 'GERAL';

UPDATE "ServiceOrder"
SET "serviceCategory" = CASE
  WHEN upper(COALESCE("problemReported", '') || ' ' || COALESCE("type", '')) ~ 'AR CONDICIONADO|CLIMAT|HVAC|PMOC|FAN COIL|VRF' THEN 'CLIMATIZACAO'
  WHEN upper(COALESCE("problemReported", '')) ~ 'REFRIG|CAMARA FRIA|EXPOSITOR' THEN 'REFRIGERACAO'
  WHEN upper(COALESCE("problemReported", '')) ~ 'ILUMIN|LAMPADA|LUMINARIA|DRIVER|REATOR' THEN 'ILUMINACAO'
  WHEN upper(COALESCE("problemReported", '')) ~ 'ELETR|QUADRO|DISJUNTOR|TOMADA|CIRCUITO' THEN 'ELETRICA'
  WHEN upper(COALESCE("problemReported", '')) ~ 'HIDRAUL|VAZAMENTO|TORNEIRA|REGISTRO|TUBULAC|RALO' THEN 'HIDRAULICA'
  WHEN upper(COALESCE("problemReported", '')) ~ 'PINTURA|ALVENARIA|GESSO|PISO|FORRO|CIVIL' THEN 'CIVIL'
  ELSE 'GERAL'
END;

INSERT INTO "FormTemplate" ("id", "code", "name", "description", "category", "assetCategory", "active", "updatedAt") VALUES
  (md5('nx-form-iluminacao')::uuid::text, 'CHECKLIST_ILUMINACAO', 'Atendimento de iluminação', 'Luminárias, lâmpadas, drivers, comandos e iluminação de emergência.', 'ILUMINACAO', 'ILUMINACAO', true, CURRENT_TIMESTAMP),
  (md5('nx-form-hidraulica')::uuid::text, 'CHECKLIST_HIDRAULICA', 'Atendimento hidráulico', 'Tubulações, metais, registros, bombas, drenos e testes de vazamento.', 'HIDRAULICA', 'HIDRAULICA', true, CURRENT_TIMESTAMP),
  (md5('nx-form-civil')::uuid::text, 'CHECKLIST_CIVIL', 'Atendimento civil e acabamentos', 'Pintura, alvenaria, gesso, pisos, forros e acabamento final.', 'CIVIL', 'CIVIL', true, CURRENT_TIMESTAMP),
  (md5('nx-form-refrigeracao')::uuid::text, 'CHECKLIST_REFRIGERACAO', 'Atendimento de refrigeração', 'Câmaras, expositores, compressores, degelo e controle térmico.', 'REFRIGERACAO', 'REFRIGERACAO', true, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "FormVersion" ("id", "templateId", "version", "status", "publishedAt", "updatedAt") VALUES
  (md5('nx-form-iluminacao-v1')::uuid::text, md5('nx-form-iluminacao')::uuid::text, 1, 'PUBLICADO', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('nx-form-hidraulica-v1')::uuid::text, md5('nx-form-hidraulica')::uuid::text, 1, 'PUBLICADO', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('nx-form-civil-v1')::uuid::text, md5('nx-form-civil')::uuid::text, 1, 'PUBLICADO', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('nx-form-refrigeracao-v1')::uuid::text, md5('nx-form-refrigeracao')::uuid::text, 1, 'PUBLICADO', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("templateId", "version") DO NOTHING;

INSERT INTO "FormSection" ("id", "versionId", "title", "description", "position") VALUES
  (md5('nx-form-iluminacao-v1-check')::uuid::text, md5('nx-form-iluminacao-v1')::uuid::text, 'Iluminação e comandos', 'Inspeção do ponto, componentes e teste funcional.', 1),
  (md5('nx-form-hidraulica-v1-check')::uuid::text, md5('nx-form-hidraulica-v1')::uuid::text, 'Sistema hidráulico', 'Inspeção, reparo e teste de estanqueidade.', 1),
  (md5('nx-form-civil-v1-check')::uuid::text, md5('nx-form-civil-v1')::uuid::text, 'Serviço civil e acabamento', 'Preparação, execução, acabamento e liberação da área.', 1),
  (md5('nx-form-refrigeracao-v1-check')::uuid::text, md5('nx-form-refrigeracao-v1')::uuid::text, 'Sistema de refrigeração', 'Componentes, medições, controle e condição final.', 1)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "FormQuestion" ("id", "sectionId", "code", "label", "type", "required", "position", "optionsJson") VALUES
  (md5('ilum-seguranca')::uuid::text, md5('nx-form-iluminacao-v1-check')::uuid::text, 'SEGURANCA', 'Circuito identificado e desenergizado', 'CHECKBOX', true, 1, '[]'),
  (md5('ilum-modelo')::uuid::text, md5('nx-form-iluminacao-v1-check')::uuid::text, 'MODELO', 'Modelo, potência e temperatura de cor registrados', 'CHECKBOX', true, 2, '[]'),
  (md5('ilum-componentes')::uuid::text, md5('nx-form-iluminacao-v1-check')::uuid::text, 'COMPONENTES', 'Lâmpada, driver, reator e conexões verificados', 'CHECKBOX', true, 3, '[]'),
  (md5('ilum-teste')::uuid::text, md5('nx-form-iluminacao-v1-check')::uuid::text, 'TESTE', 'Acionamento e funcionamento testados', 'CHECKBOX', true, 4, '[]'),
  (md5('hid-bloqueio')::uuid::text, md5('nx-form-hidraulica-v1-check')::uuid::text, 'BLOQUEIO', 'Abastecimento isolado antes da intervenção', 'CHECKBOX', true, 1, '[]'),
  (md5('hid-inspecao')::uuid::text, md5('nx-form-hidraulica-v1-check')::uuid::text, 'INSPECAO', 'Tubulações, conexões, registros e vedações inspecionados', 'CHECKBOX', true, 2, '[]'),
  (md5('hid-reparo')::uuid::text, md5('nx-form-hidraulica-v1-check')::uuid::text, 'REPARO', 'Reparo ou substituição executado conforme escopo', 'CHECKBOX', true, 3, '[]'),
  (md5('hid-estanqueidade')::uuid::text, md5('nx-form-hidraulica-v1-check')::uuid::text, 'ESTANQUEIDADE', 'Teste de estanqueidade e escoamento concluído', 'CHECKBOX', true, 4, '[]'),
  (md5('civil-protecao')::uuid::text, md5('nx-form-civil-v1-check')::uuid::text, 'PROTECAO', 'Área isolada e mobiliário protegido', 'CHECKBOX', true, 1, '[]'),
  (md5('civil-preparo')::uuid::text, md5('nx-form-civil-v1-check')::uuid::text, 'PREPARO', 'Superfície preparada e especificações conferidas', 'CHECKBOX', true, 2, '[]'),
  (md5('civil-execucao')::uuid::text, md5('nx-form-civil-v1-check')::uuid::text, 'EXECUCAO', 'Serviço executado conforme escopo', 'CHECKBOX', true, 3, '[]'),
  (md5('civil-acabamento')::uuid::text, md5('nx-form-civil-v1-check')::uuid::text, 'ACABAMENTO', 'Acabamento, limpeza e liberação conferidos', 'CHECKBOX', true, 4, '[]'),
  (md5('refrig-identificacao')::uuid::text, md5('nx-form-refrigeracao-v1-check')::uuid::text, 'IDENTIFICACAO', 'Equipamento e temperatura de ajuste registrados', 'CHECKBOX', true, 1, '[]'),
  (md5('refrig-componentes')::uuid::text, md5('nx-form-refrigeracao-v1-check')::uuid::text, 'COMPONENTES', 'Evaporador, condensador, compressor e ventiladores verificados', 'CHECKBOX', true, 2, '[]'),
  (md5('refrig-controle')::uuid::text, md5('nx-form-refrigeracao-v1-check')::uuid::text, 'CONTROLE', 'Degelo, sensores, controlador e alarmes testados', 'CHECKBOX', true, 3, '[]'),
  (md5('refrig-teste')::uuid::text, md5('nx-form-refrigeracao-v1-check')::uuid::text, 'TESTE', 'Medições e teste funcional registrados', 'CHECKBOX', true, 4, '[]')
ON CONFLICT ("sectionId", "code") DO NOTHING;
