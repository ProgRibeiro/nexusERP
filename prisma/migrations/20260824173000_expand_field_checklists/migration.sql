-- Publica a segunda geração dos formulários de campo. Cada disciplina passa a
-- possuir quatro etapas, respostas Conforme/Não conforme/Não aplicável,
-- observações por etapa e medições estruturadas quando aplicáveis.

-- As tabelas de formulários são protegidas por RLS. A migração declara o
-- tenant operacional explicitamente durante esta sessão e o remove ao final.
SELECT set_config('app.tenant_id', '00000000-0000-4000-8000-000000000001', false);

INSERT INTO "FormTemplate" ("id", "code", "name", "description", "category", "assetCategory", "active", "updatedAt", "tenantId") VALUES
  (md5('nx-form-hvac-v2'), 'CHECKLIST_HVAC', 'Preventiva completa de climatização e PMOC', 'Segurança, cadastro, higienização, componentes, medições, teste final e atualização do PMOC.', 'HVAC', 'CLIMATIZACAO', true, CURRENT_TIMESTAMP, '00000000-0000-4000-8000-000000000001'::uuid),
  (md5('nx-form-refrigeracao-v2'), 'CHECKLIST_REFRIGERACAO', 'Preventiva completa de refrigeração', 'Câmaras, expositores, circuito frigorífico, degelo, controles, temperaturas e condição operacional.', 'REFRIGERACAO', 'REFRIGERACAO', true, CURRENT_TIMESTAMP, '00000000-0000-4000-8000-000000000001'::uuid),
  (md5('nx-form-eletrica-v2'), 'CHECKLIST_ELETRICA', 'Preventiva completa elétrica e de quadros', 'Segurança, quadros, componentes, proteções, termografia, medições e recomposição.', 'ELETRICA', 'ELETRICA', true, CURRENT_TIMESTAMP, '00000000-0000-4000-8000-000000000001'::uuid),
  (md5('nx-form-iluminacao-v2'), 'CHECKLIST_ILUMINACAO', 'Preventiva completa de iluminação', 'Pontos de luz, comandos, sensores, emergência, medições e entrega.', 'ILUMINACAO', 'ILUMINACAO', true, CURRENT_TIMESTAMP, '00000000-0000-4000-8000-000000000001'::uuid),
  (md5('nx-form-hidraulica-v2'), 'CHECKLIST_HIDRAULICA', 'Preventiva completa hidráulica e sanitária', 'Redes, componentes, bombas, reservatórios, drenagem, estanqueidade e liberação.', 'HIDRAULICA', 'HIDRAULICA', true, CURRENT_TIMESTAMP, '00000000-0000-4000-8000-000000000001'::uuid),
  (md5('nx-form-civil-v2'), 'CHECKLIST_CIVIL', 'Preventiva completa civil e predial', 'Estrutura aparente, envoltória, acabamentos, acessibilidade, execução e entrega.', 'CIVIL', 'CIVIL', true, CURRENT_TIMESTAMP, '00000000-0000-4000-8000-000000000001'::uuid),
  (md5('nx-form-incendio-v2'), 'CHECKLIST_INCENDIO', 'Preventiva completa de combate a incêndio', 'Extintores, hidrantes, bombas, alarme, iluminação, sinalização, rotas e regularização.', 'INCENDIO', 'INCENDIO', true, CURRENT_TIMESTAMP, '00000000-0000-4000-8000-000000000001'::uuid),
  (md5('nx-form-geral-v2'), 'CHECKLIST_GERAL', 'Checklist técnico multidisciplinar completo', 'Preparação, inspeção, execução, testes, evidências, pendências e aceite.', 'GERAL', NULL, true, CURRENT_TIMESTAMP, '00000000-0000-4000-8000-000000000001'::uuid)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "category" = EXCLUDED."category",
  "assetCategory" = EXCLUDED."assetCategory",
  "active" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "FormVersion" ("id", "templateId", "version", "status", "publishedAt", "updatedAt", "tenantId")
