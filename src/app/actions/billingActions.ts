"use server";

import { logger } from "@/lib/logger";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAuth, requirePermission } from "@/lib/auth";

export interface BillingQueueItem {
  id: string;
  code: string;
  clientName: string;
  clientDocument: string;
  type: string;
  completedAt: Date | null;
  value: number;
  marginReal: number;
  legalName: string;
  description: string;
  cnae: string;
  email: string;
  cep: string;
  addressNumber: string;
  isCnpj: boolean;
  missingFields: string[];
}

/**
 * Obtém a fila de OSs efetivamente liberadas para faturamento.
 */
export async function getBillingQueue(): Promise<BillingQueueItem[]> {
  try {
    await requireAuth();

    const queue = await prisma.serviceOrder.findMany({
      where: {
        status: "FATURAMENTO",
      },
      include: {
        client: { include: { addresses: true } },
        address: true,
        items: true,
        materials: true,
      },
      orderBy: { completedAt: "asc" },
    });

    return queue.map((os) => {
      // Calcular valor total da OS (itens de serviço + materiais utilizados)
      const itemsVal = os.items.reduce((sum, item) => sum + Number(item.total), 0);
      const materialsVal = os.materials
        .filter((m) => m.status === "UTILIZADO")
        .reduce((sum, m) => sum + m.usedQuantity * Number(m.salePrice), 0);

      const value = itemsVal + materialsVal;
      const address = os.address || os.client.addresses[0] || null;
      const legalName = os.client.socialName || os.client.name;
      const description = os.items.map((item) => item.description).filter(Boolean).join("; ");
      const document = os.client.cpfCnpj.replace(/\D/g, "");
      const missingFields: string[] = [];
      if (!legalName) missingFields.push("Razão social / tomador");
      if (![11, 14].includes(document.length)) missingFields.push("CPF/CNPJ válido");
      if (value <= 0) missingFields.push("Valor");
      if (!os.client.email || os.client.email.endsWith("@importado.local")) missingFields.push("E-mail válido");
      if (!address?.cep) missingFields.push("CEP");
      if (!address?.number) missingFields.push("Número do endereço");

      return {
        id: os.id,
        code: os.code,
        clientName: os.client.name,
        clientDocument: os.client.cpfCnpj,
        type: os.type,
        completedAt: os.completedAt,
        value,
        marginReal: os.marginReal,
        legalName,
        description,
        cnae: "",
        email: os.client.email,
        cep: address?.cep || "",
        addressNumber: address?.number || "",
        isCnpj: document.length === 14,
        missingFields,
      };
    });
  } catch (error) {
    logger.error("Erro ao obter fila de faturamento:", error);
    return [];
  }
}

/**
 * Registra no ERP uma nota já emitida no sistema fiscal externo:
 * 1. Salva os dados de controle da nota.
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
    const session = await requirePermission("faturamento.write");
    data.userId = session.userId; // nunca confiar no valor vindo do client

    const os = await prisma.serviceOrder.findUnique({
      where: { id: data.osId },
      include: { client: true },
    });

    if (!os) throw new Error("Ordem de Serviço não encontrada.");
    if (os.status !== "FATURAMENTO") {
      throw new Error("A OS precisa estar liberada para faturamento antes de registrar a nota fiscal.");
    }
    if (!data.invoiceCode.trim()) throw new Error("Informe o número da nota fiscal.");
    if (!Number.isFinite(data.totalValue) || data.totalValue <= 0) throw new Error("Informe um valor válido para a nota fiscal.");
    if (!Number.isInteger(data.installments) || data.installments < 1) throw new Error("Informe ao menos uma parcela.");
    const duplicateInvoice = await prisma.invoice.findUnique({ where: { code: data.invoiceCode.trim() } });
    if (duplicateInvoice) throw new Error("Já existe uma nota fiscal cadastrada com este número.");

    const taxValue = (data.totalValue * (data.taxPercent / 100)) || 0;

    // Usar transação para garantir integridade do faturamento
    const result = await prisma.$transaction(async (tx) => {
      // 1. Criar Nota Fiscal (Invoice)
      const invoice = await tx.invoice.create({
        data: {
          code: data.invoiceCode.trim(),
          serviceOrderId: data.osId,
          clientId: os.clientId,
          value: data.totalValue,
          taxValue,
          status: "EMITIDA",
          pdfUrl: null,
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
    logger.error("Erro ao processar faturamento:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Obtém as Notas Fiscais emitidas
 */
export async function getInvoices() {
  try {
    await requireAuth();

    return await prisma.invoice.findMany({
      include: {
        client: true,
        serviceOrder: { select: { code: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    logger.error("Erro ao obter notas fiscais:", error);
    return [];
  }
}
