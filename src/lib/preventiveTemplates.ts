export type PreventiveDisciplineId =
  | "CLIMATIZACAO"
  | "REFRIGERACAO"
  | "ELETRICA"
  | "HIDRAULICA"
  | "CIVIL"
  | "INCENDIO";

export type PreventiveTemplateId = PreventiveDisciplineId | "INTEGRADO" | "PERSONALIZADO";

export interface PreventiveScopeItem {
  id: string;
  group: string;
  label: string;
  disciplineId?: PreventiveDisciplineId;
}

export interface PreventiveTemplate {
  id: PreventiveTemplateId;
  name: string;
  shortName: string;
  description: string;
  accent: string;
  title: string;
  durationHours: number;
  technicians: number;
  scope: PreventiveScopeItem[];
  deliverables: string[];
  inclusions: string[];
  exclusions: string[];
}

const withDiscipline = (disciplineId: PreventiveDisciplineId, items: Array<Omit<PreventiveScopeItem, "disciplineId">>) =>
  items.map((item) => ({ ...item, disciplineId }));

export const preventiveDisciplineTemplates: PreventiveTemplate[] = [
  {
    id: "CLIMATIZACAO",
    name: "Climatização e PMOC",
    shortName: "Climatização",
    description: "Splits, cassetes, selfs, VRF e controles do plano de manutenção, operação e controle.",
    accent: "blue",
    title: "Plano de manutenção preventiva de climatização e PMOC",
    durationHours: 4,
    technicians: 2,
    scope: withDiscipline("CLIMATIZACAO", [
      { id: "clima-inspecao-visual", group: "Climatização · Inspeção", label: "Inspeção visual, ruídos, vibrações, corrosão e fixações" },
      { id: "clima-temperatura", group: "Climatização · Medições", label: "Medição das temperaturas de insuflamento e retorno" },
      { id: "clima-dreno", group: "Climatização · Higienização", label: "Limpeza e desobstrução de bandeja e linha de dreno" },
      { id: "clima-filtros", group: "Climatização · Higienização", label: "Limpeza, avaliação e registro do estado dos filtros" },
      { id: "clima-serpentinas", group: "Climatização · Higienização", label: "Limpeza de serpentinas evaporadora e condensadora" },
      { id: "clima-ventiladores", group: "Climatização · Higienização", label: "Limpeza de rotores, turbinas, ventiladores e carenagens" },
      { id: "clima-eletrica", group: "Climatização · Elétrica", label: "Inspeção e reaperto de bornes, cabos, capacitores e contatores" },
      { id: "clima-corrente", group: "Climatização · Medições", label: "Medição de tensão e corrente dos equipamentos" },
      { id: "clima-controle", group: "Climatização · Operação", label: "Teste de controles, sensores, termostatos e proteções" },
      { id: "clima-gas", group: "Climatização · Desempenho", label: "Verificação de indícios de vazamento de fluido refrigerante" },
      { id: "clima-condensacao", group: "Climatização · Desempenho", label: "Avaliação da condensação, troca térmica e rendimento aparente" },
      { id: "clima-pmoc", group: "Climatização · Documentação", label: "Atualização do PMOC, histórico, medições e evidências por equipamento" },
    ]),
    deliverables: ["Checklist técnico individual por equipamento", "Relatório fotográfico antes e depois", "Registro de temperaturas, tensão e corrente", "Atualização do histórico do PMOC", "Plano de correções por criticidade"],
    inclusions: ["Mão de obra técnica especializada", "Ferramentas e instrumentos de medição", "Produtos básicos de limpeza técnica", "Identificação dos equipamentos vistoriados"],
    exclusions: ["Peças e componentes para substituição", "Recarga de fluido refrigerante", "Serviços corretivos não descritos no escopo", "Laudos ou análises laboratoriais não contratados"],
  },
  {
    id: "REFRIGERACAO",
    name: "Refrigeração comercial",
    shortName: "Refrigeração",
    description: "Câmaras frias, balcões, expositores, ilhas e unidades condensadoras.",
    accent: "cyan",
    title: "Plano de manutenção preventiva de refrigeração comercial",
    durationHours: 4,
    technicians: 2,
    scope: withDiscipline("REFRIGERACAO", [
      { id: "ref-temperatura", group: "Refrigeração · Operação", label: "Medição e registro das temperaturas de operação" },
      { id: "ref-vedacao", group: "Refrigeração · Operação", label: "Inspeção de portas, cortinas, dobradiças e vedações" },
      { id: "ref-degelo", group: "Refrigeração · Operação", label: "Teste de degelo, termostatos, pressostatos e controladores" },
      { id: "ref-evaporador", group: "Refrigeração · Limpeza", label: "Limpeza do evaporador, bandeja e dreno" },
      { id: "ref-condensador", group: "Refrigeração · Limpeza", label: "Limpeza e inspeção da unidade condensadora" },
      { id: "ref-ventiladores", group: "Refrigeração · Mecânica", label: "Inspeção de motores, hélices, rolamentos e vibrações" },
      { id: "ref-eletrica", group: "Refrigeração · Elétrica", label: "Inspeção de painéis, contatores, proteções e conexões" },
      { id: "ref-corrente", group: "Refrigeração · Medições", label: "Medição de tensão e corrente de compressores e ventiladores" },
      { id: "ref-vazamento", group: "Refrigeração · Circuito frigorífico", label: "Inspeção de vazamentos e condição das tubulações" },
      { id: "ref-isolamento", group: "Refrigeração · Circuito frigorífico", label: "Inspeção do isolamento térmico e pontos de condensação" },
    ]),
    deliverables: ["Checklist por equipamento", "Registro de temperaturas e correntes", "Relatório fotográfico", "Lista de desvios e recomendações"],
    inclusions: ["Mão de obra técnica especializada", "Limpeza técnica básica", "Instrumentos de medição"],
    exclusions: ["Fluido refrigerante e peças", "Reparo de vazamentos", "Serviços emergenciais fora do horário acordado"],
  },
  {
    id: "ELETRICA",
    name: "Elétrica e quadros",
    shortName: "Elétrica",
    description: "Quadros, circuitos, iluminação, proteções, aterramento e análise termográfica.",
    accent: "amber",
    title: "Plano de manutenção preventiva das instalações elétricas",
    durationHours: 6,
    technicians: 2,
    scope: withDiscipline("ELETRICA", [
      { id: "eletrica-visual", group: "Elétrica · Inspeção", label: "Inspeção visual de quadros, painéis, circuitos e infraestrutura" },
      { id: "eletrica-termografia", group: "Elétrica · Inspeção", label: "Inspeção termográfica de conexões e componentes" },
      { id: "eletrica-reaperto", group: "Elétrica · Conexões", label: "Verificação e reaperto técnico de conexões desenergizadas" },
      { id: "eletrica-barramentos", group: "Elétrica · Conexões", label: "Limpeza e inspeção de barramentos, isoladores e bornes" },
      { id: "eletrica-tensao", group: "Elétrica · Medições", label: "Medições de tensão, corrente e balanceamento de fases" },
      { id: "eletrica-aterramento", group: "Elétrica · Medições", label: "Verificação do aterramento e continuidade aparente" },
      { id: "eletrica-disjuntores", group: "Elétrica · Proteções", label: "Teste funcional e inspeção de disjuntores, DR e relés" },
      { id: "eletrica-dps", group: "Elétrica · Proteções", label: "Inspeção de DPS, fusíveis e sinalizações" },
      { id: "eletrica-iluminacao", group: "Elétrica · Iluminação", label: "Inspeção de luminárias, circuitos, comandos e iluminação de apoio" },
      { id: "eletrica-identificacao", group: "Elétrica · Documentação", label: "Conferência e registro da identificação de quadros e circuitos" },
      { id: "eletrica-relatorio", group: "Elétrica · Documentação", label: "Relatório de anomalias, riscos e prioridades de adequação" },
    ]),
    deliverables: ["Checklist dos quadros e circuitos", "Relatório fotográfico e termográfico", "Tabela de medições", "Mapa de disjuntores e componentes", "Plano de correções priorizado"],
    inclusions: ["Mão de obra técnica especializada", "Instrumentos de medição e termografia", "Etiquetas básicas de identificação"],
    exclusions: ["Troca de disjuntores, cabos e componentes", "Adequações civis ou de infraestrutura", "Laudo NR-10 ou prontuário elétrico, salvo contratação específica"],
  },
  {
    id: "HIDRAULICA",
    name: "Hidráulica e sanitária",
    shortName: "Hidráulica",
    description: "Redes de água, esgoto, bombas, reservatórios, louças, metais e drenagem.",
    accent: "sky",
    title: "Plano de manutenção preventiva hidráulica e sanitária",
    durationHours: 5,
    technicians: 2,
    scope: withDiscipline("HIDRAULICA", [
      { id: "hidro-vazamentos", group: "Hidráulica · Inspeção", label: "Inspeção de vazamentos aparentes em tubulações, conexões e pontos de consumo" },
      { id: "hidro-pressao", group: "Hidráulica · Medições", label: "Verificação funcional de pressão, vazão e golpes de aríete aparentes" },
      { id: "hidro-registros", group: "Hidráulica · Componentes", label: "Teste de registros, válvulas, boias e dispositivos de bloqueio" },
      { id: "hidro-bombas", group: "Hidráulica · Bombas", label: "Inspeção de bombas, pressurizadores, ruídos, vibrações e comandos" },
      { id: "hidro-reservatorios", group: "Hidráulica · Reservatórios", label: "Inspeção visual de reservatórios, tampas, extravasores e condições de acesso" },
      { id: "hidro-loucas", group: "Hidráulica · Sanitários", label: "Teste de torneiras, descargas, sifões, louças e metais sanitários" },
      { id: "hidro-ralos", group: "Hidráulica · Drenagem", label: "Inspeção e limpeza preventiva acessível de ralos, grelhas e caixas sifonadas" },
      { id: "hidro-esgoto", group: "Hidráulica · Drenagem", label: "Verificação de sinais de obstrução, retorno e odores na rede de esgoto" },
      { id: "hidro-pluvial", group: "Hidráulica · Drenagem", label: "Inspeção de calhas, condutores e pontos acessíveis de drenagem pluvial" },
      { id: "hidro-relatorio", group: "Hidráulica · Documentação", label: "Registro fotográfico de anomalias e plano de correções" },
    ]),
    deliverables: ["Checklist hidráulico por ambiente", "Mapa de vazamentos e anomalias", "Registro fotográfico", "Recomendações com prioridade e impacto"],
    inclusions: ["Mão de obra de inspeção", "Testes funcionais sem intervenção destrutiva", "Pequenos ajustes de regulagem acessíveis"],
    exclusions: ["Desentupimentos mecanizados", "Obras, quebra de revestimentos e tubulações embutidas", "Peças, bombas e materiais de substituição"],
  },
  {
    id: "CIVIL",
    name: "Civil e conservação predial",
    shortName: "Civil",
    description: "Cobertura, fachada, pisos, paredes, forros, esquadrias, infiltrações e acessibilidade.",
    accent: "orange",
    title: "Plano de manutenção preventiva civil e conservação predial",
    durationHours: 8,
    technicians: 3,
    scope: withDiscipline("CIVIL", [
      { id: "civil-fissuras", group: "Civil · Estrutura aparente", label: "Mapeamento visual de fissuras, trincas, deformações e sinais de movimentação" },
      { id: "civil-infiltracoes", group: "Civil · Umidade", label: "Inspeção de infiltrações, manchas, eflorescências, mofo e umidade" },
      { id: "civil-cobertura", group: "Civil · Cobertura", label: "Inspeção de telhas, rufos, cumeeiras, calhas e pontos de vedação acessíveis" },
      { id: "civil-impermeabilizacao", group: "Civil · Impermeabilização", label: "Avaliação visual de lajes, marquises, áreas molhadas e juntas" },
      { id: "civil-fachada", group: "Civil · Fachada", label: "Inspeção visual de revestimentos, pintura, selantes e elementos de fachada" },
      { id: "civil-pisos", group: "Civil · Acabamentos", label: "Inspeção de pisos, rodapés, revestimentos e riscos de desprendimento" },
      { id: "civil-forros", group: "Civil · Acabamentos", label: "Inspeção de paredes, divisórias, forros e pontos de deterioração" },
      { id: "civil-esquadrias", group: "Civil · Esquadrias", label: "Teste funcional de portas, janelas, ferragens, fechaduras e vedações" },
      { id: "civil-acessibilidade", group: "Civil · Segurança", label: "Verificação visual de corrimãos, guarda-corpos, rampas e acessibilidade" },
      { id: "civil-sinalizacao", group: "Civil · Segurança", label: "Inspeção de sinalização operacional e condições das rotas de circulação" },
      { id: "civil-corrosao", group: "Civil · Conservação", label: "Registro de oxidação, corrosão e deterioração de elementos aparentes" },
      { id: "civil-relatorio", group: "Civil · Documentação", label: "Relatório fotográfico com localização, criticidade e recomendação técnica" },
    ]),
    deliverables: ["Checklist predial por ambiente", "Mapa fotográfico de anomalias", "Classificação de criticidade", "Plano de manutenção e correções priorizadas"],
    inclusions: ["Inspeção visual e testes funcionais não destrutivos", "Registro fotográfico dos pontos acessíveis", "Pequenos ajustes sem fornecimento de material"],
    exclusions: ["Ensaios destrutivos, sondagens e projetos estruturais", "Obras civis e fornecimento de materiais", "Laudos de estabilidade ou responsabilidade técnica não previstos"],
  },
  {
    id: "INCENDIO",
    name: "Combate a incêndio",
    shortName: "Incêndio",
    description: "Extintores, hidrantes, iluminação, alarmes, sinalização e rotas de fuga.",
    accent: "red",
    title: "Plano de manutenção preventiva dos sistemas de combate a incêndio",
    durationHours: 5,
    technicians: 2,
    scope: withDiscipline("INCENDIO", [
      { id: "inc-extintores", group: "Incêndio · Extintores", label: "Conferência de localização, acesso, lacre, manômetro, validade e sinalização" },
      { id: "inc-hidrantes", group: "Incêndio · Hidrantes", label: "Inspeção de abrigos, registros, esguichos, chaves e mangueiras" },
      { id: "inc-bombas", group: "Incêndio · Bombas", label: "Teste funcional programado de bombas, comandos e pressurização" },
      { id: "inc-alarme", group: "Incêndio · Alarme", label: "Teste de central, acionadores, sirenes e sinalizadores acessíveis" },
      { id: "inc-iluminacao", group: "Incêndio · Emergência", label: "Teste da iluminação de emergência e autonomia aparente" },
      { id: "inc-sinalizacao", group: "Incêndio · Emergência", label: "Inspeção de placas, orientação e visibilidade das rotas de fuga" },
      { id: "inc-portas", group: "Incêndio · Compartimentação", label: "Inspeção funcional de portas corta-fogo e seus acessórios" },
      { id: "inc-saidas", group: "Incêndio · Rotas", label: "Verificação de desobstrução de saídas e rotas de abandono" },
      { id: "inc-documentos", group: "Incêndio · Documentação", label: "Conferência visual de registros, validade de documentos e controles internos" },
      { id: "inc-relatorio", group: "Incêndio · Documentação", label: "Relatório de não conformidades e plano de regularização" },
    ]),
    deliverables: ["Checklist dos sistemas de incêndio", "Registro fotográfico", "Mapa de vencimentos e pendências", "Plano de regularização por criticidade"],
    inclusions: ["Mão de obra de inspeção e testes funcionais programados", "Identificação das não conformidades aparentes", "Relatório técnico operacional"],
    exclusions: ["Recarga e substituição de extintores", "Teste hidrostático ou manutenção certificada de mangueiras", "Emissão ou renovação de AVCB/CLCB e projetos legais"],
  },
];

