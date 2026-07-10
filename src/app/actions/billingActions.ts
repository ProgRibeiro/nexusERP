"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export interface BillingQueueItem {
  id: string;
  code: string;
  clientName: string;
  clientDocument: string;
  type: string;
  completedAt: Date | null;
  value: number;
  marginReal: number;
}

/**
 * Obtém a fila de OSs aguardando faturamento (status = FATURAMENTO ou CONCLUIDA)
 */
export async function getBillingQueue(): Promise<BillingQueueItem[]> {
  try {
    const queue = await prisma.serviceOrder.findMany({
      where: {
        status: {
          in: ["CONCLUIDA", "FATURAMENTO"],
        },
      },
      include: {
        client: true,
        items: true,
        materials: true,
      },
      orderBy: { completedAt: "asc" },
    });

    return queue.map((os) => {
      // Calcular valor total da OS (itens de serviço + materiais utilizados)
      const itemsVal = os.items.reduce((sum, item) => sum + item.total, 0);
      const materialsVal = os.materials
        .filter((m) => m.status === "UTILIZADO")
        .reduce((sum, m) => sum + m.usedQuantity * m.salePrice, 0);
      
      const value = itemsVal + materialsVal;

      return {
        id: os.id,
        code: os.code,
        clientName: os.client.name,
        clientDocument: os.client.cpfCnpj,
        type: os.type,
        completedAt: os.completedAt,
        value,
        marginReal: os.marginReal,
      };
    });
  } catch (error) {
    console.error("Erro ao obter fila de faturamento:", error);
    return [];
  }
}

/**
 * Executa o faturamento de uma OS:
 * 1. Emite a Nota Fiscal fictícia.
 * 2. Atualiza a OS para "FATURADA".
 * 3. Gera a cobrança no contas a receber (com suporte a parcelamento!).
 * 4. Alimenta logs de auditoria e notificações.
 */
export async function processBilling(data: {
  osId: string;
  invoiceCode: string;
  totalValue: number;
  taxPercent: number; // ex: 5 (ISS)
  installments: number; // número de parcelas
  paymentMethod: string; // PIX, BOLETO, CARTAO, etc.
  category?: string;
  costCenter?: string;
  notes?: string;
  userId: string;
}) {
  try {
    const os = await prisma.serviceOrder.findUnique({
      where: { id: data.osId },
      include: { client: true },
    });

    if (!os) throw new Error("Ordem de Serviço não encontrada.");

    const taxValue = (data.totalValue * (data.taxPercent / 100)) || 0;

    // Usar transação para garantir integridade do faturamento
    const result = await prisma.$transaction(async (tx) => {
      // 1. Criar Nota Fiscal (Invoice)
      const invoice = await tx.invoice.create({
        data: {
          code: data.invoiceCode,
          serviceOrderId: data.osId,
          clientId: os.clientId,
          value: data.totalValue,
          taxValue,
          status: "EMITIDA",
          pdfUrl: `/invoices/${data.invoiceCode.toLowerCase()}.pdf`,
        },
      });

      // 2. Atualizar OS para FATURADA e vincular a NF
      await tx.serviceOrder.update({
        where: { id: data.osId },
        data: {
          status: "FATURADA",
          faturamentoStatus: "NF_EMITIDA",
          invoiceId: invoice.id,
        },
      });

      // 3. Gerar as contas a receber (Receivables) - Suporta parcelamento!
      const valuePerInstallment = data.totalValue / data.installments;
      const receivables = [];

      for (let i = 1; i <= data.installments; i++) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30 * i); // Parcelas com intervalo de 30 dias

        const rec = await tx.accountsReceivable.create({
          data: {
            clientId: os.clientId,
            serviceOrderId: data.osId,
            invoiceId: invoice.id,
            totalValue: valuePerInstallment,
            receivedValue: 0.0,
            pendingValue: valuePerInstallment,
            dueDate,
            status: "ABERTO",
            paymentMethod: data.paymentMethod,
            category: data.category || "RECEITA_SERVICO",
            costCenter: data.costCenter || "GERAL",
            notes: `Parcela ${i}/${data.installments} da OS ${os.code}. Notas: ${data.notes || ""}`,
          },
        });
        receivables.push(rec);
      }

      // 4. Salvar histórico de alteração de status
      await tx.serviceOrderStatusHistory.create({
        data: {
          serviceOrderId: data.osId,
          oldStatus: os.status,
          newStatus: "FATURADA",
          changedById: data.userId,
          justification: `Faturamento processado. Emitida NF ${data.invoiceCode} no valor de R$ ${data.totalValue.toFixed(
            2
          )} em ${data.installments} parcela(s).`,
        },
      });

      // 5. Gerar notificação financeira
      await tx.notification.create({
        data: {
          title: "Contas a Receber Gerado",
          message: `Faturamento concluído para ${os.client.name}. Geradas ${
            data.installments
          } parcelas no valor unitário de R$ ${valuePerInstallment.toFixed(2)}.`,
          type: "FINANCEIRO",
          link: "/financeiro",
        },
      });

      return { invoice, receivables };
    });

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: "APROVACAO",
        entity: "Faturamento",
        entityId: data.osId,
        changesJson: JSON.stringify({
          osCode: os.code,
          invoiceCode: data.invoiceCode,
          installments: data.installments,
          totalValue: data.totalValue,
        }),
      },
    });

    revalidatePath("/faturamento");
    revalidatePath("/ordens-servico");
    revalidatePath("/financeiro");
    revalidatePath("/");

    return { success: true, invoice: result.invoice, receivables: result.receivables };
  } catch (error: any) {
    console.error("Erro ao processar faturamento:", error);
    return { success: false, error: error.message };
  }
}
