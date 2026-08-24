"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { calculateProposalTax } from "@/lib/tax";
import { loadTaxProfile } from "@/lib/taxProfile";
import { getPreventiveTemplate } from "@/lib/preventiveTemplates";

const preventiveDisciplineSchema = z.enum(["CLIMATIZACAO", "REFRIGERACAO", "ELETRICA", "HIDRAULICA", "CIVIL", "INCENDIO"]);
const preventiveTemplateSchema = z.enum(["CLIMATIZACAO", "REFRIGERACAO", "ELETRICA", "HIDRAULICA", "CIVIL", "INCENDIO", "INTEGRADO", "PERSONALIZADO"]);

const scopeItemSchema = z.object({
  id: z.string().min(1),
  group: z.string().min(1),
  label: z.string().min(2),
  disciplineId: preventiveDisciplineSchema.optional(),
});

const preventiveProposalSchema = z.object({
  clientId: z.string().uuid(),
  addressId: z.string().uuid(),
  contactId: z.string().uuid().optional().or(z.literal("")),
  templateId: preventiveTemplateSchema,
  disciplineIds: z.array(preventiveDisciplineSchema).min(1).max(6),
  disciplinePrices: z.array(z.object({
    disciplineId: preventiveDisciplineSchema,
    pricePerVisit: z.number().min(0).max(100_000_000),
  })).min(1).max(6),
  title: z.string().trim().min(5).max(160),
  frequency: z.enum(["MENSAL", "BIMESTRAL", "TRIMESTRAL", "SEMESTRAL", "ANUAL"]),
  visitsPerYear: z.number().int().min(1).max(52),
  durationHours: z.number().positive().max(240),
  technicians: z.number().int().min(1).max(30),
  slaHours: z.number().int().min(1).max(720),
  startDate: z.string().date(),
  equipmentIds: z.array(z.string().uuid()).max(500),
  scope: z.array(scopeItemSchema).min(1),
  deliverables: z.array(z.string().trim().min(2)).min(1).max(30),
  inclusions: z.array(z.string().trim().min(2)).max(30),
  exclusions: z.array(z.string().trim().min(2)).max(30),
  pricePerVisit: z.number().min(0).max(100_000_000),
  materialsPerVisit: z.number().min(0).max(100_000_000),
  travelPerVisit: z.number().min(0).max(100_000_000),
  discount: z.number().min(0).max(100_000_000),
  tax: z.number().min(0).max(100_000_000),
  validityDays: z.number().int().min(1).max(365),
  warrantyDays: z.number().int().min(0).max(3650),
  paymentTerms: z.string().trim().min(2).max(500),
  notes: z.string().trim().max(4000),
});

export type PreventiveProposalInput = z.infer<typeof preventiveProposalSchema>;

export interface PreventiveProposalListItem {
  id: string;
  code: string;
  clientName: string;
  status: string;
  total: number;
  frequency: string;
  visitsPerYear: number;
  createdAt: Date;
  validUntil: Date;
  disciplines: string[];
}

