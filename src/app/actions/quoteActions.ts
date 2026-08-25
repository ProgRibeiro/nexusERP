"use server";

import { logger } from "@/lib/logger";
import { failDataAccess, mutationFailure } from "@/lib/actionErrors";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAuth, requirePermission, requireAnyPermission } from "@/lib/auth";
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
      where: search?.trim()
        ? {
            OR: [
              { code: { contains: search.trim(), mode: "insensitive" } },
              { storeName: { contains: search.trim(), mode: "insensitive" } },
              { client: { name: { contains: search.trim(), mode: "insensitive" } } },
              { client: { fancyName: { contains: search.trim(), mode: "insensitive" } } },
              { client: { socialName: { contains: search.trim(), mode: "insensitive" } } },
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
      storeName: q.storeName,
      clientId: q.clientId,
      proposalType: q.proposalType,
      procurementNumber: q.procurementNumber,
      contractingAgency: q.contractingAgency,
      biddingNumber: q.biddingNumber,
      referenceBase: q.referenceBase,
      referenceMonth: q.referenceMonth,
      publicBudgetSource: q.publicBudgetSource,
      deliveryTerm: q.deliveryTerm,
      clientName: q.client.name,
      status: q.status,
      total: Number(q.total),
      validUntil: q.validUntil,
      version: q.version,
      createdAt: q.createdAt,
      serviceOrders: q.serviceOrders,
    }));
  } catch (error) {
    failDataAccess("quotes.list", error);
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
      overheadPercentage: Number(quote.overheadPercentage),
      riskPercentage: Number(quote.riskPercentage),
      financialPercentage: Number(quote.financialPercentage),
      profitPercentage: Number(quote.profitPercentage),
      taxPercentage: Number(quote.taxPercentage),
      bdiPercentage: Number(quote.bdiPercentage),
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
    failDataAccess("quotes.details", error);
  }
}

/**
 * Cria um novo Orçamento
 */
