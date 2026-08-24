"use server";

import { prisma } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { getDynamicSimplesTaxProfile, SimplesTaxInfo } from "@/lib/simplesTaxCalculation";
import { revalidatePath } from "next/cache";

/**
 * Obtém o status tributário completo do Simples Nacional com cálculo de RBT12 e alíquota efetiva.
 */
export async function getSimplesTaxStatusAction(): Promise<SimplesTaxInfo> {
  await requireAuth();
  return getDynamicSimplesTaxProfile();
}

/**
 * Atualiza automaticamente a alíquota de impostos de todas as propostas/orçamentos em RASCUNHO
 * para a alíquota efetiva atual do Simples Nacional (baseada na evolução do RBT12).
 */
export async function recalculateDraftQuotesTaxAction() {
  await requireAuth();
  await requirePermission("comercial.write");

  const simplesInfo = await getDynamicSimplesTaxProfile();
  const newRate = simplesInfo.rate;

  const draftQuotes = await prisma.quote.findMany({
    where: { status: "RASCUNHO" },
    select: {
      id: true,
      subtotal: true,
      discount: true,
      finalValueOverride: true,
    },
  });

  let updatedCount = 0;

  for (const quote of draftQuotes) {
    const subtotal = Number(quote.subtotal) || 0;
    const discount = Number(quote.discount) || 0;
    const taxableBase = Math.max(0, subtotal - discount);
    const newTax = Math.round(taxableBase * (newRate / 100) * 100) / 100;
    const newTotal = quote.finalValueOverride
      ? Number(quote.finalValueOverride)
      : Math.round((taxableBase + newTax) * 100) / 100;

    await prisma.quote.update({
      where: { id: quote.id },
      data: {
        taxPercentage: newRate,
        tax: newTax,
        total: newTotal,
      },
    });
    updatedCount++;
  }

  revalidatePath("/orcamentos");
  revalidatePath("/comercial");
  revalidatePath("/financeiro");

  return {
    success: true,
    updatedCount,
    newRate,
    simplesInfo,
  };
}
