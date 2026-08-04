"use server";

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { requireAuth, requirePermission } from "@/lib/auth";
import { CLOSED_VISIT_STATUSES, nextVisitNumber } from "@/lib/visits";
import { revalidatePath } from "next/cache";

const VISIT_TRANSITIONS: Record<string, string[]> = {
  NAO_AGENDADA: ["AGENDADA", "CANCELADA"],
  AGENDADA: ["ACEITA", "EM_DESLOCAMENTO", "NO_LOCAL", "CANCELADA"],
  ACEITA: ["EM_DESLOCAMENTO", "NO_LOCAL", "CANCELADA"],
  EM_DESLOCAMENTO: ["NO_LOCAL", "EM_EXECUCAO", "PAUSADA", "IMPEDIDA", "CANCELADA"],
  NO_LOCAL: ["EM_EXECUCAO", "IMPEDIDA", "CANCELADA"],
  EM_EXECUCAO: ["PAUSADA", "IMPEDIDA", "CONCLUIDA", "CANCELADA"],
  PAUSADA: ["EM_EXECUCAO", "IMPEDIDA", "CANCELADA"],
  IMPEDIDA: ["EM_EXECUCAO", "CONCLUIDA", "CANCELADA"],
  CONCLUIDA: [],
  CANCELADA: [],
};

function refreshVisitScreens() {
  revalidatePath("/ordens-servico");
  revalidatePath("/agenda");
  revalidatePath("/execucao");
  revalidatePath("/");
}

export async function getServiceOrderVisits(serviceOrderId: string) {
  try {
    await requireAuth();
    return await prisma.serviceVisit.findMany({
      where: { serviceOrderId },
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
    });
  } catch (error) {
    logger.error("service_visits_list_failed", error);
    return [];
  }
}

export async function createServiceVisit(input: {
  serviceOrderId: string;
  kind?: string;
  notes?: string;
  sourceVisitId?: string;
}) {
  try {
    const session = await requirePermission("os.write");
    const serviceOrder = await prisma.serviceOrder.findUnique({
      where: { id: input.serviceOrderId },
      select: { id: true, status: true },
    });
    if (!serviceOrder) throw new Error("Ordem de serviço não encontrada.");
    if (["FATURADA", "CANCELADA"].includes(serviceOrder.status)) {
      throw new Error("Não é possível criar visita em uma OS encerrada ou cancelada.");
    }
    if (input.sourceVisitId) {
      const source = await prisma.serviceVisit.findFirst({ where: { id: input.sourceVisitId, serviceOrderId: input.serviceOrderId } });
      if (!source) throw new Error("A visita de origem não pertence a esta OS.");
    }

    const visit = await prisma.$transaction(async (tx) => {
      const number = await nextVisitNumber(tx, input.serviceOrderId);
      const created = await tx.serviceVisit.create({
        data: {
          serviceOrderId: input.serviceOrderId,
          number,
          kind: input.kind || (input.sourceVisitId ? "RETORNO" : "ATENDIMENTO"),
          status: "NAO_AGENDADA",
          notes: input.notes?.trim() || null,
          sourceVisitId: input.sourceVisitId || null,
          statusHistory: {
            create: {
              oldStatus: "NENHUM",
              newStatus: "NAO_AGENDADA",
              changedById: session.userId,
              justification: input.sourceVisitId ? "Visita de retorno criada." : "Nova visita operacional criada.",
            },
          },
        },
      });

      const oldStatus = serviceOrder.status;
      if (!CLOSED_VISIT_STATUSES.includes(oldStatus)) {
        await tx.serviceOrder.update({
          where: { id: input.serviceOrderId },
          data: { status: "AGUARDANDO_AGENDAMENTO", scheduledDate: null, scheduledTime: null, completedAt: null },
        });
        if (oldStatus !== "AGUARDANDO_AGENDAMENTO") {
          await tx.serviceOrderStatusHistory.create({
            data: {
              serviceOrderId: input.serviceOrderId,
              oldStatus,
              newStatus: "AGUARDANDO_AGENDAMENTO",
              changedById: session.userId,
              justification: `Visita ${number} criada e aguardando planejamento.`,
            },
          });
        }
      }
      return created;
    });

    refreshVisitScreens();
    return { success: true, visit };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Não foi possível criar a visita.";
    logger.error("service_visit_create_failed", error);
    return { success: false, error: message };
  }
}

