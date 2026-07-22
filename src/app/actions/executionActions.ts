"use server";

import { logger } from "@/lib/logger";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { saveBase64Asset } from "@/lib/storage";

export interface PhotoInput {
  step: "ANTES" | "DEPOS" | "EVIDENCIA";
  url: string; // base64 or mocked url
  caption: string;
}

async function assertTechnicianAccess(osId: string, userId: string, roleName: string, permissions: string[]) {
  const privileged = roleName === "Administrador" || roleName === "Gestor" || permissions.includes("admin.all");
  if (privileged) return;
  const assignment = await prisma.serviceOrderTechnician.findFirst({
    where: { serviceOrderId: osId, userId },
  });
  if (!assignment) throw new Error("Esta OS não está atribuída ao técnico conectado.");
}

/**
 * Obtém as OSs atribuídas a um técnico específico
 */
export async function getTechnicianOS(techUserId: string) {
  try {
    const session = await requireAuth();
    // Um técnico só pode ver a própria fila. Administrador/Gestor podem
    // continuar consultando a fila de qualquer técnico (uso no painel admin).
    const isPrivileged = session.roleName === "Administrador" || session.roleName === "Gestor" || session.permissions.includes("admin.all");
    const effectiveTechId = isPrivileged ? techUserId : session.userId;

    const assignments = await prisma.serviceOrderTechnician.findMany({
      where: { userId: effectiveTechId },
      include: {
        serviceOrder: {
          include: {
            client: true,
            address: true,
          },
        },
      },
    });

    return assignments.map((a) => ({
      id: a.serviceOrder.id,
      code: a.serviceOrder.code,
      clientName: a.serviceOrder.client.name,
      status: a.serviceOrder.status,
      type: a.serviceOrder.type,
      priority: a.serviceOrder.priority,
      scheduledDate: a.serviceOrder.scheduledDate,
      scheduledTime: a.serviceOrder.scheduledTime,
      addressLabel: a.serviceOrder.address?.label || "Sem local",
      addressText: a.serviceOrder.address
        ? `${a.serviceOrder.address.street}, ${a.serviceOrder.address.number} - ${a.serviceOrder.address.city}`
        : "Endereço não disponível",
    }));
  } catch (error) {
    logger.error("Erro ao obter OS do técnico:", error);
    return [];
  }
}

/**
 * Registra o início do deslocamento do técnico
 */
