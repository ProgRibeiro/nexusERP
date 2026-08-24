export type ServiceModality =
  | "CLIMATIZACAO"
  | "ELETRICA"
  | "ILUMINACAO"
  | "HIDRAULICA"
  | "CIVIL"
  | "REFRIGERACAO"
  | "INCENDIO"
  | "GERAL";

export type ChecklistStatus = "PENDENTE" | "CONFORME" | "NAO_CONFORME" | "NAO_APLICAVEL";
export type ChecklistCriticality = "ROTINA" | "ATENCAO" | "CRITICO";

export interface ServiceChecklistItem {
  id?: string;
  label: string;
  checked: boolean;
  modality?: ServiceModality;
  group?: string;
  status?: ChecklistStatus;
  observation?: string;
  criticality?: ChecklistCriticality;
  evidenceRequired?: boolean;
  required?: boolean;
}

interface ChecklistDefinition {
  group: string;
  label: string;
  criticality?: ChecklistCriticality;
  evidenceRequired?: boolean;
  required?: boolean;
}

export const SERVICE_MODALITIES: Array<{ value: ServiceModality; label: string; description: string }> = [
  { value: "CLIMATIZACAO", label: "Climatização / Ar-condicionado", description: "Split, cassete, VRF, fan coil, ventilação e controles do PMOC." },
  { value: "REFRIGERACAO", label: "Refrigeração", description: "Câmaras frias, expositores, compressores, degelo e controle térmico." },
  { value: "ELETRICA", label: "Elétrica", description: "Quadros, circuitos, disjuntores, aterramento, termografia e medições." },
  { value: "ILUMINACAO", label: "Iluminação", description: "Luminárias, lâmpadas, drivers, emergência, sensores e comandos." },
  { value: "HIDRAULICA", label: "Hidráulica", description: "Tubulações, registros, louças, bombas, reservatórios, drenos e vazamentos." },
  { value: "CIVIL", label: "Civil / Conservação predial", description: "Cobertura, fachada, infiltrações, pisos, forros, esquadrias e segurança." },
  { value: "INCENDIO", label: "Combate a incêndio", description: "Extintores, hidrantes, alarmes, iluminação, sinalização e rotas de fuga." },
  { value: "GERAL", label: "Serviço geral / Multidisciplinar", description: "Roteiro completo para atendimentos diversos ou com mais de uma disciplina." },
];

const item = (
  group: string,
  label: string,
  options: Omit<ChecklistDefinition, "group" | "label"> = {},
): ChecklistDefinition => ({ group, label, required: true, ...options });

