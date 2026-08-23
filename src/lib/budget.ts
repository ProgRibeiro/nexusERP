export interface BudgetRates {
  overhead: number;
  risk: number;
  financial: number;
  profit: number;
  tax: number;
}

export interface DetailedBdiRates {
  administration: number;
  financial: number;
  risk: number;
  insuranceGuarantee: number;
  profit: number;
  cofins: number;
  pis: number;
  cprb: number;
  iss: number;
  direct?: number | null;
}

export function calculateBdi(rates: DetailedBdiRates) {
  if (rates.direct !== undefined && rates.direct !== null) return { percentage: Number(rates.direct), source: "DIRECT" as const, taxTotal: rates.cofins + rates.pis + rates.cprb + rates.iss };
  const pct = (n: number) => Number(n || 0) / 100;
  const taxTotal = pct(rates.cofins) + pct(rates.pis) + pct(rates.cprb) + pct(rates.iss);
  if (taxTotal >= 1) throw new Error("A soma dos tributos do BDI deve ser menor que 100%.");
  const factor = ((1 + pct(rates.administration) + pct(rates.risk) + pct(rates.insuranceGuarantee)) * (1 + pct(rates.financial)) * (1 + pct(rates.profit))) / (1 - taxTotal);
  return { percentage: Math.round((factor - 1) * 10000) / 100, source: "MEMORY" as const, taxTotal: taxTotal * 100 };
}

export interface AbcRow { key: string; totalWithBdi: number; totalWithoutBdi: number; bdiValue: number; quantity: number; }
export function calculateAbc(rows: AbcRow[], limitA = 80, limitB = 95) {
  const sorted = [...rows].sort((a, b) => b.totalWithBdi - a.totalWithBdi);
  const total = sorted.reduce((sum, row) => sum + row.totalWithBdi, 0);
  let accumulated = 0;
  return sorted.map((row) => { const participation = total ? row.totalWithBdi / total * 100 : 0; accumulated += participation; return { ...row, participation, accumulated, class: accumulated <= limitA ? "A" : accumulated <= limitB ? "B" : "C" }; });
}

export function validateScheduleDistribution(distribution: number[]) {
  const total = distribution.reduce((a, b) => a + Number(b || 0), 0);
  if (distribution.some((v) => v < 0 || v > 100) || Math.abs(total - 100) > 0.001) throw new Error("A distribuição da etapa deve totalizar 100%.");
  return true;
}

/** Avalia somente números, operadores e parênteses; nunca executa JavaScript. */
export function evaluateQuantityExpression(expression: string) {
  const normalized = expression.replace(/,/g, ".").replace(/\s/g, "");
  if (!normalized || !/^[0-9.()+\-*/]+$/.test(normalized) || /\.\.|[+\-*/]{2,}/.test(normalized)) throw new Error("Memória de cálculo inválida.");
  const tokens = normalized.match(/\d+(?:\.\d+)?|[()+\-*/]/g) || [];
  const values: number[] = [], ops: string[] = [], precedence: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2 };
  const apply = () => { const op = ops.pop(); const b = values.pop() ?? 0; const a = values.pop() ?? 0; if (op === "/" && b === 0) throw new Error("Divisão por zero."); values.push(op === "+" ? a + b : op === "-" ? a - b : op === "*" ? a * b : a / b); };
  for (const token of tokens) { if (!Number.isNaN(Number(token))) values.push(Number(token)); else if (token === "(") ops.push(token); else if (token === ")") { while (ops.length && ops.at(-1) !== "(") apply(); if (ops.pop() !== "(") throw new Error("Parênteses inválidos."); } else { while (ops.length && ops.at(-1) !== "(" && precedence[ops.at(-1)!] >= precedence[token]) apply(); ops.push(token); } }
  while (ops.length) { if (ops.at(-1) === "(") throw new Error("Parênteses inválidos."); apply(); }
  const result = values[0]; if (!Number.isFinite(result) || result < 0) throw new Error("Resultado inválido."); return result;
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