export async function scheduleServiceVisit(input: {
  visitId: string;
  scheduledStart: Date;
  estimatedDurationMinutes?: number;
  techIds: string[];
  notes?: string;
}) {
  try {
    const session = await requirePermission("os.write");
    const start = new Date(input.scheduledStart);
    if (Number.isNaN(start.getTime())) throw new Error("Informe uma data e um horário válidos.");
    const duration = Math.max(15, Math.min(24 * 60, Number(input.estimatedDurationMinutes || 60)));
    const techIds = [...new Set(input.techIds.filter(Boolean))];
    if (!techIds.length) throw new Error("Selecione ao menos um técnico.");

    const visit = await prisma.serviceVisit.findUnique({
      where: { id: input.visitId },
      include: { serviceOrder: true },
    });
    if (!visit) throw new Error("Visita não encontrada.");
    if (CLOSED_VISIT_STATUSES.includes(visit.status)) throw new Error("Uma visita concluída ou cancelada não pode ser reagendada.");

    const validUsers = await prisma.user.count({ where: { id: { in: techIds } } });
    if (validUsers !== techIds.length) throw new Error("Um ou mais técnicos selecionados são inválidos.");
    const end = new Date(start.getTime() + duration * 60_000);
    const scheduledTime = start.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false });

    const updated = await prisma.$transaction(async (tx) => {
      await tx.visitTechnician.deleteMany({ where: { visitId: visit.id } });
      await tx.visitTechnician.createMany({
        data: techIds.map((userId, index) => ({ visitId: visit.id, userId, role: index === 0 ? "RESPONSAVEL" : "TECNICO" })),
      });
      const saved = await tx.serviceVisit.update({
        where: { id: visit.id },
        data: {
          status: "AGENDADA",
          scheduledStart: start,
          scheduledEnd: end,
          estimatedDurationMinutes: duration,
          notes: input.notes?.trim() || visit.notes,
        },
      });
      await tx.visitStatusHistory.create({
        data: {
          visitId: visit.id,
          oldStatus: visit.status,
          newStatus: "AGENDADA",
          changedById: session.userId,
          justification: `Visita ${visit.number} agendada para ${start.toLocaleDateString("pt-BR")} às ${scheduledTime}.`,
        },
      });

      // Mantém os campos legados sincronizados enquanto agenda e técnico
      // ainda são consumidos por módulos antigos.
      await tx.serviceOrderTechnician.deleteMany({ where: { serviceOrderId: visit.serviceOrderId } });
      await tx.serviceOrderTechnician.createMany({ data: techIds.map((userId) => ({ serviceOrderId: visit.serviceOrderId, userId })) });
      await tx.serviceOrder.update({
        where: { id: visit.serviceOrderId },
        data: { status: "AGENDADA", scheduledDate: start, scheduledTime, completedAt: null },
      });
      if (visit.serviceOrder.status !== "AGENDADA") {
        await tx.serviceOrderStatusHistory.create({
          data: {
            serviceOrderId: visit.serviceOrderId,
            oldStatus: visit.serviceOrder.status,
            newStatus: "AGENDADA",
            changedById: session.userId,
            justification: `Visita ${visit.number} planejada e equipe escalada.`,
          },
        });
      }
      return saved;
    });

    refreshVisitScreens();
    return { success: true, visit: updated };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Não foi possível agendar a visita.";
    logger.error("service_visit_schedule_failed", error);
    return { success: false, error: message };
  }
}