export async function makeOSCheckin(osId: string, userId: string) {
  try {
    const session = await requireAuth();
    userId = session.userId; // nunca confiar no valor vindo do client
    await assertTechnicianAccess(osId, userId, session.roleName, session.permissions);
    const os = await prisma.serviceOrder.findUnique({ where: { id: osId } });
    if (!os) throw new Error("Ordem de serviço não encontrada.");
    if (os.status !== "AGENDADA") throw new Error("Apenas uma OS agendada pode iniciar deslocamento.");

    const updatedOS = await prisma.$transaction(async (tx) => {
      const updated = await tx.serviceOrder.update({ where: { id: osId }, data: { status: "DESLOCAMENTO" } });
      await tx.serviceOrderStatusHistory.create({
        data: {
          serviceOrderId: osId,
          oldStatus: os.status,
          newStatus: "DESLOCAMENTO",
          changedById: userId,
          justification: "Técnico iniciou deslocamento para o local do cliente.",
        },
      });
      return updated;
    });

    revalidatePath("/execucao");
    revalidatePath("/ordens-servico");
    return { success: true, os: updatedOS };
  } catch (error: any) {
    logger.error("Erro no checkin da OS:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Registra a chegada do técnico e o início da execução
 */
export async function makeOSStartExecution(osId: string, userId: string) {
  try {
    const session = await requireAuth();
    userId = session.userId; // nunca confiar no valor vindo do client
    await assertTechnicianAccess(osId, userId, session.roleName, session.permissions);
    const os = await prisma.serviceOrder.findUnique({ where: { id: osId } });
    if (!os) throw new Error("Ordem de serviço não encontrada.");
    if (!["DESLOCAMENTO", "AGENDADA"].includes(os.status)) {
      throw new Error("A OS precisa estar agendada ou em deslocamento para iniciar a execução.");
    }

    const updatedOS = await prisma.$transaction(async (tx) => {
      const updated = await tx.serviceOrder.update({ where: { id: osId }, data: { status: "EXECUCAO" } });
      await tx.serviceOrderStatusHistory.create({
        data: {
          serviceOrderId: osId,
          oldStatus: os.status,
          newStatus: "EXECUCAO",
          changedById: userId,
          justification: "Técnico chegou ao local e iniciou os serviços.",
        },
      });
      return updated;
    });

    revalidatePath("/execucao");
    revalidatePath("/ordens-servico");
    return { success: true, os: updatedOS };
  } catch (error: any) {
    logger.error("Erro no início da execução da OS:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Finaliza a execução técnica salvando laudos, checklists, fotos, assinatura e gerando o Relatório de Conclusão.
 */
export async function submitTechnicalExecution(
  osId: string,
  data: {
    technicalDiagnosis: string;
    checklistJson: string;
    measurementsJson: string; // Salvo dentro das notas técnicas ou histórico
    photos: PhotoInput[];
    signatureBase64: string;
    signatureName: string;
    clientFeedback?: string;
    userId: string;
  }
) {
  try {
    const session = await requireAuth();
    data.userId = session.userId; // nunca confiar no valor vindo do client
    await assertTechnicianAccess(osId, data.userId, session.roleName, session.permissions);
    const currentOS = await prisma.serviceOrder.findUnique({ where: { id: osId } });
    if (!currentOS) throw new Error("Ordem de serviço não encontrada.");
    if (currentOS.status !== "EXECUCAO") throw new Error("A OS precisa estar em execução para ser concluída.");
    if (!data.technicalDiagnosis.trim()) throw new Error("Preencha o diagnóstico técnico.");
    if (!data.signatureBase64 || !data.signatureName.trim()) throw new Error("Colete a assinatura e informe o nome do cliente.");
    let submittedChecklist: Array<{ checked?: boolean }> = [];
    try { submittedChecklist = JSON.parse(data.checklistJson || "[]"); } catch {
      throw new Error("Checklist técnico inválido.");
    }
    if (submittedChecklist.length > 0 && submittedChecklist.some((item) => !item.checked)) {
      throw new Error("Conclua todos os itens do checklist antes de finalizar.");
    }

    // 1. Atualizar OS com laudo, checklist e assinatura
    const notesJson = JSON.stringify({
      medicoes: data.measurementsJson,
      checklist: JSON.parse(data.checklistJson),
    });

    // Assinatura chega como data URL base64 do canvas — grava em disco e
    // salva só a URL pública na coluna (o nome da coluna ficou legado, mas
    // qualquer <img src> aceita tanto data: URL quanto URL relativa).
    const storedSignatureUrl = await saveBase64Asset(data.signatureBase64, `os-${osId}-assinatura`);

    // Salva os arquivos antes da transação; os registros relacionais são gravados juntos.
    let photoRelations: Array<{ serviceOrderId: string; step: string; url: string; caption: string | null }> = [];
    if (data.photos && data.photos.length > 0) {
      photoRelations = await Promise.all(
        data.photos.map(async (p) => ({
          serviceOrderId: osId,
          step: p.step,
          url: await saveBase64Asset(p.url, `os-${osId}`),
          caption: p.caption || null,
        }))
      );

    }

    const { updatedOS, report } = await prisma.$transaction(async (tx) => {
      const updatedOS = await tx.serviceOrder.update({
        where: { id: osId },
        data: {
          status: "RELATORIO_ENVIADO",
          technicalDiagnosis: data.technicalDiagnosis,
          checklistJson: data.checklistJson,
          signatureBase64: storedSignatureUrl,
          signatureName: data.signatureName,
          completedAt: new Date(),
          notes: `Medições técnicas: ${data.measurementsJson}.`,
        },
      });
      if (photoRelations.length > 0) {
        await tx.serviceOrderPhoto.deleteMany({ where: { serviceOrderId: osId } });
        await tx.serviceOrderPhoto.createMany({ data: photoRelations });
      }
      const report = await tx.completionReport.upsert({
        where: { serviceOrderId: osId },
        update: {
          clientFeedback: data.clientFeedback || "Serviço aprovado sem observações.",
          technicalObservations: `Executado diagnóstico técnico. Equipamento testado e entregue operacional. Medições registradas: ${data.measurementsJson}.`,
          warrantyTerms: "Garantia de 90 dias nos serviços prestados, a contar desta data.",
          approvedByClient: true,
          approvedAt: new Date(),
        },
        create: {
          serviceOrderId: osId,
          clientFeedback: data.clientFeedback || "Serviço aprovado sem observações.",
          technicalObservations: `Executado diagnóstico técnico. Equipamento testado e entregue operacional. Medições registradas: ${data.measurementsJson}.`,
          warrantyTerms: "Garantia de 90 dias nos serviços prestados, a contar desta data.",
          approvedByClient: true,
          approvedAt: new Date(),
        },
      });
      await tx.serviceOrderStatusHistory.createMany({
        data: [
          {
            serviceOrderId: osId,
            oldStatus: "EXECUCAO",
            newStatus: "CONCLUIDA",
            changedById: data.userId,
            justification: `Execução finalizada e assinada por ${data.signatureName}.`,
          },
          {
            serviceOrderId: osId,
            oldStatus: "CONCLUIDA",
            newStatus: "RELATORIO_ENVIADO",
            changedById: data.userId,
            justification: "Relatório técnico aprovado com assinatura do cliente.",
          },
        ],
      });
      return { updatedOS, report };
    });

    // 5. Enviar Notificação para o Faturamento
    const client = await prisma.client.findFirst({
      where: { serviceOrders: { some: { id: osId } } },
    });

    await prisma.notification.create({
      data: {
        title: "Revisão e Faturamento Pendente",
        message: `A OS ${updatedOS.code} (${client?.name}) está concluída. Favor revisar o relatório técnico e processar faturamento.`,
        type: "OPERACIONAL",
        link: "/ordens-servico",
      },
    });

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: "EDICAO",
        entity: "OrdemServico",
        entityId: osId,
        changesJson: JSON.stringify({
          action: "Finalização Técnica de OS",
          reportId: report.id,
          signatureName: data.signatureName,
        }),
      },
    });

    revalidatePath("/execucao");
    revalidatePath("/ordens-servico");
    return { success: true, os: updatedOS, report };
  } catch (error: any) {
    logger.error("Erro ao enviar finalização técnica:", error);
    return { success: false, error: error.message };
  }
}
