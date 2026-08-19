export interface PaymentTermOption {
  value: string;
  label: string;
  description: string;
}

export const PAYMENT_TERM_OPTIONS: PaymentTermOption[] = [
  {
    value: "LIQUIDO_30",
    label: "30 dias líquidos",
    description: "Vencimento em 30 dias corridos a partir da emissão da NF",
  },
  {
    value: "HERING_60",
    label: "Hering 60d (Dia 10 / Dia 25)",
    description: "60 dias líquidos: Emissão até dia 10 paga dia 10; após dia 10 paga dia 25 (após 60d)",
  },
  {
    value: "LIQUIDO_21",
    label: "21 dias líquidos",
    description: "Vencimento em 21 dias corridos a partir da emissão da NF",
  },
  {
    value: "LIQUIDO_15",
    label: "15 dias líquidos",
    description: "Vencimento em 15 dias corridos a partir da emissão da NF",
  },
  {
    value: "LIQUIDO_45",
    label: "45 dias líquidos",
    description: "Vencimento em 45 dias corridos a partir da emissão da NF",
  },
  {
    value: "LIQUIDO_60",
    label: "60 dias líquidos",
    description: "Vencimento em 60 dias corridos a partir da emissão da NF",
  },
  {
    value: "A_VISTA",
    label: "À vista / No ato",
    description: "Vencimento na própria data de emissão",
  },
];

/**
 * Retorna o nome amigável da regra de pagamento.
 */
export function getPaymentTermLabel(termRule?: string | null): string {
  if (!termRule) return "30 dias líquidos";
  const found = PAYMENT_TERM_OPTIONS.find((opt) => opt.value === termRule);
  return found ? found.label : termRule;
}

/**
 * Calcula a data de vencimento com base na data de emissão, regra de pagamento e índice da parcela.
 * 
 * Regra Especial HERING_60:
 * - 60 dias líquidos (2 meses após a emissão da NF).
 * - Se a nota for emitida ATÉ o dia 10 (inclusive): Vencimento no dia 10 do mês pós-60 dias.
 * - Se a nota for emitida APÓS o dia 10: Vencimento no dia 25 do mês pós-60 dias.
 */
export function calculateDueDate(
  issueDateInput: Date | string,
  termRule: string = "LIQUIDO_30",
  installmentIndex: number = 1
): Date {
  const issueDate = new Date(issueDateInput);
  if (isNaN(issueDate.getTime())) {
    return new Date();
  }

  const resultDate = new Date(issueDate);

  if (termRule === "HERING_60") {
    const issueDay = issueDate.getDate();
    // 60 dias líquidos = +2 meses. Para parcelas subsequentes, incrementa 1 mês por parcela.
    const monthOffset = 2 + (installmentIndex - 1);
    const targetMonth = issueDate.getMonth() + monthOffset;
    const targetYear = issueDate.getFullYear();
    const targetDay = issueDay <= 10 ? 10 : 25;

    // Criar a data no mês e ano calculados
    const calculated = new Date(targetYear, targetMonth, targetDay, 12, 0, 0);
    return calculated;
  }

  let daysAdd = 30;
  switch (termRule) {
    case "A_VISTA":
      daysAdd = 0;
      break;
    case "LIQUIDO_15":
      daysAdd = 15;
      break;
    case "LIQUIDO_21":
      daysAdd = 21;
      break;
    case "LIQUIDO_30":
      daysAdd = 30;
      break;
    case "LIQUIDO_45":
      daysAdd = 45;
      break;
    case "LIQUIDO_60":
      daysAdd = 60;
      break;
    default:
      daysAdd = 30;
      break;
  }

  // Multiplicar pelo número da parcela
  const totalDays = daysAdd * installmentIndex;
  resultDate.setDate(resultDate.getDate() + totalDays);
  return resultDate;
}