export async function createQuote(
  data: {
    clientId: string;
    code?: string;
    storeName?: string;
    proposalType?: "AVULSA" | "PREVENTIVA" | "LICITACAO";
    procurementNumber?: string;
    contractingAgency?: string;
    biddingNumber?: string;
    referenceBase?: string;
    referenceMonth?: string;
    publicBudgetSource?: string;
    deliveryTerm?: string;
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
    overheadPercentage?: number;
    riskPercentage?: number;
    financialPercentage?: number;
    profitPercentage?: number;
    taxPercentage?: number;
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
    const code = data.code?.trim() || `Q-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;
    const duplicateCode = await prisma.quote.findUnique({ where: { code }, select: { id: true } });
    if (duplicateCode) throw new Error(`Já existe uma proposta com o código ${code}.`);

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
    const taxRate = data.taxPercentage ?? taxProfile.rate;
    const calculation = calculateProposalTax(subtotal, discount, taxRate);
    const tax = calculation.tax;
    const finalValueOverride = data.finalValueOverride == null ? null : roundCurrency(Number(data.finalValueOverride));
    if (finalValueOverride !== null && finalValueOverride <= 0) throw new Error("O valor final personalizado deve ser maior que zero.");
    const total = finalValueOverride ?? calculation.total;
    const estimatedMargin = total - costEstimate;

    const quote = await prisma.quote.create({
        data: {
          code,
          storeName: data.storeName?.trim() || null,
        clientId: data.clientId,
        addressId: relations.addressId || null,
        contactId: relations.contactId || null,
        status: "RASCUNHO",
        proposalType: data.proposalType || "AVULSA",
        procurementNumber: data.procurementNumber?.trim() || null,
        contractingAgency: data.contractingAgency?.trim() || null,
        biddingNumber: data.biddingNumber?.trim() || null,
        referenceBase: data.referenceBase?.trim() || null,
        referenceMonth: data.referenceMonth?.trim() || null,
        publicBudgetSource: data.publicBudgetSource?.trim() || null,
        deliveryTerm: data.deliveryTerm?.trim() || null,
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
        overheadPercentage: 0,
        riskPercentage: 0,
        financialPercentage: 0,
        profitPercentage: 0,
        taxPercentage: taxRate,
        bdiPercentage: 0,
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
    return { success: true as const, error: undefined, quote };
  } catch (error: unknown) {
    return mutationFailure("quotes.create", error, "Não foi possível criar o orçamento.");
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
    return { success: true as const, error: undefined, quote };
  } catch (error: unknown) {
    return mutationFailure("quotes.status.update", error, "Não foi possível atualizar o status do orçamento.");
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
export async function approveAndConvertQuote(
  quoteId: string,
  userId: string,
  finalAgreedValue?: number,
) {
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

    // Se um valor fechado negociado foi fornecido e difere do total atual, atualiza no banco
    if (
      finalAgreedValue !== undefined &&
      Number.isFinite(finalAgreedValue) &&
      finalAgreedValue > 0 &&
      Math.abs(Number(quote.total) - finalAgreedValue) > 0.01
    ) {
      const currentSubtotal = Number(quote.subtotal);
      const currentTax = Number(quote.tax);
      const newDiscount = Math.max(0, currentSubtotal + currentTax - finalAgreedValue);

      await prisma.quote.update({
        where: { id: quoteId },
        data: {
          total: finalAgreedValue,
          discount: newDiscount,
        },
      });
      quote.total = finalAgreedValue as any;
      quote.discount = newDiscount as any;
    }

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

    return { success: true as const, error: undefined, os, quoteStatus: "CONVERTIDO" };
  } catch (error: unknown) {
    return mutationFailure("quotes.convert-to-service-order", error, "Não foi possível converter o orçamento em ordem de serviço.");
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
      select: { id: true, name: true, description: true, category: true, maintenanceType: true, billingUnit: true, estimatedHours: true, defaultPrice: true, serviceType: true, referenceCode: true, materialCost: true, laborCost: true, equipmentCost: true, otherDirectCost: true, productivity: true, supplierId: true, supplier: { select: { name: true } } },
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
        directCost: Number(service.materialCost) + Number(service.laborCost) + Number(service.equipmentCost) + Number(service.otherDirectCost),
      })),
    };
  } catch (error) {
    failDataAccess("quotes.catalog", error);
  }
}

/** Catálogo oficial (SINAPI/SICRO/SEINFRA/OUTRA) usado em licitações. */
export async function getReferencePriceCatalog(input?: { base?: string; search?: string; referenceMonth?: string; limit?: number }) {
  try {
    await requireAuth();
    const limit = Math.min(Math.max(input?.limit ?? 80, 1), 200);
    const search = input?.search?.trim();
    const rows = await prisma.referencePriceItem.findMany({
      where: {
        ...(input?.base ? { base: input.base } : {}),
        ...(input?.referenceMonth ? { referenceMonth: input.referenceMonth } : {}),
        ...(search ? { OR: [{ code: { contains: search, mode: "insensitive" } }, { description: { contains: search, mode: "insensitive" } }] } : {}),
      }, orderBy: [{ base: "asc" }, { code: "asc" }], take: limit,
    });
    return rows.map((row) => ({ ...row, unitPrice: Number(row.unitPrice) }));
  } catch (error) { failDataAccess("quotes.reference-catalog", error); }
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
    failDataAccess("quotes.client-item-history", error);
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
    const session = await requireAnyPermission(["quotes.write", "orcamentos.write", "estoque.write"]);
    const name = data.name.trim();
    if (name.length < 2) return { success: false as const, error: "Informe um nome válido para o item." };
    const priceVal = Math.max(0, Number(data.price) || 0);
    const costVal = Math.max(0, Number(data.cost) || 0);

    if (data.type === "SERVICO") {
      const exists = await prisma.service.findFirst({
        where: { name: { equals: name, mode: "insensitive" } }
      });
      if (exists) {
        return { success: false as const, error: "Serviço já cadastrado com este nome." };
      }
      const service = await prisma.service.create({
        data: {
          name,
          description: data.description?.trim() || null,
          category: data.category?.trim() || null,
          maintenanceType: data.maintenanceType?.trim() || null,
          billingUnit: data.unit?.trim().toUpperCase() || "SERVIÇO",
          estimatedHours: data.estimatedHours && data.estimatedHours > 0 ? data.estimatedHours : null,
          defaultPrice: priceVal,
        }
      });
      await prisma.auditLog.create({
        data: {
          userId: session.userId,
          action: "CRIACAO",
          entity: "Servico",
          entityId: service.id,
          changesJson: JSON.stringify({ id: service.id, name: service.name, defaultPrice: priceVal })
        },
      });
      revalidatePath("/orcamentos");
      revalidatePath("/servicos");
      return {
        success: true as const,
        error: undefined,
        item: { name: service.name, price: Number(service.defaultPrice), type: "SERVICO", unit: service.billingUnit || "SERVIÇO", costPrice: 0 }
      };
    } else {
      const exists = await prisma.product.findFirst({
        where: { name: { equals: name, mode: "insensitive" } }
      });
      if (exists) {
        return { success: false as const, error: `Material/peça "${name}" já cadastrado no catálogo.` };
      }

      const productCodes = await prisma.product.findMany({ select: { code: true } });
      const numbers = productCodes.map((p) => {
        const m = p.code.match(/(\d+)$/);
        return m ? parseInt(m[1], 10) : 0;
      });
      let nextNum = Math.max(0, ...numbers) + 1;
      let code = `P-${String(nextNum).padStart(4, "0")}`;

      // Garante código 100% único sem risco de colisão P2002
      while (await prisma.product.findUnique({ where: { code } })) {
        nextNum++;
        code = `P-${String(nextNum).padStart(4, "0")}`;
      }

      const initialStock = Math.max(0, Number(data.stockQuantity) || 0);
      const minStockVal = Math.max(0, Number(data.minStock) || 0);

      const product = await prisma.$transaction(async (tx) => {
        const created = await tx.product.create({
          data: {
            code,
            name,
            description: data.description?.trim() || null,
            type: data.productType || "MATERIAL",
            salePrice: priceVal,
            costPrice: costVal,
            unit: data.unit?.trim().toUpperCase() || "UN",
            stockQuantity: initialStock,
            minStock: minStockVal,
          }
        });
        if (initialStock > 0) {
          await tx.stockMovement.create({
            data: {
              productId: created.id,
              type: "ENTRADA",
              quantity: initialStock,
              reason: "AJUSTE",
              cost: costVal,
              date: new Date()
            },
          });
        }
        await tx.auditLog.create({
          data: {
            userId: session.userId,
            action: "CRIACAO",
            entity: "Produto",
            entityId: created.id,
            changesJson: JSON.stringify({ id: created.id, code: created.code, name: created.name, salePrice: priceVal, costPrice: costVal })
          },
        });
        return created;
      });
      revalidatePath("/orcamentos");
      revalidatePath("/estoque");
      return {
        success: true as const,
        error: undefined,
        item: {
          name: product.name,
          price: Number(product.salePrice),
          type: "PECAS",
          unit: product.unit,
          costPrice: Number(product.costPrice),
        },
      };
    }
  } catch (error: unknown) {
    return mutationFailure("quotes.catalog.create", error, "Não foi possível registrar o item no catálogo.");
  }
}

/**
 * Atualiza um Orçamento Existente
 */
export async function updateQuote(
  quoteId: string,
  data: {
    clientId: string;
    code?: string;
    storeName?: string;
    proposalType?: "AVULSA" | "PREVENTIVA" | "LICITACAO";
    procurementNumber?: string;
    contractingAgency?: string;
    biddingNumber?: string;
    referenceBase?: string;
    referenceMonth?: string;
    publicBudgetSource?: string;
    deliveryTerm?: string;
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
    overheadPercentage?: number;
    riskPercentage?: number;
    financialPercentage?: number;
    profitPercentage?: number;
    taxPercentage?: number;
  },
  items: QuoteItemInput[],
  userId: string
) {
  try {
    const session = await requirePermission("quotes.write");
    userId = session.userId; // nunca confiar no valor vindo do client
    quoteCreateSchema.parse(data);
    const relations = await resolveClientRelations(data.clientId, data.addressId, data.contactId);
    const requestedCode = data.code?.trim();
    if (requestedCode) {
      const duplicateCode = await prisma.quote.findFirst({
        where: { code: requestedCode, NOT: { id: quoteId } },
        select: { id: true },
      });
      if (duplicateCode) throw new Error(`Já existe uma proposta com o código ${requestedCode}.`);
    }

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
    const taxRate = data.taxPercentage ?? taxProfile.rate;
    const calculation = calculateProposalTax(subtotal, discount, taxRate);
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
          ...(requestedCode ? { code: requestedCode } : {}),
          storeName: data.storeName?.trim() || null,
          proposalType: data.proposalType || "AVULSA",
          procurementNumber: data.procurementNumber?.trim() || null,
          contractingAgency: data.contractingAgency?.trim() || null,
          biddingNumber: data.biddingNumber?.trim() || null,
          referenceBase: data.referenceBase?.trim() || null,
          referenceMonth: data.referenceMonth?.trim() || null,
          publicBudgetSource: data.publicBudgetSource?.trim() || null,
          deliveryTerm: data.deliveryTerm?.trim() || null,
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
          overheadPercentage: 0,
          riskPercentage: 0,
          financialPercentage: 0,
          profitPercentage: 0,
          taxPercentage: taxRate,
          bdiPercentage: 0,
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

    return { success: true as const, error: undefined, quote };
  } catch (error: unknown) {
    return mutationFailure("quotes.update", error, "Não foi possível atualizar o orçamento.");
  }
}
