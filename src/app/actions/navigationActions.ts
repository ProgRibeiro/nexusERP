"use server";

import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { logger } from "@/lib/logger";

export interface NavigationIndicators {
  os: number;
  faturamento: number;
  fiscalErrors: number;
  overdue: number;
  stock: number;
}

export async function getNavigationIndicators(): Promise<NavigationIndicators> {
  try {
    await requireAuth();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [os, faturamento, fiscalErrors, overdue, stock] = await Promise.all([
      prisma.serviceOrder.count({
        where: {
          status: { in: ["CRIADA", "AGUARDANDO_AGENDAMENTO", "AGENDADA", "DESLOCAMENTO", "EXECUCAO", "PAUSADA", "AGUARDANDO_PECA", "AGUARDANDO_CLIENTE", "RETORNO"] },
        },
      }),
      prisma.serviceOrder.count({ where: { status: "FATURAMENTO" } }),
      prisma.invoice.count({ where: { status: { in: ["REJEITADA", "ERRO"] } } }),
      prisma.accountsReceivable.count({
        where: { dueDate: { lt: today }, status: { notIn: ["PAGO", "CANCELADO", "CANCELADA", "ESTORNADO"] } },
      }),
      prisma.product.count({ where: { stockQuantity: { lte: prisma.product.fields.minStock } } }).catch(() => 0),
    ]);

    return { os, faturamento, fiscalErrors, overdue, stock };
  } catch (error) {
    logger.error("Erro ao carregar indicadores da navegação:", error);
    return { os: 0, faturamento: 0, fiscalErrors: 0, overdue: 0, stock: 0 };
  }
}
