"use server";

import { logger } from "@/lib/logger";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { saveBase64Asset } from "@/lib/storage";

export interface PhotoInput {
  step: "ANTES" | "DEPOIS" | "EVIDENCIA";
  url: string; // base64 or mocked url
  caption: string;
}

interface FieldFormAnswerInput {
  questionId: string;
  value: string | number | boolean | null;
  notApplicable?: boolean;
}

interface LocationInput {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

async function resolveVisit(identifier: string, userId: string, roleName: string, permissions: string[]) {
  const visit = await prisma.serviceVisit.findUnique({
    where: { id: identifier },
    include: { technicians: true, serviceOrder: true },
  }) || await prisma.serviceVisit.findFirst({
    where: { serviceOrderId: identifier, status: { notIn: ["CONCLUIDA", "CANCELADA"] } },
    include: { technicians: true, serviceOrder: true },
    orderBy: { number: "desc" },
  });
  if (!visit) throw new Error("Visita de serviço não encontrada.");
  const privileged = roleName === "Administrador" || roleName === "Gestor" || permissions.includes("admin.all");
  if (!privileged && !visit.technicians.some((assignment) => assignment.userId === userId)) {
    throw new Error("Esta visita não está atribuída ao técnico conectado.");
  }
  return visit;
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

    const assignments = await prisma.visitTechnician.findMany({
      where: { userId: effectiveTechId },
      include: {
        visit: {
          include: {
            serviceOrder: {
              include: {
                client: true,
                address: true,
                serviceOrderAssets: {
                  include: { storeAsset: true, clientEquipment: true },
                },
              },
            },
          },
        },
      },
      orderBy: { visit: { scheduledStart: "asc" } },
    });

    return assignments
      .filter((assignment) => !["CONCLUIDA", "CANCELADA"].includes(assignment.visit.status))
      .map((assignment) => {
      const visit = assignment.visit;
      const order = visit.serviceOrder;
      const primaryAsset = order.serviceOrderAssets.find((item) => item.isPrimary) || order.serviceOrderAssets[0];
      return {
      id: visit.id,
      visitId: visit.id,
      osId: order.id,
      visitNumber: visit.number,
      code: order.code,
      clientName: order.client.name,
      status: visit.status,
      serviceOrderStatus: order.status,
      type: order.type,
      priority: order.priority,
      problemReported: order.problemReported,
      scheduledDate: visit.scheduledStart,
      scheduledTime: visit.scheduledStart?.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false }),
      estimatedDurationMinutes: visit.estimatedDurationMinutes,
      addressLabel: order.address?.label || "Sem local",
      addressText: order.address
        ? `${order.address.street}, ${order.address.number} - ${order.address.city}`
        : "Endereço não disponível",
      assetName: primaryAsset?.storeAsset?.name || primaryAsset?.clientEquipment?.type || null,
      syncStatus: "SINCRONIZADO",
    };});
  } catch (error) {
    logger.error("Erro ao obter OS do técnico:", error);
    return [];
  }
}

/**
 * Registra o início do deslocamento do técnico
 */