SELECT md5(template."code" || ':v2'), template."id", 2, 'PUBLICADO', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, template."tenantId"
FROM "FormTemplate" template
WHERE template."code" IN ('CHECKLIST_HVAC', 'CHECKLIST_REFRIGERACAO', 'CHECKLIST_ELETRICA', 'CHECKLIST_ILUMINACAO', 'CHECKLIST_HIDRAULICA', 'CHECKLIST_CIVIL', 'CHECKLIST_INCENDIO', 'CHECKLIST_GERAL')
ON CONFLICT ("templateId", "version") DO UPDATE SET
  "status" = 'PUBLICADO',
  "publishedAt" = CURRENT_TIMESTAMP,
  "updatedAt" = CURRENT_TIMESTAMP;

WITH section_data("position", "title", "description") AS (VALUES
  (1, 'Segurança e identificação', 'Confirme autorização, riscos, isolamento, acesso, ativo e condição inicial.'),
  (2, 'Inspeção técnica e componentes', 'Avalie todos os sistemas e componentes previstos no escopo.'),
  (3, 'Medições, testes e desempenho', 'Registre testes funcionais, valores aferidos e anomalias encontradas.'),
  (4, 'Resultado, evidências e liberação', 'Classifique o resultado, registre pendências e libere a área com segurança.')
)
INSERT INTO "FormSection" ("id", "versionId", "title", "description", "position", "tenantId")
SELECT md5(template."code" || ':v2:section:' || section_data."position"), version."id", section_data."title", section_data."description", section_data."position", version."tenantId"
FROM "FormTemplate" template
JOIN "FormVersion" version ON version."templateId" = template."id" AND version."version" = 2
CROSS JOIN section_data
WHERE template."code" IN ('CHECKLIST_HVAC', 'CHECKLIST_REFRIGERACAO', 'CHECKLIST_ELETRICA', 'CHECKLIST_ILUMINACAO', 'CHECKLIST_HIDRAULICA', 'CHECKLIST_CIVIL', 'CHECKLIST_INCENDIO', 'CHECKLIST_GERAL')
ON CONFLICT ("id") DO UPDATE SET
  "title" = EXCLUDED."title",
  "description" = EXCLUDED."description",
  "position" = EXCLUDED."position";

