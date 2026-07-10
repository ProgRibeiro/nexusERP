"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export interface PhotoInput {
  step: "ANTES" | "DEPOS" | "EVIDENCIA";
  url: string; // base64 or mocked url
  caption: string;
}

/**
 * Obtém as OSs atribuídas a um técnico específico
 */
export async function getTechnicianOS(techUserId: string) {
  try {
    const assignments = await prisma.serviceOrderTechnician.findMany({
      where: { userId: techUserId },
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
    console.error("Erro ao obter OS do técnico:", error);
    return [];
  }
}

/**
 * Registra o início do deslocamento do técnico
 */
export async function makeOSCheckin(osId: string, userId: string) {
  try {
    const updatedOS = await prisma.serviceOrder.update({
      where: { id: osId },
      data: {
        status: "DESLOCAMENTO", // Técnico em deslocamento
      },
    });

    await prisma.serviceOrderStatusHistory.create({
      data: {
        serviceOrderId: osId,
        oldStatus: "AGENDADA",
        newStatus: "DESLOCAMENTO",
        changedById: userId,
        justification: "Técnico iniciou deslocamento para o local do cliente.",
      },
    });

    revalidatePath("/execucao");
    revalidatePath("/ordens-servico");
    return { success: true, os: updatedOS };
  } catch (error: any) {
    console.error("Erro no checkin da OS:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Registra a chegada do técnico e o início da execução
 */
export async function makeOSStartExecution(osId: string, userId: string) {
  try {
    const updatedOS = await prisma.serviceOrder.update({
      where: { id: osId },
      data: {
        status: "EXECUCAO", // Em execução
      },
    });

    await prisma.serviceOrderStatusHistory.create({
      data: {
        serviceOrderId: osId,
        oldStatus: "DESLOCAMENTO",
        newStatus: "EXECUCAO",
        changedById: userId,
        justification: "Técnico chegou ao local e iniciou os serviços (Check-in concluído).",
      },
    });

    revalidatePath("/execucao");
    revalidatePath("/ordens-servico");
    return { success: true, os: updatedOS };
  } catch (error: any) {
    console.error("Erro no início da execução da OS:", error);
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
    // 1. Atualizar OS com laudo, checklist e assinatura
    const notesJson = JSON.stringify({
      medicoes: data.measurementsJson,
      checklist: JSON.parse(data.checklistJson),
    });

    const updatedOS = await prisma.serviceOrder.update({
      where: { id: osId },
      data: {
        status: "CONCLUIDA",
        technicalDiagnosis: data.technicalDiagnosis,
        checklistJson: data.checklistJson,
        signatureBase64: data.signatureBase64,
        signatureName: data.signatureName,
        completedAt: new Date(),
        notes: `Medições técnicas: ${data.measurementsJson}.`,
      },
    });

    // 2. Salvar as fotos de evidência técnica
    if (data.photos && data.photos.length > 0) {
      await prisma.serviceOrderPhoto.deleteMany({ where: { serviceOrderId: osId } }); // limpa antigas se houver
      
      const photoRelations = data.photos.map((p) => ({
        serviceOrderId: osId,
        step: p.step,
        url: p.url,
        caption: p.caption || null,
      }));

      await prisma.serviceOrderPhoto.createMany({
        data: photoRelations,
      });
    }

    // 3. Gerar o Relatório de Conclusão vinculado de forma 1:1
    await prisma.completionReport.deleteMany({ where: { serviceOrderId: osId } }); // garante integridade 1:1
    
    const report = await prisma.completionReport.create({
      data: {
        serviceOrderId: osId,
        clientFeedback: data.clientFeedback || "Serviço aprovado sem observações.",
        technicalObservations: `Executado diagnóstico técnico. Equipamento testado e entregue operacional. Medições registradas: ${data.measurementsJson}.`,
        warrantyTerms: "Garantia de 90 dias nos serviços prestados, a contar desta data.",
        approvedByClient: true,
        approvedAt: new Date(),
      },
    });

    // 4. Salvar histórico de auditoria
    await prisma.serviceOrderStatusHistory.create({
      data: {
        serviceOrderId: osId,
        oldStatus: "EXECUCAO",
        newStatus: "CONCLUIDA",
        changedById: data.userId,
        justification: `Técnico finalizou execução, preencheu checklist, coletou assinatura e emitiu relatório de conclusão. Assinado por: ${data.signatureName}.`,
      },
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
    console.error("Erro ao enviar finalização técnica:", error);
    return { success: false, error: error.message };
  }
}
