import { prisma } from "@/lib/db";
import { calculateSimples, SimplesAnnex } from "@/lib/simplesNacional";
import { TaxRegime } from "@/lib/tax";

const ANNEX_KEY = "company.simplesAnnex";
const REGIME_KEY = "company.fiscalRegime";
const RATE_KEY = "company.taxRate";

export interface SimplesTaxInfo {
  regime: TaxRegime;
  rate: number; // Alíquota Efetiva Calculada (ex: 7.82%)
  nominalRate: number; // Alíquota Nominal da Faixa (ex: 11.20%)
  bracket: number; // Faixa 1 a 6
  annex: SimplesAnnex; // "III" | "IV" | "V"
  rbt12: number; // Faturamento Acumulado dos últimos 12 meses (RBT12)
  deduction: number; // Parcela a deduzir da tabela do Simples
  limit: number; // Limite teto da faixa atual
  remaining: number; // Quanto falta para subir de faixa
  exceeded: boolean; // Se ultrapassou R$ 4,8Mi
  isDynamic: boolean;
  label: string;
}

/**
 * Calcula a Alíquota Efetiva Real do Simples Nacional baseada no faturamento acumulado dos últimos 12 meses (RBT12)
 */
export async function getDynamicSimplesTaxProfile(): Promise<SimplesTaxInfo> {
  const settings = await prisma.setting.findMany({
    where: { key: { in: [REGIME_KEY, RATE_KEY, ANNEX_KEY] } },
  });
  const values = new Map(settings.map((s) => [s.key, s.value]));

  const regimeRaw = values.get(REGIME_KEY) || "SIMPLES_NACIONAL";
  const regime: TaxRegime = regimeRaw in { SIMPLES_NACIONAL: 1, LUCRO_PRESUMIDO: 1, LUCRO_REAL: 1 }
    ? (regimeRaw as TaxRegime)
    : "SIMPLES_NACIONAL";

  const annexRaw = values.get(ANNEX_KEY) || "III";
  const annex: SimplesAnnex = ["III", "IV", "V"].includes(annexRaw)
    ? (annexRaw as SimplesAnnex)
    : "III";

  if (regime !== "SIMPLES_NACIONAL") {
    const storedRate = Number(values.get(RATE_KEY));
    const fallbackRate = regime === "LUCRO_PRESUMIDO" ? 15 : 18;
    const rate = Number.isFinite(storedRate) && storedRate >= 0 ? storedRate : fallbackRate;
    return {
      regime,
      rate,
      nominalRate: rate,
      bracket: 1,
      annex,
      rbt12: 0,
      deduction: 0,
      limit: 0,
      remaining: 0,
      exceeded: false,
      isDynamic: false,
      label: regime === "LUCRO_PRESUMIDO" ? "Lucro Presumido" : "Lucro Real",
    };
  }

  // Busca o faturamento bruto dos últimos 12 meses no contas a receber não cancelado
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const receivables = await prisma.accountsReceivable.aggregate({
    _sum: { totalValue: true },
    where: {
      issueDate: { gte: twelveMonthsAgo },
      status: { not: "CANCELADO" },
    },
  });

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthlyReceivables = await prisma.accountsReceivable.aggregate({
    _sum: { totalValue: true },
    where: {
      issueDate: { gte: startOfMonth },
      status: { not: "CANCELADO" },
    },
  });

  const rbt12 = Math.max(0, Number(receivables._sum.totalValue) || 0);
  const monthlyRevenue = Math.max(0, Number(monthlyReceivables._sum.totalValue) || 0);

  const simples = calculateSimples(rbt12, monthlyRevenue, annex);

  return {
    regime: "SIMPLES_NACIONAL",
    rate: simples.effectiveRate,
    nominalRate: simples.nominalRate,
    bracket: simples.bracket,
    annex,
    rbt12,
    deduction: simples.deduction,
    limit: simples.limit,
    remaining: simples.remaining,
    exceeded: simples.exceeded,
    isDynamic: true,
    label: `Simples Nacional (Anexo ${annex} - Faixa ${simples.bracket})`,
  };
}
