"use server";

import { logger } from "@/lib/logger";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAuth, requirePermission } from "@/lib/auth";
import { saveBase64Asset, deleteUploadedAsset } from "@/lib/storage";
import { osScheduleSchema } from "@/lib/schemas";
import { nextServiceOrderCode } from "@/lib/sequences";
import { createInitialVisit, nextVisitNumber, visitStatusFromLegacyOS } from "@/lib/visits";
import type { Prisma } from "@prisma/client";

export interface OSPartsInput {
  productId: string;
  quantity: number;
  salePrice: number;
  usedQuantity: number;
  status: "PREVISTO" | "UTILIZADO" | "DEVOLVIDO";
  acquisitionType?: string; // ESTOQUE or COMPRA_FUTURA
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
  priority: string;
  problemReported: string;
  notes?: string;
}) {
  try {
    const session = await requirePermission("os.write");
    if (!data.clientId) throw new Error("Selecione o cliente.");
    if (!data.addressId) throw new Error("Selecione o endereço de execução.");
    if (!data.problemReported?.trim()) throw new Error("Descreva o serviço ou problema relatado.");
    const validTypes = ["INSTALACAO", "PREVENTIVA", "CORRETIVA", "CONTRATO", "VISITA_TECNICA", "GARANTIA", "RETORNO", "EMERGENCIA", "LAUDO_TECNICO"];
    const validPriorities = ["BAIXA", "MEDIA", "ALTA", "URGENTE"];
    if (!validTypes.includes(data.type)) throw new Error("Tipo de serviço inválido.");
    if (!validPriorities.includes(data.priority)) throw new Error("Prioridade inválida.");

    const client = await prisma.client.findUnique({
      where: { id: data.clientId },
      include: { addresses: { where: { id: data.addressId } }, contacts: data.contactId ? { where: { id: data.contactId } } : false },
    });
    if (!client) throw new Error("Cliente não encontrado.");
    if (!client.addresses.length) throw new Error("O endereço selecionado não pertence ao cliente.");
    if (data.contactId && (!client.contacts || !client.contacts.length)) throw new Error("O contato selecionado não pertence ao cliente.");
    if (data.contractId) {
      const contract = await prisma.contract.findFirst({
        where: { id: data.contractId, clientId: data.clientId, status: "ATIVO" },
        select: { id: true, addressId: true },
      });
      if (!contract) throw new Error("O contrato selecionado não pertence a este cliente ou não está ativo.");
      if (contract.addressId && contract.addressId !== data.addressId) {
        throw new Error("O endereço da OS deve ser a loja vinculada ao contrato.");
      }
    }

    const os = await prisma.$transaction(async (tx) => {
      const code = await nextServiceOrderCode(tx);
      const created = await tx.serviceOrder.create({
        data: {
          code,
          clientId: data.clientId,
          contractId: data.contractId || null,
          addressId: data.addressId,
          contactId: data.contactId || null,
          type: data.type,
          priority: data.priority,
          status: "AGUARDANDO_AGENDAMENTO",
          problemReported: data.problemReported.trim(),
          notes: data.notes?.trim() || null,
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
          changesJson: JSON.stringify({ code: created.code, origin: "MANUAL", clientId: data.clientId }),
        },
      });
      return created;
    });

    revalidatePath("/ordens-servico");
    revalidatePath("/");
    return { success: true, os };
  } catch (error: any) {
    logger.error("Erro ao criar OS manual:", error);
    return { success: false, error: error.issues?.[0]?.message || error.message };
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
    if (filters?.search) {
      where.OR = [
        { code: { contains: filters.search } },
        { client: { name: { contains: filters.search } } },
        { problemReported: { contains: filters.search } },
      ];
    }

    const serviceOrders = await prisma.serviceOrder.findMany({
      where,
      include: {
        client: true,
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
        items: true,
        materials: true,
      },
      orderBy: { code: "desc" },
    });

    return serviceOrders.map((os) => {
      const totalItems = os.items.reduce((sum, item) => sum + Number(item.total), 0);
      const totalMaterials = os.materials.reduce((sum, m) => {
        const qty = m.status === "UTILIZADO" ? m.usedQuantity : m.quantity;
        return sum + qty * Number(m.salePrice);
      }, 0);
      const totalValue = totalItems + totalMaterials;

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
        problemReported: os.problemReported,
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
    logger.error("Erro ao obter ordens de serviço:", error);
    return [];
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
      const qty = m.status === "UTILIZADO" ? m.usedQuantity : m.quantity;
      return sum + qty * Number(m.salePrice);
    }, 0);
    const totalValue = totalItems + totalMaterials;

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
        product: {
          ...material.product,
          costPrice: Number(material.product.costPrice),
          salePrice: Number(material.product.salePrice),
        },
      })),
      totalValue,
    };
  } catch (error) {
    logger.error(`Erro ao obter OS ${id}:`, error);
    return null;
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
    return { success: true, os: updatedOS };
  } catch (error: any) {
    logger.error("Erro ao agendar OS:", error);
    return { success: false, error: error.issues?.[0]?.message || error.message };
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
    if (oldStatus === newStatus) return { success: true, os: { ...os, status: oldStatus } };
    if (!OS_TRANSITIONS[oldStatus]?.includes(newStatus)) {
      throw new Error(`Transição inválida: ${oldStatus} não pode avançar diretamente para ${newStatus}.`);
    }

    if (["AGENDADA", "DESLOCAMENTO", "EXECUCAO"].includes(newStatus) && os.technicians.length === 0) {
      throw new Error("Atribua ao menos um técnico antes de iniciar o atendimento.");
    }
    if (newStatus === "AGENDADA" && (!os.scheduledDate || !os.scheduledTime)) {
      throw new Error("Informe data e horário no agendamento da OS.");
    }
    if (newStatus === "CONCLUIDA") {
      if (!os.technicalDiagnosis?.trim()) {
        throw new Error("Preencha o diagnóstico técnico antes de concluir a OS.");
      }
      let checklist: Array<{ checked?: boolean }> = [];
      try { checklist = JSON.parse(os.checklistJson || "[]"); } catch {}
      if (checklist.length > 0 && checklist.some((item) => !item.checked)) {
        throw new Error("Conclua todos os itens do checklist antes de fechar a OS.");
      }
      if (os.materials.some((material) => material.acquisitionType === "COMPRA_FUTURA" && material.status !== "UTILIZADO")) {
        throw new Error("Existem materiais de compra futura ainda não utilizados.");
      }
    }
    if (["RELATORIO_ENVIADO", "FATURAMENTO"].includes(newStatus) && !os.completionReport?.approvedByClient) {
      throw new Error("O relatório de conclusão precisa estar aprovado pelo cliente.");
    }

    const data: any = { status: newStatus };
    if (newStatus === "CONCLUIDA") {
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
    return { success: true, os: updatedOS };
  } catch (error: any) {
    logger.error("Erro ao alterar status da OS:", error);
    return { success: false, error: error.message };
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
    return { success: true };
  } catch (error: any) {
    logger.error("Erro ao atualizar materiais e estoque da OS:", error);
    return { success: false, error: error.message };
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

    const updatedOS = await prisma.serviceOrder.update({
      where: { id: osId },
      data: {
        priority: data.priority !== undefined ? data.priority : oldOS.priority,
        type: data.type !== undefined ? data.type : oldOS.type,
        problemReported: data.problemReported !== undefined ? data.problemReported : oldOS.problemReported,
        technicalDiagnosis: data.technicalDiagnosis !== undefined ? data.technicalDiagnosis : oldOS.technicalDiagnosis,
        checklistJson: data.checklistJson !== undefined ? data.checklistJson : oldOS.checklistJson,
        notes: data.notes !== undefined ? data.notes : oldOS.notes,
      }
    });

    revalidatePath("/ordens-servico");
    return { success: true, os: updatedOS };
  } catch (error: any) {
    logger.error("Erro ao atualizar detalhes da OS:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Salva ou atualiza o relatório de conclusão de serviço (CompletionReport)
 */
export async function saveOSCompletionReport(
  osId: string,
  reportData: {
    clientFeedback?: string;
    technicalObservations?: string;
    warrantyTerms?: string;
    approvedByClient: boolean;
  }
) {
  try {
    const session = await requirePermission("os.write");
    const currentOS = await prisma.serviceOrder.findUnique({ where: { id: osId } });
    if (!currentOS) throw new Error("Ordem de serviço não encontrada.");
    const currentStatus = normalizeOSStatus(currentOS.status);
    if (!["CONCLUIDA", "REVISAO", "RELATORIO_ENVIADO"].includes(currentStatus)) {
      throw new Error("Conclua a execução da OS antes de emitir o relatório final.");
    }
    if (reportData.approvedByClient && !reportData.technicalObservations?.trim()) {
      throw new Error("Informe o parecer técnico antes de registrar a aprovação do cliente.");
    }

    const report = await prisma.$transaction(async (tx) => {
      const saved = await tx.completionReport.upsert({
        where: { serviceOrderId: osId },
        update: {
          clientFeedback: reportData.clientFeedback,
          technicalObservations: reportData.technicalObservations,
          warrantyTerms: reportData.warrantyTerms,
          approvedByClient: reportData.approvedByClient,
          approvedAt: reportData.approvedByClient ? new Date() : null,
        },
        create: {
          serviceOrderId: osId,
          clientFeedback: reportData.clientFeedback,
          technicalObservations: reportData.technicalObservations,
          warrantyTerms: reportData.warrantyTerms || "Garantia de 90 dias nos serviços prestados.",
          approvedByClient: reportData.approvedByClient,
          approvedAt: reportData.approvedByClient ? new Date() : null,
        },
      });
      if (reportData.approvedByClient && ["CONCLUIDA", "REVISAO"].includes(currentStatus)) {
        await tx.serviceOrder.update({ where: { id: osId }, data: { status: "RELATORIO_ENVIADO" } });
        await tx.serviceOrderStatusHistory.create({
          data: {
            serviceOrderId: osId,
            oldStatus: currentStatus,
            newStatus: "RELATORIO_ENVIADO",
            changedById: session.userId,
            justification: "Relatório final aprovado pelo cliente.",
          },
        });
      } else if (!reportData.approvedByClient && currentStatus === "RELATORIO_ENVIADO") {
        await tx.serviceOrder.update({ where: { id: osId }, data: { status: "REVISAO" } });
        await tx.serviceOrderStatusHistory.create({
          data: {
            serviceOrderId: osId,
            oldStatus: "RELATORIO_ENVIADO",
            newStatus: "REVISAO",
            changedById: session.userId,
            justification: "A aprovação do relatório foi retirada para revisão.",
          },
        });
      }
      return saved;
    });

    revalidatePath("/ordens-servico");
    revalidatePath("/faturamento");
    return { success: true, report };
  } catch (error: any) {
    logger.error("Erro ao salvar relatório de conclusão:", error);
    return { success: false, error: error.message };
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
    return { success: true, photo };
  } catch (error: any) {
    logger.error("Erro ao adicionar foto:", error);
    return { success: false, error: error.message };
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
    return { success: true };
  } catch (error: any) {
    logger.error("Erro ao deletar foto:", error);
    return { success: false, error: error.message };
  }
}
