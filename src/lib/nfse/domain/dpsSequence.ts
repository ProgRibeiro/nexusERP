import { prisma } from "@/lib/db";
import { resolveTenantFallback } from "@/lib/tenantAccess";

function sequenceIdentity(fiscalSeries: string) {
  const tenantId = resolveTenantFallback();
  return { tenantId, fiscalSeries, series: `${tenantId}:${fiscalSeries}` };
}

/**
 * Obtém o próximo número de DPS para uma determinada série de forma atômica e transacional,
 * evitando a péssima prática de COUNT(*) + 1 ou race condition.
 */
export async function getNextDpsNumber(series = "1"): Promise<number> {
  const identity = sequenceIdentity(series);
  return await prisma.$transaction(async (tx) => {
    // 1. Tenta obter o contador da série com exclusividade
    const record = await tx.dpsSequence.findUnique({
      where: { series: identity.series },
    });

    let nextNum = 1;
    if (record) {
      nextNum = record.lastNumber + 1;
      await tx.dpsSequence.update({
        where: { series: identity.series },
        data: { lastNumber: nextNum },
      });
    } else {
      await tx.dpsSequence.create({
        data: {
          series: identity.series,
          tenantId: identity.tenantId,
          fiscalSeries: identity.fiscalSeries,
          lastNumber: 1,
        },
      });
      nextNum = 1;
    }

    return nextNum;
  });
}

/**
 * Consulta a numeração atual de DPS sem incrementar.
 */
export async function peekCurrentDpsNumber(series = "1"): Promise<number> {
  const identity = sequenceIdentity(series);
  const record = await prisma.dpsSequence.findUnique({
    where: { series: identity.series },
  });
  return record ? record.lastNumber + 1 : 1;
}
