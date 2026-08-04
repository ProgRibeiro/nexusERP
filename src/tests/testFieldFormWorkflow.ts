import "dotenv/config";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const nextCache = require("next/cache");
nextCache.revalidatePath = () => {};
nextCache.revalidateTag = () => {};

let mockSessionToken: string | null = null;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nextHeaders = require("next/headers");
nextHeaders.cookies = async () => ({
  get: (name: string) => name === "nx_session" && mockSessionToken ? { name, value: mockSessionToken } : undefined,
  set: () => {},
  delete: () => {},
});

async function main() {
  const { prisma } = await import("../lib/db");
  const { encryptSession } = await import("../lib/session");
  const { deleteUploadedAsset } = await import("../lib/storage");
  const { createManualServiceOrder, scheduleServiceOrder } = await import("../app/actions/osActions");
  const { makeOSStartExecution, submitTechnicalExecution } = await import("../app/actions/executionActions");
  const { getVisitExecutionForm, saveVisitFormDraft } = await import("../app/actions/formActions");

  const admin = await prisma.user.findUnique({ where: { email: "admin@erp.com" }, include: { role: true } });
  const client = await prisma.client.findFirst({ include: { addresses: true } });
  if (!admin || !client?.addresses[0]) throw new Error("O teste precisa de administrador e cliente com endereço.");

  mockSessionToken = await encryptSession({
    userId: admin.id,
    name: admin.name,
    email: admin.email,
    roleName: admin.role?.name || "Administrador",
    permissions: JSON.parse(admin.permissions),
    exp: Date.now() + 60 * 60 * 1000,
  });

  const created = await createManualServiceOrder({
    clientId: client.id,
    addressId: client.addresses[0].id,
    type: "PREVENTIVA",
    priority: "MEDIA",
    problemReported: "Teste do formulário versionado de campo.",
  });
  if (!created.success || !created.os) throw new Error(created.error || "Falha ao criar OS de teste.");
  const osId = created.os.id;
  const code = created.os.code;
  let uploadedUrls: string[] = [];

  try {
    const visit = await prisma.serviceVisit.findFirstOrThrow({ where: { serviceOrderId: osId } });
    const scheduled = await scheduleServiceOrder(osId, {
      scheduledDate: new Date(Date.now() + 86_400_000),
      scheduledTime: "08:00",
      techIds: [admin.id],
      priority: "MEDIA",
    }, admin.id);
    if (!scheduled.success) throw new Error(scheduled.error);

    const started = await makeOSStartExecution(visit.id, admin.id);
    if (!started.success) throw new Error(started.error);

    const formResult = await getVisitExecutionForm(visit.id);
    if (!formResult.success) throw new Error(formResult.error);
    if (formResult.form.template.code !== "CHECKLIST_HVAC") {
      throw new Error(`Modelo inesperado: ${formResult.form.template.code}.`);
    }

    const questions = formResult.form.sections.flatMap((section) => section.questions);
    const answers = questions.map((question) => ({
      questionId: question.id,
      value: question.type === "CHECKBOX"
        ? true
        : question.type === "SELECT"
          ? question.options[0]
          : question.type === "MEASUREMENT" && question.measurementDefinition?.code === "TENSAO"
            ? 220
            : null,
    }));
    const draft = await saveVisitFormDraft(formResult.form.submissionId, answers);
    if (!draft.success) throw new Error(draft.error);

    const requiredChecklist = questions
      .filter((question) => question.type === "CHECKBOX" && question.required)
      .map((question) => ({ label: question.label, checked: true }));
    const voltageQuestion = questions.find((question) => question.measurementDefinition?.code === "TENSAO");
    const onePixelPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nWQAAAAASUVORK5CYII=";
    const submitted = await submitTechnicalExecution(visit.id, {
      technicalDiagnosis: "Equipamento inspecionado, higienizado e testado.",
      checklistJson: JSON.stringify(requiredChecklist),
      measurementsJson: "TENSAO: 220",
      measurements: voltageQuestion ? [{ definitionCode: "TENSAO", value: 220, rawValue: "220" }] : [],
      formSubmissionId: formResult.form.submissionId,
      formAnswers: answers,
      photos: [],
      signatureBase64: onePixelPng,
      signatureName: "Responsável de teste",
      clientFeedback: "Aprovado",
      userId: admin.id,
    });
    if (!submitted.success) throw new Error(submitted.error);

    const persisted = await prisma.formSubmission.findUnique({
      where: { id: formResult.form.submissionId },
      include: { answers: true },
    });
    const finalVisit = await prisma.serviceVisit.findUnique({ where: { id: visit.id } });
    const finalOS = await prisma.serviceOrder.findUnique({ where: { id: osId } });
    if (persisted?.status !== "ENVIADO" || persisted.answers.length !== questions.length) {
      throw new Error("A submissão versionada não foi persistida por completo.");
    }
    if (finalVisit?.status !== "CONCLUIDA" || finalOS?.status !== "REVISAO") {
      throw new Error("O formulário foi salvo, mas o fluxo operacional não foi concluído.");
    }
    uploadedUrls = (await prisma.evidence.findMany({ where: { serviceOrderId: osId }, select: { fileUrl: true } })).map((item) => item.fileUrl);
    console.log("FIELD_FORM_WORKFLOW_OK", {
      template: formResult.form.template.name,
      version: formResult.form.template.version,
      answers: persisted.answers.length,
      readings: await prisma.measurementReading.count({ where: { serviceOrderId: osId } }),
    });
  } finally {
    await prisma.auditLog.deleteMany({ where: { entity: "OrdemServico", entityId: osId } });
    await prisma.notification.deleteMany({ where: { message: { contains: code } } });
    await prisma.serviceOrder.delete({ where: { id: osId } });
    await Promise.all(uploadedUrls.map((url) => deleteUploadedAsset(url)));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