export async function makeOSCheckin(visitId: string, userId: string, location?: LocationInput) {
  try {
    const session = await requireAuth();
    userId = session.userId; // nunca confiar no valor vindo do client
    const visit = await resolveVisit(visitId, userId, session.roleName, session.permissions);
    if (!["AGENDADA", "ACEITA"].includes(visit.status)) throw new Error("Apenas uma visita agendada ou aceita pode iniciar deslocamento.");
    const now = new Date();

    const updatedOS = await prisma.$transaction(async (tx) => {
      await tx.serviceVisit.update({
        where: { id: visit.id },
        data: { status: "EM_DESLOCAMENTO", travelStartedAt: now },
      });
      await tx.visitStatusHistory.create({
        data: {
          visitId: visit.id,
          oldStatus: visit.status,
          newStatus: "EM_DESLOCAMENTO",
          changedById: userId,
          justification: "Técnico iniciou o deslocamento para o atendimento.",
          latitude: location?.latitude,
          longitude: location?.longitude,
        },
      });
      await tx.timeEntry.create({ data: { visitId: visit.id, userId, type: "DESLOCAMENTO", startedAt: now } });
      if (location) {
        await tx.locationEvent.create({
          data: { visitId: visit.id, userId, type: "DESLOCAMENTO_INICIADO", latitude: location.latitude, longitude: location.longitude, accuracy: location.accuracy },
        });
      }
      const updated = await tx.serviceOrder.update({ where: { id: visit.serviceOrderId }, data: { status: "DESLOCAMENTO" } });
      await tx.serviceOrderStatusHistory.create({
        data: {
          serviceOrderId: visit.serviceOrderId,
          oldStatus: visit.serviceOrder.status,
          newStatus: "DESLOCAMENTO",
          changedById: userId,
          justification: `Visita ${visit.number}: técnico iniciou deslocamento para o local do cliente.`,
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
export async function makeOSStartExecution(visitId: string, userId: string, location?: LocationInput) {
  try {
    const session = await requireAuth();
    userId = session.userId; // nunca confiar no valor vindo do client
    const visit = await resolveVisit(visitId, userId, session.roleName, session.permissions);
    if (!["EM_DESLOCAMENTO", "AGENDADA", "ACEITA", "NO_LOCAL", "PAUSADA"].includes(visit.status)) {
      throw new Error("A visita precisa estar agendada, no local ou pausada para iniciar a execução.");
    }
    const now = new Date();

    const updatedOS = await prisma.$transaction(async (tx) => {
      await tx.timeEntry.updateMany({ where: { visitId: visit.id, endedAt: null }, data: { endedAt: now } });
      await tx.timeEntry.create({ data: { visitId: visit.id, userId, type: "EXECUCAO", startedAt: now } });
      await tx.serviceVisit.update({
        where: { id: visit.id },
        data: {
          status: "EM_EXECUCAO",
          arrivedAt: visit.arrivedAt || now,
          startedAt: visit.startedAt || now,
          checkinLatitude: location?.latitude ?? visit.checkinLatitude,
          checkinLongitude: location?.longitude ?? visit.checkinLongitude,
        },
      });
      await tx.visitStatusHistory.create({
        data: {
          visitId: visit.id,
          oldStatus: visit.status,
          newStatus: "EM_EXECUCAO",
          changedById: userId,
          justification: visit.status === "PAUSADA" ? "Técnico retomou a execução." : "Técnico confirmou a chegada e iniciou a execução.",
          latitude: location?.latitude,
          longitude: location?.longitude,
        },
      });
      if (location) {
        await tx.locationEvent.create({
          data: { visitId: visit.id, userId, type: "CHECKIN", latitude: location.latitude, longitude: location.longitude, accuracy: location.accuracy },
        });
      }
      const updated = await tx.serviceOrder.update({ where: { id: visit.serviceOrderId }, data: { status: "EXECUCAO" } });
      await tx.serviceOrderStatusHistory.create({
        data: {
          serviceOrderId: visit.serviceOrderId,
          oldStatus: visit.serviceOrder.status,
          newStatus: "EXECUCAO",
          changedById: userId,
          justification: `Visita ${visit.number}: técnico chegou ao local e iniciou os serviços.`,
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
  visitOrOsId: string,
  data: {
    technicalDiagnosis: string;
    checklistJson: string;
    measurementsJson: string; // Salvo dentro das notas técnicas ou histórico
    photos: PhotoInput[];
    signatureBase64: string;
    signatureName: string;
    clientFeedback?: string;
    userId: string;
    measurements?: Array<{ definitionCode: string; value: number; rawValue?: string }>;
    formSubmissionId?: string;
    formAnswers?: FieldFormAnswerInput[];
  }
) {
  try {
    const session = await requireAuth();
    data.userId = session.userId; // nunca confiar no valor vindo do client
    const visit = await resolveVisit(visitOrOsId, data.userId, session.roleName, session.permissions);
    const osId = visit.serviceOrderId;
    const currentOS = await prisma.serviceOrder.findUnique({ where: { id: osId } });
    if (!currentOS) throw new Error("Ordem de serviço não encontrada.");
    if (visit.status !== "EM_EXECUCAO") throw new Error("A visita precisa estar em execução para ser concluída.");
    if (!data.technicalDiagnosis.trim()) throw new Error("Preencha o diagnóstico técnico.");
    if (!data.signatureBase64 || !data.signatureName.trim()) throw new Error("Colete a assinatura e informe o nome do cliente.");
    let submittedChecklist: Array<{ checked?: boolean }> = [];
    try { submittedChecklist = JSON.parse(data.checklistJson || "[]"); } catch {
      throw new Error("Checklist técnico inválido.");
    }
    if (submittedChecklist.length > 0 && submittedChecklist.some((item) => !item.checked)) {
      throw new Error("Conclua todos os itens do checklist antes de finalizar.");
    }

    const formSubmission = data.formSubmissionId
      ? await prisma.formSubmission.findUnique({
          where: { id: data.formSubmissionId },
          include: { version: { include: { sections: { include: { questions: true } } } } },
        })
      : null;
    if (data.formSubmissionId && (!formSubmission || formSubmission.visitId !== visit.id)) {
      throw new Error("O formulário informado não pertence a esta visita.");
    }
    if (formSubmission?.status === "ENVIADO") throw new Error("O formulário desta visita já foi enviado.");
    const formQuestions = formSubmission?.version.sections.flatMap((section) => section.questions) || [];
    const formAnswerByQuestion = new Map((data.formAnswers || []).map((answer) => [answer.questionId, answer]));
    const missingRequired = formQuestions.find((question) => {
      if (!question.required) return false;
      const answer = formAnswerByQuestion.get(question.id);
      if (answer?.notApplicable) return false;
      if (!answer) return true;
      if (question.type === "CHECKBOX") return answer.value !== true;
      return answer.value == null || (typeof answer.value === "string" && !answer.value.trim());
    });
    if (missingRequired) throw new Error(`Responda o campo obrigatório: ${missingRequired.label}.`);

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
          url: await saveBase64Asset(p.url, `visita-${visit.id}`),
          caption: p.caption || null,
        }))
      );
    }

    const submittedMeasurements = (data.measurements || []).filter((item) => item.definitionCode && Number.isFinite(item.value));
    const measurementDefinitions = submittedMeasurements.length
      ? await prisma.measurementDefinition.findMany({ where: { code: { in: submittedMeasurements.map((item) => item.definitionCode) }, active: true } })
      : [];
    const definitionByCode = new Map(measurementDefinitions.map((definition) => [definition.code, definition]));
    const primaryAsset = await prisma.serviceOrderAsset.findFirst({
      where: { serviceOrderId: osId },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      select: { storeAssetId: true, clientEquipmentId: true },
    });
    const now = new Date();

    const { updatedOS, report } = await prisma.$transaction(async (tx) => {
      const updatedOS = await tx.serviceOrder.update({
        where: { id: osId },
        data: {
          status: "REVISAO",
          technicalDiagnosis: data.technicalDiagnosis,
          checklistJson: data.checklistJson,
          signatureBase64: storedSignatureUrl,
          signatureName: data.signatureName,
          completedAt: new Date(),
          notes: `Medições técnicas: ${data.measurementsJson}.`,
        },
      });
      if (photoRelations.length > 0) {
        await tx.serviceOrderPhoto.createMany({ data: photoRelations });
        await tx.evidence.createMany({
          data: photoRelations.map((photo) => ({
            serviceOrderId: osId,
            visitId: visit.id,
            storeAssetId: primaryAsset?.storeAssetId,
            clientEquipmentId: primaryAsset?.clientEquipmentId,
            authorId: data.userId,
            kind: "FOTO",
            stage: photo.step === "EVIDENCIA" ? "DIAGNOSTICO" : photo.step,
            fileUrl: photo.url,
            caption: photo.caption,
            capturedAt: now,
          })),
        });
      }
      await tx.evidence.create({
        data: {
          serviceOrderId: osId,
          visitId: visit.id,
          storeAssetId: primaryAsset?.storeAssetId,
          clientEquipmentId: primaryAsset?.clientEquipmentId,
          authorId: data.userId,
          kind: "ASSINATURA",
          stage: "DEPOIS",
          fileUrl: storedSignatureUrl,
          caption: `Assinatura de ${data.signatureName}`,
          capturedAt: now,
        },
      });
      if (submittedMeasurements.length > 0) {
        await tx.measurementReading.createMany({
          data: submittedMeasurements.flatMap((measurement) => {
            const definition = definitionByCode.get(measurement.definitionCode);
            if (!definition) return [];
            const status = definition.minValue != null && measurement.value < definition.minValue
              ? "ABAIXO"
              : definition.maxValue != null && measurement.value > definition.maxValue
                ? "ACIMA"
                : "NORMAL";
            return [{
              definitionId: definition.id,
              serviceOrderId: osId,
              visitId: visit.id,
              storeAssetId: primaryAsset?.storeAssetId,
              clientEquipmentId: primaryAsset?.clientEquipmentId,
              recordedById: data.userId,
              value: measurement.value,
              rawValue: measurement.rawValue || String(measurement.value),
              status,
            }];
          }),
        });
      }
      if (formSubmission) {
        const allowedQuestionIds = new Set(formQuestions.map((question) => question.id));
        for (const answer of (data.formAnswers || []).filter((item) => allowedQuestionIds.has(item.questionId))) {
          const value = answer.value;
          await tx.formAnswer.upsert({
            where: { submissionId_questionId: { submissionId: formSubmission.id, questionId: answer.questionId } },
            update: {
              valueText: typeof value === "string" ? value : null,
              valueNumber: typeof value === "number" && Number.isFinite(value) ? value : null,
              valueBoolean: typeof value === "boolean" ? value : null,
              notApplicable: Boolean(answer.notApplicable),
              answeredAt: now,
            },
            create: {
              submissionId: formSubmission.id,
              questionId: answer.questionId,
              valueText: typeof value === "string" ? value : null,
              valueNumber: typeof value === "number" && Number.isFinite(value) ? value : null,
              valueBoolean: typeof value === "boolean" ? value : null,
              notApplicable: Boolean(answer.notApplicable),
              answeredAt: now,
            },
          });
        }
        await tx.formSubmission.update({
          where: { id: formSubmission.id },
          data: { status: "ENVIADO", submittedById: data.userId, submittedAt: now },
        });
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
      await tx.timeEntry.updateMany({ where: { visitId: visit.id, endedAt: null }, data: { endedAt: now } });
      await tx.serviceVisit.update({
        where: { id: visit.id },
        data: { status: "CONCLUIDA", result: "RESOLVIDO", completedAt: now },
      });
      await tx.visitStatusHistory.create({
        data: {
          visitId: visit.id,
          oldStatus: visit.status,
          newStatus: "CONCLUIDA",
          changedById: data.userId,
          justification: `Visita concluída e assinada por ${data.signatureName}.`,
        },
      });
      await tx.serviceOrderStatusHistory.create({
        data: {
          serviceOrderId: osId,
          oldStatus: currentOS.status,
          newStatus: "REVISAO",
          changedById: data.userId,
          justification: `Visita ${visit.number} concluída; documentação encaminhada para revisão técnica.`,
        },
      });
      return { updatedOS, report };
    });

    // 5. Enviar Notificação para o Faturamento
    const client = await prisma.client.findFirst({
      where: { serviceOrders: { some: { id: osId } } },
    });

    await prisma.notification.create({
      data: {
        title: "Revisão técnica pendente",
        message: `A visita ${visit.number} da OS ${updatedOS.code} (${client?.name}) foi concluída. Revise as evidências antes de liberar o relatório e o faturamento.`,
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
          visitId: visit.id,
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
