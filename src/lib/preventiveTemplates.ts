export type PreventiveTemplateId = "CLIMATIZACAO" | "ELETRICA" | "REFRIGERACAO" | "PERSONALIZADO";

export interface PreventiveScopeItem {
  id: string;
  group: string;
  label: string;
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

export const preventiveTemplates: PreventiveTemplate[] = [
  {
    id: "CLIMATIZACAO",
    name: "Climatização e PMOC",
    shortName: "Climatização",
    description: "Plano completo para splits, cassetes, selfs e sistemas de climatização.",
    accent: "blue",
    title: "Plano de manutenção preventiva de climatização e PMOC",
    durationHours: 4,
    technicians: 2,
    scope: [
      { id: "clima-inspecao-visual", group: "Inspeção", label: "Inspeção visual, ruídos, vibrações e fixações" },
      { id: "clima-temperatura", group: "Inspeção", label: "Medição de temperatura de insuflamento e retorno" },
      { id: "clima-dreno", group: "Higienização", label: "Limpeza e desobstrução de bandeja e linha de dreno" },
      { id: "clima-filtros", group: "Higienização", label: "Limpeza, avaliação e registro do estado dos filtros" },
      { id: "clima-serpentinas", group: "Higienização", label: "Limpeza de serpentinas evaporadora e condensadora" },
      { id: "clima-ventiladores", group: "Higienização", label: "Limpeza de rotores, turbinas e ventiladores" },
      { id: "clima-eletrica", group: "Elétrica", label: "Reaperto e inspeção de bornes, cabos e contatores" },
      { id: "clima-corrente", group: "Elétrica", label: "Medição de tensão e corrente dos equipamentos" },
      { id: "clima-controle", group: "Elétrica", label: "Teste de controles, sensores e proteções" },
      { id: "clima-gas", group: "Desempenho", label: "Verificação de indícios de vazamento de fluido refrigerante" },
      { id: "clima-condensacao", group: "Desempenho", label: "Avaliação da condensação e troca térmica" },
      { id: "clima-pmoc", group: "Documentação", label: "Atualização do registro de manutenção e evidências do PMOC" },
    ],
    deliverables: ["Checklist técnico por equipamento", "Relatório fotográfico antes e depois", "Registro de medições", "Recomendações corretivas e criticidade"],
    inclusions: ["Mão de obra técnica especializada", "Ferramentas e instrumentos de medição", "Produtos básicos de limpeza"],
    exclusions: ["Peças e componentes para substituição", "Recarga de fluido refrigerante", "Serviços corretivos não descritos no escopo"],
  },
  {
    id: "ELETRICA",
    name: "Instalações elétricas",
    shortName: "Elétrica",
    description: "Inspeção preventiva em quadros, circuitos, proteções e infraestrutura elétrica.",
    accent: "amber",
    title: "Plano de manutenção preventiva das instalações elétricas",
    durationHours: 6,
    technicians: 2,
    scope: [
      { id: "eletrica-visual", group: "Inspeção", label: "Inspeção visual de quadros, painéis e circuitos" },
      { id: "eletrica-termografia", group: "Inspeção", label: "Inspeção termográfica de conexões e componentes" },
      { id: "eletrica-reaperto", group: "Conexões", label: "Verificação e reaperto técnico de conexões" },
      { id: "eletrica-barramentos", group: "Conexões", label: "Limpeza e inspeção de barramentos e isoladores" },
      { id: "eletrica-tensao", group: "Medições", label: "Medições de tensão, corrente e balanceamento de fases" },
      { id: "eletrica-aterramento", group: "Medições", label: "Verificação do aterramento e continuidade" },
      { id: "eletrica-disjuntores", group: "Proteções", label: "Teste funcional e inspeção de disjuntores e DR" },
      { id: "eletrica-dps", group: "Proteções", label: "Inspeção de DPS, fusíveis e sinalizações" },
      { id: "eletrica-identificacao", group: "Documentação", label: "Conferência da identificação de circuitos" },
      { id: "eletrica-relatorio", group: "Documentação", label: "Relatório de anomalias, riscos e prioridades" },
    ],
    deliverables: ["Checklist dos quadros e circuitos", "Relatório fotográfico e termográfico", "Tabela de medições", "Plano de correções priorizado"],
    inclusions: ["Mão de obra técnica especializada", "Instrumentos de medição e termografia", "Etiquetas básicas de identificação"],
    exclusions: ["Troca de disjuntores, cabos e componentes", "Adequações civis ou de infraestrutura", "Laudo NR-10 ou prontuário elétrico, salvo contratação específica"],
  },
  {
    id: "REFRIGERACAO",
    name: "Refrigeração comercial",
    shortName: "Refrigeração",
    description: "Rotina para câmaras frias, balcões, expositores e unidades condensadoras.",
    accent: "cyan",
    title: "Plano de manutenção preventiva de refrigeração comercial",
    durationHours: 4,
    technicians: 2,
    scope: [
      { id: "ref-temperatura", group: "Operação", label: "Medição e registro das temperaturas de operação" },
      { id: "ref-vedacao", group: "Operação", label: "Inspeção de portas, cortinas e vedações" },
      { id: "ref-degelo", group: "Operação", label: "Teste de degelo, termostatos e controladores" },
      { id: "ref-evaporador", group: "Limpeza", label: "Limpeza do evaporador, bandeja e dreno" },
      { id: "ref-condensador", group: "Limpeza", label: "Limpeza da unidade condensadora" },
      { id: "ref-ventiladores", group: "Mecânica", label: "Inspeção de motores, hélices e vibrações" },
      { id: "ref-eletrica", group: "Elétrica", label: "Inspeção de painéis, contatores e conexões" },
      { id: "ref-corrente", group: "Elétrica", label: "Medição de tensão e corrente do compressor" },
      { id: "ref-vazamento", group: "Circuito frigorífico", label: "Inspeção de vazamentos e condição das tubulações" },
      { id: "ref-isolamento", group: "Circuito frigorífico", label: "Inspeção do isolamento térmico e pontos de condensação" },
    ],
    deliverables: ["Checklist por equipamento", "Registro de temperaturas e correntes", "Relatório fotográfico", "Lista de desvios e recomendações"],
    inclusions: ["Mão de obra técnica especializada", "Limpeza técnica básica", "Instrumentos de medição"],
    exclusions: ["Fluido refrigerante e peças", "Reparo de vazamentos", "Serviços emergenciais fora do horário acordado"],
  },
  {
    id: "PERSONALIZADO",
    name: "Plano personalizado",
    shortName: "Personalizado",
    description: "Comece com uma estrutura geral e monte um escopo sob medida.",
    accent: "violet",
    title: "Plano de manutenção preventiva personalizado",
    durationHours: 4,
    technicians: 1,
    scope: [
      { id: "custom-inspecao", group: "Inspeção", label: "Inspeção geral das condições de funcionamento" },
      { id: "custom-limpeza", group: "Manutenção", label: "Limpeza técnica dos componentes acessíveis" },
      { id: "custom-testes", group: "Testes", label: "Testes funcionais e registro de medições" },
      { id: "custom-relatorio", group: "Documentação", label: "Relatório técnico com evidências e recomendações" },
    ],
    deliverables: ["Checklist técnico", "Relatório fotográfico", "Recomendações de correção"],
    inclusions: ["Mão de obra técnica", "Ferramentas necessárias à inspeção"],
    exclusions: ["Peças, materiais e serviços corretivos"],
  },
];

export function getPreventiveTemplate(id: PreventiveTemplateId) {
  return preventiveTemplates.find((template) => template.id === id) || preventiveTemplates[0];
}
