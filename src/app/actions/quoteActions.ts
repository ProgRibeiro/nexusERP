"use server";

import { logger } from "@/lib/logger";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAuth, requirePermission } from "@/lib/auth";
import { quoteCreateSchema, quoteItemSchema } from "@/lib/schemas";
import { z } from "zod";
import { calculateProposalTax } from "@/lib/tax";
import { loadTaxProfile } from "@/lib/taxProfile";
import { nextServiceOrderCode } from "@/lib/sequences";
import { createInitialVisit } from "@/lib/visits";
import { getServiceChecklistTemplate, inferServiceModality } from "@/lib/serviceChecklistTemplates";

export interface QuoteItemInput {
  type: string; // SERVICO, TERCEIRIZADO, PRODUTO, PECAS, MAO_DE_OBRA, DESLOCAMENTO, IMPOSTO
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  costPrice: number;
  markupPercentage?: number;
  supplierId?: string;
  discount: number;
}

const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

async function resolveClientRelations(clientId: string, addressId?: string, contactId?: string) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      addresses: { orderBy: { createdAt: "asc" } },
      contacts: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!client) throw new Error("Cliente não encontrado.");

  const addressPriorities = ["principal", "execução", "execucao", "sede", "cadastral"];
  const preferredAddress = client.addresses.find((address) => {
    const label = address.label.toLowerCase();
    return addressPriorities.some((priority) => label.includes(priority));
  }) || client.addresses[0] || null;
  const preferredContact = client.contacts.find((contact) => contact.isApproval)
    || client.contacts.find((contact) => contact.isTechnical)
    || client.contacts[0]
    || null;

  return {
    addressId: client.addresses.some((address) => address.id === addressId)
      ? addressId!
      : preferredAddress?.id,
    contactId: client.contacts.some((contact) => contact.id === contactId)
      ? contactId!
      : preferredContact?.id,
  };
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
      total: Number(q.total),
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

    if (!quote) return null;

    return {
      ...quote,
      subtotal: Number(quote.subtotal),
      discount: Number(quote.discount),
      tax: Number(quote.tax),
      total: Number(quote.total),
      costEstimate: Number(quote.costEstimate),
      estimatedMargin: Number(quote.estimatedMargin),
      items: quote.items.map((item) => ({
        ...item,
        unitPrice: Number(item.unitPrice),
        costPrice: Number(item.costPrice),
        markupPercentage: Number(item.markupPercentage),
        discount: Number(item.discount),
        total: Number(item.total),
      })),
    };
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
    finalValueOverride?: number | null;
  },
  items: QuoteItemInput[],
  userId: string
) {
  try {
    const session = await requirePermission("quotes.write");
    userId = session.userId; // nunca confiar no valor vindo do client
    quoteCreateSchema.parse(data);
    z.array(quoteItemSchema).min(1, "O orçamento precisa de ao menos um item.").parse(items);
    const relations = await resolveClientRelations(data.clientId, data.addressId, data.contactId);

    const count = await prisma.quote.count();
    const code = `Q-2026-${String(count + 1).padStart(4, "0")}`;

    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + (data.validityDays || 15));

    // Cálculos preliminares
    let subtotal = 0;
    let costEstimate = 0;

    const itemsData = [];
    for (const item of items) {
      const markupPercentage = item.type === "TERCEIRIZADO" ? Number(item.markupPercentage || 0) : 0;
      const unitPrice = item.type === "TERCEIRIZADO"
        ? roundCurrency(item.costPrice * (1 + (markupPercentage / 100)))
        : item.unitPrice;
      const itemSubtotal = item.quantity * unitPrice;
      const itemDiscount = item.quantity * item.discount;
      const itemTotal = itemSubtotal - itemDiscount;

      subtotal += itemSubtotal;
      costEstimate += item.quantity * item.costPrice;

      itemsData.push({
        type: item.type,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice,
        costPrice: item.costPrice,
        markupPercentage,
        supplierId: item.type === "TERCEIRIZADO" ? item.supplierId || null : null,
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
                defaultPrice: unitPrice,
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
                salePrice: unitPrice,
                costPrice: item.costPrice || (unitPrice * 0.6),
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
    const finalValueOverride = data.finalValueOverride == null ? null : roundCurrency(Number(data.finalValueOverride));
    if (finalValueOverride !== null && finalValueOverride <= 0) throw new Error("O valor final personalizado deve ser maior que zero.");
    const total = finalValueOverride ?? calculation.total;
    const estimatedMargin = total - costEstimate;

    const quote = await prisma.quote.create({
      data: {
        code,
        clientId: data.clientId,
        addressId: relations.addressId || null,
        contactId: relations.contactId || null,
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
        finalValueOverride,
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

    const relations = await resolveClientRelations(quote.clientId, quote.addressId || undefined, quote.contactId || undefined);
    if (relations.addressId !== quote.addressId || relations.contactId !== quote.contactId) {
      await prisma.quote.update({
        where: { id: quote.id },
        data: {
          addressId: relations.addressId || null,
          contactId: relations.contactId || null,
        },
      });
    }

    // Validações obrigatórias
    if (!relations.addressId) throw new Error("O cliente precisa possuir um endereço cadastrado para gerar a OS.");
    if (quote.items.length === 0) throw new Error("O orçamento precisa conter pelo menos um item faturável.");
    const unassignedProviderItem = quote.items.find((item) => item.type === "TERCEIRIZADO" && !item.supplierId);
    if (unassignedProviderItem) throw new Error(`Selecione o prestador responsável por: ${unassignedProviderItem.description}.`);

    // Determinar o tipo de OS com base no tipo de serviço mais frequente ou padrão
    const services = quote.items.filter((item) => item.type === "SERVICO" || item.type === "TERCEIRIZADO");
    const products = quote.items.filter((item) => item.type === "PRODUTO" || item.type === "PECAS");

    const hasInstallation = services.some((s) => s.description.toLowerCase().includes("instalação") || s.description.toLowerCase().includes("instalacao"));
    const osType = quote.proposalType === "PREVENTIVA" ? "PREVENTIVA" : hasInstallation ? "INSTALACAO" : "CORRETIVA";
    const serviceCategory = inferServiceModality(quote.items.map((item) => `${item.description} ${item.type}`).join(" "));
    let preventiveChecklist: Array<{ id: string; label: string; group?: string; checked: boolean }> = [];
    if (quote.proposalType === "PREVENTIVA" && quote.preventivePlanJson) {
      try {
        const plan = JSON.parse(quote.preventivePlanJson) as { scope?: Array<{ id: string; label: string; group?: string }> };
        preventiveChecklist = (plan.scope || []).map((item) => ({ ...item, checked: false }));
      } catch {
        logger.warn("preventive_plan_invalid", { quoteId: quote.id });
      }
    }

    // O código e a OS nascem na mesma transação para impedir colisões.
    const os = await prisma.$transaction(async (tx) => {
      const osCode = await nextServiceOrderCode(tx);
      const created = await tx.serviceOrder.create({
        data: {
          code: osCode,
          quoteId: quote.id,
          clientId: quote.clientId,
          addressId: relations.addressId,
          contactId: relations.contactId || null,
          status: "CRIADA",
          priority: "MEDIA",
          type: osType,
          serviceCategory,
          checklistJson: JSON.stringify(preventiveChecklist.length ? preventiveChecklist : getServiceChecklistTemplate(serviceCategory)),
          problemReported: `Serviço gerado a partir do Orçamento ${quote.code}.\n\nItens vendidos:\n${quote.items
            .map((i) => `- ${i.description} (${i.quantity}x)`)
            .join("\n")}\n\nObservações gerais: ${quote.notes || "Sem observações."}`,
          notes: `Condições de pagamento: ${quote.paymentTerms || "Padrão"}. Garantia acordada: ${quote.warrantyDays} dias.`,
        },
      });
      await createInitialVisit(tx, {
        serviceOrderId: created.id,
        status: created.status,
        kind: osType === "PREVENTIVA" ? "VISTORIA" : "ATENDIMENTO",
        changedById: userId,
      });
      return created;
    });
    const osCode = os.code;

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

    const outsourcedItems = quote.items.filter((item) => item.type === "TERCEIRIZADO" && item.supplierId);
    if (outsourcedItems.length > 0) {
      await prisma.providerJob.createMany({
        data: outsourcedItems.map((item) => ({
          supplierId: item.supplierId!,
          quoteId: quote.id,
          quoteItemId: item.id,
          serviceOrderId: os.id,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          costValue: Number(item.costPrice) * item.quantity,
          saleValue: Number(item.total),
        })),
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
      select: { id: true, code: true, name: true, description: true, type: true, salePrice: true, costPrice: true, unit: true, stockQuantity: true, minStock: true },
      orderBy: { name: "asc" }
    });
    const services = await prisma.service.findMany({
      select: { id: true, name: true, description: true, category: true, maintenanceType: true, billingUnit: true, estimatedHours: true, defaultPrice: true },
      orderBy: { name: "asc" }
    });
    return {
      products: products.map((product) => ({
        ...product,
        salePrice: Number(product.salePrice),
        costPrice: Number(product.costPrice),
      })),
      services: services.map((service) => ({
        ...service,
        defaultPrice: Number(service.defaultPrice),
      })),
    };
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
  description?: string;
  category?: string;
  maintenanceType?: string;
  estimatedHours?: number;
  productType?: string;
  stockQuantity?: number;
  minStock?: number;
}) {
  try {
    const session = await requirePermission("quotes.write");
    const name = data.name.trim();
    if (name.length < 2) return { success: false, error: "Informe um nome válido para o item." };
    if (!Number.isFinite(data.price) || data.price < 0) return { success: false, error: "Informe um preço de venda válido." };

    if (data.type === "SERVICO") {
      const exists = await prisma.service.findFirst({
        where: { name: { equals: name, mode: "insensitive" } }
      });
      if (exists) {
        return { success: false, error: "Serviço já cadastrado com este nome." };
      }
      const service = await prisma.service.create({
        data: {
          name,
          description: data.description?.trim() || null,
          category: data.category?.trim() || null,
          maintenanceType: data.maintenanceType?.trim() || null,
          billingUnit: data.unit?.trim().toUpperCase() || "SERVIÇO",
          estimatedHours: data.estimatedHours && data.estimatedHours > 0 ? data.estimatedHours : null,
          defaultPrice: data.price,
        }
      });
      await prisma.auditLog.create({
        data: { userId: session.userId, action: "CRIACAO", entity: "Servico", entityId: service.id, changesJson: JSON.stringify(service) },
      });
      revalidatePath("/orcamentos");
      revalidatePath("/servicos");
      return { success: true, item: { name: service.name, price: Number(service.defaultPrice), type: "SERVICO", unit: service.billingUnit || "SERVIÇO", costPrice: 0 } };
    } else {
      const exists = await prisma.product.findFirst({
        where: { name: { equals: name, mode: "insensitive" } }
      });
      if (exists) {
        return { success: false, error: "Peça já cadastrada com este nome." };
      }
      const productCodes = await prisma.product.findMany({ where: { code: { startsWith: "P-" } }, select: { code: true } });
      const lastNumber = Math.max(0, ...productCodes.map((product) => Number(product.code.match(/(\d+)$/)?.[1] || 0)));
      const code = `P-${String(lastNumber + 1).padStart(4, "0")}`;
      const initialStock = Math.max(0, data.stockQuantity || 0);
      const product = await prisma.$transaction(async (tx) => {
        const created = await tx.product.create({
          data: {
            code,
            name,
            description: data.description?.trim() || null,
            type: data.productType || "MATERIAL",
            salePrice: data.price,
            costPrice: data.cost ?? 0,
            unit: data.unit?.trim().toUpperCase() || "UN",
            stockQuantity: initialStock,
            minStock: Math.max(0, data.minStock || 0),
          }
        });
        if (initialStock > 0) {
          await tx.stockMovement.create({
            data: { productId: created.id, type: "ENTRADA", quantity: initialStock, reason: "AJUSTE", cost: data.cost ?? 0, date: new Date() },
          });
        }
        await tx.auditLog.create({
          data: { userId: session.userId, action: "CRIACAO", entity: "Produto", entityId: created.id, changesJson: JSON.stringify(created) },
        });
        return created;
      });
      revalidatePath("/orcamentos");
      revalidatePath("/estoque");
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
    finalValueOverride?: number | null;
  },
  items: QuoteItemInput[],
  userId: string
) {
  try {
    const session = await requirePermission("quotes.write");
    userId = session.userId; // nunca confiar no valor vindo do client
    const relations = await resolveClientRelations(data.clientId, data.addressId, data.contactId);

    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + (data.validityDays || 15));

    // Cálculos
    let subtotal = 0;
    let costEstimate = 0;
    const itemsData: any[] = [];
    for (const item of items) {
      const markupPercentage = item.type === "TERCEIRIZADO" ? Number(item.markupPercentage || 0) : 0;
      const unitPrice = item.type === "TERCEIRIZADO"
        ? roundCurrency(item.costPrice * (1 + (markupPercentage / 100)))
        : item.unitPrice;
      const itemSubtotal = item.quantity * unitPrice;
      const itemDiscount = item.quantity * (item.discount || 0);
      const itemTotal = itemSubtotal - itemDiscount;

      subtotal += itemSubtotal;
      costEstimate += item.quantity * (item.costPrice || 0);

      itemsData.push({
        type: item.type,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit || "UN",
        unitPrice,
        costPrice: item.costPrice || 0.0,
        markupPercentage,
        supplierId: item.type === "TERCEIRIZADO" ? item.supplierId || null : null,
        discount: item.discount || 0.0,
        total: itemTotal
      });
    }

    const discount = data.discount || 0;
    const taxProfile = await loadTaxProfile();
    const calculation = calculateProposalTax(subtotal, discount, taxProfile.rate);
    const tax = calculation.tax;
    const finalValueOverride = data.finalValueOverride == null ? null : roundCurrency(Number(data.finalValueOverride));
    if (finalValueOverride !== null && finalValueOverride <= 0) throw new Error("O valor final personalizado deve ser maior que zero.");
    const total = finalValueOverride ?? calculation.total;

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
          client: { connect: { id: data.clientId } },
          address: relations.addressId ? { connect: { id: relations.addressId } } : { disconnect: true },
          contact: relations.contactId ? { connect: { id: relations.contactId } } : { disconnect: true },
          validUntil,
          warrantyDays: data.warrantyDays || 90,
          executionTerm: data.executionTerm,
          paymentTerms: data.paymentTerms,
          subtotal,
          discount,
          tax,
          total,
          finalValueOverride,
          costEstimate,
          estimatedMargin: total - costEstimate,
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
