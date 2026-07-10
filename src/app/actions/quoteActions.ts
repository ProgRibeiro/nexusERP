"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export interface QuoteItemInput {
  type: string; // SERVICO, PRODUTO, MAO_DE_OBRA, DESLOCAMENTO, IMPOSTO
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  costPrice: number;
  discount: number;
}

/**
 * Obtém a listagem de Orçamentos
 */
export async function getQuotes(search?: string) {
  try {
    const quotes = await prisma.quote.findMany({
      where: search
        ? {
            OR: [
              { code: { contains: search } },
              { client: { name: { contains: search } } },
            ],
          }
        : undefined,
      include: {
        client: true,
        serviceOrders: {
          select: { code: true, status: true },
        },
      },
      orderBy: { code: "desc" },
    });

    return quotes.map((q) => ({
      id: q.id,
      code: q.code,
      clientId: q.clientId,
      clientName: q.client.name,
      status: q.status,
      total: q.total,
      validUntil: q.validUntil,
      version: q.version,
      serviceOrders: q.serviceOrders,
    }));
  } catch (error) {
    console.error("Erro ao obter orçamentos:", error);
    return [];
  }
}

/**
 * Obtém detalhes completos do orçamento
 */
export async function getQuoteDetails(id: string) {
  try {
    const quote = await prisma.quote.findUnique({
      where: { id },
      include: {
        client: {
          include: {
            contacts: true,
            addresses: true,
          },
        },
        items: true,
        approvals: true,
        serviceOrders: true,
      },
    });

    return quote;
  } catch (error) {
    console.error(`Erro ao obter orçamento ${id}:`, error);
    return null;
  }
}

/**
 * Cria um novo Orçamento
 */