WITH question_data("templateCode", "sectionPosition", "position", "label") AS (VALUES
  ('CHECKLIST_HVAC', 1, 1, 'Área autorizada, isolada e com acesso seguro'),
  ('CHECKLIST_HVAC', 1, 2, 'Equipamento desligado e desenergizado antes da intervenção'),
  ('CHECKLIST_HVAC', 1, 3, 'TAG, fabricante, modelo, capacidade, série e localização registrados'),
  ('CHECKLIST_HVAC', 2, 1, 'Filtros, serpentinas, turbina, ventiladores e carenagens verificados'),
  ('CHECKLIST_HVAC', 2, 2, 'Bandeja, dreno e bomba de condensado limpos e testados'),
  ('CHECKLIST_HVAC', 2, 3, 'Tubulações, isolamento térmico, fixações, ruído e vibração inspecionados'),
  ('CHECKLIST_HVAC', 3, 1, 'Bornes, cabos, contatores, capacitores e proteções inspecionados'),
  ('CHECKLIST_HVAC', 3, 2, 'Temperaturas, tensão e corrente registradas'),
  ('CHECKLIST_HVAC', 3, 3, 'Controles, termostatos, sensores e circuito frigorífico testados'),
  ('CHECKLIST_HVAC', 4, 1, 'Teste funcional final executado sem vazamento ou anomalia crítica'),
  ('CHECKLIST_HVAC', 4, 2, 'Anomalias, criticidade e ações recomendadas registradas'),
  ('CHECKLIST_HVAC', 4, 3, 'Histórico individual e informações do PMOC atualizados'),

  ('CHECKLIST_REFRIGERACAO', 1, 1, 'Área isolada e condição de segurança elétrica confirmada'),
  ('CHECKLIST_REFRIGERACAO', 1, 2, 'TAG, modelo, série, fluido e temperatura de ajuste registrados'),
  ('CHECKLIST_REFRIGERACAO', 1, 3, 'Temperaturas iniciais do produto, ambiente e equipamento registradas'),
  ('CHECKLIST_REFRIGERACAO', 2, 1, 'Portas, dobradiças, cortinas, puxadores e vedações inspecionados'),
  ('CHECKLIST_REFRIGERACAO', 2, 2, 'Evaporador, condensador, filtros, bandeja e dreno higienizados'),
  ('CHECKLIST_REFRIGERACAO', 2, 3, 'Ventiladores, motores, hélices, isolamento e formação de gelo avaliados'),
  ('CHECKLIST_REFRIGERACAO', 3, 1, 'Compressor, tubulações e indícios de vazamento inspecionados'),
  ('CHECKLIST_REFRIGERACAO', 3, 2, 'Degelo, termostatos, pressostatos, sensores e controladores testados'),
  ('CHECKLIST_REFRIGERACAO', 3, 3, 'Painéis, contatores, relés, proteções e alarmes conferidos'),
  ('CHECKLIST_REFRIGERACAO', 4, 1, 'Temperatura estabilizada e condição operacional confirmada'),
  ('CHECKLIST_REFRIGERACAO', 4, 2, 'Riscos para produtos, anomalias e recomendações registrados'),
  ('CHECKLIST_REFRIGERACAO', 4, 3, 'Área limpa e equipamento liberado ao responsável'),

  ('CHECKLIST_ELETRICA', 1, 1, 'Autorização, EPI, EPC, ferramentas e delimitação conferidos'),
  ('CHECKLIST_ELETRICA', 1, 2, 'Fontes identificadas, circuito desenergizado e ausência de tensão confirmada'),
  ('CHECKLIST_ELETRICA', 1, 3, 'Quadro, tensão nominal, alimentação e diagrama registrados'),
  ('CHECKLIST_ELETRICA', 2, 1, 'Invólucro, barreiras, limpeza, umidade e identificação inspecionados'),
  ('CHECKLIST_ELETRICA', 2, 2, 'Cabos, terminais, barramentos e isoladores sem dano aparente'),
  ('CHECKLIST_ELETRICA', 2, 3, 'Conexões conferidas e reaperto técnico realizado quando aplicável'),
  ('CHECKLIST_ELETRICA', 3, 1, 'Disjuntores, fusíveis, DR, DPS, relés e sinalizações testados'),
  ('CHECKLIST_ELETRICA', 3, 2, 'Tensões, correntes e balanceamento de fases registrados'),
  ('CHECKLIST_ELETRICA', 3, 3, 'Aterramento e inspeção termográfica avaliados'),
  ('CHECKLIST_ELETRICA', 4, 1, 'Tampas, barreiras e proteções recompostas corretamente'),
  ('CHECKLIST_ELETRICA', 4, 2, 'Circuitos energizados e cargas testadas com segurança'),
  ('CHECKLIST_ELETRICA', 4, 3, 'Anomalias, temperatura, criticidade e recomendação registradas'),

  ('CHECKLIST_ILUMINACAO', 1, 1, 'Ambiente, circuito, comando e tipo de luminária identificados'),
  ('CHECKLIST_ILUMINACAO', 1, 2, 'Desenergização e acesso seguro em altura confirmados'),
  ('CHECKLIST_ILUMINACAO', 1, 3, 'Fabricante, modelo, potência, temperatura de cor e soquete registrados'),
  ('CHECKLIST_ILUMINACAO', 2, 1, 'Lâmpadas, luminárias, difusores, drivers e conexões inspecionados'),
  ('CHECKLIST_ILUMINACAO', 2, 2, 'Fixação, limpeza, oxidação, aquecimento e entrada de água avaliados'),
  ('CHECKLIST_ILUMINACAO', 2, 3, 'Interruptores, contatores, sensores, temporizadores e automação conferidos'),
  ('CHECKLIST_ILUMINACAO', 3, 1, 'Iluminação e sinalização de emergência testadas'),
  ('CHECKLIST_ILUMINACAO', 3, 2, 'Bateria e autonomia aparente verificadas'),
  ('CHECKLIST_ILUMINACAO', 3, 3, 'Tensão, acionamento, uniformidade e pontos intermitentes avaliados'),
  ('CHECKLIST_ILUMINACAO', 4, 1, 'Componentes aplicados possuem especificação compatível'),
  ('CHECKLIST_ILUMINACAO', 4, 2, 'Acionamento final e pontos normalizados testados'),
  ('CHECKLIST_ILUMINACAO', 4, 3, 'Pendências, quantidade, localização e criticidade registradas'),

  ('CHECKLIST_HIDRAULICA', 1, 1, 'Sistema, ponto e registro de bloqueio identificados'),
  ('CHECKLIST_HIDRAULICA', 1, 2, 'Área isolada e abastecimento bloqueado com segurança'),
  ('CHECKLIST_HIDRAULICA', 1, 3, 'Condição inicial, vazamentos e sinais de umidade registrados'),
  ('CHECKLIST_HIDRAULICA', 2, 1, 'Tubulações, conexões, flexíveis, sifões, vedações e suportes inspecionados'),
  ('CHECKLIST_HIDRAULICA', 2, 2, 'Torneiras, válvulas, registros, boias, louças e metais testados'),
  ('CHECKLIST_HIDRAULICA', 2, 3, 'Bombas, pressurizadores, comandos, ruídos e vibrações avaliados'),
  ('CHECKLIST_HIDRAULICA', 3, 1, 'Reservatórios, tampas, extravasores, nível e acesso inspecionados'),
  ('CHECKLIST_HIDRAULICA', 3, 2, 'Ralos, caixas sifonadas, esgoto e drenagem pluvial verificados'),
  ('CHECKLIST_HIDRAULICA', 3, 3, 'Pressão, vazão, estanqueidade e funcionamento final testados'),
  ('CHECKLIST_HIDRAULICA', 4, 1, 'Abastecimento reaberto sem vazamento aparente'),
  ('CHECKLIST_HIDRAULICA', 4, 2, 'Anomalias ocultas suspeitas, danos e ações recomendadas registrados'),
  ('CHECKLIST_HIDRAULICA', 4, 3, 'Área higienizada e liberada ao responsável'),

  ('CHECKLIST_CIVIL', 1, 1, 'Área isolada e mobiliário, piso e circulação protegidos'),
  ('CHECKLIST_CIVIL', 1, 2, 'Ambiente, dimensões, substrato, acabamento e condição inicial registrados'),
  ('CHECKLIST_CIVIL', 1, 3, 'Acesso em altura e risco de queda de materiais avaliados'),
  ('CHECKLIST_CIVIL', 2, 1, 'Fissuras, trincas, deformações e sinais de movimentação mapeados'),
  ('CHECKLIST_CIVIL', 2, 2, 'Infiltração, umidade, eflorescência, mofo e origem aparente avaliados'),
  ('CHECKLIST_CIVIL', 2, 3, 'Cobertura, fachada, revestimentos, juntas e selantes inspecionados'),
  ('CHECKLIST_CIVIL', 3, 1, 'Pisos, paredes, divisórias, forros e esquadrias inspecionados'),
  ('CHECKLIST_CIVIL', 3, 2, 'Corrimãos, guarda-corpos, rampas e acessibilidade verificados'),
  ('CHECKLIST_CIVIL', 3, 3, 'Materiais, alinhamento, nível, cobertura e acabamento conferidos'),
  ('CHECKLIST_CIVIL', 4, 1, 'Tempo de cura ou secagem e condição final respeitados'),
  ('CHECKLIST_CIVIL', 4, 2, 'Mapa de anomalias, pendências e criticidades registrado'),
  ('CHECKLIST_CIVIL', 4, 3, 'Resíduos removidos e área liberada com segurança'),

  ('CHECKLIST_INCENDIO', 1, 1, 'Planta, registros anteriores e validade documental conferidos'),
  ('CHECKLIST_INCENDIO', 1, 2, 'Acesso aos equipamentos e rotas de abandono livres'),
  ('CHECKLIST_INCENDIO', 1, 3, 'Responsável local informado sobre testes e condições críticas'),
  ('CHECKLIST_INCENDIO', 2, 1, 'Extintores conferidos quanto a classe, lacre, manômetro, validade e sinalização'),
  ('CHECKLIST_INCENDIO', 2, 2, 'Hidrantes, abrigos, registros, esguichos, chaves e mangueiras inspecionados'),
  ('CHECKLIST_INCENDIO', 2, 3, 'Bombas, comandos, pressurização, reserva e válvulas verificadas'),
  ('CHECKLIST_INCENDIO', 3, 1, 'Central, acionadores, detectores, sirenes e sinalizadores testados'),
  ('CHECKLIST_INCENDIO', 3, 2, 'Iluminação de emergência e autonomia aparente testadas'),
  ('CHECKLIST_INCENDIO', 3, 3, 'Sinalização, rotas, portas corta-fogo e barras antipânico verificadas'),
  ('CHECKLIST_INCENDIO', 4, 1, 'Vencimentos, ausências, avarias e não conformidades registrados'),
  ('CHECKLIST_INCENDIO', 4, 2, 'Risco classificado e ação corretiva com prazo definida'),
  ('CHECKLIST_INCENDIO', 4, 3, 'Condições críticas comunicadas formalmente ao responsável'),

  ('CHECKLIST_GERAL', 1, 1, 'Escopo, autorização e responsável pelo acompanhamento confirmados'),
  ('CHECKLIST_GERAL', 1, 2, 'Análise de risco, isolamento e condições seguras confirmados'),
  ('CHECKLIST_GERAL', 1, 3, 'Local, ativo, identificação e condição inicial registrados'),
  ('CHECKLIST_GERAL', 2, 1, 'Integridade, fixação, limpeza, desgaste e sinais de falha inspecionados'),
  ('CHECKLIST_GERAL', 2, 2, 'Riscos para pessoas, operação, patrimônio e continuidade identificados'),
  ('CHECKLIST_GERAL', 2, 3, 'Materiais, ferramentas e componentes conferidos'),
  ('CHECKLIST_GERAL', 3, 1, 'Serviço executado conforme escopo e procedimento aplicável'),
  ('CHECKLIST_GERAL', 3, 2, 'Medições, alterações e materiais utilizados registrados'),
  ('CHECKLIST_GERAL', 3, 3, 'Teste funcional e condição operacional confirmados'),
  ('CHECKLIST_GERAL', 4, 1, 'Fotos finais e evidências da execução registradas'),
  ('CHECKLIST_GERAL', 4, 2, 'Pendências classificadas com ação, responsável e prazo'),
  ('CHECKLIST_GERAL', 4, 3, 'Área limpa, proteções recompostas e responsável informado')
), version_data AS (
  SELECT template."code", version."id" AS "versionId"
  FROM "FormTemplate" template
  JOIN "FormVersion" version ON version."templateId" = template."id" AND version."version" = 2
)
INSERT INTO "FormQuestion" ("id", "sectionId", "code", "label", "helpText", "type", "required", "position", "optionsJson", "measurementDefinitionId", "tenantId")
SELECT
  md5(question_data."templateCode" || ':v2:' || question_data."sectionPosition" || ':' || question_data."position"),
  section."id",
  'ITEM_' || lpad(question_data."position"::text, 2, '0'),
  question_data."label",
  'Selecione Não conforme quando houver desvio e descreva a condição na observação da etapa.',
  'SELECT',
  true,
  question_data."position",
  '["CONFORME","NAO_CONFORME","NAO_APLICAVEL"]',
  NULL,
  section."tenantId"
