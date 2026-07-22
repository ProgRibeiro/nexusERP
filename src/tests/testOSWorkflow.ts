import "dotenv/config";

const nextCache = require("next/cache");
nextCache.revalidatePath = () => {};
nextCache.revalidateTag = () => {};

let mockSessionToken: string | null = null;
const nextHeaders = require("next/headers");
nextHeaders.cookies = async () => ({
  get: (name: string) => name === "nx_session" && mockSessionToken
    ? { name, value: mockSessionToken }
    : undefined,
  set: () => {},
  delete: () => {},
});

async function main() {
  const { prisma } = await import("../lib/db");
  const { encryptSession } = await import("../lib/session");
  const { createManualServiceOrder, scheduleServiceOrder, updateOSStatus, updateOSDetails, saveOSCompletionReport } = await import("../app/actions/osActions");
  const { searchGlobalAction } = await import("../app/actions/searchActions");
  const { getNavigationIndicators } = await import("../app/actions/navigationActions");

  const admin = await prisma.user.findUnique({ where: { email: "admin@erp.com" }, include: { role: true } });
  const client = await prisma.client.findFirst({ include: { addresses: true } });
  if (!admin || !client?.addresses[0]) throw new Error("Teste requer admin@erp.com e ao menos um cliente com endereço.");

  mockSessionToken = await encryptSession({
    userId: admin.id,
    name: admin.name,
    email: admin.email,
    roleName: admin.role?.name || "Administrador",
    permissions: JSON.parse(admin.permissions),
    exp: Date.now() + 60 * 60 * 1000,
  });

  const searchResults = await searchGlobalAction(client.name.split(" ")[0]);
  if (!searchResults.some((item) => item.type === "cliente" && item.id === client.id)) {
    throw new Error("A busca global não encontrou o cliente usado no teste.");
  }
  const indicators = await getNavigationIndicators();
  if (Object.values(indicators).some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error("Indicadores de navegação inválidos.");
  }

  const created = await createManualServiceOrder({
    clientId: client.id,
    addressId: client.addresses[0].id,
    type: "CORRETIVA",
    priority: "MEDIA",
    problemReported: "Teste isolado do fluxo",
  });
  if (!created.success || !created.os) throw new Error(created.error || "Falha ao criar OS manual.");
  const os = created.os;
  const code = os.code;

  try {
    const invalidStart = await updateOSStatus(os.id, "EXECUCAO", admin.id);
    if (invalidStart.success) throw new Error("O fluxo aceitou pular o agendamento.");

    const scheduled = await scheduleServiceOrder(os.id, {
      scheduledDate: new Date(Date.now() + 86400000),
      scheduledTime: "09:00",
      techIds: [admin.id],
      priority: "MEDIA",
    }, admin.id);
    if (!scheduled.success) throw new Error(scheduled.error);

    for (const status of ["DESLOCAMENTO", "EXECUCAO"]) {
      const result = await updateOSStatus(os.id, status, admin.id);
      if (!result.success) throw new Error(result.error);
    }

    const invalidConclusion = await updateOSStatus(os.id, "CONCLUIDA", admin.id);
    if (invalidConclusion.success) throw new Error("A OS foi concluída sem diagnóstico/checklist.");

    const details = await updateOSDetails(os.id, {
      technicalDiagnosis: "Equipamento testado e entregue em funcionamento.",
      checklistJson: JSON.stringify([{ label: "Teste funcional", checked: true }]),
    }, admin.id);
    if (!details.success) throw new Error(details.error);

    const concluded = await updateOSStatus(os.id, "CONCLUIDA", admin.id);
    if (!concluded.success) throw new Error(concluded.error);

    const report = await saveOSCompletionReport(os.id, {
      technicalObservations: "Serviço executado e validado no teste.",
      clientFeedback: "Aprovado",
      warrantyTerms: "90 dias",
      approvedByClient: true,
    });
    if (!report.success) throw new Error(report.error);

    const billing = await updateOSStatus(os.id, "FATURAMENTO", admin.id);
    if (!billing.success) throw new Error(billing.error);

    const finalOS = await prisma.serviceOrder.findUnique({ where: { id: os.id }, include: { statusHistory: true } });
    if (finalOS?.status !== "FATURAMENTO") throw new Error(`Status final inesperado: ${finalOS?.status}`);
    if ((finalOS.statusHistory?.length || 0) < 6) throw new Error("Histórico incompleto.");
    console.log("OS_WORKFLOW_OK", { status: finalOS.status, history: finalOS.statusHistory.length });
  } finally {
    await prisma.auditLog.deleteMany({ where: { entity: "OrdemServico", entityId: os.id } });
    await prisma.notification.deleteMany({ where: { message: { contains: code } } });
    await prisma.serviceOrder.delete({ where: { id: os.id } });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