export async function requestServiceReturn(input: {
  visitId: string;
  reason: string;
  proposedStart?: Date;
  estimatedDurationMinutes?: number;
}) {
  try {
    const session = await requirePermission("os.write");
    if (!input.reason?.trim()) throw new Error("Informe o motivo e o que será necessário no retorno.");
    const visit = await prisma.serviceVisit.findUnique({
      where: { id: input.visitId },
      include: { serviceOrder: true, technicians: true },
    });
    if (!visit) throw new Error("Visita não encontrada.");
    if (CLOSED_VISIT_STATUSES.includes(visit.status)) throw new Error("Esta visita já está encerrada.");

    const now = new Date();
    const proposedStart = input.proposedStart ? new Date(input.proposedStart) : null;
    if (proposedStart && Number.isNaN(proposedStart.getTime())) throw new Error("Data proposta inválida.");
    const duration = Math.max(15, Math.min(24 * 60, Number(input.estimatedDurationMinutes || visit.estimatedDurationMinutes || 60)));

    const nextVisit = await prisma.$transaction(async (tx) => {
      const number = await nextVisitNumber(tx, visit.serviceOrderId);
      await tx.timeEntry.updateMany({
        where: { visitId: visit.id, endedAt: null },
        data: { endedAt: now },
      });
      await tx.serviceVisit.update({
        where: { id: visit.id },
        data: { status: "CONCLUIDA", result: "RETORNO_NECESSARIO", returnReason: input.reason.trim(), completedAt: now },
      });
      await tx.visitStatusHistory.create({
        data: {
          visitId: visit.id,
          oldStatus: visit.status,
          newStatus: "CONCLUIDA",
          changedById: session.userId,
          justification: `Atendimento encerrado com retorno necessário: ${input.reason.trim()}`,
        },
      });

      const created = await tx.serviceVisit.create({
        data: {
          serviceOrderId: visit.serviceOrderId,
          number,
          kind: "RETORNO",
          sourceVisitId: visit.id,
          status: proposedStart ? "AGENDADA" : "NAO_AGENDADA",
          scheduledStart: proposedStart,
          scheduledEnd: proposedStart ? new Date(proposedStart.getTime() + duration * 60_000) : null,
          estimatedDurationMinutes: duration,
          notes: `Retorno da visita ${visit.number}. ${input.reason.trim()}`,
          technicians: visit.technicians.length
            ? { create: visit.technicians.map((technician) => ({ userId: technician.userId, role: technician.role })) }
            : undefined,
          statusHistory: {
            create: {
              oldStatus: "NENHUM",
              newStatus: proposedStart ? "AGENDADA" : "NAO_AGENDADA",
              changedById: session.userId,
              justification: `Retorno criado a partir da visita ${visit.number}.`,
            },
          },
        },
      });

      const newOSStatus = proposedStart ? "AGENDADA" : "AGUARDANDO_AGENDAMENTO";
      const scheduledTime = proposedStart
        ? proposedStart.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false })
        : null;
      await tx.serviceOrder.update({
        where: { id: visit.serviceOrderId },
        data: { status: newOSStatus, scheduledDate: proposedStart, scheduledTime, completedAt: null },
      });
      await tx.serviceOrderStatusHistory.create({
        data: {
          serviceOrderId: visit.serviceOrderId,
          oldStatus: visit.serviceOrder.status,
          newStatus: newOSStatus,
          changedById: session.userId,
          justification: `Visita ${visit.number} preservada e retorno ${number} criado.`,
        },
      });
      return created;
    });

    refreshVisitScreens();
    return { success: true, visit: nextVisit };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Não foi possível criar o retorno.";
    logger.error("service_visit_return_failed", error);
    return { success: false, error: message };
  }
}

export async function updateServiceVisitStatus(input: {
  visitId: string;
  status: string;
  justification?: string;
  latitude?: number;
  longitude?: number;
}) {
  try {
    const session = await requireAuth();
    const visit = await prisma.serviceVisit.findUnique({
      where: { id: input.visitId },
      include: { technicians: true, serviceOrder: true },
    });
    if (!visit) throw new Error("Visita não encontrada.");
    const privileged = session.roleName === "Administrador" || session.roleName === "Gestor" || session.permissions.includes("os.write") || session.permissions.includes("admin.all");
    if (!privileged && !visit.technicians.some((item) => item.userId === session.userId)) {
      throw new Error("Esta visita não está atribuída ao técnico conectado.");
    }
    const newStatus = input.status.trim().toUpperCase();
    if (!VISIT_TRANSITIONS[visit.status]?.includes(newStatus)) {
      throw new Error(`A visita não pode passar de ${visit.status} para ${newStatus}.`);
    }

    const now = new Date();
    const data: Record<string, string | Date | number | null> = { status: newStatus };
    if (newStatus === "ACEITA") data.acceptedAt = now;
    if (newStatus === "EM_DESLOCAMENTO") data.travelStartedAt = now;
    if (newStatus === "NO_LOCAL") {
      data.arrivedAt = now;
      data.checkinLatitude = input.latitude ?? null;
      data.checkinLongitude = input.longitude ?? null;
    }
    if (newStatus === "EM_EXECUCAO") data.startedAt = visit.startedAt || now;
    if (newStatus === "PAUSADA") data.pausedAt = now;
    if (newStatus === "CONCLUIDA") {
      data.completedAt = now;
      data.result = visit.result || "RESOLVIDO";
    }
    if (newStatus === "CANCELADA") data.cancelledAt = now;

    await prisma.$transaction(async (tx) => {
      await tx.serviceVisit.update({ where: { id: visit.id }, data });
      await tx.visitStatusHistory.create({
        data: {
          visitId: visit.id,
          oldStatus: visit.status,
          newStatus,
          changedById: session.userId,
          justification: input.justification?.trim() || "Etapa da visita atualizada.",
          latitude: input.latitude,
          longitude: input.longitude,
        },
      });
      if (Number.isFinite(input.latitude) && Number.isFinite(input.longitude)) {
        await tx.locationEvent.create({
          data: {
            visitId: visit.id,
            userId: session.userId,
            type: newStatus,
            latitude: Number(input.latitude),
            longitude: Number(input.longitude),
          },
        });
      }
    });

    refreshVisitScreens();
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Não foi possível atualizar a visita.";
    logger.error("service_visit_status_failed", error);
    return { success: false, error: message };
  }
}
