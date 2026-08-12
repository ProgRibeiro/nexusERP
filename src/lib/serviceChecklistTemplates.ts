export type ServiceModality =
  | "CLIMATIZACAO"
  | "ELETRICA"
  | "ILUMINACAO"
  | "HIDRAULICA"
  | "CIVIL"
  | "REFRIGERACAO"
  | "GERAL";

export interface ServiceChecklistItem {
  label: string;
  checked: boolean;
  modality?: ServiceModality;
}

export const SERVICE_MODALITIES: Array<{ value: ServiceModality; label: string; description: string }> = [
  { value: "CLIMATIZACAO", label: "Climatização / Ar-condicionado", description: "Split, cassete, VRF, fan coil, PMOC e ventilação." },
  { value: "ELETRICA", label: "Elétrica", description: "Quadros, circuitos, disjuntores, tomadas e medições." },
  { value: "ILUMINACAO", label: "Iluminação", description: "Luminárias, lâmpadas, drivers, emergência e comandos." },
  { value: "HIDRAULICA", label: "Hidráulica", description: "Tubulações, registros, louças, bombas, drenos e vazamentos." },
  { value: "CIVIL", label: "Civil / Acabamentos", description: "Pintura, alvenaria, gesso, piso, forro e acabamento." },
  { value: "REFRIGERACAO", label: "Refrigeração", description: "Câmaras, expositores, compressores e controle térmico." },
  { value: "GERAL", label: "Serviço geral / Multidisciplinar", description: "Roteiro básico para atendimentos diversos." },
];

const TEMPLATE_LABELS: Record<ServiceModality, string[]> = {
  CLIMATIZACAO: [
    "Confirmar bloqueio elétrico e condições seguras de acesso",
    "Registrar modelo, capacidade, número de série e identificação do equipamento",
    "Verificar filtros, serpentinas, turbina e bandeja de condensado",
    "Higienizar filtros e componentes previstos no escopo",
    "Testar dreno, bomba e possíveis pontos de vazamento",
    "Inspecionar conexões elétricas, contator, capacitor e proteções",
    "Verificar ruídos, vibrações e fixação das unidades",
    "Medir tensão, corrente e temperaturas de retorno e insuflamento",
    "Verificar pressão e indícios de vazamento de fluido refrigerante",
    "Executar teste funcional e registrar condição final",
  ],
  ELETRICA: [
    "Identificar circuito e confirmar desenergização antes da intervenção",
    "Conferir EPI, ferramentas isoladas e condição segura do local",
    "Registrar identificação, tensão e alimentação do quadro ou circuito",
    "Inspecionar cabos, terminais, barramentos e sinais de aquecimento",
    "Verificar aperto e integridade das conexões elétricas",
    "Testar disjuntores, fusíveis, DR, DPS e demais proteções aplicáveis",
    "Conferir aterramento, continuidade e identificação dos circuitos",
    "Medir tensão, corrente e equilíbrio entre fases quando aplicável",
    "Recolocar tampas, barreiras e sinalização de segurança",
    "Energizar, testar funcionamento e registrar condição final",
  ],
  ILUMINACAO: [
    "Identificar ambiente, circuito e tipo de luminária atendida",
    "Confirmar desenergização e acesso seguro ao ponto de trabalho",
    "Registrar marca, modelo, potência, temperatura de cor e soquete",
    "Inspecionar lâmpada, luminária, driver, reator e conexões",
    "Verificar interruptores, sensores, automação e comandos",
    "Testar iluminação de emergência e autonomia quando aplicável",
    "Substituir componentes previstos e conferir correta fixação",
    "Medir tensão no ponto e verificar oscilações ou aquecimento",
    "Testar acionamento e uniformidade da iluminação",
    "Limpar a área e registrar condição final com foto",
  ],
  HIDRAULICA: [
    "Identificar ponto, registro de bloqueio e origem da alimentação",
    "Isolar a área e fechar o abastecimento antes da intervenção",
    "Inspecionar tubulações, conexões, flexíveis, sifões e vedações",
    "Verificar torneiras, válvulas, registros, louças e metais",
    "Testar vazamentos visíveis e perda de pressão",
    "Inspecionar ralos, caixas sifonadas, drenos e escoamento",
    "Verificar bombas, boias e pressurizadores quando aplicável",
    "Executar reparo ou substituição prevista no escopo",
    "Reabrir o abastecimento e realizar teste de estanqueidade",
    "Limpar a área e registrar condição final",
  ],
  CIVIL: [
    "Isolar e proteger mobiliário, piso e área de circulação",
    "Registrar medidas, substrato, cor, acabamento e condição inicial",
    "Inspecionar trincas, umidade, infiltração e partes soltas",
    "Preparar a superfície conforme o serviço contratado",
    "Conferir materiais, lote, cor e especificação antes da aplicação",
    "Executar alvenaria, pintura, gesso, piso ou acabamento previsto",
    "Verificar alinhamento, nivelamento, cobertura e acabamento",
    "Respeitar tempo de cura ou secagem do material aplicado",
    "Remover proteções, resíduos e liberar a área com segurança",
    "Registrar fotos e aceite da condição final",
  ],
  REFRIGERACAO: [
    "Confirmar segurança elétrica e acesso ao equipamento",
    "Registrar equipamento, modelo, série e temperatura de ajuste",
    "Verificar evaporador, condensador, filtros e circulação de ar",
    "Inspecionar compressor, ventiladores, pressostatos e proteções",
    "Verificar dreno, degelo e formação anormal de gelo",
    "Inspecionar tubulações e indícios de vazamento de refrigerante",
    "Medir tensão, corrente, pressões e temperaturas do sistema",
    "Testar controlador, sensores e alarmes",
    "Higienizar componentes previstos no escopo",
    "Executar teste de funcionamento e registrar condição final",
  ],
  GERAL: [
    "Confirmar escopo com o responsável do local",
    "Isolar a área e verificar condições de segurança",
    "Registrar condição inicial e identificação do item atendido",
    "Executar o serviço conforme a solicitação da OS",
    "Conferir materiais e componentes utilizados",
    "Realizar limpeza e organização da área",
    "Executar teste funcional quando aplicável",
    "Registrar pendências, recomendações e condição final",
  ],
};

export function getServiceChecklistTemplate(modality?: string | null): ServiceChecklistItem[] {
  const normalized = (modality || "GERAL").toUpperCase() as ServiceModality;
  const selected = TEMPLATE_LABELS[normalized] ? normalized : "GERAL";
  return TEMPLATE_LABELS[selected].map((label) => ({ label, checked: false, modality: selected }));
}

export function inferServiceModality(text: string): ServiceModality {
  const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  if (/AR CONDICIONADO|CLIMAT|HVAC|PMOC|FAN COIL|VRF/.test(normalized)) return "CLIMATIZACAO";
  if (/REFRIG|CAMARA FRIA|EXPOSITOR|COMPRESSOR/.test(normalized)) return "REFRIGERACAO";
  if (/ILUMIN|LAMPADA|LUMINARIA|DRIVER|REATOR/.test(normalized)) return "ILUMINACAO";
  if (/ELETR|QUADRO|DISJUNTOR|TOMADA|CIRCUITO/.test(normalized)) return "ELETRICA";
  if (/HIDRAUL|VAZAMENTO|TORNEIRA|REGISTRO|TUBULAC|RAL0|RALO/.test(normalized)) return "HIDRAULICA";
  if (/PINTURA|ALVENARIA|GESSO|PISO|FORRO|CIVIL/.test(normalized)) return "CIVIL";
  return "GERAL";
}