const TEMPLATE_ITEMS: Record<ServiceModality, ChecklistDefinition[]> = {
  CLIMATIZACAO: [
    item("1. Segurança e identificação", "Confirmar autorização, isolamento da área e condições seguras de acesso", { criticality: "CRITICO" }),
    item("1. Segurança e identificação", "Desligar e desenergizar o equipamento antes da intervenção", { criticality: "CRITICO" }),
    item("1. Segurança e identificação", "Registrar TAG, fabricante, modelo, capacidade, número de série e localização", { evidenceRequired: true }),
    item("1. Segurança e identificação", "Registrar condição inicial, ruídos, vibrações, corrosão e fixações", { evidenceRequired: true }),
    item("2. Higienização e componentes", "Avaliar e higienizar filtros conforme o escopo contratado"),
    item("2. Higienização e componentes", "Limpar serpentinas evaporadora e condensadora"),
    item("2. Higienização e componentes", "Limpar turbina, ventiladores, carenagens e bandeja de condensado"),
    item("2. Higienização e componentes", "Desobstruir dreno e testar bomba de condensado, quando existente", { criticality: "ATENCAO" }),
    item("2. Higienização e componentes", "Inspecionar isolamento térmico, tubulações e pontos de condensação"),
    item("3. Elétrica e desempenho", "Inspecionar bornes, cabos, contatores, capacitores e proteções", { criticality: "CRITICO" }),
    item("3. Elétrica e desempenho", "Medir e registrar tensão e corrente elétrica"),
    item("3. Elétrica e desempenho", "Medir temperaturas de retorno e insuflamento e calcular o diferencial térmico"),
    item("3. Elétrica e desempenho", "Verificar indícios de vazamento e condição do circuito frigorífico", { criticality: "ATENCAO" }),
    item("3. Elétrica e desempenho", "Testar controle remoto, termostato, sensores, atuadores e modos de operação"),
    item("4. Fechamento e PMOC", "Executar teste funcional final sem ruído, vibração ou vazamento anormal", { evidenceRequired: true }),
    item("4. Fechamento e PMOC", "Registrar materiais, anomalias, criticidade e ação recomendada"),
    item("4. Fechamento e PMOC", "Atualizar histórico individual do equipamento e informações do PMOC"),
    item("4. Fechamento e PMOC", "Limpar a área, recolocar proteções e obter ciência do responsável local"),
  ],
  REFRIGERACAO: [
    item("1. Segurança e cadastro", "Confirmar segurança elétrica, isolamento da área e acesso ao equipamento", { criticality: "CRITICO" }),
    item("1. Segurança e cadastro", "Registrar TAG, modelo, série, fluido refrigerante e temperatura de ajuste", { evidenceRequired: true }),
    item("1. Segurança e cadastro", "Registrar temperaturas inicial do produto, ambiente e equipamento"),
    item("2. Estrutura e higienização", "Inspecionar portas, dobradiças, cortinas, puxadores e vedações"),
    item("2. Estrutura e higienização", "Limpar evaporador, condensador, filtros, bandeja e dreno"),
    item("2. Estrutura e higienização", "Verificar formação anormal de gelo, condensação e isolamento térmico"),
    item("2. Estrutura e higienização", "Inspecionar ventiladores, motores, hélices, rolamentos e fixações"),
    item("3. Circuito e controles", "Inspecionar compressor, tubulações e indícios de vazamento", { criticality: "ATENCAO" }),
    item("3. Circuito e controles", "Medir tensão e corrente de compressores e ventiladores"),
    item("3. Circuito e controles", "Testar degelo, termostatos, pressostatos, sensores e controladores"),
    item("3. Circuito e controles", "Conferir painéis, contatores, relés, proteções e alarmes", { criticality: "CRITICO" }),
    item("3. Circuito e controles", "Medir pressões e temperaturas do sistema quando previsto no escopo"),
    item("4. Resultado operacional", "Confirmar estabilização da temperatura após o serviço"),
    item("4. Resultado operacional", "Registrar condição final e curva de temperatura quando aplicável", { evidenceRequired: true }),
    item("4. Resultado operacional", "Registrar anomalias, risco para produtos e ações recomendadas"),
    item("4. Resultado operacional", "Limpar a área e liberar o equipamento ao responsável local"),
  ],
  ELETRICA: [
    item("1. Segurança elétrica", "Confirmar autorização, EPI, EPC, ferramentas isoladas e delimitação da área", { criticality: "CRITICO" }),
    item("1. Segurança elétrica", "Identificar fontes, desenergizar e confirmar ausência de tensão", { criticality: "CRITICO" }),
    item("1. Segurança elétrica", "Registrar identificação do quadro, tensão nominal, alimentação e diagrama disponível", { evidenceRequired: true }),
    item("2. Quadro e componentes", "Inspecionar invólucro, fechadura, barreiras, limpeza e sinais de umidade"),
    item("2. Quadro e componentes", "Inspecionar cabos, terminais, barramentos, isoladores e sinais de aquecimento", { criticality: "ATENCAO" }),
    item("2. Quadro e componentes", "Executar reaperto técnico conforme procedimento e torque aplicável"),
    item("2. Quadro e componentes", "Conferir identificação de circuitos, componentes, cabos e legendas"),
    item("3. Proteções e medições", "Testar disjuntores, fusíveis, DR, DPS, relés e sinalizações", { criticality: "CRITICO" }),
    item("3. Proteções e medições", "Medir tensões fase-fase, fase-neutro e fase-terra"),
    item("3. Proteções e medições", "Medir correntes por fase e avaliar balanceamento de cargas"),
    item("3. Proteções e medições", "Verificar continuidade e condição aparente do aterramento", { criticality: "CRITICO" }),
    item("3. Proteções e medições", "Realizar inspeção termográfica e registrar pontos anormais", { evidenceRequired: true }),
    item("4. Recomposição e liberação", "Recolocar tampas, barreiras, proteções e sinalizações"),
    item("4. Recomposição e liberação", "Energizar e testar circuitos e cargas atendidas"),
    item("4. Recomposição e liberação", "Registrar anomalias, temperatura, criticidade e recomendação", { evidenceRequired: true }),
    item("4. Recomposição e liberação", "Liberar o quadro em condição segura e obter ciência do responsável"),
  ],
  ILUMINACAO: [
    item("1. Identificação e segurança", "Identificar ambiente, circuito, comando e tipo de luminária"),
    item("1. Identificação e segurança", "Confirmar desenergização e condição segura de acesso em altura", { criticality: "CRITICO" }),
    item("1. Identificação e segurança", "Registrar fabricante, modelo, potência, fluxo, temperatura de cor e soquete", { evidenceRequired: true }),
    item("2. Inspeção dos pontos", "Inspecionar lâmpadas, luminárias, difusores, drivers, reatores e conexões"),
    item("2. Inspeção dos pontos", "Verificar fixação, limpeza, oxidação, aquecimento e entrada de água"),
    item("2. Inspeção dos pontos", "Conferir interruptores, contatores, sensores, temporizadores e automação"),
    item("2. Inspeção dos pontos", "Avaliar uniformidade, ofuscamento e pontos apagados ou intermitentes"),
    item("3. Emergência e medições", "Testar luminárias de emergência e sinalização iluminada", { criticality: "CRITICO" }),
    item("3. Emergência e medições", "Verificar bateria e autonomia aparente da iluminação de emergência"),
    item("3. Emergência e medições", "Medir tensão no ponto e verificar oscilações ou aquecimento"),
    item("3. Emergência e medições", "Conferir acionamento por circuito, sensor e comando central"),
    item("4. Fechamento", "Substituir componentes previstos e confirmar especificação compatível"),
    item("4. Fechamento", "Testar acionamento final e registrar pontos normalizados"),
    item("4. Fechamento", "Registrar pendências, quantidade, localização e criticidade", { evidenceRequired: true }),
    item("4. Fechamento", "Limpar a área e descartar componentes conforme procedimento"),
  ],
  HIDRAULICA: [
    item("1. Segurança e identificação", "Identificar sistema, ponto, registro de bloqueio e origem da alimentação"),
    item("1. Segurança e identificação", "Isolar a área e bloquear abastecimento antes da intervenção", { criticality: "CRITICO" }),
    item("1. Segurança e identificação", "Registrar condição inicial e sinais de vazamento ou umidade", { evidenceRequired: true }),
    item("2. Redes e componentes", "Inspecionar tubulações, conexões, flexíveis, sifões, vedações e suportes"),
    item("2. Redes e componentes", "Testar torneiras, válvulas, registros, boias, louças e metais"),
    item("2. Redes e componentes", "Verificar pressão, vazão e sinais de golpe de aríete"),
    item("2. Redes e componentes", "Inspecionar bombas, pressurizadores, comandos, ruídos e vibrações"),
    item("3. Reservatórios e drenagem", "Inspecionar reservatórios, tampas, extravasores, nível e acesso"),
    item("3. Reservatórios e drenagem", "Inspecionar ralos, grelhas, caixas sifonadas e escoamento"),
    item("3. Reservatórios e drenagem", "Verificar retorno, odores e sinais de obstrução em esgoto"),
    item("3. Reservatórios e drenagem", "Inspecionar calhas, condutores e drenagem pluvial acessível"),
    item("4. Teste e liberação", "Reabrir abastecimento e realizar teste de estanqueidade", { criticality: "ATENCAO" }),
    item("4. Teste e liberação", "Confirmar funcionamento sem vazamentos após o serviço", { evidenceRequired: true }),
    item("4. Teste e liberação", "Registrar anomalias ocultas suspeitas, danos e ações recomendadas"),
    item("4. Teste e liberação", "Higienizar e liberar a área ao responsável local"),
  ],
  CIVIL: [
    item("1. Preparação e segurança", "Isolar a área e proteger mobiliário, piso e circulação", { criticality: "CRITICO" }),
    item("1. Preparação e segurança", "Registrar ambiente, dimensões, substrato, acabamento e condição inicial", { evidenceRequired: true }),
    item("1. Preparação e segurança", "Verificar acesso em altura, guarda-corpos e risco de queda de materiais", { criticality: "CRITICO" }),
    item("2. Estrutura e envoltória", "Mapear fissuras, trincas, deformações e sinais de movimentação", { criticality: "ATENCAO" }),
    item("2. Estrutura e envoltória", "Inspecionar infiltração, umidade, eflorescência, mofo e origem aparente"),
    item("2. Estrutura e envoltória", "Inspecionar cobertura, telhas, rufos, calhas e pontos de vedação acessíveis"),
    item("2. Estrutura e envoltória", "Inspecionar fachada, pintura, revestimentos, juntas e selantes"),
    item("3. Acabamentos e acessibilidade", "Inspecionar pisos, rodapés, paredes, divisórias e forros"),
    item("3. Acabamentos e acessibilidade", "Testar portas, janelas, ferragens, fechaduras e vedações"),
    item("3. Acabamentos e acessibilidade", "Verificar corrimãos, guarda-corpos, rampas e condições de acessibilidade", { criticality: "CRITICO" }),
    item("3. Acabamentos e acessibilidade", "Registrar corrosão, desprendimento e deterioração de elementos aparentes"),
    item("4. Execução e entrega", "Conferir material, lote, cor e especificação antes da aplicação"),
    item("4. Execução e entrega", "Verificar alinhamento, nível, cobertura, acabamento e tempo de cura"),
    item("4. Execução e entrega", "Registrar serviço concluído, pendências e mapa de anomalias", { evidenceRequired: true }),
    item("4. Execução e entrega", "Remover resíduos, proteções e liberar a área com segurança"),
  ],
  INCENDIO: [
    item("1. Documentação e acesso", "Conferir planta, registros, inspeções anteriores e validade documental"),
    item("1. Documentação e acesso", "Verificar acesso livre aos equipamentos e rotas de abandono", { criticality: "CRITICO", evidenceRequired: true }),
    item("2. Extintores e hidrantes", "Conferir extintores: localização, classe, lacre, manômetro, validade e sinalização", { criticality: "CRITICO" }),
    item("2. Extintores e hidrantes", "Inspecionar abrigos, registros, esguichos, chaves e mangueiras", { criticality: "CRITICO" }),
    item("2. Extintores e hidrantes", "Testar bombas, comandos e pressurização conforme procedimento", { criticality: "CRITICO" }),
    item("2. Extintores e hidrantes", "Verificar reserva técnica, válvulas e indicadores acessíveis"),
    item("3. Alarme e emergência", "Testar central, acionadores, detectores, sirenes e sinalizadores", { criticality: "CRITICO" }),
    item("3. Alarme e emergência", "Testar iluminação de emergência e autonomia aparente", { criticality: "CRITICO" }),
    item("3. Alarme e emergência", "Conferir sinalização, sentido e visibilidade das rotas de fuga"),
    item("3. Alarme e emergência", "Testar portas corta-fogo, barras antipânico e acessórios"),
    item("4. Resultado e regularização", "Registrar vencimentos, ausência, avarias e não conformidades", { evidenceRequired: true }),
    item("4. Resultado e regularização", "Classificar risco imediato, alto, médio ou baixo"),
    item("4. Resultado e regularização", "Definir ação corretiva, responsável e prazo recomendado"),
    item("4. Resultado e regularização", "Comunicar imediatamente qualquer condição crítica ao responsável local", { criticality: "CRITICO" }),
  ],
  GERAL: [
    item("1. Preparação", "Confirmar escopo, autorização e responsável pelo acompanhamento"),
    item("1. Preparação", "Realizar análise preliminar de risco e isolar a área", { criticality: "CRITICO" }),
    item("1. Preparação", "Registrar local, ativo, identificação e condição inicial", { evidenceRequired: true }),
    item("2. Inspeção", "Inspecionar integridade, fixação, limpeza, desgaste e sinais de falha"),
    item("2. Inspeção", "Identificar riscos para pessoas, operação, patrimônio e continuidade"),
    item("2. Inspeção", "Registrar medições e testes aplicáveis ao serviço"),
    item("3. Execução", "Conferir materiais, ferramentas e componentes antes da aplicação"),
    item("3. Execução", "Executar o serviço conforme escopo, fabricante e procedimento interno"),
    item("3. Execução", "Registrar materiais utilizados e alterações realizadas"),
    item("4. Validação", "Executar teste funcional e confirmar condição operacional"),
    item("4. Validação", "Registrar fotos finais e evidências da execução", { evidenceRequired: true }),
    item("4. Validação", "Classificar pendências e definir ação, responsável e prazo"),
    item("4. Validação", "Limpar a área, remover resíduos e recompor proteções"),
    item("4. Validação", "Apresentar o resultado e obter ciência do responsável local"),
  ],
};