FROM question_data
JOIN version_data ON version_data."code" = question_data."templateCode"
JOIN "FormSection" section ON section."versionId" = version_data."versionId" AND section."position" = question_data."sectionPosition"
ON CONFLICT ("sectionId", "code") DO UPDATE SET
  "label" = EXCLUDED."label",
  "helpText" = EXCLUDED."helpText",
  "type" = EXCLUDED."type",
  "required" = EXCLUDED."required",
  "optionsJson" = EXCLUDED."optionsJson";

-- Toda etapa possui campo livre para localização, valor observado, risco e ação.
INSERT INTO "FormQuestion" ("id", "sectionId", "code", "label", "helpText", "type", "required", "position", "optionsJson", "measurementDefinitionId", "tenantId")
SELECT
  md5(section."id" || ':observacoes'),
  section."id",
  'OBSERVACOES',
  'Observações, não conformidades e ações recomendadas',
  'Informe localização, condição encontrada, risco, providência, responsável e prazo quando aplicável.',
  'LONG_TEXT',
  false,
  90,
  '[]',
  NULL,
  section."tenantId"
FROM "FormSection" section
JOIN "FormVersion" version ON version."id" = section."versionId" AND version."version" = 2
JOIN "FormTemplate" template ON template."id" = version."templateId"
WHERE template."code" IN ('CHECKLIST_HVAC', 'CHECKLIST_REFRIGERACAO', 'CHECKLIST_ELETRICA', 'CHECKLIST_ILUMINACAO', 'CHECKLIST_HIDRAULICA', 'CHECKLIST_CIVIL', 'CHECKLIST_INCENDIO', 'CHECKLIST_GERAL')
ON CONFLICT ("sectionId", "code") DO UPDATE SET
  "label" = EXCLUDED."label",
  "helpText" = EXCLUDED."helpText",
  "type" = EXCLUDED."type",
  "position" = EXCLUDED."position";

