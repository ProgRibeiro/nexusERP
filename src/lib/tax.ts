export const TAX_REGIMES = {
  SIMPLES_NACIONAL: { label: "Simples Nacional", defaultRate: 6 },
  LUCRO_PRESUMIDO: { label: "Lucro Presumido", defaultRate: 15 },
  LUCRO_REAL: { label: "Lucro Real", defaultRate: 18 },
} as const;

export type TaxRegime = keyof typeof TAX_REGIMES;

export interface TaxProfile {
  regime: TaxRegime;
  rate: number;
  label: string;
  configured: boolean;
}

export function normalizeTaxRegime(value: string | null | undefined): TaxRegime {
  return value && value in TAX_REGIMES ? value as TaxRegime : "SIMPLES_NACIONAL";
}

export function defaultTaxRate(regime: TaxRegime) {
  return TAX_REGIMES[regime].defaultRate;
}

export function calculateProposalTax(subtotal: number, discount: number, rate: number) {
  const taxableBase = Math.max(0, subtotal - Math.max(0, discount));
  const safeRate = Math.min(100, Math.max(0, Number(rate) || 0));
  const tax = Math.round(taxableBase * (safeRate / 100) * 100) / 100;
  return { taxableBase, tax, total: Math.round((taxableBase + tax) * 100) / 100 };
}
