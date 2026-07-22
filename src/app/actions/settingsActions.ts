"use server";

import { prisma } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { persistTaxProfile, loadTaxProfile } from "@/lib/taxProfile";
import { normalizeTaxRegime } from "@/lib/tax";
import { calculateProposalTax } from "@/lib/tax";
import { revalidatePath } from "next/cache";

export async function getCompanyTaxProfile() {
  await requireAuth();
  return loadTaxProfile();
}

export async function saveCompanyTaxProfile(input: { regime: string; rate: number }) {
  try {
    const session = await requirePermission("admin.all");
    const regime = normalizeTaxRegime(input.regime);
    const rate = Number(input.rate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      throw new Error("A alíquota deve estar entre 0% e 100%.");
    }
    await persistTaxProfile({ regime, rate });
    const openQuotes = await prisma.quote.findMany({
      where: { status: { in: ["RASCUNHO", "ENVIADO", "PENDENTE", "NEGOCIACAO", "EM_NEGOCIACAO"] } },
      select: { id: true, subtotal: true, discount: true, costEstimate: true },
    });
    if (openQuotes.length) {
      await prisma.$transaction(openQuotes.map((quote) => {
        const calculation = calculateProposalTax(Number(quote.subtotal), Number(quote.discount), rate);
        return prisma.quote.update({
          where: { id: quote.id },
          data: {
            tax: calculation.tax,
            total: calculation.total,
            estimatedMargin: calculation.total - Number(quote.costEstimate),
          },
        });
      }));
    }
    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "ATUALIZACAO",
        entity: "ConfiguracaoTributaria",
        entityId: "company.taxProfile",
        changesJson: JSON.stringify({ regime, rate, recalculatedOpenProposals: openQuotes.length }),
      },
    });
    revalidatePath("/orcamentos");
    revalidatePath("/preventivas");
    return { success: true as const, profile: await loadTaxProfile(), recalculated: openQuotes.length };
  } catch (error: unknown) {
    return { success: false as const, error: error instanceof Error ? error.message : "Não foi possível salvar o perfil tributário." };
  }
}