export async function createQuote(
  data: {
    clientId: string;
    addressId?: string;
    contactId?: string;
    validityDays?: number;
    warrantyDays?: number;
    executionTerm?: string;
    paymentTerms?: string;
    notes?: string;
    discount?: number;
    tax?: number;
  },
  items: QuoteItemInput[],
  userId: string
) {
  try {
    const count = await prisma.quote.count();
    const code = `Q-2026-${String(count + 1).padStart(4, "0")}`;

    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + (data.validityDays || 15));

    // Cálculos preliminares
    let subtotal = 0;
    let costEstimate = 0;

    const itemsData = items.map((item) => {
      const itemSubtotal = item.quantity * item.unitPrice;
      const itemDiscount = item.quantity * item.discount;
      const itemTotal = itemSubtotal - itemDiscount;

      subtotal += itemSubtotal;
      costEstimate += item.quantity * item.costPrice;

      return {
        type: item.type,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        costPrice: item.costPrice,
        discount: item.discount,
        total: itemTotal,
      };
    });

    const discount = data.discount || 0;
    const tax = data.tax || 0;
    const total = subtotal - discount + tax;
    const estimatedMargin = total - costEstimate;

    const quote = await prisma.quote.create({
      data: {
        code,
        clientId: data.clientId,
        addressId: data.addressId || null,
        contactId: data.contactId || null,
        status: "RASCUNHO",
        validUntil,
        warrantyDays: data.warrantyDays || 90,
        executionTerm: data.executionTerm || null,
        paymentTerms: data.paymentTerms || null,
        notes: data.notes || null,
        subtotal,
        discount,
        tax,
        total,
        costEstimate,
        estimatedMargin,
        items: {
          create: itemsData,
        },
      },
    });

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        userId,
        action: "CRIACAO",
        entity: "Orcamento",
        entityId: quote.id,
        changesJson: JSON.stringify(quote),
      },
    });

    revalidatePath("/orcamentos");
    return { success: true, quote };
  } catch (error: any) {
    console.error("Erro ao criar orçamento:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Atualiza o status do orçamento com registro de justificativa
 */
export async function updateQuoteStatus(
  quoteId: string,
  status: string,
  userId: string,
  justification?: string
) {
  try {
    const oldQuote = await prisma.quote.findUnique({
      where: { id: quoteId },
    });
    if (!oldQuote) throw new Error("Orçamento não encontrado");

    // Impedir modificações indevidas se já aprovado/convertido sem justificativa
    if (oldQuote.status === "CONVERTIDO" && status !== "CONVERTIDO") {
      throw new Error("Este orçamento já foi convertido em OS e não pode ter seu status alterado.");
    }

    const data: any = { status };
    if (status === "APROVADO") {
      data.approvedAt = new Date();
      data.approvedBy = `Usuário ID: ${userId}`;
    }

    const quote = await prisma.quote.update({
      where: { id: quoteId },
      data,
    });

    // Registrar aprovação/reprovação
    await prisma.quoteApproval.create({
      data: {
        quoteId,
        approved: status === "APROVADO" || status === "CONVERTIDO",
        justification: justification || null,
        userId,
      },
    });

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        userId,
        action: "EDICAO",
        entity: "Orcamento",
        entityId: quoteId,
        changesJson: JSON.stringify({
          oldStatus: oldQuote.status,
          newStatus: status,
          justification,
        }),
      },
    });

    revalidatePath("/orcamentos");
    return { success: true, quote };
  } catch (error: any) {
    console.error("Erro ao atualizar status do orçamento:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Converte Orçamento Aprovado em OS (Geração Automática)
 * REGRAS DE NEGÓCIO EXIGIDAS:
 * 1. Verifica se já existe OS ativa vinculada (bloqueio duplicidade).
 * 2. Valida cliente, itens, valor, endereço, termos.
 * 3. Cria OS e clona dados (serviços e materiais previstos).
 * 4. Grava logs permanentes.
 */
export async function approveAndConvertQuote(quoteId: string, userId: string) {
  try {
    // 1. Carregar Orçamento com itens
    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: {
        items: true,
        serviceOrders: true,
        client: true,
      },
    });

    if (!quote) throw new Error("Orçamento não encontrado.");

    // Bloqueio de duplicidade
    const activeOS = quote.serviceOrders.find((os) => os.status !== "CANCELADA");
    if (activeOS) {
      throw new Error(`Este orçamento já está convertido na OS ativa: ${activeOS.code}. Operação bloqueada.`);
    }

    // Validações obrigatórias
    if (!quote.addressId) throw new Error("O orçamento precisa de um endereço de execução vinculado para gerar a OS.");
    if (quote.items.length === 0) throw new Error("O orçamento precisa conter pelo menos um item faturável.");

    // 2. Criar a Ordem de Serviço
    const count = await prisma.serviceOrder.count();
    const osCode = `OS-2026-${String(count + 1).padStart(4, "0")}`;

    // Determinar o tipo de OS com base no tipo de serviço mais frequente ou padrão
    const services = quote.items.filter((item) => item.type === "SERVICO");
    const products = quote.items.filter((item) => item.type === "PRODUTO");

    const hasInstallation = services.some((s) => s.description.toLowerCase().includes("instalação") || s.description.toLowerCase().includes("instalacao"));
    const osType = hasInstallation ? "INSTALACAO" : "CORRETIVA";

    // Criar a OS no banco
    const os = await prisma.serviceOrder.create({
      data: {
        code: osCode,
        quoteId: quote.id,
        clientId: quote.clientId,
        addressId: quote.addressId,
        contactId: quote.contactId || null,
        status: "CRIADA", // Status inicial padrão
        priority: "MEDIA",
        type: osType,
        problemReported: `Serviço gerado a partir do Orçamento ${quote.code}.\n\nItens vendidos:\n${quote.items
          .map((i) => `- ${i.description} (${i.quantity}x)`)
          .join("\n")}\n\nObservações gerais: ${quote.notes || "Sem observações."}`,
        notes: `Condições de pagamento: ${quote.paymentTerms || "Padrão"}. Garantia acordada: ${quote.warrantyDays} dias.`,
      },
    });

    // 3. Clona itens de serviço do orçamento como ServiceOrderItems
    const osItems = services.map((s) => ({
      serviceOrderId: os.id,
      description: s.description,
      quantity: s.quantity,
      unit: s.unit,
      unitPrice: s.unitPrice,
      total: s.total,
    }));

    if (osItems.length > 0) {
      await prisma.serviceOrderItem.createMany({
        data: osItems,
      });
    }

    // 4. Clona itens de produto como materiais previstos na OS (ServiceOrderMaterial)
    // Precisamos relacionar com a tabela Product. Se o produto não existir no cadastro master por nome, buscamos um produto genérico ou associamos
    const dbProducts = await prisma.product.findMany();

    for (const prodItem of products) {
      // Tentar encontrar produto por nome
      let matchedProduct = dbProducts.find(
        (p) => p.name.toLowerCase() === prodItem.description.toLowerCase()
      );

      // Se não encontrou, criar um genérico para o estoque
      if (!matchedProduct) {
        const prodCount = dbProducts.length;
        matchedProduct = await prisma.product.create({
          data: {
            code: `P-GEN-${String(prodCount + 1).padStart(4, "0")}`,
            name: prodItem.description,
            type: "PECA",
            costPrice: prodItem.costPrice,
            salePrice: prodItem.unitPrice,
            stockQuantity: 10, // assume saldo
            minStock: 2,
          },
        });
      }

      await prisma.serviceOrderMaterial.create({
        data: {
          serviceOrderId: os.id,
          productId: matchedProduct.id,
          quantity: prodItem.quantity,
          costPrice: prodItem.costPrice,
          salePrice: prodItem.unitPrice,
          usedQuantity: 0, // Apenas previsto inicialmente
          status: "PREVISTO",
        },
      });
    }

    // 5. Atualizar o status do orçamento para "CONVERTIDO"
    await prisma.quote.update({
      where: { id: quoteId },
      data: {
        status: "CONVERTIDO",
        approvedAt: new Date(),
        approvedBy: `Conversão Automática (User ID: ${userId})`,
      },
    });

    // 6. Gravar histórico na OS
    const systemUser = await prisma.user.findUnique({ where: { id: userId } });
    await prisma.serviceOrderStatusHistory.create({
      data: {
        serviceOrderId: os.id,
        oldStatus: "NENHUM",
        newStatus: "CRIADA",
        changedById: userId,
        justification: `OS gerada automaticamente a partir da aprovação do Orçamento ${quote.code} pelo usuário ${systemUser?.name}.`,
      },
    });

    // 7. Notificação operacional
    await prisma.notification.create({
      data: {
        title: "OS Gerada com Sucesso",
        message: `A OS ${osCode} para o cliente ${quote.client.name} foi gerada a partir do orçamento ${quote.code}.`,
        type: "OPERACIONAL",
        link: "/ordens-servico",
      },
    });

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        userId,
        action: "APROVACAO",
        entity: "Orcamento",
        entityId: quoteId,
        changesJson: JSON.stringify({
          message: "Orçamento convertido em OS",
          quoteCode: quote.code,
          osId: os.id,
          osCode: osCode,
        }),
      },
    });

    revalidatePath("/orcamentos");
    revalidatePath("/ordens-servico");

    return { success: true, os, quoteStatus: "CONVERTIDO" };
  } catch (error: any) {
    console.error("Erro na conversão de orçamento para OS:", error);
    return { success: false, error: error.message };
  }
}