export const preventiveDisciplineIds = preventiveDisciplineTemplates.map((template) => template.id as PreventiveDisciplineId);

const unique = (values: string[]) => Array.from(new Set(values));

export function buildPreventivePackage(ids: PreventiveDisciplineId[]) {
  const selected = preventiveDisciplineTemplates.filter((template) => ids.includes(template.id as PreventiveDisciplineId));
  const disciplines = selected.length ? selected : [preventiveDisciplineTemplates[0]];
  const integrated = disciplines.length > 1;
  return {
    templateId: (integrated ? "INTEGRADO" : disciplines[0].id) as PreventiveTemplateId,
    title: integrated
      ? disciplines.length > 3
        ? `Plano integrado de manutenção preventiva predial — ${disciplines.length} disciplinas`
        : `Plano integrado de manutenção preventiva — ${disciplines.map((template) => template.shortName).join(", ")}`
      : disciplines[0].title,
    durationHours: integrated ? Math.min(40, disciplines.reduce((sum, template) => sum + template.durationHours, 0)) : disciplines[0].durationHours,
    technicians: integrated ? Math.min(12, Math.max(3, ...disciplines.map((template) => template.technicians))) : disciplines[0].technicians,
    scope: disciplines.flatMap((template) => template.scope),
    deliverables: unique(disciplines.flatMap((template) => template.deliverables)),
    inclusions: unique(disciplines.flatMap((template) => template.inclusions)),
    exclusions: unique(disciplines.flatMap((template) => template.exclusions)),
    disciplines,
  };
}

