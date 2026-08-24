"use server";

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { requireAuth, requirePermission } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface FieldFormAnswerInput {
  questionId: string;
  value: string | number | boolean | null;
  notApplicable?: boolean;
}

function isPrivileged(roleName: string, permissions: string[]) {
  return roleName === "Administrador" || roleName === "Gestor" || permissions.includes("admin.all");
}

async function authorizedVisit(visitId: string) {
  const session = await requireAuth();
  const visit = await prisma.serviceVisit.findUnique({
    where: { id: visitId },
    include: {
      technicians: true,
      serviceOrder: {
        include: {
          serviceOrderAssets: { include: { storeAsset: true, clientEquipment: true } },
        },
      },
    },
  });
  if (!visit) throw new Error("Visita não encontrada.");
  if (!isPrivileged(session.roleName, session.permissions) && !visit.technicians.some((item) => item.userId === session.userId)) {
    throw new Error("Esta visita não está atribuída ao técnico conectado.");
  }
  return { session, visit };
}

function recommendedTemplateCode(
  serviceCategory: string,
  serviceType: string,
  links: Array<{ storeAsset: { category: string } | null; clientEquipment: { type: string } | null }>,
) {
  const terms = [serviceCategory, serviceType, ...links.flatMap((link) => [link.storeAsset?.category || "", link.clientEquipment?.type || ""])]
    .join(" ")
    .toUpperCase();
  if (/INCENDIO|EXTINTOR|HIDRANTE|ALARME|ROTA DE FUGA/.test(terms)) return "CHECKLIST_INCENDIO";
  if (/ILUMINA|LAMPADA|LUMINARIA|DRIVER|REATOR/.test(terms)) return "CHECKLIST_ILUMINACAO";
  if (/ELETR|QUADRO|ILUMINA|DISJUNTOR/.test(terms)) return "CHECKLIST_ELETRICA";
  if (/HIDRAUL|VAZAMENTO|TORNEIRA|REGISTRO|TUBULAC|RALO/.test(terms)) return "CHECKLIST_HIDRAULICA";
  if (/CIVIL|PINTURA|ALVENARIA|GESSO|PISO|FORRO/.test(terms)) return "CHECKLIST_CIVIL";
  if (/REFRIG|CAMARA FRIA|EXPOSITOR/.test(terms)) return "CHECKLIST_REFRIGERACAO";
  if (/HVAC|CLIMAT|REFRIG|AR CONDICIONADO|PMOC|PREVENTIVA/.test(terms)) return "CHECKLIST_HVAC";
  return "CHECKLIST_GERAL";
}

async function publishedVersion(templateCode: string) {
  const version = await prisma.formVersion.findFirst({
    where: { status: "PUBLICADO", template: { code: templateCode, active: true } },
    orderBy: { version: "desc" },
  });
  if (version) return version;
  return prisma.formVersion.findFirst({
    where: { status: "PUBLICADO", template: { code: "CHECKLIST_GERAL", active: true } },
    orderBy: { version: "desc" },
  });
}

async function ensureVisitSubmission(visitId: string, userId: string) {
  const existing = await prisma.formSubmission.findFirst({
    where: { visitId },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
  });
  if (existing) return existing;

  const visit = await prisma.serviceVisit.findUnique({
    where: { id: visitId },
    include: {
      serviceOrder: {
        include: { serviceOrderAssets: { include: { storeAsset: true, clientEquipment: true } } },
      },
    },
  });
  if (!visit) throw new Error("Visita não encontrada.");
  const code = recommendedTemplateCode(visit.serviceOrder.serviceCategory, visit.serviceOrder.type, visit.serviceOrder.serviceOrderAssets);
  const version = await publishedVersion(code);
  if (!version) throw new Error("Nenhum formulário de campo publicado foi encontrado.");

  return prisma.formSubmission.upsert({
    where: { visitId_versionId: { visitId, versionId: version.id } },
    update: {},
    create: {
      visitId,
      serviceOrderId: visit.serviceOrderId,
      versionId: version.id,
      submittedById: userId,
    },
  });
}

function answerValue(answer: {
  valueText: string | null;
  valueNumber: number | null;
  valueBoolean: boolean | null;
  valueJson: string | null;
}) {
  if (answer.valueBoolean != null) return answer.valueBoolean;
  if (answer.valueNumber != null) return answer.valueNumber;
  if (answer.valueText != null) return answer.valueText;
  if (answer.valueJson != null) {
    try { return JSON.parse(answer.valueJson); } catch { return answer.valueJson; }
  }
  return null;
}

