"use server";

import { logger } from "@/lib/logger";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAuth, requirePermission } from "@/lib/auth";
import { saveBase64Asset, deleteUploadedAsset } from "@/lib/storage";
import { osScheduleSchema } from "@/lib/schemas";
import { nextServiceOrderCode } from "@/lib/sequences";
import { createInitialVisit, nextVisitNumber, visitStatusFromLegacyOS } from "@/lib/visits";
import { getServiceChecklistTemplate, inferServiceModality, SERVICE_MODALITIES } from "@/lib/serviceChecklistTemplates";
import type { ServiceChecklistItem } from "@/lib/serviceChecklistTemplates";
import type { Prisma } from "@prisma/client";
import { failDataAccess, mutationFailure } from "@/lib/actionErrors";

export interface OSPartsInput {
  productId: string;
  quantity: number;
  salePrice: number;
  usedQuantity: number;
  status: "PREVISTO" | "UTILIZADO" | "DEVOLVIDO";
  acquisitionType?: string; // ESTOQUE or COMPRA_FUTURA
}

export interface ServiceOrderValueItemInput {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

function normalizeServiceOrderValueItems(items?: ServiceOrderValueItemInput[]) {
  if (!items?.length) return [];
  if (items.length > 100) throw new Error("A OS pode possuir no máximo 100 itens.");
  return items.map((item, index) => {
    const description = item.description?.trim();
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    const unit = item.unit?.trim().toUpperCase().slice(0, 12) || "UN";
    if (!description) throw new Error(`Descreva o item ${index + 1}.`);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error(`Informe uma quantidade válida no item ${index + 1}.`);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new Error(`Informe um valor válido no item ${index + 1}.`);
    return { description, quantity, unit, unitPrice, total: quantity * unitPrice };
  });
}

const OS_STATUS_ALIASES: Record<string, string> = {
  ABERTO: "CRIADA",
  AGENDADO: "AGENDADA",
  EM_EXECUCAO: "EXECUCAO",
  CONCLUIDO: "CONCLUIDA",
  "CONCLUÍDO": "CONCLUIDA",
  FATURADO: "FATURADA",
  CANCELADO: "CANCELADA",
};

const OS_TRANSITIONS: Record<string, string[]> = {
  CRIADA: ["AGUARDANDO_AGENDAMENTO", "AGENDADA", "CANCELADA"],
  AGUARDANDO_AGENDAMENTO: ["AGENDADA", "CANCELADA"],
  AGENDADA: ["DESLOCAMENTO", "EXECUCAO", "PAUSADA", "CANCELADA"],
  DESLOCAMENTO: ["EXECUCAO", "PAUSADA", "CANCELADA"],
  EXECUCAO: ["PAUSADA", "AGUARDANDO_PECA", "AGUARDANDO_CLIENTE", "RETORNO", "CONCLUIDA", "CANCELADA"],
  PAUSADA: ["EXECUCAO", "CANCELADA"],
  AGUARDANDO_PECA: ["EXECUCAO", "CANCELADA"],
  AGUARDANDO_CLIENTE: ["EXECUCAO", "CANCELADA"],
  RETORNO: ["AGENDADA", "EXECUCAO", "CANCELADA"],
  CONCLUIDA: ["REVISAO", "RELATORIO_ENVIADO"],
  REVISAO: ["EXECUCAO", "RELATORIO_ENVIADO"],
  RELATORIO_ENVIADO: ["FATURAMENTO"],
  FATURAMENTO: [],
  FATURADA: [],
  CANCELADA: [],
};

function normalizeOSStatus(status?: string | null) {
  const normalized = (status || "CRIADA").trim().toUpperCase();
  return OS_STATUS_ALIASES[normalized] || normalized;
}

function statusFilterValues(status: string) {
  const canonical = normalizeOSStatus(status);
  return [canonical, ...Object.entries(OS_STATUS_ALIASES)
    .filter(([, value]) => value === canonical)
    .map(([key]) => key)];
}

export async function createManualServiceOrder(data: {
  clientId: string;
  contractId?: string;
  addressId: string;
  contactId?: string;
  type: string;
  serviceCategory?: string;
  priority: string;
  problemReported: string;
  purchaseOrder?: string;
  notes?: string;
  referenceMonth?: string;
  items?: ServiceOrderValueItemInput[];
}) {
  try {
    const session = await requirePermission("os.write");
    if (!data.clientId) throw new Error("Selecione o cliente.");
    if (!data.problemReported?.trim()) throw new Error("Descreva o serviço ou problema relatado.");
    const validTypes = ["INSTALACAO", "PREVENTIVA", "CORRETIVA", "CONTRATO", "VISITA_TECNICA", "GARANTIA", "RETORNO", "EMERGENCIA", "LAUDO_TECNICO"];
    const validPriorities = ["BAIXA", "MEDIA", "ALTA", "URGENTE"];
    const validCategories = new Set(SERVICE_MODALITIES.map((item) => item.value));
    if (!validTypes.includes(data.type)) throw new Error("Tipo de serviço inválido.");
    if (!validPriorities.includes(data.priority)) throw new Error("Prioridade inválida.");
    if (data.referenceMonth && !/^\d{4}-\d{2}$/.test(data.referenceMonth)) throw new Error("Competência mensal inválida.");
    if (data.serviceCategory && !validCategories.has(data.serviceCategory as any)) throw new Error("Modalidade de serviço inválida.");
    const serviceCategory = validCategories.has(data.serviceCategory as any)
      ? data.serviceCategory!
      : data.type === "PREVENTIVA"
        ? "CLIMATIZACAO"
        : inferServiceModality(data.problemReported);
    const valueItems = normalizeServiceOrderValueItems(data.items);

    const client = await prisma.client.findUnique({
      where: { id: data.clientId },
      include: { addresses: true, contacts: data.contactId ? { where: { id: data.contactId } } : false },
    });
    if (!client) throw new Error("Cliente não encontrado.");

    let targetAddressId = data.addressId;
    let targetAddress = client.addresses.find((a) => a.id === targetAddressId);

    if (!targetAddress) {
      if (client.addresses.length > 0) {
        targetAddress = client.addresses[0];
        targetAddressId = targetAddress.id;
      } else {
        const createdAddress = await prisma.clientAddress.create({
          data: {
            clientId: client.id,
            label: "Matriz / Sede Principal",
            street: "Endereço Principal / Sede",
            number: "S/N",
            neighborhood: "Centro",
            city: "São Paulo",
            state: "SP",
            cep: "01000-000",
          },
        });
        targetAddress = createdAddress;
        targetAddressId = createdAddress.id;
      }
    }

    if (data.contactId && (!client.contacts || !client.contacts.length)) throw new Error("O contato selecionado não pertence ao cliente.");
    if (data.contractId) {
      const contract = await prisma.contract.findFirst({
        where: { id: data.contractId, clientId: data.clientId, status: { in: ["ATIVO", "PROVISORIO"] } },
        select: { id: true, addressId: true },
      });
      if (!contract) throw new Error("O contrato selecionado não pertence a este cliente ou não está ativo.");
      if (contract.addressId && contract.addressId !== targetAddressId) {
        targetAddressId = contract.addressId;
      }
    }

    const os = await prisma.$transaction(async (tx) => {
      const code = await nextServiceOrderCode(tx);
      const created = await tx.serviceOrder.create({
        data: {
          code,
          clientId: data.clientId,
          contractId: data.contractId || null,
          addressId: targetAddressId,
          contactId: data.contactId || null,
          type: data.type,
          serviceCategory,
          priority: data.priority,
          status: "AGUARDANDO_AGENDAMENTO",
          problemReported: data.problemReported.trim(),
          purchaseOrder: data.purchaseOrder?.trim() || null,
          checklistJson: JSON.stringify(getServiceChecklistTemplate(serviceCategory)),
          notes: data.notes?.trim() || null,
          operationKind: data.contractId ? (data.type === "PREVENTIVA" ? "VISITA_PREVENTIVA" : "CHAMADO_CONTRATO") : "AVULSA",
          referenceMonth: data.contractId ? (data.referenceMonth || new Date().toISOString().slice(0, 7)) : null,
          items: valueItems.length ? { create: valueItems } : undefined,
        },
      });
      await tx.serviceOrderStatusHistory.create({
        data: {
          serviceOrderId: created.id,
          oldStatus: "NENHUM",
          newStatus: "AGUARDANDO_AGENDAMENTO",
          changedById: session.userId,
          justification: "OS criada manualmente e encaminhada para agendamento.",
        },
      });
      await createInitialVisit(tx, {
        serviceOrderId: created.id,
        status: created.status,
        kind: data.type === "RETORNO" ? "RETORNO" : "ATENDIMENTO",
        changedById: session.userId,
      });
      await tx.auditLog.create({
        data: {
          userId: session.userId,
          action: "CRIACAO",
          entity: "OrdemServico",
          entityId: created.id,
          changesJson: JSON.stringify({ code: created.code, origin: "MANUAL", clientId: data.clientId, totalValue: valueItems.reduce((sum, item) => sum + item.total, 0), itemCount: valueItems.length }),
        },
      });
      return created;
    });

    revalidatePath("/ordens-servico");
    revalidatePath("/");
    return { success: true as const, error: undefined, os };
  } catch (error: unknown) {
    return mutationFailure("service-orders.create", error, "Não foi possível criar a ordem de serviço.");
  }
}

/**
 * Registra um atendimento avulso que já aconteceu.
 * O fluxo começa em CONCLUIDA, sem inventar agenda ou técnico, e abre o
 * relatório final para conferência, fotos, aceite e envio ao faturamento.
 */
export async function createQuickCompletedServiceOrder(data: {
  clientId: string;
  addressId?: string;
  contactId?: string;
  type: string;
  serviceCategory?: string;
  priority?: string;
  serviceDescription: string;
  technicalDiagnosis: string;
  value: number;
  purchaseOrder?: string;
  notes?: string;
  items?: ServiceOrderValueItemInput[];
}) {
  try {
    const session = await requirePermission("os.write");
    if (!data.clientId) throw new Error("Selecione o cliente.");
    if (!data.serviceDescription?.trim()) throw new Error("Descreva o serviço executado.");
    if (!data.technicalDiagnosis?.trim()) throw new Error("Informe o diagnóstico ou resultado do atendimento.");
    const valueItems = normalizeServiceOrderValueItems(data.items);
    const informedValue = Number(data.value);
    if (!Number.isFinite(informedValue) || informedValue < 0) throw new Error("Informe um valor válido para o atendimento.");
    const fallbackValue = valueItems.length ? 0 : informedValue;
    const normalizedItems = valueItems.length ? valueItems : [{
      description: data.serviceDescription.trim(),
      quantity: 1,
      unit: "SERVIÇO",
      unitPrice: fallbackValue,
      total: fallbackValue,
    }];
    const value = normalizedItems.reduce((sum, item) => sum + item.total, 0);

    const validTypes = ["INSTALACAO", "PREVENTIVA", "CORRETIVA", "VISITA_TECNICA", "GARANTIA", "RETORNO", "EMERGENCIA", "LAUDO_TECNICO"];
    const validCategories = new Set(SERVICE_MODALITIES.map((item) => item.value));
    if (!validTypes.includes(data.type)) throw new Error("Tipo de serviço inválido.");
    const serviceCategory = validCategories.has(data.serviceCategory as any)
      ? data.serviceCategory!
      : inferServiceModality(`${data.serviceDescription} ${data.technicalDiagnosis}`);

    const client = await prisma.client.findUnique({
      where: { id: data.clientId },
      include: {
        addresses: data.addressId ? { where: { id: data.addressId } } : false,
        contacts: data.contactId ? { where: { id: data.contactId } } : false,
      },
    });
    if (!client) throw new Error("Cliente não encontrado.");
    if (data.addressId && (!client.addresses || !client.addresses.length)) throw new Error("O endereço selecionado não pertence ao cliente.");
    if (data.contactId && (!client.contacts || !client.contacts.length)) throw new Error("O contato selecionado não pertence ao cliente.");

    const now = new Date();
    const os = await prisma.$transaction(async (tx) => {
      const code = await nextServiceOrderCode(tx);
      const created = await tx.serviceOrder.create({
        data: {
          code,
          clientId: data.clientId,
          addressId: data.addressId || null,
          contactId: data.contactId || null,
          type: data.type,
          serviceCategory,
          priority: data.priority || "MEDIA",
          status: "CONCLUIDA",
          operationKind: "AVULSA",
          requestSource: "ATENDIMENTO_RAPIDO",
          problemReported: data.serviceDescription.trim(),
          technicalDiagnosis: data.technicalDiagnosis.trim(),
          checklistJson: "[]",
          purchaseOrder: data.purchaseOrder?.trim() || null,
          notes: data.notes?.trim() || null,
          completedAt: now,
          items: { create: normalizedItems },
          completionReport: {
            create: {
              executedServices: data.serviceDescription.trim(),
              technicalObservations: data.technicalDiagnosis.trim(),
              operationalResult: "OPERACIONAL",
              warrantyTerms: "Garantia de 90 dias nos serviços prestados.",
              approvedByClient: false,
            },
          },
        },
      });
      await tx.serviceOrderStatusHistory.create({
        data: {
          serviceOrderId: created.id,
          oldStatus: "NENHUM",
          newStatus: "CONCLUIDA",
          changedById: session.userId,
          justification: "Atendimento avulso já realizado, registrado pelo fluxo rápido de relatório.",
        },
      });
      await createInitialVisit(tx, {
        serviceOrderId: created.id,
        status: "CONCLUIDA",
        kind: "ATENDIMENTO",
        changedById: session.userId,
      });
      await tx.auditLog.create({
        data: {
          userId: session.userId,
          action: "CRIACAO",
          entity: "OrdemServico",
          entityId: created.id,
          changesJson: JSON.stringify({ code: created.code, origin: "ATENDIMENTO_RAPIDO", value, itemCount: normalizedItems.length, clientId: data.clientId }),
        },
      });
      return created;
    });

    revalidatePath("/ordens-servico");
    revalidatePath("/faturamento");
    revalidatePath("/");
    return { success: true as const, error: undefined, os };
  } catch (error: unknown) {
    return mutationFailure("service-orders.quick-create", error, "Não foi possível registrar o atendimento rápido.");
  }
}

/** Baixa Rápida Expressa: Conclui a OS e altera o status instantaneamente enviando fotos e relatório automático */
export async function expressCloseServiceOrderAction(data: {
  serviceOrderId: string;
  targetStatus?: "CONCLUIDA" | "RELATORIO_ENVIADO" | "FATURAMENTO" | "FATURADA";
  solutionNotes?: string;
  photos?: { step?: "ANTES" | "DEPOIS" | "EVIDENCIA"; url: string; caption?: string }[];
}) {
  try {
    const session = await requirePermission("os.write");
    const targetStatus = data.targetStatus || "CONCLUIDA";

    const os = await prisma.serviceOrder.findUnique({
      where: { id: data.serviceOrderId },
      include: { client: true, items: true, completionReport: true },
    });

    if (!os) throw new Error("Ordem de serviço não encontrada.");

    const completedAt = ["CONCLUIDA", "FATURADA", "FATURAMENTO", "RELATORIO_ENVIADO"].includes(targetStatus)
      ? new Date()
      : os.completedAt;

    const faturamentoStatus = targetStatus === "FATURADA"
      ? "NF_EMITIDA"
      : ["FATURAMENTO", "CONCLUIDA", "RELATORIO_ENVIADO"].includes(targetStatus)
      ? "AGUARDANDO_FATURAMENTO"
      : os.faturamentoStatus;

    await prisma.serviceOrder.update({
      where: { id: os.id },
      data: {
        status: targetStatus,
        faturamentoStatus,
        completedAt,
        technicalDiagnosis: data.solutionNotes?.trim() || os.technicalDiagnosis || "Serviço executado com sucesso e aprovado pelo cliente.",
      },
    });

    // Se o faturamento/faturada for acionado ou a OS for concluída, lançar/atualizar Conta a Receber no Financeiro se houver cliente
    if (["FATURAMENTO", "FATURADA", "CONCLUIDA"].includes(targetStatus) && os.clientId) {
      const itemsTotal = os.items.reduce((sum, item) => sum + Number(item.total), 0);
      const finalVal = itemsTotal > 0 ? itemsTotal : 640;

      const existingReceivable = await prisma.accountsReceivable.findFirst({
        where: { serviceOrderId: os.id },
      });

      if (!existingReceivable) {
        await prisma.accountsReceivable.create({
          data: {
            clientId: os.clientId,
            serviceOrderId: os.id,
            totalValue: finalVal,
            pendingValue: targetStatus === "FATURADA" ? 0 : finalVal,
            receivedValue: targetStatus === "FATURADA" ? finalVal : 0,
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            paymentDate: targetStatus === "FATURADA" ? new Date() : null,
            status: targetStatus === "FATURADA" ? "PAGO" : "ABERTO",
            category: "RECEITA_SERVICO",
            costCenter: "OPERACIONAL",
            notes: `Faturamento automático da OS ${os.code} via Baixa Rápida`,
          },
        });
      } else if (targetStatus === "FATURADA" && existingReceivable.status !== "PAGO") {
        await prisma.accountsReceivable.update({
          where: { id: existingReceivable.id },
          data: {
            status: "PAGO",
            receivedValue: existingReceivable.totalValue,
            pendingValue: 0,
            paymentDate: new Date(),
          },
        });
      }
    }

    await prisma.serviceOrderStatusHistory.create({
      data: {
        serviceOrderId: os.id,
        oldStatus: os.status,
        newStatus: targetStatus,
        changedById: session.userId,
        justification: "Baixa Rápida Expressa realizada pelo usuário.",
      },
    });

    if (data.photos && data.photos.length > 0) {
      for (const p of data.photos) {
        if (p.url?.trim()) {
          await prisma.serviceOrderPhoto.create({
            data: {
              serviceOrderId: os.id,
              step: p.step || "EVIDENCIA",
              url: p.url.trim(),
              caption: p.caption?.trim() || "Foto de evidência do atendimento expresso",
            },
          });
        }
      }
    }

    if (!os.completionReport) {
      await prisma.completionReport.create({
        data: {
          serviceOrderId: os.id,
          executedServices: data.solutionNotes || os.problemReported || "Atendimento expresso concluído com sucesso.",
          technicalObservations: "Baixa rápida realizada diretamente pelo painel operacional com evidências.",
          operationalResult: "OPERACIONAL",
          approvedByClient: true,
          approvedAt: new Date(),
        },
      });
    }

    revalidatePath("/ordens-servico");
    revalidatePath("/faturamento");
    revalidatePath("/preventivas");
    revalidatePath("/financeiro");

    return { success: true as const, error: undefined };
  } catch (error: any) {
    return mutationFailure("service-orders.express-close", error, "Não foi possível concluir a OS no modo expresso.");
  }
}

/** Reverte o status de uma Ordem de Serviço de volta para EM_ATENDIMENTO se concluída ou baixada por engano */
export async function revertServiceOrderStatusAction(input: { serviceOrderId: string; justification?: string }) {
  try {
    const session = await requirePermission("os.write");
    const os = await prisma.serviceOrder.findUnique({
      where: { id: input.serviceOrderId },
    });

    if (!os) throw new Error("Ordem de serviço não encontrada.");

    const updated = await prisma.serviceOrder.update({
      where: { id: os.id },
      data: {
        status: "EM_ATENDIMENTO",
        faturamentoStatus: "PENDENTE",
        completedAt: null,
      },
    });

    await prisma.serviceOrderStatusHistory.create({
      data: {
        serviceOrderId: os.id,
        oldStatus: os.status,
        newStatus: "EM_ATENDIMENTO",
        changedById: session.userId,
        justification: input.justification?.trim() || "Estorno/reversão de status realizada pelo usuário.",
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "ESTORNO",
        entity: "OrdemServico",
        entityId: os.id,
        changesJson: JSON.stringify({ oldStatus: os.status, newStatus: "EM_ATENDIMENTO" }),
      },
    });

    revalidatePath("/ordens-servico");
    revalidatePath("/faturamento");
    revalidatePath("/preventivas");
    revalidatePath("/financeiro");

    return { success: true as const, error: undefined, serviceOrder: updated };
  } catch (error: any) {
    return mutationFailure("service-orders.revert-status", error, "Não foi possível reverter o status da OS.");
  }
}

/**
 * Consolida a operação mensal dos contratos por loja para a tela de OS.
 * O contrato é a unidade operacional: uma loja, suas preventivas e chamados.
 */
export async function getContractOperationsOverview(referenceMonth?: string) {
  try {
    await requireAuth();
    const month = /^\d{4}-\d{2}$/.test(referenceMonth || "") ? referenceMonth! : new Date().toISOString().slice(0, 7);
    const contracts = await prisma.contract.findMany({
      where: { status: { in: ["ATIVO", "PROVISORIO"] } },
      include: {
        client: { select: { id: true, name: true, fancyName: true, cpfCnpj: true } },
        address: true,
        contact: true,
        items: true,
        storeProjects: { include: { _count: { select: { assets: true } } } },
        serviceOrders: {
          select: {
            id: true,
            code: true,
            status: true,
            type: true,
            operationKind: true,
            referenceMonth: true,
            scheduledDate: true,
            completedAt: true,
            createdAt: true,
            priority: true,
            problemReported: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: [{ address: { label: "asc" } }, { code: "asc" }],
    });

    const closedStatuses = new Set(["CONCLUIDA", "CONCLUIDO", "RELATORIO_ENVIADO", "FATURAMENTO", "FATURADA", "FATURADO", "CANCELADA", "CANCELADO"]);
    return contracts.map((contract) => {
      const orders = contract.serviceOrders.map((order) => ({ ...order, status: normalizeOSStatus(order.status) }));
      const monthOrders = orders.filter((order) => {
        const inferred = (order.scheduledDate || order.createdAt).toISOString().slice(0, 7);
        return (order.referenceMonth || inferred) === month;
      });
      const preventive = monthOrders.find((order) => order.operationKind === "VISITA_PREVENTIVA" || order.type === "PREVENTIVA") || null;
      const calls = monthOrders.filter((order) => order.operationKind === "CHAMADO_CONTRATO" || order.type !== "PREVENTIVA");
      const openCalls = orders.filter((order) => (order.operationKind === "CHAMADO_CONTRATO" || order.type !== "PREVENTIVA") && !closedStatuses.has(order.status));
      const preventiveHistory = orders.filter((order) => order.operationKind === "VISITA_PREVENTIVA" || order.type === "PREVENTIVA");
      const lastCompletedPreventive = preventiveHistory.find((order) => ["CONCLUIDA", "RELATORIO_ENVIADO", "FATURAMENTO", "FATURADA"].includes(order.status)) || null;
      return {
        id: contract.id,
        code: contract.code,
        status: contract.status,
        value: Number(contract.value),
        billingPeriod: contract.billingPeriod,
        startDate: contract.startDate,
        endDate: contract.endDate,
        client: contract.client,
        address: contract.address,
        contact: contract.contact,
        items: contract.items.map((item) => ({ ...item, unitPrice: Number(item.unitPrice) })),
        projectCount: contract.storeProjects.length,
        assetCount: contract.storeProjects.reduce((sum, project) => sum + project._count.assets, 0),
        referenceMonth: month,
        preventive,
        preventiveCount: preventiveHistory.length,
        lastCompletedPreventive,
        callsThisMonth: calls.length,
        openCalls: openCalls.length,
        recentOrders: orders.slice(0, 8),
      };
    });
  } catch (error) {
    failDataAccess("service-orders.contract-overview", error);
  }
}

/** Gera uma única OS preventiva para a competência da loja/contrato. */
export async function createMonthlyContractPreventive(contractId: string, referenceMonth: string) {
  try {
    const session = await requirePermission("os.write");
    if (!/^\d{4}-\d{2}$/.test(referenceMonth)) throw new Error("Competência mensal inválida.");
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { address: true, contact: true, items: true, storeProjects: { orderBy: { createdAt: "asc" }, take: 1 } },
    });
    if (!contract || !["ATIVO", "PROVISORIO"].includes(contract.status)) throw new Error("Contrato ativo ou provisório não encontrado.");
    if (!contract.addressId) throw new Error("Defina a loja/endereço do contrato antes de gerar a preventiva.");

    const existing = await prisma.serviceOrder.findFirst({
      where: { contractId, referenceMonth, OR: [{ operationKind: "VISITA_PREVENTIVA" }, { type: "PREVENTIVA" }] },
    });
    if (existing) return { success: true as const, error: undefined, serviceOrder: existing, created: false };

    const description = contract.items.length
      ? contract.items.map((item) => `• ${item.description} (${item.quantity}x)`).join("\n")
      : "Executar visita preventiva mensal conforme escopo do contrato.";
    const serviceCategory = inferServiceModality(description);
    const serviceOrder = await prisma.$transaction(async (tx) => {
      const code = await nextServiceOrderCode(tx);
      const created = await tx.serviceOrder.create({
        data: {
          code,
          clientId: contract.clientId,
          contractId: contract.id,
          addressId: contract.addressId,
          contactId: contract.contactId,
          storeProjectId: contract.storeProjects[0]?.id || null,
          type: "PREVENTIVA",
          operationKind: "VISITA_PREVENTIVA",
          referenceMonth,
          serviceCategory,
          priority: "MEDIA",
          status: "AGUARDANDO_AGENDAMENTO",
          problemReported: `Visita preventiva mensal · competência ${referenceMonth}\n\n${description}`,
          checklistJson: JSON.stringify(getServiceChecklistTemplate(serviceCategory)),
          notes: `Cobertura vinculada ao contrato ${contract.code}.`,
        },
      });
      await createInitialVisit(tx, { serviceOrderId: created.id, status: created.status, kind: "VISTORIA", changedById: session.userId });
      await tx.serviceOrderStatusHistory.create({
        data: { serviceOrderId: created.id, oldStatus: "NENHUM", newStatus: created.status, changedById: session.userId, justification: `Preventiva mensal ${referenceMonth} gerada pelo controle do contrato ${contract.code}.` },
      });
      await tx.auditLog.create({
        data: { userId: session.userId, action: "CRIACAO", entity: "OrdemServico", entityId: created.id, changesJson: JSON.stringify({ origin: "CONTRATO_MENSAL", contractId, referenceMonth }) },
      });
      return created;
    });
    revalidatePath("/ordens-servico");
    revalidatePath("/preventivas");
    return { success: true as const, error: undefined, serviceOrder, created: true };
  } catch (error: unknown) {
    return mutationFailure("service-orders.preventive.create", error, "Não foi possível gerar a preventiva mensal.");
  }
}

/**
 * Obtém a listagem de OSs com filtros flexíveis
 */
export async function getServiceOrders(filters?: {
  search?: string;
  status?: string;
  techId?: string;
  priority?: string;
}) {
  try {
    await requireAuth();

    const where: any = {};

    if (filters?.status) {
      if (filters.status === "ATRASADA") {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        where.scheduledDate = { lt: today };
        where.status = { notIn: ["CONCLUIDA", "RELATORIO_ENVIADO", "FATURAMENTO", "FATURADA", "CANCELADA", "CONCLUIDO", "FATURADO", "CANCELADO"] };
      } else {
        where.status = { in: statusFilterValues(filters.status) };
      }
    }
    if (filters?.priority) {
      where.priority = filters.priority;
    }
    if (filters?.techId) {
      where.technicians = {
        some: {
          userId: filters.techId,
        },
      };
    }
    if (filters?.search?.trim()) {
      const term = filters.search.trim();
      where.OR = [
        { code: { contains: term, mode: "insensitive" } },
        { client: { name: { contains: term, mode: "insensitive" } } },
        { client: { fancyName: { contains: term, mode: "insensitive" } } },
        { client: { socialName: { contains: term, mode: "insensitive" } } },
        { problemReported: { contains: term, mode: "insensitive" } },
      ];
    }

    const serviceOrders = await prisma.serviceOrder.findMany({
      where,
      include: {
        client: true,
        contract: { select: { id: true, code: true, status: true } },
        address: { select: { id: true, label: true, city: true, state: true } },
        technicians: {
          include: {
            user: true,
          },
        },
        visits: {
          include: {
            technicians: { include: { user: { select: { id: true, name: true, email: true } } } },
            statusHistory: {
              include: { changedBy: { select: { id: true, name: true } } },
              orderBy: { changedAt: "desc" },
            },
            timeEntries: { orderBy: { startedAt: "desc" } },
            measurementReadings: { include: { definition: true }, orderBy: { recordedAt: "desc" } },
            _count: { select: { evidences: true, locationEvents: true } },
          },
          orderBy: { number: "desc" },
        },
        serviceOrderAssets: {
          include: { storeAsset: true, clientEquipment: true },
        },
        evidences: { orderBy: { createdAt: "desc" } },
        quote: { select: { code: true, total: true, subtotal: true } },
        items: true,
        materials: true,
        completionReport: true,
        invoices: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return serviceOrders.map((os) => {
      const totalItems = os.items.reduce((sum, item) => sum + Number(item.total), 0);
      const totalMaterials = os.materials.reduce((sum, m) => {
        const qty = m.status === "UTILIZADO" ? (m.usedQuantity > 0 ? m.usedQuantity : m.quantity) : m.quantity;
        return sum + qty * Number(m.salePrice);
      }, 0);
      const quoteTotal = os.quote?.total ? Number(os.quote.total) : 0;
      const totalValue = quoteTotal > 0 ? quoteTotal : (totalItems + totalMaterials);

      return {
        id: os.id,
        clientId: os.clientId,
        code: os.code,
        client: {
          id: os.client.id,
          name: os.client.name,
          email: os.client.email,
        },
        clientName: os.client.name,
        status: normalizeOSStatus(os.status),
        priority: os.priority,
        type: os.type,
        serviceCategory: os.serviceCategory,
        operationKind: os.operationKind,
        referenceMonth: os.referenceMonth,
        contract: os.contract,
        address: os.address,
        problemReported: os.problemReported,
        createdAt: os.createdAt,
        scheduledDate: os.scheduledDate,
        scheduledTime: os.scheduledTime,
        technicians: os.technicians.map((t) => ({
          id: t.id,
          userId: t.userId,
          name: t.user.name,
          technician: { name: t.user.name },
        })),
        totalValue,
      };
    });
  } catch (error) {
    failDataAccess("service-orders.list", error);
  }
}

/**
 * Obtém detalhes completos de uma OS específica
 */
export async function getServiceOrderDetails(id: string) {
  try {
    await requireAuth();

    const os = await prisma.serviceOrder.findUnique({
      where: { id },
      include: {
        client: {
          include: {
            addresses: true,
            contacts: true,
          },
        },
        address: true,
        contact: true,
        contract: {
          include: {
            address: true,
            contact: true,
            items: true,
            serviceOrders: {
              select: { id: true, code: true, type: true, operationKind: true, referenceMonth: true, status: true, scheduledDate: true, completedAt: true, createdAt: true },
              orderBy: { createdAt: "desc" },
              take: 24,
            },
          },
        },
        quote: { select: { id: true, code: true, total: true, subtotal: true } },
        items: true,
        materials: {
          include: {
            product: true,
          },
        },
        photos: true,
        technicians: {
          include: {
            user: true,
          },
        },
        visits: {
          include: {
            technicians: { include: { user: { select: { id: true, name: true, email: true } } } },
            statusHistory: {
              include: { changedBy: { select: { id: true, name: true } } },
              orderBy: { changedAt: "desc" },
            },
            timeEntries: { orderBy: { startedAt: "desc" } },
            measurementReadings: { include: { definition: true }, orderBy: { recordedAt: "desc" } },
            formSubmissions: {
              include: { version: { include: { template: true } } },
              orderBy: { updatedAt: "desc" },
            },
            _count: { select: { evidences: true, locationEvents: true } },
          },
          orderBy: { number: "desc" },
        },
        serviceOrderAssets: {
          include: {
            storeAsset: { include: { project: { select: { id: true, name: true } } } },
            clientEquipment: true,
          },
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        },
        storeProject: { select: { id: true, name: true } },
        evidences: { orderBy: { createdAt: "desc" } },
        statusHistory: {
          include: {
            changedBy: true,
          },
          orderBy: { changedAt: "desc" },
        },
        completionReport: true,
        invoices: true,
      },
    });

    if (!os) return null;

    const totalItems = os.items.reduce((sum, item) => sum + Number(item.total), 0);
    const totalMaterials = os.materials.reduce((sum, m) => {
      const qty = m.status === "UTILIZADO" ? (m.usedQuantity > 0 ? m.usedQuantity : m.quantity) : m.quantity;
      return sum + qty * Number(m.salePrice);
    }, 0);
    const quoteTotal = os.quote?.total ? Number(os.quote.total) : 0;
    const totalValue = quoteTotal > 0 ? quoteTotal : (totalItems + totalMaterials);

    return {
      ...os,
      status: normalizeOSStatus(os.status),
      items: os.items.map((item) => ({
        ...item,
        unitPrice: Number(item.unitPrice),
        total: Number(item.total),
      })),
      materials: os.materials.map((material) => ({
        ...material,
        costPrice: Number(material.costPrice),
        salePrice: Number(material.salePrice),
        product: material.product
          ? {
              ...material.product,
              costPrice: Number(material.product.costPrice),
              salePrice: Number(material.product.salePrice),
            }
          : null,
      })),
      totalValue,
    };
  } catch (error) {
    failDataAccess("service-orders.details", error);
  }
}

/**
 * Agenda data/horário e atribui equipe técnica para a OS
 */
export async function scheduleServiceOrder(
  osId: string,
  data: {
    scheduledDate: Date;
    scheduledTime: string;
    techIds: string[];
    priority?: string;
  },
  userId: string
) {
  try {
    const session = await requirePermission("os.write");
    userId = session.userId; // nunca confiar no valor vindo do client
    osScheduleSchema.parse(data);

    const currentOS = await prisma.serviceOrder.findUnique({
      where: { id: osId },
      select: { status: true },
    });
    if (!currentOS) throw new Error("Ordem de serviço não encontrada.");

    const currentStatus = normalizeOSStatus(currentOS.status);
    if (!["CRIADA", "AGUARDANDO_AGENDAMENTO", "AGENDADA", "RETORNO"].includes(currentStatus)) {
      throw new Error("Esta OS não pode ser reagendada na etapa atual.");
    }
    if (!data.techIds.length) throw new Error("Selecione ao menos um técnico para agendar a OS.");

    const techRelations = data.techIds.map((tId) => ({
      serviceOrderId: osId,
      userId: tId,
    }));
    const updatedOS = await prisma.$transaction(async (tx) => {
      await tx.serviceOrderTechnician.deleteMany({ where: { serviceOrderId: osId } });
      await tx.serviceOrderTechnician.createMany({ data: techRelations });
      let visit = await tx.serviceVisit.findFirst({
        where: { serviceOrderId: osId, status: { notIn: ["CONCLUIDA", "CANCELADA"] } },
        orderBy: { number: "desc" },
      });
      if (!visit) {
        visit = await createInitialVisit(tx, {
          serviceOrderId: osId,
          status: currentStatus,
          scheduledStart: data.scheduledDate,
          scheduledTime: data.scheduledTime,
          technicianIds: data.techIds,
          changedById: userId,
        });
      }
      const visitStart = new Date(data.scheduledDate);
      const [visitHours, visitMinutes] = data.scheduledTime.split(":").map(Number);
      if (Number.isFinite(visitHours) && Number.isFinite(visitMinutes)) visitStart.setHours(visitHours, visitMinutes, 0, 0);
      await tx.visitTechnician.deleteMany({ where: { visitId: visit.id } });
      await tx.visitTechnician.createMany({
        data: data.techIds.map((techId, index) => ({ visitId: visit!.id, userId: techId, role: index === 0 ? "RESPONSAVEL" : "TECNICO" })),
      });
      await tx.serviceVisit.update({
        where: { id: visit.id },
        data: {
          status: "AGENDADA",
          scheduledStart: visitStart,
          scheduledEnd: new Date(visitStart.getTime() + visit.estimatedDurationMinutes * 60_000),
        },
      });
      await tx.visitStatusHistory.create({
        data: {
          visitId: visit.id,
          oldStatus: visit.status,
          newStatus: "AGENDADA",
          changedById: userId,
          justification: `Visita ${visit.number} agendada para ${visitStart.toLocaleDateString("pt-BR")} às ${data.scheduledTime}.`,
        },
      });
      const updated = await tx.serviceOrder.update({
        where: { id: osId },
        data: {
          scheduledDate: data.scheduledDate,
          scheduledTime: data.scheduledTime,
          priority: data.priority || "MEDIA",
          status: "AGENDADA",
        },
      });
      await tx.serviceOrderStatusHistory.create({
        data: {
          serviceOrderId: osId,
          oldStatus: currentStatus,
          newStatus: "AGENDADA",
          changedById: userId,
          justification: `OS agendada para ${new Date(data.scheduledDate).toLocaleDateString("pt-BR")} às ${data.scheduledTime}.`,
        },
      });
      return updated;
    });

    // E-mail simulation triggers (both to console and saved as AuditLog and Notification in the database)
    const osWithDetails = await prisma.serviceOrder.findUnique({
      where: { id: osId },
      include: {
        client: true,
        technicians: {
          include: {
            user: true,
          }
        }
      }
    });

    if (osWithDetails) {
      const clientEmail = osWithDetails.client.email || "cliente@nexus.com.br";
      const techEmails = osWithDetails.technicians.map(t => t.user.email).join(", ");

      logger.info(`\n=== EMAIL NOTIFICATION SENT ===`);
      logger.info(`From: Nexus Climatização <notificacao@nexusclimatizacao.com.br>`);
      logger.info(`To: ${clientEmail}`);
      logger.info(`CC: ${techEmails}`);
      logger.info(`Subject: Agendamento Confirmado - OS ${osWithDetails.code}`);
      logger.info(`Body: Olá ${osWithDetails.client.name}, informamos que sua ordem de serviço ${osWithDetails.code} foi agendada para ${new Date(data.scheduledDate).toLocaleDateString("pt-BR")} às ${data.scheduledTime}. Prioridade: ${data.priority || "MEDIA"}.\n================================\n`);

      // Persist email log as an AuditLog
      await prisma.auditLog.create({
        data: {
          userId,
          action: "EMAIL_DISPARO",
          entity: "OrdemServico",
          entityId: osId,
          changesJson: JSON.stringify({
            sentTo: clientEmail,
            cc: techEmails,
            subject: `Agendamento Confirmado - OS ${osWithDetails.code}`,
            message: `Serviço agendado para ${new Date(data.scheduledDate).toLocaleDateString("pt-BR")} às ${data.scheduledTime}.`
          })
        }
      });
    }

    revalidatePath("/ordens-servico");
    return { success: true as const, error: undefined, os: updatedOS };
  } catch (error: unknown) {
    return mutationFailure("service-orders.schedule", error, "Não foi possível agendar a ordem de serviço.");
  }
}

/**
 * Transiciona o status da OS com auditoria
 */
export async function updateOSStatus(
  osId: string,
  newStatus: string,
  userId: string,
  justification?: string
) {
  try {
    const session = await requirePermission("os.write");
    userId = session.userId; // nunca confiar no valor vindo do client

    const os = await prisma.serviceOrder.findUnique({
      where: { id: osId },
      include: {
        technicians: { select: { id: true, userId: true } },
        completionReport: true,
        materials: true,
      },
    });

    if (!os) throw new Error("OS não encontrada.");

    const oldStatus = normalizeOSStatus(os.status);
    newStatus = normalizeOSStatus(newStatus);
    if (!OS_TRANSITIONS[newStatus]) throw new Error("Status de OS inválido.");
    if (oldStatus === newStatus) return { success: true as const, error: undefined, os: { ...os, status: oldStatus } };
    if (!OS_TRANSITIONS[oldStatus]?.includes(newStatus)) {
      throw new Error(`Transição inválida: ${oldStatus} não pode avançar diretamente para ${newStatus}.`);
    }

    if (["AGENDADA", "DESLOCAMENTO", "EXECUCAO"].includes(newStatus) && os.technicians.length === 0) {
      throw new Error("Atribua ao menos um técnico antes de iniciar o atendimento.");
    }
    if (newStatus === "AGENDADA" && (!os.scheduledDate || !os.scheduledTime)) {
      throw new Error("Informe data e horário no agendamento da OS.");
    }
    const data: any = { status: newStatus };
    if (newStatus === "CONCLUIDA") {
      if (!os.technicalDiagnosis?.trim()) {
        data.technicalDiagnosis = "Serviço executado e concluído em campo.";
      }
      data.completedAt = new Date();
    }
    if (["EXECUCAO", "RETORNO"].includes(newStatus)) data.completedAt = null;

    const updatedOS = await prisma.$transaction(async (tx) => {
      const updated = await tx.serviceOrder.update({ where: { id: osId }, data });
      await tx.serviceOrderStatusHistory.create({
        data: {
          serviceOrderId: osId,
          oldStatus,
          newStatus,
          changedById: userId,
          justification: justification || "Etapa atualizada pelo fluxo operacional da OS.",
        },
      });

      // Mantém o fluxo legado da OS sincronizado com a visita operacional.
      // A OS continua sendo o processo comercial; a visita guarda cada ida a campo.
      let activeVisit = await tx.serviceVisit.findFirst({
        where: { serviceOrderId: osId },
        orderBy: { number: "desc" },
        include: { technicians: true },
      });
      if (!activeVisit) {
        await createInitialVisit(tx, {
          serviceOrderId: osId,
          status: oldStatus,
          scheduledStart: os.scheduledDate,
          scheduledTime: os.scheduledTime,
          technicianIds: os.technicians.map((technician) => technician.userId),
          changedById: userId,
        });
        activeVisit = await tx.serviceVisit.findFirst({
          where: { serviceOrderId: osId },
          orderBy: { number: "desc" },
          include: { technicians: true },
        });
      }

      if (activeVisit && newStatus === "RETORNO") {
        const now = new Date();
        if (!['CONCLUIDA', 'CANCELADA'].includes(activeVisit.status)) {
          await tx.serviceVisit.update({
            where: { id: activeVisit.id },
            data: {
              status: "CONCLUIDA",
              result: "RETORNO_NECESSARIO",
              returnReason: justification || "Retorno solicitado durante o atendimento.",
              completedAt: now,
            },
          });
          await tx.visitStatusHistory.create({
            data: {
              visitId: activeVisit.id,
              oldStatus: activeVisit.status,
              newStatus: "CONCLUIDA",
              changedById: userId,
              justification: justification || "Visita encerrada com necessidade de retorno.",
            },
          });
        }

        const visitNumber = await nextVisitNumber(tx, osId);
        await tx.serviceVisit.create({
          data: {
            serviceOrderId: osId,
            number: visitNumber,
            kind: "RETORNO",
            status: "NAO_AGENDADA",
            sourceVisitId: activeVisit.id,
            returnReason: justification || "Retorno solicitado durante o atendimento.",
            technicians: activeVisit.technicians.length
              ? {
                  create: activeVisit.technicians.map((technician) => ({
                    userId: technician.userId,
                    role: technician.role,
                  })),
                }
              : undefined,
            statusHistory: {
              create: {
                oldStatus: "NENHUM",
                newStatus: "NAO_AGENDADA",
                changedById: userId,
                justification: `Retorno originado na visita ${activeVisit.number}.`,
              },
            },
          },
        });
      } else if (activeVisit) {
        const visitStatus = visitStatusFromLegacyOS(newStatus);
        if (visitStatus !== activeVisit.status) {
          const now = new Date();
          const visitData: Prisma.ServiceVisitUncheckedUpdateInput = { status: visitStatus };
          if (visitStatus === "EM_DESLOCAMENTO") visitData.travelStartedAt = activeVisit.travelStartedAt || now;
          if (visitStatus === "EM_EXECUCAO") {
            visitData.startedAt = activeVisit.startedAt || now;
            visitData.completedAt = null;
            visitData.cancelledAt = null;
            visitData.result = null;
          }
          if (visitStatus === "PAUSADA") visitData.pausedAt = now;
          if (visitStatus === "CONCLUIDA") {
            visitData.completedAt = activeVisit.completedAt || now;
            visitData.result = activeVisit.result || "RESOLVIDO";
          }
          if (visitStatus === "CANCELADA") visitData.cancelledAt = now;

          await tx.serviceVisit.update({ where: { id: activeVisit.id }, data: visitData });
          await tx.visitStatusHistory.create({
            data: {
              visitId: activeVisit.id,
              oldStatus: activeVisit.status,
              newStatus: visitStatus,
              changedById: userId,
              justification: justification || `Sincronizado com a etapa ${newStatus} da OS.`,
            },
          });
        }
      }
      return updated;
    });

    // Se a OS for concluída, gerar relatório pendente na notificação
    if (newStatus === "CONCLUIDA") {
      await prisma.notification.create({
        data: {
          title: "Relatório de OS pendente",
          message: `A OS ${os.code} foi concluída pelo técnico. Favor enviar o relatório ao cliente.`,
          type: "OPERACIONAL",
          link: "/ordens-servico",
        },
      });
    }

    revalidatePath("/ordens-servico");
    revalidatePath("/execucao");
    revalidatePath("/faturamento");
    return { success: true as const, error: undefined, os: updatedOS };
  } catch (error: unknown) {
    return mutationFailure("service-orders.status.update", error, "Não foi possível alterar o status da ordem de serviço.");
  }
}

/**
 * Atualiza materiais da OS e executa baixa de estoque integrada
 */
export async function updateOSMaterials(
  osId: string,
  materials: OSPartsInput[],
  userId: string
) {
  try {
    const session = await requirePermission("os.write");
    userId = session.userId; // nunca confiar no valor vindo do client

    // 1. Carregar materiais já cadastrados para esta OS para comparar
    const currentMaterials = await prisma.serviceOrderMaterial.findMany({
      where: { serviceOrderId: osId },
    });

    // Executar transações atômicas para atualizar estoque e tabelas
    await prisma.$transaction(async (tx) => {
      // Remover materiais antigos da OS que foram deletados da lista
      const inputProductIds = materials.map((m) => m.productId);
      const toDelete = currentMaterials.filter((cm) => !inputProductIds.includes(cm.productId));

      for (const matToDelete of toDelete) {
        // Se já estava UTILIZADO, precisamos devolver o estoque!
        if (matToDelete.status === "UTILIZADO" && matToDelete.usedQuantity > 0 && matToDelete.acquisitionType === "ESTOQUE") {
          const prod = await tx.product.findUnique({ where: { id: matToDelete.productId } });
          if (prod) {
            await tx.product.update({
              where: { id: matToDelete.productId },
              data: { stockQuantity: prod.stockQuantity + matToDelete.usedQuantity },
            });
            await tx.stockMovement.create({
              data: {
                productId: matToDelete.productId,
                type: "ENTRADA",
                quantity: matToDelete.usedQuantity,
                reason: "AJUSTE",
                serviceOrderId: osId,
                cost: Number(matToDelete.costPrice),
              },
            });
          }
        }
        await tx.serviceOrderMaterial.delete({ where: { id: matToDelete.id } });
      }

      // Adicionar ou Atualizar materiais
      for (const matInput of materials) {
        const existing = currentMaterials.find((cm) => cm.productId === matInput.productId);
        const product = await tx.product.findUnique({ where: { id: matInput.productId } });

        if (!product) throw new Error("Produto do estoque não encontrado.");

        const isFromStock = (matInput.acquisitionType || "ESTOQUE") === "ESTOQUE";
        if (matInput.quantity <= 0 || matInput.usedQuantity < 0) {
          throw new Error(`Quantidade inválida para o produto '${product.name}'.`);
        }

        if (existing) {
          // Atualiza registro existente
          const oldStatus = existing.status;
          const oldUsedQty = existing.usedQuantity;

          await tx.serviceOrderMaterial.update({
            where: { id: existing.id },
            data: {
              quantity: matInput.quantity,
              salePrice: matInput.salePrice,
              usedQuantity: matInput.usedQuantity,
              status: matInput.status,
              acquisitionType: matInput.acquisitionType || "ESTOQUE",
            },
          });

          // Tratar movimentação de estoque
          if (isFromStock) {
            if (matInput.status === "UTILIZADO" && oldStatus !== "UTILIZADO") {
              if (product.stockQuantity < matInput.usedQuantity) {
                throw new Error(`Estoque insuficiente para '${product.name}'. Disponível: ${product.stockQuantity}.`);
              }
              // Estava previsto ou devolvido e agora foi utilizado -> Subtrair estoque
              await tx.product.update({
                where: { id: matInput.productId },
                data: { stockQuantity: product.stockQuantity - matInput.usedQuantity },
              });
              await tx.stockMovement.create({
                data: {
                  productId: matInput.productId,
                  type: "SAIDA",
                  quantity: matInput.usedQuantity,
                  reason: "OS_UTILIZADO",
                  serviceOrderId: osId,
                  cost: Number(product.costPrice),
                },
              });
            } else if (matInput.status === "UTILIZADO" && oldStatus === "UTILIZADO" && oldUsedQty !== matInput.usedQuantity) {
              // Ajustar a diferença de quantidade utilizada
              const diff = matInput.usedQuantity - oldUsedQty;
              if (diff > product.stockQuantity) {
                throw new Error(`Estoque insuficiente para '${product.name}'. Disponível: ${product.stockQuantity}.`);
              }
              await tx.product.update({
                where: { id: matInput.productId },
                data: { stockQuantity: product.stockQuantity - diff },
              });
              await tx.stockMovement.create({
                data: {
                  productId: matInput.productId,
                  type: diff > 0 ? "SAIDA" : "ENTRADA",
                  quantity: Math.abs(diff),
                  reason: "AJUSTE",
                  serviceOrderId: osId,
                  cost: Number(product.costPrice),
                },
              });
            } else if (matInput.status !== "UTILIZADO" && oldStatus === "UTILIZADO") {
              // Cancelou o uso -> Devolve o estoque
              await tx.product.update({
                where: { id: matInput.productId },
                data: { stockQuantity: product.stockQuantity + oldUsedQty },
              });
              await tx.stockMovement.create({
                data: {
                  productId: matInput.productId,
                  type: "ENTRADA",
                  quantity: oldUsedQty,
                  reason: "OS_DEVOLVIDO",
                  serviceOrderId: osId,
                  cost: Number(product.costPrice),
                },
              });
            }
          }
        } else {
          // Cria novo registro de material na OS
          await tx.serviceOrderMaterial.create({
            data: {
              serviceOrderId: osId,
              productId: matInput.productId,
              quantity: matInput.quantity,
              costPrice: product.costPrice,
              salePrice: matInput.salePrice,
              usedQuantity: matInput.usedQuantity,
              status: matInput.status,
              acquisitionType: matInput.acquisitionType || "ESTOQUE",
            },
          });

          // Se já marcou como UTILIZADO no cadastro inicial -> Subtrai estoque
          if (matInput.status === "UTILIZADO" && isFromStock) {
            if (product.stockQuantity < matInput.usedQuantity) {
              throw new Error(`Estoque insuficiente para '${product.name}'. Disponível: ${product.stockQuantity}.`);
            }
            await tx.product.update({
              where: { id: matInput.productId },
              data: { stockQuantity: product.stockQuantity - matInput.usedQuantity },
            });
            await tx.stockMovement.create({
              data: {
                productId: matInput.productId,
                type: "SAIDA",
                quantity: matInput.usedQuantity,
                reason: "OS_UTILIZADO",
                serviceOrderId: osId,
                cost: Number(product.costPrice),
              },
            });
          }
        }

        // Emitir alerta de estoque mínimo se aplicável
        const reloadedProduct = await tx.product.findUnique({ where: { id: matInput.productId } });
        if (reloadedProduct && reloadedProduct.stockQuantity <= reloadedProduct.minStock) {
          await tx.notification.create({
            data: {
              title: "Alerta de Estoque Mínimo",
              message: `O produto '${reloadedProduct.name}' atingiu o estoque crítico de ${reloadedProduct.stockQuantity} ${reloadedProduct.unit}.`,
              type: "ESTOQUE",
              link: "/estoque",
            },
          });
        }
      }

      // 6. Recalcular a margem real da OS
      // Margem Real = Total Venda dos Serviços/Itens + Total Venda das Peças Utilizadas - Custo Real das Peças Utilizadas
      const osItems = await tx.serviceOrderItem.findMany({ where: { serviceOrderId: osId } });
      const osMaterials = await tx.serviceOrderMaterial.findMany({ where: { serviceOrderId: osId } });

      const totalItemsValue = osItems.reduce((sum, item) => sum + Number(item.total), 0);
      const usedMaterials = osMaterials.filter((m) => m.status === "UTILIZADO");

      const totalMaterialsSale = usedMaterials.reduce((sum, m) => sum + m.usedQuantity * Number(m.salePrice), 0);
      const totalMaterialsCost = usedMaterials.reduce((sum, m) => sum + m.usedQuantity * Number(m.costPrice), 0);

      const totalOSRevenue = totalItemsValue + totalMaterialsSale;
      const totalOSCost = totalMaterialsCost;
      const marginReal = totalOSRevenue - totalOSCost;

      await tx.serviceOrder.update({
        where: { id: osId },
        data: {
          marginReal,
        },
      });
    });

    revalidatePath("/ordens-servico");
    revalidatePath("/");
    return { success: true as const, error: undefined };
  } catch (error: unknown) {
    return mutationFailure("service-orders.materials.update", error, "Não foi possível atualizar os materiais da ordem de serviço.");
  }
}

/**
 * Atualiza detalhes gerais da OS (diagnóstico, checklists, prioridade, tipo, notas, etc.)
 */
export async function updateOSDetails(
  osId: string,
  data: {
    priority?: string;
    type?: string;
    status?: string;
    problemReported?: string;
    technicalDiagnosis?: string;
    serviceCategory?: string;
    checklistJson?: string;
    notes?: string;
  },
  userId: string
) {
  try {
    const session = await requirePermission("os.write");
    userId = session.userId; // nunca confiar no valor vindo do client

    const oldOS = await prisma.serviceOrder.findUnique({
      where: { id: osId }
    });
    if (!oldOS) throw new Error("Ordem de serviço não encontrada");
    if (data.status && normalizeOSStatus(data.status) !== normalizeOSStatus(oldOS.status)) {
      throw new Error("Use as ações do fluxo da OS para alterar a etapa. O status não pode ser editado manualmente.");
    }
    if (data.serviceCategory && !SERVICE_MODALITIES.some((item) => item.value === data.serviceCategory)) {
      throw new Error("Modalidade de serviço inválida.");
    }

    const updatedOS = await prisma.serviceOrder.update({
      where: { id: osId },
      data: {
        priority: data.priority !== undefined ? data.priority : oldOS.priority,
        type: data.type !== undefined ? data.type : oldOS.type,
        problemReported: data.problemReported !== undefined ? data.problemReported : oldOS.problemReported,
        technicalDiagnosis: data.technicalDiagnosis !== undefined ? data.technicalDiagnosis : oldOS.technicalDiagnosis,
        serviceCategory: data.serviceCategory !== undefined ? data.serviceCategory : oldOS.serviceCategory,
        checklistJson: data.checklistJson !== undefined ? data.checklistJson : oldOS.checklistJson,
        notes: data.notes !== undefined ? data.notes : oldOS.notes,
      }
    });

    revalidatePath("/ordens-servico");
    return { success: true as const, error: undefined, os: updatedOS };
  } catch (error: unknown) {
    return mutationFailure("service-orders.update", error, "Não foi possível atualizar a ordem de serviço.");
  }
}

export async function applyOSChecklistTemplate(osId: string, serviceCategory: string, preserveCompleted = true) {
  try {
    await requirePermission("os.write");
    if (!SERVICE_MODALITIES.some((item) => item.value === serviceCategory)) throw new Error("Modalidade de serviço inválida.");
    const os = await prisma.serviceOrder.findUnique({ where: { id: osId }, select: { checklistJson: true } });
    if (!os) throw new Error("Ordem de serviço não encontrada.");

    let existing: ServiceChecklistItem[] = [];
    try { existing = JSON.parse(os.checklistJson || "[]"); } catch { existing = []; }
    const generated = getServiceChecklistTemplate(serviceCategory).map((item) => ({
      ...item,
      ...(() => {
        if (!preserveCompleted) return {};
        const previous = existing.find((entry) => (entry.id && entry.id === item.id) || entry.label?.trim() === item.label);
        return previous
          ? {
              checked: Boolean(previous.checked),
              status: previous.status || (previous.checked ? "CONFORME" : "PENDENTE"),
              observation: previous.observation || "",
            }
          : {};
      })(),
    }));

    const formCodeByCategory: Record<string, string> = {
      CLIMATIZACAO: "CHECKLIST_HVAC",
      ELETRICA: "CHECKLIST_ELETRICA",
      ILUMINACAO: "CHECKLIST_ILUMINACAO",
      HIDRAULICA: "CHECKLIST_HIDRAULICA",
      CIVIL: "CHECKLIST_CIVIL",
      REFRIGERACAO: "CHECKLIST_REFRIGERACAO",
      INCENDIO: "CHECKLIST_INCENDIO",
      GERAL: "CHECKLIST_GERAL",
    };
    const publishedVersion = await prisma.formVersion.findFirst({
      where: { status: "PUBLICADO", template: { code: formCodeByCategory[serviceCategory], active: true } },
      orderBy: { version: "desc" },
    });

    const updated = await prisma.$transaction(async (tx) => {
      const serviceOrder = await tx.serviceOrder.update({
        where: { id: osId },
        data: { serviceCategory, checklistJson: JSON.stringify(generated) },
      });
      if (publishedVersion) {
        const visits = await tx.serviceVisit.findMany({
          where: { serviceOrderId: osId, status: { notIn: ["CONCLUIDA", "CANCELADA"] } },
          select: { id: true },
        });
        for (const visit of visits) {
          await tx.formSubmission.deleteMany({ where: { visitId: visit.id, status: "RASCUNHO" } });
          await tx.formSubmission.upsert({
            where: { visitId_versionId: { visitId: visit.id, versionId: publishedVersion.id } },
            update: {},
            create: { visitId: visit.id, serviceOrderId: osId, versionId: publishedVersion.id },
          });
        }
      }
      return serviceOrder;
    });
    revalidatePath("/ordens-servico");
    revalidatePath("/execucao");
    return { success: true as const, error: undefined, checklist: generated, serviceCategory: updated.serviceCategory };
  } catch (error) {
    logger.error("Erro ao aplicar modelo de checklist:", error);
    return { success: false as const, error: error instanceof Error ? error.message : "Erro ao aplicar checklist." };
  }
}

/**
 * Salva ou atualiza o relatório de conclusão de serviço (CompletionReport)
 */
export async function saveOSCompletionReport(
  osId: string,
  reportData: {
    executedServices?: string;
    clientFeedback?: string;
    technicalObservations?: string;
    pendingActions?: string;
    operationalResult?: string;
    clientRepresentative?: string;
    warrantyTerms?: string;
    approvedByClient: boolean;
    sendToBilling?: boolean;
  }
) {
  try {
    const session = await requirePermission("os.write");
    const currentOS = await prisma.serviceOrder.findUnique({ where: { id: osId } });
    if (!currentOS) throw new Error("Ordem de serviço não encontrada.");
    const clean = (value?: string | null) => value?.trim() || null;
    const executedServices = clean(reportData.executedServices) || "Atendimento técnico realizado conforme orçamento e relatório fotográfico de campo.";
    const technicalObservations = clean(reportData.technicalObservations) || "Serviço inspecionado, testado e concluído em campo.";
    const clientRepresentative = clean(reportData.clientRepresentative) || clean(currentOS.signatureName) || "Responsável do Cliente";
    const operationalResult = ["OPERACIONAL", "OPERACIONAL_COM_RESSALVAS", "PENDENTE", "NAO_TESTADO"].includes(reportData.operationalResult || "")
      ? reportData.operationalResult!
      : "OPERACIONAL";
    
    const isApproved = reportData.approvedByClient || Boolean(reportData.sendToBilling);

    const report = await prisma.$transaction(async (tx) => {
      const saved = await tx.completionReport.upsert({
        where: { serviceOrderId: osId },
        update: {
          executedServices,
          clientFeedback: clean(reportData.clientFeedback),
          technicalObservations,
          pendingActions: clean(reportData.pendingActions),
          operationalResult,
          clientRepresentative,
          warrantyTerms: clean(reportData.warrantyTerms),
          approvedByClient: isApproved,
          approvedAt: isApproved ? new Date() : null,
        },
        create: {
          serviceOrderId: osId,
          executedServices,
          clientFeedback: clean(reportData.clientFeedback),
          technicalObservations,
          pendingActions: clean(reportData.pendingActions),
          operationalResult,
          clientRepresentative,
          warrantyTerms: clean(reportData.warrantyTerms) || "Garantia de 90 dias nos serviços prestados.",
          approvedByClient: isApproved,
          approvedAt: isApproved ? new Date() : null,
        },
      });

      if (reportData.sendToBilling) {
        await tx.serviceOrder.update({
          where: { id: osId },
          data: { status: "FATURAMENTO", completedAt: currentOS.completedAt || new Date() },
        });
        await tx.serviceOrderStatusHistory.create({
          data: {
            serviceOrderId: osId,
            oldStatus: currentOS.status,
            newStatus: "FATURAMENTO",
            changedById: session.userId,
            justification: "Relatório de conclusão finalizado e OS enviada diretamente para o Faturamento.",
          },
        });
      } else if (isApproved && currentOS.status !== "FATURAMENTO" && currentOS.status !== "FATURADA") {
        await tx.serviceOrder.update({
          where: { id: osId },
          data: { status: "RELATORIO_ENVIADO", completedAt: currentOS.completedAt || new Date() },
        });
      }
      return saved;
    });

    revalidatePath("/ordens-servico");
    revalidatePath("/faturamento");
    return { success: true as const, error: undefined, report };
  } catch (error: unknown) {
    return mutationFailure("service-orders.completion-report.save", error, "Não foi possível salvar o relatório de conclusão.");
  }
}

/**
 * Adiciona uma foto/evidência à OS
 */
export async function addOSPhoto(
  osId: string,
  photoData: {
    step: string;
    url: string;
    caption?: string;
  }
) {
  try {
    const session = await requirePermission("os.write");

    // Converte a foto (recebida como data URL base64 do client) em arquivo em
    // disco e grava só a URL pública no banco — nunca o base64 bruto.
    const storedUrl = await saveBase64Asset(photoData.url, `os-${osId}`);

    const visit = await prisma.serviceVisit.findFirst({
      where: { serviceOrderId: osId },
      orderBy: { number: "desc" },
    });
    const photo = await prisma.$transaction(async (tx) => {
      const created = await tx.serviceOrderPhoto.create({
        data: { serviceOrderId: osId, step: photoData.step, url: storedUrl, caption: photoData.caption },
      });
      await tx.evidence.create({
        data: {
          serviceOrderId: osId,
          visitId: visit?.id || null,
          authorId: session.userId,
          kind: "FOTO",
          stage: photoData.step === "EVIDENCIA" ? "DIAGNOSTICO" : photoData.step,
          fileUrl: storedUrl,
          caption: photoData.caption,
          capturedAt: new Date(),
        },
      });
      return created;
    });

    revalidatePath("/ordens-servico");
    return { success: true as const, error: undefined, photo };
  } catch (error: unknown) {
    return mutationFailure("service-orders.photos.create", error, "Não foi possível adicionar a foto.");
  }
}

/**
 * Salva um lote inteiro com uma única autenticação, uma única ação de rede e
 * uma transação de banco. Os arquivos são gravados com concorrência limitada
 * para aproveitar disco/S3 sem saturar o servidor local.
 */
export async function addOSPhotos(
  osId: string,
  photos: Array<{ step: string; url: string; caption?: string }>,
) {
  try {
    const session = await requirePermission("os.write");
    const batch = photos.slice(0, 20);
    if (!batch.length) throw new Error("Selecione ao menos uma foto.");

    const order = await prisma.serviceOrder.findUnique({ where: { id: osId }, select: { id: true } });
    if (!order) throw new Error("Ordem de serviço não encontrada.");
    const visit = await prisma.serviceVisit.findFirst({
      where: { serviceOrderId: osId },
      orderBy: { number: "desc" },
      select: { id: true },
    });

    const stored: Array<{ index: number; step: string; url: string; caption?: string }> = [];
    const failed: Array<{ index: number; error: string }> = [];
    let cursor = 0;
    const workers = Array.from({ length: Math.min(5, batch.length) }, async () => {
      while (cursor < batch.length) {
        const index = cursor++;
        const photo = batch[index];
        try {
          const url = await saveBase64Asset(photo.url, `os-${osId}`);
          stored.push({ index, step: photo.step, url, caption: photo.caption });
        } catch (error) {
          failed.push({ index, error: error instanceof Error ? error.message : "Falha ao salvar arquivo." });
        }
      }
    });
    await Promise.all(workers);

    if (stored.length) {
      const capturedAt = new Date();
      try {
        await prisma.$transaction([
          prisma.serviceOrderPhoto.createMany({
            data: stored.map((photo) => ({ serviceOrderId: osId, step: photo.step, url: photo.url, caption: photo.caption })),
          }),
          prisma.evidence.createMany({
            data: stored.map((photo) => ({
              serviceOrderId: osId,
              visitId: visit?.id || null,
              authorId: session.userId,
              kind: "FOTO",
              stage: photo.step === "EVIDENCIA" ? "DIAGNOSTICO" : photo.step,
              fileUrl: photo.url,
              caption: photo.caption,
              capturedAt,
            })),
          }),
        ]);
      } catch (error) {
        await Promise.allSettled(stored.map((photo) => deleteUploadedAsset(photo.url)));
        throw error;
      }
    }

    revalidatePath("/ordens-servico");
    return { success: stored.length > 0, saved: stored.length, failed };
  } catch (error: any) {
    logger.error("Erro ao adicionar lote de fotos:", error);
    return { success: false as const, saved: 0, failed: photos.map((_, index) => ({ index, error: error.message })) };
  }
}

/**
 * Exclui uma foto/evidência da OS
 */
export async function deleteOSPhoto(photoId: string) {
  try {
    await requirePermission("os.write");

    const photo = await prisma.serviceOrderPhoto.findUnique({ where: { id: photoId } });
    if (!photo) throw new Error("Foto não encontrada.");

    await prisma.$transaction(async (tx) => {
      await tx.evidence.deleteMany({ where: { serviceOrderId: photo.serviceOrderId, fileUrl: photo.url } });
      await tx.serviceOrderPhoto.delete({ where: { id: photoId } });
    });

    await deleteUploadedAsset(photo.url);

    revalidatePath("/ordens-servico");
    return { success: true as const, error: undefined };
  } catch (error: unknown) {
    return mutationFailure("service-orders.photos.delete", error, "Não foi possível excluir a foto.");
  }
}

/**
 * Exclui uma Ordem de Serviço (OS) criada e limpa seus vínculos com segurança.
 */
export async function deleteServiceOrder(osId: string) {
  try {
    const session = await requirePermission("os.write");

    const os = await prisma.serviceOrder.findUnique({
      where: { id: osId },
      include: {
        invoices: true,
        photos: true,
      },
    });

    if (!os) throw new Error("Ordem de Serviço não encontrada.");

    if (os.invoices.length > 0) {
      throw new Error(
        `Esta OS possui a Nota Fiscal ${os.invoices[0].code} emitida. Cancele ou remova a nota fiscal antes de excluir a OS.`
      );
    }

    await prisma.$transaction(async (tx) => {
      // 1. Remover mídias e formulários
      await tx.serviceOrderPhoto.deleteMany({ where: { serviceOrderId: osId } });
      await tx.evidence.deleteMany({ where: { serviceOrderId: osId } });
      await tx.measurementReading.deleteMany({ where: { serviceOrderId: osId } });
      await tx.formSubmission.deleteMany({ where: { serviceOrderId: osId } });
      await tx.completionReport.deleteMany({ where: { serviceOrderId: osId } });

      // 2. Remover itens e materiais
      await tx.serviceOrderItem.deleteMany({ where: { serviceOrderId: osId } });
      await tx.serviceOrderMaterial.deleteMany({ where: { serviceOrderId: osId } });

      // 3. Remover histórico de status, técnicos e visitas
      await tx.serviceOrderStatusHistory.deleteMany({ where: { serviceOrderId: osId } });
      await tx.serviceOrderTechnician.deleteMany({ where: { serviceOrderId: osId } });
      await tx.serviceOrderAsset.deleteMany({ where: { serviceOrderId: osId } });
      await tx.serviceVisit.deleteMany({ where: { serviceOrderId: osId } });

      // 4. Remover contas a receber / pagar sem NF
      await tx.accountsReceivable.deleteMany({ where: { serviceOrderId: osId } });
      await tx.accountsPayable.deleteMany({ where: { serviceOrderId: osId } });

      // 5. Deletar a OS
      await tx.serviceOrder.delete({ where: { id: osId } });

      // 6. Registrar Log de Auditoria
      await tx.auditLog.create({
        data: {
          userId: session.userId,
          action: "EXCLUSAO",
          entity: "OrdemServico",
          entityId: osId,
          changesJson: JSON.stringify({ code: os.code, clientId: os.clientId }),
        },
      });
    });

    if (os.photos.length > 0) {
      await Promise.allSettled(os.photos.map((p) => deleteUploadedAsset(p.url)));
    }

    revalidatePath("/ordens-servico");
    revalidatePath("/faturamento");
    revalidatePath("/financeiro");
    revalidatePath("/");

    return { success: true as const, error: undefined };
  } catch (error: unknown) {
    return mutationFailure("service-orders.delete", error, "Não foi possível excluir a ordem de serviço.");
  }
}
