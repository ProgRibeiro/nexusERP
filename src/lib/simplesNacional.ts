export type SimplesAnnex = "III" | "IV" | "V";

const TABLES: Record<SimplesAnnex, Array<[number, number, number]>> = {
  III: [[180000,6,0],[360000,11.2,9360],[720000,13.5,17640],[1800000,16,35640],[3600000,21,125640],[4800000,33,648000]],
  IV: [[180000,4.5,0],[360000,9,8100],[720000,10.2,12420],[1800000,14,39780],[3600000,22,183780],[4800000,33,828000]],
  V: [[180000,15.5,0],[360000,18,4500],[720000,19.5,9900],[1800000,20.5,17100],[3600000,23,62100],[4800000,30.5,540000]],
};

export function calculateSimples(rbt12: number, monthlyRevenue: number, annex: SimplesAnnex) {
  const revenue = Math.max(0, Number(rbt12) || 0);
  const rowIndex = TABLES[annex].findIndex(([limit]) => revenue <= limit);
  const index = rowIndex < 0 ? TABLES[annex].length - 1 : rowIndex;
  const [limit, nominalRate, deduction] = TABLES[annex][index];
  const effectiveRate = revenue > 0 ? ((revenue * nominalRate / 100) - deduction) / revenue * 100 : nominalRate;
  const taxEstimate = Math.max(0, monthlyRevenue * effectiveRate / 100);
  const previousLimit = index === 0 ? 0 : TABLES[annex][index - 1][0];
  return { bracket: index + 1, limit, previousLimit, nominalRate, deduction, effectiveRate, taxEstimate, remaining: Math.max(0, limit - revenue), exceeded: revenue > 4800000 };
}
