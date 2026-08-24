import { prisma } from "@/lib/db";
import { defaultTaxRate, normalizeTaxRegime, TAX_REGIMES, TaxProfile } from "@/lib/tax";

import { getDynamicSimplesTaxProfile } from "@/lib/simplesTaxCalculation";

const REGIME_KEY = "company.fiscalRegime";
const RATE_KEY = "company.taxRate";

export async function loadTaxProfile(): Promise<TaxProfile> {
  const dynamicSimples = await getDynamicSimplesTaxProfile();
  if (dynamicSimples.regime === "SIMPLES_NACIONAL") {
    return {
      regime: "SIMPLES_NACIONAL",
      rate: dynamicSimples.rate,
      label: dynamicSimples.label,
      configured: true,
    };
  }

  const settings = await prisma.setting.findMany({
    where: { key: { in: [REGIME_KEY, RATE_KEY] } },
  });
  const values = new Map(settings.map((setting) => [setting.key, setting.value]));
  const regime = normalizeTaxRegime(values.get(REGIME_KEY));
  const storedRate = Number(values.get(RATE_KEY));
  const rate = Number.isFinite(storedRate) && storedRate >= 0 && storedRate <= 100
    ? storedRate
    : defaultTaxRate(regime);
  return { regime, rate, label: TAX_REGIMES[regime].label, configured: values.has(REGIME_KEY) && values.has(RATE_KEY) };
}

export async function persistTaxProfile(profile: Pick<TaxProfile, "regime" | "rate">) {
  await prisma.$transaction([
    prisma.setting.upsert({
      where: { key: REGIME_KEY },
      update: { value: profile.regime },
      create: { key: REGIME_KEY, value: profile.regime },
    }),
    prisma.setting.upsert({
      where: { key: RATE_KEY },
      update: { value: String(profile.rate) },
      create: { key: RATE_KEY, value: String(profile.rate) },
    }),
  ]);
}