export async function getPreventiveProposals(): Promise<PreventiveProposalListItem[]> {
  try {
    await requireAuth();
    const quotes = await prisma.quote.findMany({
      where: { proposalType: "PREVENTIVA" },
      include: { client: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return quotes.map((quote) => {
      let frequency = "—";
      let visitsPerYear = 0;
      let disciplines: string[] = [];
      try {
        const plan = JSON.parse(quote.preventivePlanJson || "{}") as {
          frequency?: string;
          visitsPerYear?: number;
          templateId?: string;
          disciplineIds?: string[];
        };
        frequency = plan.frequency || frequency;
        visitsPerYear = plan.visitsPerYear || visitsPerYear;
        disciplines = plan.disciplineIds?.length ? plan.disciplineIds : plan.templateId ? [plan.templateId] : [];
      } catch {
        // Mantém propostas legadas visíveis mesmo com plano inconsistente.
      }
      return {
        id: quote.id,
        code: quote.code,
        clientName: quote.client.name,
        status: quote.status,
        total: Number(quote.total),
        frequency,
        visitsPerYear,
        createdAt: quote.createdAt,
        validUntil: quote.validUntil,
        disciplines,
      };
    });
  } catch (error) {
    logger.error("Erro ao listar propostas preventivas:", error);
    return [];
  }
}

async function nextQuoteCode() {
  const year = new Date().getFullYear();
  const prefix = `Q-${year}-`;
  const last = await prisma.quote.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  const lastSequence = Number(last?.code.slice(prefix.length)) || 0;
  return `${prefix}${String(lastSequence + 1).padStart(4, "0")}`;
}

export async function createPreventiveProposal(rawInput: PreventiveProposalInput) {
  try {
    const session = await requirePermission("quotes.write");
    const input = preventiveProposalSchema.parse(rawInput);
    const disciplineIds = Array.from(new Set(input.disciplineIds));
    if (disciplineIds.length !== input.disciplineIds.length) throw new Error("Existem disciplinas duplicadas no pacote preventivo.");
    const invalidPrice = input.disciplinePrices.find((line) => !disciplineIds.includes(line.disciplineId));
    if (invalidPrice) throw new Error("A composição de valores possui uma disciplina que não está no escopo.");
    const client = await prisma.client.findUnique({
      where: { id: input.clientId },
      include: {
        addresses: { where: { id: input.addressId } },
        contacts: { where: { id: input.contactId || "__none__" } },
        equipments: { where: { id: { in: input.equipmentIds } } },
      },
    });
    if (!client) throw new Error("Cliente não encontrado.");
    if (client.addresses.length !== 1) throw new Error("Selecione um endereço de execução válido do cliente.");
    if (input.contactId && client.contacts.length !== 1) throw new Error("O contato selecionado não pertence ao cliente.");
    if (client.equipments.length !== input.equipmentIds.length) {
      throw new Error("Um ou mais equipamentos selecionados não pertencem ao cliente.");
    }

    const disciplinePrices = disciplineIds.map((disciplineId) => ({
      disciplineId,
      pricePerVisit: input.disciplinePrices.find((line) => line.disciplineId === disciplineId)?.pricePerVisit || 0,
    }));
    const packagePricePerVisit = disciplinePrices.reduce((sum, line) => sum + line.pricePerVisit, 0) || input.pricePerVisit;
    const serviceTotal = packagePricePerVisit * input.visitsPerYear;
    const materialTotal = input.materialsPerVisit * input.visitsPerYear;
    const travelTotal = input.travelPerVisit * input.visitsPerYear;
    const subtotal = serviceTotal + materialTotal + travelTotal;
    if (subtotal <= 0) throw new Error("Informe um valor para a proposta.");
    if (input.discount > subtotal) throw new Error("O desconto não pode superar o valor da proposta.");
    const taxProfile = await loadTaxProfile();
    const taxCalculation = calculateProposalTax(subtotal, input.discount, taxProfile.rate);
    const tax = taxCalculation.tax;
    const total = taxCalculation.total;
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + input.validityDays);
    const code = await nextQuoteCode();

    const equipmentSnapshots = client.equipments.map((equipment) => ({
      id: equipment.id,
      type: equipment.type,
      brand: equipment.brand,
      model: equipment.model,
      serialNumber: equipment.serialNumber,
      capacity: equipment.capacity,
      tag: equipment.tag,
      location: equipment.location,
    }));
    const plan = {
      schemaVersion: 2,
      templateId: input.templateId,
      disciplineIds,
      title: input.title,
      frequency: input.frequency,
      visitsPerYear: input.visitsPerYear,
      durationHours: input.durationHours,
      technicians: input.technicians,
      slaHours: input.slaHours,
      startDate: input.startDate,
      scope: input.scope,
      deliverables: input.deliverables,
      inclusions: input.inclusions,
      exclusions: input.exclusions,
      equipments: equipmentSnapshots,
      pricing: {
        pricePerVisit: packagePricePerVisit,
        packagePricePerVisit,
        disciplinePrices,
        materialsPerVisit: input.materialsPerVisit,
        travelPerVisit: input.travelPerVisit,
        discount: input.discount,
        tax,
        taxRegime: taxProfile.regime,
        taxRate: taxProfile.rate,
      },
    };
    const serviceItems = disciplinePrices.some((line) => line.pricePerVisit > 0)
      ? disciplinePrices.map((line) => {
          const template = getPreventiveTemplate(line.disciplineId);
          return {
            type: "SERVICO",
            description: `Manutenção preventiva — ${template.shortName} — ${input.visitsPerYear} visita(s) ${input.frequency.toLowerCase()}`,
            quantity: input.visitsPerYear,
            unit: "VISITA",
            unitPrice: line.pricePerVisit,
            costPrice: 0,
            discount: 0,
            total: line.pricePerVisit * input.visitsPerYear,
          };
        })
      : [{
          type: "SERVICO",
          description: `${input.title} — ${input.visitsPerYear} visita(s) ${input.frequency.toLowerCase()}`,
          quantity: input.visitsPerYear,
          unit: "VISITA",
          unitPrice: packagePricePerVisit,
          costPrice: 0,
          discount: 0,
          total: serviceTotal,
        }];
    const items = [
      ...serviceItems,
      ...(input.materialsPerVisit > 0 ? [{
        type: "PRODUTO",
        description: "Materiais e insumos previstos por visita",
        quantity: input.visitsPerYear,
        unit: "VISITA",
        unitPrice: input.materialsPerVisit,
        costPrice: input.materialsPerVisit,
        discount: 0,
        total: materialTotal,
      }] : []),
      ...(input.travelPerVisit > 0 ? [{
        type: "DESLOCAMENTO",
        description: "Deslocamento técnico programado",
        quantity: input.visitsPerYear,
        unit: "VISITA",
        unitPrice: input.travelPerVisit,
        costPrice: 0,
        discount: 0,
        total: travelTotal,
      }] : []),
    ];

    const quote = await prisma.$transaction(async (tx) => {
      const created = await tx.quote.create({
        data: {
          code,
          clientId: input.clientId,
          addressId: input.addressId,
          contactId: input.contactId || null,
          proposalType: "PREVENTIVA",
          preventivePlanJson: JSON.stringify(plan),
          status: "RASCUNHO",
          validUntil,
          warrantyDays: input.warrantyDays,
          executionTerm: `Início previsto em ${input.startDate}; ${input.visitsPerYear} visita(s) por ano`,
          paymentTerms: input.paymentTerms,
          subtotal,
          discount: input.discount,
          tax,
          total,
          costEstimate: materialTotal,
          estimatedMargin: total - materialTotal,
          notes: input.notes || null,
          items: { create: items },
        },
      });
      await tx.auditLog.create({
        data: {
          userId: session.userId,
          action: "CRIACAO",
          entity: "PropostaPreventiva",
          entityId: created.id,
          changesJson: JSON.stringify({ code: created.code, clientId: input.clientId, plan }),
        },
      });
      return created;
    });

    revalidatePath("/preventivas");
    revalidatePath("/orcamentos");
    return { success: true as const, quote: { id: quote.id, code: quote.code } };
  } catch (error) {
    logger.error("Erro ao criar proposta preventiva:", error);
    const message = error instanceof z.ZodError
      ? error.issues[0]?.message
      : error instanceof Error
        ? error.message
        : "Não foi possível criar a proposta preventiva.";
    return { success: false as const, error: message };
  }
}