-- Medições principais permanecem estruturadas e alimentam o histórico do ativo.
WITH measurement_data("templateCode", "sectionPosition", "position", "code", "label", "definitionCode") AS (VALUES
  ('CHECKLIST_HVAC', 3, 20, 'TENSAO', 'Tensão elétrica aferida', 'TENSAO'),
  ('CHECKLIST_HVAC', 3, 21, 'CORRENTE', 'Corrente elétrica aferida', 'CORRENTE'),
  ('CHECKLIST_HVAC', 3, 22, 'PRESSAO', 'Pressão do sistema aferida', 'PRESSAO'),
  ('CHECKLIST_HVAC', 3, 23, 'TEMPERATURA', 'Temperatura de insuflamento aferida', 'TEMPERATURA'),
  ('CHECKLIST_REFRIGERACAO', 3, 20, 'TENSAO', 'Tensão elétrica aferida', 'TENSAO'),
  ('CHECKLIST_REFRIGERACAO', 3, 21, 'CORRENTE', 'Corrente do compressor aferida', 'CORRENTE'),
  ('CHECKLIST_REFRIGERACAO', 3, 22, 'PRESSAO', 'Pressão do circuito aferida', 'PRESSAO'),
  ('CHECKLIST_REFRIGERACAO', 3, 23, 'TEMPERATURA', 'Temperatura operacional aferida', 'TEMPERATURA'),
  ('CHECKLIST_ELETRICA', 3, 20, 'TENSAO', 'Tensão elétrica aferida', 'TENSAO'),
  ('CHECKLIST_ELETRICA', 3, 21, 'CORRENTE', 'Corrente elétrica aferida', 'CORRENTE'),
  ('CHECKLIST_ILUMINACAO', 3, 20, 'TENSAO', 'Tensão no ponto aferida', 'TENSAO')
), version_data AS (
  SELECT template."code", version."id" AS "versionId"
  FROM "FormTemplate" template
  JOIN "FormVersion" version ON version."templateId" = template."id" AND version."version" = 2
)
INSERT INTO "FormQuestion" ("id", "sectionId", "code", "label", "helpText", "type", "required", "position", "optionsJson", "measurementDefinitionId", "tenantId")
SELECT
  md5(measurement_data."templateCode" || ':v2:measurement:' || measurement_data."code"),
  section."id",
  measurement_data."code",
  measurement_data."label",
  'Registre o valor exibido pelo instrumento de medição.',
  'MEASUREMENT',
  false,
  measurement_data."position",
  '[]',
  definition."id",
  section."tenantId"
FROM measurement_data
JOIN version_data ON version_data."code" = measurement_data."templateCode"
JOIN "FormSection" section ON section."versionId" = version_data."versionId" AND section."position" = measurement_data."sectionPosition"
JOIN "MeasurementDefinition" definition ON definition."code" = measurement_data."definitionCode"
ON CONFLICT ("sectionId", "code") DO UPDATE SET
  "label" = EXCLUDED."label",
  "helpText" = EXCLUDED."helpText",
  "type" = EXCLUDED."type",
  "measurementDefinitionId" = EXCLUDED."measurementDefinitionId";

RESET app.tenant_id;
