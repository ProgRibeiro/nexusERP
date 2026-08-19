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
  clientId: string;
  clientName: string;
  clientDocument: string;
  defaultPaymentTerms?: string | null;
  billingGroup?: string | null;
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
        quote: { select: { code: true, total: true, subtotal: true } },
      },
      orderBy: { completedAt: "asc" },
    });

    return queue.map((os) => {
      // Valor total integral da OS/Orçamento (serviços + materiais/peças vendidas no orçamento)
      const itemsVal = os.items.reduce((sum, item) => sum + Number(item.total), 0);
      const materialsVal = os.materials.reduce((sum, m) => {
        const qty = m.status === "UTILIZADO" ? (m.usedQuantity > 0 ? m.usedQuantity : m.quantity) : m.quantity;
        return sum + qty * Number(m.salePrice);
      }, 0);

      const address = os.address || os.client.addresses[0] || null;
      const mirror = os.billingMirrorJson && typeof os.billingMirrorJson === "object" && !Array.isArray(os.billingMirrorJson)
        ? os.billingMirrorJson as Record<string, unknown>
        : {};
      const mirrorString = (field: string, fallback: string) => typeof mirror[field] === "string" ? mirror[field] as string : fallback;

      const quoteTotal = os.quote?.total ? Number(os.quote.total) : 0;
      const calculatedValue = itemsVal + materialsVal;
      const finalBillingValue = quoteTotal > 0 ? quoteTotal : (calculatedValue > 0 ? calculatedValue : (typeof mirror.value === "number" && Number.isFinite(mirror.value) ? mirror.value as number : 0));
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
      if (finalBillingValue <= 0) missingFields.push("Valor");
      if (!email || email.endsWith("@importado.local")) missingFields.push("E-mail válido");
      if (!cep) missingFields.push("CEP");
      if (!addressNumber) missingFields.push("Número do endereço");

      return {
        id: os.id,
        code: os.code,
        clientId: os.clientId,
        clientName: os.client.name,
        clientDocument: os.client.cpfCnpj || "",
        defaultPaymentTerms: os.client.defaultPaymentTerms,
        billingGroup: os.client.billingGroup,
        type: os.type,
        completedAt: os.completedAt,
        value: finalBillingValue,
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

import { calculateDueDate } from "@/lib/paymentTerms";

/**
 * Registra no ERP uma nota já emitida no sistema fiscal externo:
 * 1. Salva os dados de controle e anexos (PDF/XML) da nota.
 * 2. Atualiza a OS para "FATURADA".
 * 3. Gera a cobrança no contas a receber com cálculo inteligente de vencimento (Hering 60d, 30d, 21d etc.).
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
  paymentTerms?: string;
  issueDate?: string;
  pdfDataUrl?: string;
  xmlDataUrl?: string;
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

    const issueDateParsed = data.issueDate ? new Date(data.issueDate) : new Date();
    const paymentTermsCode = data.paymentTerms || os.client?.defaultPaymentTerms || "LIQUIDO_30";

    let pdfUrl: string | null = null;
    let xmlUrl: string | null = null;
    if (data.pdfDataUrl) {
      pdfUrl = await saveBase64Asset(data.pdfDataUrl, `nf-${data.invoiceCode.trim()}-pdf`);
    }
    if (data.xmlDataUrl) {
      xmlUrl = await saveBase64Asset(data.xmlDataUrl, `nf-${data.invoiceCode.trim()}-xml`);
    }

    const result = await prisma.$transaction(async (tx) => {
      const claimed = await tx.serviceOrder.updateMany({
        where: { id: data.osId, status: "FATURAMENTO" },
        data: { status: "FATURADA" },
      });
      if (claimed.count !== 1) {
        throw new Error("Esta OS já foi faturada ou está sendo processada por outro usuário.");
      }

      const invoice = await tx.invoice.create({
        data: {
          code: data.invoiceCode.trim(),
          serviceOrderId: data.osId,
          clientId: os.clientId,
          value: data.totalValue,
          taxValue,
          status: "EMITIDA",
          issueDate: issueDateParsed,
          paymentTerms: paymentTermsCode,
          pdfUrl,
          xmlUrl,
          notes: data.notes || null,
        },
      });

      await tx.serviceOrder.update({
        where: { id: data.osId },
        data: {
          faturamentoStatus: "NF_EMITIDA",
          invoiceId: invoice.id,
        },
      });

      const valuePerInstallment = netTotal / data.installments;
      const receivables = [];

      for (let i = 1; i <= data.installments; i++) {
        const dueDate = data.expectedDueDate
          ? new Date(new Date(data.expectedDueDate).setDate(new Date(data.expectedDueDate).getDate() + 30 * (i - 1)))
          : calculateDueDate(issueDateParsed, paymentTermsCode, i);

        const rec = await tx.accountsReceivable.create({
          data: {
            clientId: os.clientId,
            serviceOrderId: data.osId,
            invoiceId: invoice.id,
            totalValue: valuePerInstallment,
            receivedValue: 0.0,
            pendingValue: valuePerInstallment,
            issueDate: issueDateParsed,
            dueDate,
            status: "ABERTO",
            paymentMethod: data.paymentMethod,
            category: data.category || "RECEITA_SERVICO",
            costCenter: data.costCenter || "GERAL",
            notes: `Parcela ${i}/${data.installments} da OS ${os.code}. Regra: ${paymentTermsCode}. ${data.notes || ""}`,
          },
        });
        receivables.push(rec);
      }

      await tx.serviceOrderStatusHistory.create({
        data: {
          serviceOrderId: data.osId,
          oldStatus: os.status,
          newStatus: "FATURADA",
          changedById: data.userId,
          justification: `Faturamento processado com a regra ${paymentTermsCode}. Emitida NF ${data.invoiceCode} no valor de R$ ${data.totalValue.toFixed(
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
          } parcelas (Regra: ${paymentTermsCode}) no valor unitário de R$ ${valuePerInstallment.toFixed(2)}.`,
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
          paymentTerms: paymentTermsCode,
          issueDate: issueDateParsed.toISOString(),
          installments: data.installments,
          totalValue: data.totalValue,
          hasPdf: Boolean(pdfUrl),
          hasXml: Boolean(xmlUrl),
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
 * Obtém as Notas Fiscais emitidas com seus comprovantes e dados para auditoria mensal.
 */
export async function getInvoices() {
  try {
    await requireAuth();

    const list = await prisma.invoice.findMany({
      include: {
        client: {
          select: { id: true, name: true, defaultPaymentTerms: true, billingGroup: true },
        },
        serviceOrder: { select: { code: true, purchaseOrder: true } },
        receivables: { select: { id: true, dueDate: true, status: true, pendingValue: true, totalValue: true, paymentDate: true, paymentMethod: true } },
      },
      orderBy: { issueDate: "desc" },
    });

    return list.map((inv) => ({
      ...inv,
      receivables: inv.receivables.map((r) => ({
        id: r.id,
        dueDate: r.dueDate,
        status: r.status,
        pendingValue: Number(r.pendingValue),
        totalValue: Number(r.totalValue),
      })),
    }));
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

/**
 * Registra faturamento avulso / direto (sem OS) no ERP:
 * Para terceirização, prestação de serviços diretos, consultorias ou vendas sem OS.
 */
export async function processDirectBilling(data: {
  clientId: string;
  serviceDescription: string;
  invoiceCode: string;
  totalValue: number;
  taxPercent: number;
  installments: number;
  paymentMethod: string;
  paymentTerms?: string;
  issueDate?: string;
  pdfDataUrl?: string;
  xmlDataUrl?: string;
  purchaseOrder?: string;
  notes?: string;
  userId: string;
}) {
  try {
    const session = await requirePermission("faturamento.write");
    data.userId = session.userId;

    const client = await prisma.client.findUnique({ where: { id: data.clientId } });
    if (!client) throw new Error("Cliente não encontrado.");

    if (!data.invoiceCode.trim()) throw new Error("Informe o número da nota fiscal.");
    if (!Number.isFinite(data.totalValue) || data.totalValue <= 0) throw new Error("Informe um valor válido.");
    if (!Number.isInteger(data.installments) || data.installments < 1) throw new Error("Informe ao menos 1 parcela.");

    const duplicate = await prisma.invoice.findUnique({ where: { code: data.invoiceCode.trim() } });
    if (duplicate) throw new Error("Já existe uma nota fiscal cadastrada com este número.");

    const taxValue = (data.totalValue * (data.taxPercent / 100)) || 0;
    const issueDateParsed = data.issueDate ? new Date(data.issueDate) : new Date();
    const paymentTermsCode = data.paymentTerms || client.defaultPaymentTerms || "LIQUIDO_30";

    let pdfUrl: string | null = null;
    let xmlUrl: string | null = null;
    if (data.pdfDataUrl) pdfUrl = await saveBase64Asset(data.pdfDataUrl, `nf-direta-${data.invoiceCode.trim()}-pdf`);
    if (data.xmlDataUrl) xmlUrl = await saveBase64Asset(data.xmlDataUrl, `nf-direta-${data.invoiceCode.trim()}-xml`);

    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          code: data.invoiceCode.trim(),
          serviceOrderId: null,
          clientId: client.id,
          value: data.totalValue,
          taxValue,
          status: "EMITIDA",
          issueDate: issueDateParsed,
          paymentTerms: paymentTermsCode,
          pdfUrl,
          xmlUrl,
          notes: `Faturamento Avulso (sem OS): ${data.serviceDescription}. ${data.notes || ""}`,
        },
      });

      const valuePerInstallment = data.totalValue / data.installments;
      const receivables = [];

      for (let i = 1; i <= data.installments; i++) {
        const dueDate = calculateDueDate(issueDateParsed, paymentTermsCode, i);
        const rec = await tx.accountsReceivable.create({
          data: {
            clientId: client.id,
            serviceOrderId: null,
            invoiceId: invoice.id,
            totalValue: valuePerInstallment,
            receivedValue: 0.0,
            pendingValue: valuePerInstallment,
            issueDate: issueDateParsed,
            dueDate,
            status: "ABERTO",
            paymentMethod: data.paymentMethod,
            category: "RECEITA_SERVICO",
            costCenter: "GERAL",
            notes: `Faturamento Avulso - Parcela ${i}/${data.installments}. ${data.serviceDescription}. Regra: ${paymentTermsCode}`,
          },
        });
        receivables.push(rec);
      }

      await tx.notification.create({
        data: {
          title: "Faturamento Avulso Registrado",
          message: `Faturamento direto de R$ ${data.totalValue.toFixed(2)} registrado para ${client.name} (NF ${data.invoiceCode}).`,
          type: "FINANCEIRO",
          link: "/faturamento",
        },
      });

      return { invoice, receivables };
    });

    await prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: "CRIACAO",
        entity: "FaturamentoAvulso",
        entityId: result.invoice.id,
        changesJson: JSON.stringify({
          clientName: client.name,
          invoiceCode: data.invoiceCode,
          totalValue: data.totalValue,
          serviceDescription: data.serviceDescription,
        }),
      },
    });

    revalidatePath("/faturamento");
    revalidatePath("/financeiro");
    revalidatePath("/");

    return { success: true, invoice: result.invoice, receivables: result.receivables };
  } catch (error: any) {
    logger.error("Erro no faturamento avulso:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Atualiza e ajusta os dados do Prontuário da Nota Fiscal faturada:
 * Permite alterar código da NF, data de emissão, regra de pagamento, vencimento customizado das parcelas, valores, notas e anexos.
 */
export async function updateInvoiceProntuario(data: {
  invoiceId: string;
  invoiceCode?: string;
  issueDate?: string;
  paymentTerms?: string;
  customDueDate?: string;
  totalValue?: number;
  taxPercent?: number;
  status?: string;
  notes?: string;
  pdfDataUrl?: string;
  xmlDataUrl?: string;
}) {
  try {
    const session = await requirePermission("faturamento.write");

    const invoice = await prisma.invoice.findUnique({
      where: { id: data.invoiceId },
      include: { receivables: true },
    });

    if (!invoice) throw new Error("Nota fiscal não encontrada.");

    let pdfUrl = invoice.pdfUrl;
    let xmlUrl = invoice.xmlUrl;
    if (data.pdfDataUrl) pdfUrl = await saveBase64Asset(data.pdfDataUrl, `nf-${data.invoiceCode || invoice.code}-pdf`);
    if (data.xmlDataUrl) xmlUrl = await saveBase64Asset(data.xmlDataUrl, `nf-${data.invoiceCode || invoice.code}-xml`);

    const issueDateParsed = data.issueDate ? new Date(data.issueDate) : invoice.issueDate;
    const paymentTermsCode = data.paymentTerms || invoice.paymentTerms || "LIQUIDO_30";
    const totalVal = data.totalValue !== undefined ? Number(data.totalValue) : invoice.value;
    const taxVal = data.taxPercent !== undefined ? (totalVal * (Number(data.taxPercent) / 100)) : invoice.taxValue;

    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        code: data.invoiceCode?.trim() || invoice.code,
        issueDate: issueDateParsed,
        paymentTerms: paymentTermsCode,
        value: totalVal,
        taxValue: taxVal,
        status: data.status || invoice.status,
        notes: data.notes !== undefined ? data.notes : invoice.notes,
        pdfUrl,
        xmlUrl,
      },
    });

    // Se a data de vencimento customizada ou a regra/data de emissão foram alteradas, atualizar Receivables não pagos
    const openReceivables = invoice.receivables.filter((r) => r.status !== "PAGO");
    if (openReceivables.length > 0) {
      for (let i = 0; i < openReceivables.length; i++) {
        const rec = openReceivables[i];
        let newDueDate: Date;
        if (data.customDueDate) {
          newDueDate = new Date(data.customDueDate);
        } else {
          newDueDate = calculateDueDate(issueDateParsed, paymentTermsCode, i + 1);
        }

        await prisma.accountsReceivable.update({
          where: { id: rec.id },
          data: {
            issueDate: issueDateParsed,
            dueDate: newDueDate,
            totalValue: totalVal / invoice.receivables.length,
            pendingValue: totalVal / invoice.receivables.length,
          },
        });
      }
    }

    if (data.pdfDataUrl && invoice.pdfUrl && invoice.pdfUrl !== pdfUrl) await deleteUploadedAsset(invoice.pdfUrl);
    if (data.xmlDataUrl && invoice.xmlUrl && invoice.xmlUrl !== xmlUrl) await deleteUploadedAsset(invoice.xmlUrl);

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "ATUALIZACAO",
        entity: "ProntuarioFaturamento",
        entityId: invoice.id,
        changesJson: JSON.stringify({
          code: updatedInvoice.code,
          paymentTerms: paymentTermsCode,
          issueDate: issueDateParsed.toISOString(),
          customDueDate: data.customDueDate || null,
        }),
      },
    });

    revalidatePath("/faturamento");
    revalidatePath("/financeiro");
    return { success: true, invoice: updatedInvoice };
  } catch (error: any) {
    logger.error("Erro ao atualizar prontuário de faturamento:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Registra o recebimento/quitação manual ("Dar Baixa no Recebimento") de uma Nota Fiscal e suas parcelas.
 */
export async function markInvoiceAsPaid(invoiceId: string, paymentDate?: string, paymentMethod?: string) {
  try {
    const session = await requirePermission("financeiro.write");

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { receivables: true, client: true },
    });

    if (!invoice) throw new Error("Nota fiscal não encontrada.");

    const payDate = paymentDate ? new Date(paymentDate) : new Date();
    const payMethod = paymentMethod || "PIX";

    await prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id: invoiceId },
        data: { status: "ENVIADA" },
      });

      for (const rec of invoice.receivables) {
        if (rec.status !== "PAGO") {
          await tx.accountsReceivable.update({
            where: { id: rec.id },
            data: {
              status: "PAGO",
              paymentDate: payDate,
              paymentMethod: payMethod,
              receivedValue: rec.totalValue,
              pendingValue: 0.0,
            },
          });

          await tx.financialTransaction.create({
            data: {
              type: "RECEITA",
              value: rec.totalValue,
              date: payDate,
              category: "RECEITA_SERVICO",
              costCenter: "GERAL",
              accountsReceivableId: rec.id,
              description: `Recebimento da NF ${invoice.code} - ${invoice.client.name}`,
            },
          });
        }
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "ATUALIZACAO",
        entity: "QuitacaoFaturamento",
        entityId: invoiceId,
        changesJson: JSON.stringify({ code: invoice.code, payDate }),
      },
    });

    revalidatePath("/faturamento");
    revalidatePath("/financeiro");
    return { success: true };
  } catch (error: any) {
    logger.error("Erro ao dar baixa de pagamento na NF:", error);
    return { success: false, error: error.message };
  }
}