export function getServiceChecklistTemplate(modality?: string | null): ServiceChecklistItem[] {
  const normalized = (modality || "GERAL").toUpperCase() as ServiceModality;
  const selected = TEMPLATE_ITEMS[normalized] ? normalized : "GERAL";
  return TEMPLATE_ITEMS[selected].map((definition, index) => ({
    id: `${selected}-${String(index + 1).padStart(2, "0")}`,
    ...definition,
    checked: false,
    status: "PENDENTE",
    observation: "",
    modality: selected,
  }));
}

export function normalizeChecklistStatus(item: Pick<ServiceChecklistItem, "status" | "checked">): ChecklistStatus {
  if (item.status) return item.status;
  return item.checked ? "CONFORME" : "PENDENTE";
}

export function inferServiceModality(text: string): ServiceModality {
  const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  if (/INCENDIO|EXTINTOR|HIDRANTE|ALARME|ROTA DE FUGA|PORTA CORTA/.test(normalized)) return "INCENDIO";
  if (/AR CONDICIONADO|CLIMAT|HVAC|PMOC|FAN COIL|VRF/.test(normalized)) return "CLIMATIZACAO";
  if (/REFRIG|CAMARA FRIA|EXPOSITOR|COMPRESSOR/.test(normalized)) return "REFRIGERACAO";
  if (/ILUMIN|LAMPADA|LUMINARIA|DRIVER|REATOR/.test(normalized)) return "ILUMINACAO";
  if (/ELETR|QUADRO|DISJUNTOR|TOMADA|CIRCUITO/.test(normalized)) return "ELETRICA";
  if (/HIDRAUL|VAZAMENTO|TORNEIRA|REGISTRO|TUBULAC|RAL0|RALO/.test(normalized)) return "HIDRAULICA";
  if (/PINTURA|ALVENARIA|GESSO|PISO|FORRO|CIVIL|FACHADA|COBERTURA/.test(normalized)) return "CIVIL";
  return "GERAL";
}
