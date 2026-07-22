"use server";

import { logger } from "@/lib/logger";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAuth, requirePermission } from "@/lib/auth";
import { quoteCreateSchema, quoteItemSchema } from "@/lib/schemas";
import { z } from "zod";
import { calculateProposalTax } from "@/lib/tax";
import { loadTaxProfile } from "@/lib/taxProfile";

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
    await requireAuth();

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
      createdAt: q.createdAt,
      serviceOrders: q.serviceOrders,
    }));
  } catch (error) {
    logger.error("Erro ao obter orçamentos:", error);
    return [];
  }
}

/**
 * Obtém detalhes completos do orçamento
 */
export async function getQuoteDetails(id: string) {
  try {
    await requireAuth();

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
    logger.error(`Erro ao obter orçamento ${id}:`, error);
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
    const session = await requirePermission("quotes.write");
    userId = session.userId; // nunca confiar no valor vindo do client
    quoteCreateSchema.parse(data);
    z.array(quoteItemSchema).min(1, "O orçamento precisa de ao menos um item.").parse(items);

    const count = await prisma.quote.count();
    const code = `Q-2026-${String(count + 1).padStart(4, "0")}`;

    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + (data.validityDays || 15));

    // Cálculos preliminares
    let subtotal = 0;
    let costEstimate = 0;

    const itemsData = [];
    for (const item of items) {
      const itemSubtotal = item.quantity * item.unitPrice;
      const itemDiscount = item.quantity * item.discount;
      const itemTotal = itemSubtotal - itemDiscount;

      subtotal += itemSubtotal;
      costEstimate += item.quantity * item.costPrice;

      itemsData.push({
        type: item.type,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        costPrice: item.costPrice,
        discount: item.discount,
        total: itemTotal,
      });

      // Cadastra o item avulso na hora se ele não existir
      try {
        if (item.type === "SERVICO") {
          const exists = await prisma.service.findFirst({
            where: { name: { equals: item.description } }
          });
          if (!exists) {
            await prisma.service.create({
              data: {
                name: item.description,
                defaultPrice: item.unitPrice,
              }
            });
          }
        } else if (item.type === "PECAS" || item.type === "PRODUTO") {
          const existsByName = await prisma.product.findFirst({
            where: { name: { equals: item.description } }
          });
          if (!existsByName) {
            const prodCount = await prisma.product.count();
            await prisma.product.create({
              data: {
                code: `P-${String(prodCount + 1).padStart(4, "0")}`,
                name: item.description,
                type: "PECA",
                salePrice: item.unitPrice,
                costPrice: item.costPrice || (item.unitPrice * 0.6),
                unit: item.unit || "UN",
                stockQuantity: 0,
              }
            });
          }
        }
      } catch (err) {
        logger.error("Erro ao registrar item avulso durante orçamento:", err);
      }
    }

    const discount = data.discount || 0;
    const taxProfile = await loadTaxProfile();
    const calculation = calculateProposalTax(subtotal, discount, taxProfile.rate);
    const tax = calculation.tax;
    const total = calculation.total;
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
        changesJson: JSON.stringify({ quote, taxProfile }),
      },
    });

    revalidatePath("/orcamentos");
    return { success: true, quote };
  } catch (error: any) {
    logger.error("Erro ao criar orçamento:", error);
    return { success: false, error: error.issues?.[0]?.message || error.message };
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
    const session = await requirePermission("quotes.write");
    userId = session.userId; // nunca confiar no valor vindo do client

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
    logger.error("Erro ao atualizar status do orçamento:", error);
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
    const session = await requirePermission("quotes.write");
    userId = session.userId; // nunca confiar no valor vindo do client

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
    const osType = quote.proposalType === "PREVENTIVA" ? "PREVENTIVA" : hasInstallation ? "INSTALACAO" : "CORRETIVA";
    let preventiveChecklist: Array<{ id: string; label: string; group?: string; checked: boolean }> = [];
    if (quote.proposalType === "PREVENTIVA" && quote.preventivePlanJson) {
      try {
        const plan = JSON.parse(quote.preventivePlanJson) as { scope?: Array<{ id: string; label: string; group?: string }> };
        preventiveChecklist = (plan.scope || []).map((item) => ({ ...item, checked: false }));
      } catch {
        logger.warn("preventive_plan_invalid", { quoteId: quote.id });
      }
    }

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
        checklistJson: JSON.stringify(preventiveChecklist),
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
    logger.error("Erro na conversão de orçamento para OS:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Obtém todos os produtos e serviços cadastrados para o autocomplete
 */
export async function getQuoteCatalog() {
  try {
    await requireAuth();

    const products = await prisma.product.findMany({
      select: { name: true, salePrice: true, costPrice: true, unit: true },
      orderBy: { name: "asc" }
    });
    const services = await prisma.service.findMany({
      select: { name: true, defaultPrice: true },
      orderBy: { name: "asc" }
    });
    return { products, services };
  } catch (error) {
    logger.error("Erro ao obter catálogo:", error);
    return { products: [], services: [] };
  }
}

export interface ClientItemHistoryDTO {
  description: string;
  type: string;
  unit: string;
  count: number;
  avgQuantity: number;
  lastUnitPrice: number;
}

/**
 * Histórico de itens já orçados para um cliente específico — usado para
 * priorizar itens frequentes no seletor de catálogo e pré-preencher
 * quantidade/preço com base no que já foi praticado com este cliente.
 */
export async function getClientItemHistory(clientId: string): Promise<ClientItemHistoryDTO[]> {
  if (!clientId) return [];

  try {
    await requireAuth();

    const items = await prisma.quoteItem.findMany({
      where: { quote: { clientId } },
      orderBy: { quote: { createdAt: "desc" } },
      take: 200,
    });

    const byDescription = new Map<
      string,
      { type: string; unit: string; count: number; totalQuantity: number; lastUnitPrice: number }
    >();

    items.forEach((item) => {
      const existing = byDescription.get(item.description);
      if (existing) {
        existing.count += 1;
        existing.totalQuantity += item.quantity;
      } else {
        byDescription.set(item.description, {
          type: item.type,
          unit: item.unit,
          count: 1,
          totalQuantity: item.quantity,
          lastUnitPrice: Number(item.unitPrice),
        });
      }
    });

    return Array.from(byDescription.entries())
      .map(([description, v]) => ({
        description,
        type: v.type,
        unit: v.unit,
        count: v.count,
        avgQuantity: v.totalQuantity / v.count,
        lastUnitPrice: v.lastUnitPrice,
      }))
      .sort((a, b) => b.count - a.count);
  } catch (error) {
    logger.error("Erro ao obter histórico de itens do cliente:", error);
    return [];
  }
}

/**
 * Registra um novo item (Serviço ou Produto) no catálogo
 */
export async function registerCatalogItem(data: {
  type: string;
  name: string;
  price: number;
  cost?: number;
  unit?: string;
}) {
  try {
    await requirePermission("quotes.write");

    if (data.type === "SERVICO") {
      const exists = await prisma.service.findFirst({
        where: { name: { equals: data.name } }
      });
      if (exists) {
        return { success: false, error: "Serviço já cadastrado com este nome." };
      }
      const service = await prisma.service.create({
        data: {
          name: data.name,
          defaultPrice: data.price,
        }
      });
      return { success: true, item: { name: service.name, price: service.defaultPrice, type: "SERVICO" } };
    } else {
      const exists = await prisma.product.findFirst({
        where: { name: { equals: data.name } }
      });
      if (exists) {
        return { success: false, error: "Peça já cadastrada com este nome." };
      }
      const prodCount = await prisma.product.count();
      const product = await prisma.product.create({
        data: {
          code: `P-${String(prodCount + 1).padStart(4, "0")}`,
          name: data.name,
          type: "PECA",
          salePrice: data.price,
          costPrice: data.cost || (data.price * 0.6),
          unit: data.unit || "UN",
          stockQuantity: 0,
        }
      });
      return {
        success: true,
        item: {
          name: product.name,
          price: Number(product.salePrice),
          type: "PECAS",
          unit: product.unit,
          costPrice: Number(product.costPrice),
        },
      };
    }
  } catch (error: any) {
    logger.error("Erro ao registrar item no catálogo:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Atualiza um Orçamento Existente
 */
export async function updateQuote(
  quoteId: string,
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
    const session = await requirePermission("quotes.write");
    userId = session.userId; // nunca confiar no valor vindo do client

    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + (data.validityDays || 15));

    // Cálculos
    let subtotal = 0;
    let costEstimate = 0;
    const itemsData: any[] = [];
    for (const item of items) {
      const itemSubtotal = item.quantity * item.unitPrice;
      const itemDiscount = item.quantity * (item.discount || 0);
      const itemTotal = itemSubtotal - itemDiscount;

      subtotal += itemSubtotal;
      costEstimate += item.quantity * (item.costPrice || 0);

      itemsData.push({
        type: item.type,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit || "UN",
        unitPrice: item.unitPrice,
        costPrice: item.costPrice || 0.0,
        discount: item.discount || 0.0,
        total: itemTotal
      });
    }

    const discount = data.discount || 0;
    const taxProfile = await loadTaxProfile();
    const calculation = calculateProposalTax(subtotal, discount, taxProfile.rate);
    const tax = calculation.tax;
    const total = calculation.total;

    // Deletar os itens antigos e criar os novos em uma transação do Prisma
    const quote = await prisma.$transaction(async (tx) => {
      // Deletar itens antigos
      await tx.quoteItem.deleteMany({
        where: { quoteId }
      });

      // Atualizar o orçamento
      const updated = await tx.quote.update({
        where: { id: quoteId },
        data: {
          clientId: data.clientId,
          addressId: data.addressId || null,
          contactId: data.contactId || null,
          validUntil,
          warrantyDays: data.warrantyDays || 90,
          executionTerm: data.executionTerm,
          paymentTerms: data.paymentTerms,
          subtotal,
          discount,
          tax,
          total,
          costEstimate,
          notes: data.notes,
          items: {
            create: itemsData
          }
        },
        include: {
          client: true,
          items: true
        }
      });

      // Log de Auditoria
      await tx.auditLog.create({
        data: {
          userId,
          action: "UPDATE",
          entity: "Quote",
          entityId: quoteId,
          changesJson: JSON.stringify({
            data,
            itemsCount: items.length,
            total,
            taxProfile,
          })
        }
      });

      return updated;
    });

    return { success: true, quote };
  } catch (error: any) {
    logger.error("Erro ao atualizar orçamento:", error);
    return { success: false, error: error.message };
  }
}
