export interface BudgetRates {
  overhead: number;
  risk: number;
  financial: number;
  profit: number;
  tax: number;
}

const rate = (value: number) => Math.min(99, Math.max(0, Number(value) || 0)) / 100;
const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

// Estrutura de BDI: custos indiretos e risco, despesas financeiras e lucro
// são compostos; tributos incidentes sobre faturamento ficam no denominador.
export function calculateProfessionalBudget(directCost: number, discount: number, rates: BudgetRates) {
  const base = Math.max(0, money(directCost - discount));
  const overhead = rate(rates.overhead);
  const risk = rate(rates.risk);
  const financial = rate(rates.financial);
  const profit = rate(rates.profit);
  const tax = Math.min(0.95, rate(rates.tax));
  const factor = ((1 + overhead + risk) * (1 + financial) * (1 + profit)) / (1 - tax);
  const total = money(base * factor);
  const bdiValue = money(total - base);
  return { base, total, bdiValue, bdiPercentage: base > 0 ? money((factor - 1) * 100) : 0, factor };
}
