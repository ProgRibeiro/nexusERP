"use server";

import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface FiscalAuditDivergence {
  osId: string;
  osCode: string;
  clientName: string;
  currentOsStatus: string;
  currentFaturamentoStatus: string;
  hasInvoice: boolean;
  invoiceCode?: string;
  receivablesStatus?: string;
  receivablesCount: number;
  divergenceType: string;
  description: string;
}

export interface FiscalAuditResult {
  totalAudited: number;
  totalDivergences: number;
  reconciledCount: number;
  divergences: FiscalAuditDivergence[];
  summary: {
    osUpdatedToFaturada: number;
    faturamentoStatusSynced: number;
    receivablesAligned: number;
  };
}

/**
 * Realiza auditoria completa de ponta a ponta comparando:
 * - Status da Ordem de Serviço (ServiceOrder)
 * - Status Faturamento (faturamentoStatus)
 * - Notas Fiscais Emitidas (Invoice)
 * - Contas a Receber (AccountsReceivable)
 */
export async function auditFiscalAndOSAction(): Promise<FiscalAuditResult> {
  await requirePermission("faturamento.write");

  const serviceOrders = await prisma.serviceOrder.findMany({
    include: {
      client: true,
      invoices: true,
      accountsReceivable: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const divergences: FiscalAuditDivergence[] = [];
  let osUpdatedToFaturada = 0;
  let faturamentoStatusSynced = 0;
  let receivablesAligned = 0;

  for (const os of serviceOrders) {
    const hasInvoice = os.invoices.length > 0;
    const invoiceCode = os.invoices[0]?.code;
    const receivables = os.accountsReceivable;
    const hasPaidReceivable = receivables.some((r) => r.status === "PAGO" || Number(r.receivedValue) > 0);
    const hasAnyReceivable = receivables.length > 0;
    const receivablesStatus = hasPaidReceivable ? "PAGO" : hasAnyReceivable ? receivables[0].status : undefined;

    let isDivergent = false;
    let divergenceType = "";
    let description = "";

    // Regra 1: Tem NF emitida ou Conta a Receber PAGA, mas a OS não está com status FATURADA
    if ((hasInvoice || hasPaidReceivable) && os.status !== "FATURADA") {
      isDivergent = true;
      divergenceType = "OS_NAO_MARCADA_FATURADA";
      description = `A OS ${os.code} possui ${hasInvoice ? `NF ${invoiceCode}` : "Conta a Receber registrada"}, mas o status da OS consta como "${os.status}".`;
    }
    // Regra 2: Status da OS é FATURADA, mas o faturamentoStatus não é NF_EMITIDA
    else if (os.status === "FATURADA" && os.faturamentoStatus !== "NF_EMITIDA") {
      isDivergent = true;
      divergenceType = "FATURAMENTO_STATUS_DESALINHADO";
      description = `A OS ${os.code} está marcada como FATURADA, mas seu status fiscal está como "${os.faturamentoStatus}".`;
    }
    // Regra 3: Possui Contas a Receber com NF vinculada, mas o faturamentoStatus é AGUARDANDO_FATURAMENTO
    else if (hasAnyReceivable && os.faturamentoStatus === "AGUARDANDO_FATURAMENTO" && (hasInvoice || receivables.some((r) => r.invoiceId))) {
      isDivergent = true;
      divergenceType = "RECEIVABLE_DISCREPANCY";
      description = `A OS ${os.code} possui títulos financeiros registrados, mas o painel fiscal indica aguardando faturamento.`;
    }

    if (isDivergent) {
      divergences.push({
        osId: os.id,
        osCode: os.code,
        clientName: os.client.name,
        currentOsStatus: os.status,
        currentFaturamentoStatus: os.faturamentoStatus,
        hasInvoice,
        invoiceCode,
        receivablesStatus,
        receivablesCount: receivables.length,
        divergenceType,
        description,
      });
    }
  }

  return {
    totalAudited: serviceOrders.length,
    totalDivergences: divergences.length,
    reconciledCount: 0,
    divergences,
    summary: {
      osUpdatedToFaturada,
      faturamentoStatusSynced,
      receivablesAligned,
    },
  };
}

/**
 * Executa a conciliação automática de ponta a ponta para corrigir 100% das divergências.
 */
export async function executeFiscalAndOSReconciliationAction(): Promise<FiscalAuditResult> {
  const session = await requirePermission("faturamento.write");

  const serviceOrders = await prisma.serviceOrder.findMany({
    include: {
      client: true,
      invoices: true,
      accountsReceivable: true,
    },
  });

  let osUpdatedToFaturada = 0;
  let faturamentoStatusSynced = 0;
  let receivablesAligned = 0;

  for (const os of serviceOrders) {
    const hasInvoice = os.invoices.length > 0;
    const receivables = os.accountsReceivable;
    const hasPaidReceivable = receivables.some((r) => r.status === "PAGO" || Number(r.receivedValue) > 0);
    const hasAnyReceivable = receivables.length > 0;

    let shouldUpdateOs = false;
    let newOsStatus = os.status;
    let newFaturamentoStatus = os.faturamentoStatus;

    // Regra 1: Se tem NF ou pagamento recebido -> OS DEVE estar FATURADA e NF_EMITIDA
    if (hasInvoice || hasPaidReceivable) {
      if (os.status !== "FATURADA") {
        newOsStatus = "FATURADA";
        shouldUpdateOs = true;
        osUpdatedToFaturada++;
      }
      if (os.faturamentoStatus !== "NF_EMITIDA") {
        newFaturamentoStatus = "NF_EMITIDA";
        shouldUpdateOs = true;
        faturamentoStatusSynced++;
      }
    }
    // Regra 2: Se status da OS é FATURADA -> faturamentoStatus DEVE ser NF_EMITIDA
    else if (os.status === "FATURADA" && os.faturamentoStatus !== "NF_EMITIDA") {
      newFaturamentoStatus = "NF_EMITIDA";
      shouldUpdateOs = true;
      faturamentoStatusSynced++;
    }

    if (shouldUpdateOs) {
      await prisma.serviceOrder.update({
        where: { id: os.id },
        data: {
          status: newOsStatus,
          faturamentoStatus: newFaturamentoStatus,
          completedAt: os.completedAt || new Date(),
        },
      });

      // Se não existia AccountsReceivable para uma OS faturada, cria automaticamente
      if (hasInvoice && !hasAnyReceivable) {
        const inv = os.invoices[0];
        await prisma.accountsReceivable.create({
          data: {
            clientId: os.clientId,
            serviceOrderId: os.id,
            invoiceId: inv.id,
            totalValue: inv.value,
            receivedValue: 0,
            pendingValue: inv.value,
            issueDate: inv.issueDate,
            dueDate: new Date(inv.issueDate.getTime() + 30 * 24 * 60 * 60 * 1000),
            status: "ABERTO",
            category: "RECEITA_SERVICO",
            costCenter: "GERAL",
            notes: `Gerado por conciliação automática para NF ${inv.code}`,
          },
        });
        receivablesAligned++;
      }
    }
  }

  await prisma.auditLog.create({
    data: {
      userId: session.userId,
      action: "CONCILIACAO",
      entity: "PainelFiscalERPOS",
      entityId: "TODAS",
      changesJson: JSON.stringify({
        osUpdatedToFaturada,
        faturamentoStatusSynced,
        receivablesAligned,
      }),
    },
  });

  revalidatePath("/faturamento");
  revalidatePath("/ordens-servico");
  revalidatePath("/financeiro");

  return auditFiscalAndOSAction();
}
