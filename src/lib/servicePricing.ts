export interface ServicePricingInput {
  materialCost?: number;
  laborCost?: number;
  equipmentCost?: number;
  otherDirectCost?: number;
  payrollBurdenPercentage?: number;
  overheadPercentage?: number;
  riskPercentage?: number;
  profitPercentage?: number;
  serviceTaxPercentage?: number;
}

const safe = (value?: number) => Math.max(0, Number(value) || 0);
const pct = (value?: number) => Math.min(95, safe(value)) / 100;
const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

// Memória interna de formação do preço. Encargos de pessoal incidem apenas
// sobre mão de obra; tributos sobre faturamento ficam no denominador.
export function calculateServicePrice(input: ServicePricingInput) {
  const laborWithBurden = safe(input.laborCost) * (1 + pct(input.payrollBurdenPercentage));
  const directCost = safe(input.materialCost) + laborWithBurden + safe(input.equipmentCost) + safe(input.otherDirectCost);
  const operationalCost = directCost * (1 + pct(input.overheadPercentage) + pct(input.riskPercentage));
  const priceBeforeTax = operationalCost * (1 + pct(input.profitPercentage));
  const salePrice = priceBeforeTax / (1 - pct(input.serviceTaxPercentage));
  return {
    laborWithBurden: money(laborWithBurden),
    directCost: money(directCost),
    operationalCost: money(operationalCost),
    salePrice: money(salePrice),
    taxProvision: money(salePrice - priceBeforeTax),
  };
}