const integratedPackage = buildPreventivePackage(preventiveDisciplineIds);

const integratedTemplate: PreventiveTemplate = {
  id: "INTEGRADO",
  name: "Mega Pacote Integrado",
  shortName: "Mega Pacote",
  description: "Todas as disciplinas prediais reunidas em um único plano, cronograma e relatório gerencial.",
  accent: "indigo",
  title: "Mega pacote integrado de manutenção preventiva predial",
  durationHours: integratedPackage.durationHours,
  technicians: integratedPackage.technicians,
  scope: integratedPackage.scope,
  deliverables: integratedPackage.deliverables,
  inclusions: integratedPackage.inclusions,
  exclusions: integratedPackage.exclusions,
};

const customTemplate: PreventiveTemplate = {
  id: "PERSONALIZADO",
  name: "Plano personalizado",
  shortName: "Personalizado",
  description: "Estrutura livre para atividades adicionais ou necessidades fora dos pacotes técnicos.",
  accent: "violet",
  title: "Plano de manutenção preventiva personalizado",
  durationHours: 4,
  technicians: 1,
  scope: [
    { id: "custom-inspecao", group: "Personalizado", label: "Inspeção geral das condições de funcionamento" },
    { id: "custom-testes", group: "Personalizado", label: "Testes funcionais e registro de medições" },
    { id: "custom-relatorio", group: "Personalizado", label: "Relatório técnico com evidências e recomendações" },
  ],
  deliverables: ["Checklist técnico", "Relatório fotográfico", "Recomendações de correção"],
  inclusions: ["Mão de obra técnica", "Ferramentas necessárias à inspeção"],
  exclusions: ["Peças, materiais e serviços corretivos"],
};

export const preventiveTemplates: PreventiveTemplate[] = [
  ...preventiveDisciplineTemplates,
  integratedTemplate,
  customTemplate,
];

export function getPreventiveTemplate(id: PreventiveTemplateId) {
  return preventiveTemplates.find((template) => template.id === id) || preventiveTemplates[0];
}