export async function getVisitExecutionForm(visitId: string) {
  try {
    const { session } = await authorizedVisit(visitId);
    const ensured = await ensureVisitSubmission(visitId, session.userId);
    const submission = await prisma.formSubmission.findUnique({
      where: { id: ensured.id },
      include: {
        answers: true,
        version: {
          include: {
            template: true,
            sections: {
              include: {
                questions: {
                  include: { measurementDefinition: true },
                  orderBy: { position: "asc" },
                },
              },
              orderBy: { position: "asc" },
            },
          },
        },
      },
    });
    if (!submission) throw new Error("Não foi possível preparar o formulário da visita.");

    const values = Object.fromEntries(submission.answers.map((answer) => [answer.questionId, answerValue(answer)]));
    return {
      success: true as const,
      form: {
        submissionId: submission.id,
        status: submission.status,
        template: {
          id: submission.version.template.id,
          code: submission.version.template.code,
          name: submission.version.template.name,
          description: submission.version.template.description,
          category: submission.version.template.category,
          version: submission.version.version,
        },
        sections: submission.version.sections.map((section) => ({
          id: section.id,
          title: section.title,
          description: section.description,
          questions: section.questions.map((question) => ({
            id: question.id,
            code: question.code,
            label: question.label,
            helpText: question.helpText,
            type: question.type,
            required: question.required,
            options: (() => {
              try { return JSON.parse(question.optionsJson || "[]"); } catch { return []; }
            })(),
            measurementDefinition: question.measurementDefinition
              ? {
                  code: question.measurementDefinition.code,
                  unit: question.measurementDefinition.unit,
                  minValue: question.measurementDefinition.minValue,
                  maxValue: question.measurementDefinition.maxValue,
                  decimals: question.measurementDefinition.decimals,
                }
              : null,
          })),
        })),
        values,
      },
    };
  } catch (error) {
    logger.error("Erro ao carregar formulário da visita:", error);
    return { success: false as const, error: error instanceof Error ? error.message : "Erro ao carregar formulário." };
  }
}

export async function getPublishedFormTemplates() {
  try {
    await requireAuth();
    const templates = await prisma.formTemplate.findMany({
      where: { active: true, versions: { some: { status: "PUBLICADO" } } },
      include: {
        versions: {
          where: { status: "PUBLICADO" },
          orderBy: { version: "desc" },
          take: 1,
          include: { _count: { select: { sections: true } } },
        },
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
    return { success: true as const, templates };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Erro ao carregar modelos." };
  }
}

export async function assignFormTemplateToVisit(visitId: string, templateId: string) {
  try {
    const session = await requirePermission("os.write");
    const visit = await prisma.serviceVisit.findUnique({ where: { id: visitId } });
    if (!visit) throw new Error("Visita não encontrada.");
    const version = await prisma.formVersion.findFirst({
      where: { templateId, status: "PUBLICADO", template: { active: true } },
      orderBy: { version: "desc" },
    });
    if (!version) throw new Error("O modelo selecionado não possui uma versão publicada.");

    await prisma.$transaction(async (tx) => {
      await tx.formSubmission.deleteMany({ where: { visitId, status: "RASCUNHO" } });
      await tx.formSubmission.upsert({
        where: { visitId_versionId: { visitId, versionId: version.id } },
        update: { submittedById: session.userId },
        create: {
          visitId,
          serviceOrderId: visit.serviceOrderId,
          versionId: version.id,
          submittedById: session.userId,
        },
      });
    });
    revalidatePath("/ordens-servico");
    revalidatePath("/execucao");
    return { success: true as const };
  } catch (error) {
    logger.error("Erro ao atribuir formulário:", error);
    return { success: false as const, error: error instanceof Error ? error.message : "Erro ao atribuir formulário." };
  }
}

export async function saveVisitFormDraft(submissionId: string, answers: FieldFormAnswerInput[]) {
  try {
    const session = await requireAuth();
    const submission = await prisma.formSubmission.findUnique({
      where: { id: submissionId },
      include: { visit: { include: { technicians: true } }, version: { include: { sections: { include: { questions: true } } } } },
    });
    if (!submission) throw new Error("Formulário não encontrado.");
    if (!isPrivileged(session.roleName, session.permissions) && !submission.visit.technicians.some((item) => item.userId === session.userId)) {
      throw new Error("Sem permissão para editar este formulário.");
    }
    if (submission.status === "ENVIADO") throw new Error("Este formulário já foi finalizado.");

    const allowedQuestionIds = new Set(submission.version.sections.flatMap((section) => section.questions.map((question) => question.id)));
    const validAnswers = answers.filter((answer) => allowedQuestionIds.has(answer.questionId));
    await prisma.$transaction(async (tx) => {
      for (const answer of validAnswers) {
        const value = answer.value;
        await tx.formAnswer.upsert({
          where: { submissionId_questionId: { submissionId, questionId: answer.questionId } },
          update: {
            valueText: typeof value === "string" ? value : null,
            valueNumber: typeof value === "number" && Number.isFinite(value) ? value : null,
            valueBoolean: typeof value === "boolean" ? value : null,
            valueJson: value != null && typeof value === "object" ? JSON.stringify(value) : null,
            notApplicable: Boolean(answer.notApplicable),
            answeredAt: new Date(),
          },
          create: {
            submissionId,
            questionId: answer.questionId,
            valueText: typeof value === "string" ? value : null,
            valueNumber: typeof value === "number" && Number.isFinite(value) ? value : null,
            valueBoolean: typeof value === "boolean" ? value : null,
            valueJson: value != null && typeof value === "object" ? JSON.stringify(value) : null,
            notApplicable: Boolean(answer.notApplicable),
          },
        });
      }
      await tx.formSubmission.update({ where: { id: submissionId }, data: { submittedById: session.userId } });
    });
    return { success: true as const, savedAt: new Date() };
  } catch (error) {
    logger.error("Erro ao salvar rascunho do formulário:", error);
    return { success: false as const, error: error instanceof Error ? error.message : "Erro ao salvar rascunho." };
  }
}
