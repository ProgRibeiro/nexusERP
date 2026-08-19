"use server";

import { logger } from "@/lib/logger";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAuth, requirePermission } from "@/lib/auth";
import { buildBillingDescription } from "@/lib/billingDescription";
import { deleteUploadedAsset, saveBase64Asset } from "@/lib/storage";

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
  serviceDescription: string;
  quoteCode: string;
  cnae: string;
  email: string;
  cep: string;
  addressNumber: string;
  purchaseOrder: string;
  isCnpj: boolean;
  missingFields: string[];
}

export interface BillingMirrorInput {
  legalName: string;
  clientDocument: string;
  value: number;
  description: string;
  cnae: string;
  email: string;
  cep: string;
  addressNumber: string;
  purchaseOrder: string;
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
        quote: { select: { code: true } },
      },
      orderBy: { completedAt: "asc" },
    });

    return queue.map((os) => {
      // Calcular valor total da OS (itens de serviço + materiais utilizados)
      const itemsVal = os.items.reduce((sum, item) => sum + Number(item.total), 0);
      const materialsVal = os.materials
        .filter((m) => m.status === "UTILIZADO")
        .reduce((sum, m) => sum + m.usedQuantity * Number(m.salePrice), 0);

      const calculatedValue = itemsVal + materialsVal;
      const address = os.address || os.client.addresses[0] || null;
      const mirror = os.billingMirrorJson && typeof os.billingMirrorJson === "object" && !Array.isArray(os.billingMirrorJson)
        ? os.billingMirrorJson as Record<string, unknown>
        : {};
      const mirrorString = (field: string, fallback: string) => typeof mirror[field] === "string" ? mirror[field] as string : fallback;
      const mirrorValue = typeof mirror.value === "number" && Number.isFinite(mirror.value) ? mirror.value : calculatedValue;
      const legalName = mirrorString("legalName", os.client.socialName || os.client.name);
      const serviceDescription = os.items.map((item) => item.description).filter(Boolean).join("; ");
      const purchaseOrder = os.purchaseOrder || "";
      const automaticDescription = buildBillingDescription({
        purchaseOrder,
        quoteCode: os.quote?.code,
        serviceOrderCode: os.code,
        serviceDescription,
      });
      const savedDescription = mirrorString("description", "");
      const description = !savedDescription || savedDescription === serviceDescription ? automaticDescription : savedDescription;
      const document = mirrorString("clientDocument", os.client.cpfCnpj || "").replace(/\D/g, "");
      const email = mirrorString("email", os.client.email);
      const cep = mirrorString("cep", address?.cep || "");
      const addressNumber = mirrorString("addressNumber", address?.number || "");
      const missingFields: string[] = [];
      if (!legalName) missingFields.push("Razão social / tomador");
      if (![11, 14].includes(document.length)) missingFields.push("CPF/CNPJ válido");
      if (mirrorValue <= 0) missingFields.push("Valor");
      if (!email || email.endsWith("@importado.local")) missingFields.push("E-mail válido");
      if (!cep) missingFields.push("CEP");
      if (!addressNumber) missingFields.push("Número do endereço");

      return {
        id: os.id,
        code: os.code,
        clientName: os.client.name,
        clientDocument: os.client.cpfCnpj || "",
        type: os.type,
        completedAt: os.completedAt,
        value: mirrorValue,
        marginReal: os.marginReal,
        legalName,
        description,
        serviceDescription,
        quoteCode: os.quote?.code || "",
        cnae: mirrorString("cnae", ""),
        email,
        cep,
        addressNumber,
        purchaseOrder,
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
 * Persiste os ajustes do espelho para que não sejam perdidos ao atualizar a tela.
 * O pedido de compra fica em campo próprio da OS e acompanha o histórico fiscal.
 */
export async function updateBillingMirror(osId: string, data: BillingMirrorInput) {
  try {
    const session = await requirePermission("faturamento.write");
    const normalized = {
      legalName: data.legalName.trim(),
      clientDocument: data.clientDocument.replace(/\D/g, ""),
      value: Number(data.value) || 0,
      description: data.description.trim(),
      cnae: data.cnae.replace(/\D/g, ""),
      email: data.email.trim(),
      cep: data.cep.replace(/\D/g, ""),
      addressNumber: data.addressNumber.trim(),
    };
    const purchaseOrder = data.purchaseOrder.trim().slice(0, 120);

    const serviceOrder = await prisma.serviceOrder.update({
      where: { id: osId },
      data: {
        purchaseOrder: purchaseOrder || null,
        billingMirrorJson: normalized,
      },
      select: { id: true, code: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "ATUALIZACAO",
        entity: "EspelhoFaturamento",
        entityId: serviceOrder.id,
        changesJson: JSON.stringify({ ...normalized, purchaseOrder }),
      },
    });

    revalidatePath("/faturamento");
    return { success: true, purchaseOrder, mirror: normalized };
  } catch (error: any) {
    logger.error("Erro ao salvar espelho de faturamento:", error);
    return { success: false, error: error.message };
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
  totalValue: number; // Valor Bruto
  taxPercent?: number;
  retentionValue?: number; // Valor de retenções fiscais em R$
  netValueToReceive?: number; // Valor líquido a receber em R$
  expectedDueDate?: string; // Data prevista para recebimento (vencimento)
  installments: number;
  paymentMethod: string;
  category?: string;
  costCenter?: string;
  notes?: string;
  userId: string;
}) {
  try {
    const session = await requirePermission("faturamento.write");
    data.userId = session.userId;

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

    const taxValue = data.retentionValue !== undefined && Number.isFinite(data.retentionValue)
      ? Math.max(0, data.retentionValue)
      : (data.totalValue * ((data.taxPercent || 0) / 100)) || 0;

    const netTotal = data.netValueToReceive !== undefined && Number.isFinite(data.netValueToReceive) && data.netValueToReceive > 0
      ? data.netValueToReceive
      : Math.max(0, data.totalValue - taxValue);

    // Usar transação para garantir integridade do faturamento
    const result = await prisma.$transaction(async (tx) => {
      const claimed = await tx.serviceOrder.updateMany({
        where: { id: data.osId, status: "FATURAMENTO" },
        data: { status: "FATURADA" },
      });
      if (claimed.count !== 1) {
        throw new Error("Esta OS já foi faturada ou está sendo processada por outro usuário.");
      }

      // 1. Criar Nota Fiscal (Invoice) com valor bruto e retenção
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
          faturamentoStatus: "NF_EMITIDA",
          invoiceId: invoice.id,
        },
      });

      // 3. Gerar as contas a receber (Receivables) com o valor líquido a receber e data prevista selecionada
      const valuePerInstallment = netTotal / data.installments;
      const receivables = [];
      const baseDueDate = data.expectedDueDate ? new Date(data.expectedDueDate) : new Date();

      for (let i = 1; i <= data.installments; i++) {
        const dueDate = new Date(baseDueDate);
        if (i > 1) {
          dueDate.setDate(dueDate.getDate() + 30 * (i - 1));
        }

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
            notes: `Parcela ${i}/${data.installments} da OS ${os.code}. Valor Bruto: R$ ${data.totalValue.toFixed(2)}. Retenção Impostos: R$ ${taxValue.toFixed(2)}. Líquido a Receber: R$ ${netTotal.toFixed(2)}. ${data.notes || ""}`,
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
          purchaseOrder: os.purchaseOrder || null,
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
        serviceOrder: { select: { code: true, purchaseOrder: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    logger.error("Erro ao obter notas fiscais:", error);
    return [];
  }
}

export async function saveInvoiceDocuments(data: {
  invoiceId: string;
  pdfDataUrl?: string;
  xmlDataUrl?: string;
  status?: "EMITIDA" | "ENVIADA" | "CANCELADA" | "SUBSTITUIDA";
}) {
  try {
    const session = await requirePermission("faturamento.write");
    const invoice = await prisma.invoice.findUnique({ where: { id: data.invoiceId } });
    if (!invoice) throw new Error("Nota fiscal não encontrada.");
    if (!data.pdfDataUrl && !data.xmlDataUrl && !data.status) throw new Error("Selecione um PDF, XML ou novo status.");

    let pdfUrl = invoice.pdfUrl;
    let xmlUrl = invoice.xmlUrl;
    if (data.pdfDataUrl) pdfUrl = await saveBase64Asset(data.pdfDataUrl, `nf-${invoice.code}-pdf`);
    if (data.xmlDataUrl) xmlUrl = await saveBase64Asset(data.xmlDataUrl, `nf-${invoice.code}-xml`);

    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: { pdfUrl, xmlUrl, status: data.status || invoice.status },
    });
    if (data.pdfDataUrl && invoice.pdfUrl && invoice.pdfUrl !== pdfUrl) await deleteUploadedAsset(invoice.pdfUrl);
    if (data.xmlDataUrl && invoice.xmlUrl && invoice.xmlUrl !== xmlUrl) await deleteUploadedAsset(invoice.xmlUrl);
    await prisma.auditLog.create({
      data: { userId: session.userId, action: "ATUALIZACAO", entity: "DocumentoFiscal", entityId: invoice.id, changesJson: JSON.stringify({ code: invoice.code, pdf: Boolean(data.pdfDataUrl), xml: Boolean(data.xmlDataUrl), status: updated.status }) },
    });
    revalidatePath("/faturamento");
    return { success: true, invoice: updated };
  } catch (error: unknown) {
    logger.error("Erro ao armazenar documentos fiscais:", error);
    return { success: false, error: error instanceof Error ? error.message : "Não foi possível armazenar os documentos." };
  }
}
