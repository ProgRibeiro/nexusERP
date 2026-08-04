import "dotenv/config";

// Executa as Server Actions fora de uma requisição HTTP real.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nextCache = require("next/cache");
nextCache.revalidatePath = () => {};
nextCache.revalidateTag = () => {};

let mockSessionToken: string | null = null;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nextHeaders = require("next/headers");
nextHeaders.cookies = async () => ({
  get: (name: string) =>
    name === "nx_session" && mockSessionToken
      ? { name, value: mockSessionToken }
      : undefined,
  set: () => {},
  delete: () => {},
});

async function main() {
  const { prisma } = await import("../lib/db");
  const { encryptSession } = await import("../lib/session");
  const {
    createManualServiceOrder,
    scheduleServiceOrder,
    updateOSStatus,
  } = await import("../app/actions/osActions");

  const admin = await prisma.user.findUnique({
    where: { email: "admin@erp.com" },
    include: { role: true },
  });
  const client = await prisma.client.findFirst({ include: { addresses: true } });
  if (!admin || !client?.addresses[0]) {
    throw new Error("O teste precisa de um administrador e um cliente com endereço.");
  }

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
    type: "CORRETIVA",
    priority: "MEDIA",
    problemReported: "Teste de visita e retorno sem apagar o atendimento anterior.",
  });
  if (!created.success || !created.os) {
    throw new Error(created.error || "Não foi possível criar a OS de teste.");
  }

  const osId = created.os.id;
  const code = created.os.code;

  try {
    const scheduled = await scheduleServiceOrder(
      osId,
      {
        scheduledDate: new Date(Date.now() + 86_400_000),
        scheduledTime: "09:00",
        techIds: [admin.id],
        priority: "MEDIA",
      },
      admin.id,
    );
    if (!scheduled.success) throw new Error(scheduled.error);

    for (const status of ["DESLOCAMENTO", "EXECUCAO", "RETORNO"]) {
      const result = await updateOSStatus(
        osId,
        status,
        admin.id,
        status === "RETORNO" ? "Peça complementar necessária." : undefined,
      );
      if (!result.success) throw new Error(result.error);
    }

    let visits = await prisma.serviceVisit.findMany({
      where: { serviceOrderId: osId },
      orderBy: { number: "asc" },
    });
    if (visits.length !== 2) throw new Error(`Esperadas 2 visitas; recebidas ${visits.length}.`);
    if (visits[0].status !== "CONCLUIDA" || visits[0].result !== "RETORNO_NECESSARIO") {
      throw new Error("A primeira visita não preservou o resultado de retorno necessário.");
    }
    if (visits[1].status !== "NAO_AGENDADA" || visits[1].sourceVisitId !== visits[0].id) {
      throw new Error("A visita de retorno não foi criada e ligada à visita original.");
    }

    const rescheduled = await scheduleServiceOrder(
      osId,
      {
        scheduledDate: new Date(Date.now() + 2 * 86_400_000),
        scheduledTime: "14:00",
        techIds: [admin.id],
        priority: "ALTA",
      },
      admin.id,
    );
    if (!rescheduled.success) throw new Error(rescheduled.error);

    visits = await prisma.serviceVisit.findMany({
      where: { serviceOrderId: osId },
      orderBy: { number: "asc" },
    });
    if (visits[1].status !== "AGENDADA" || !visits[1].scheduledStart) {
      throw new Error("A nova visita não recebeu o reagendamento.");
    }

    console.log("SERVICE_VISIT_WORKFLOW_OK", {
      os: code,
      visits: visits.map((visit) => ({ number: visit.number, status: visit.status, result: visit.result })),
    });
  } finally {
    await prisma.auditLog.deleteMany({ where: { entity: "OrdemServico", entityId: osId } });
    await prisma.notification.deleteMany({ where: { message: { contains: code } } });
    await prisma.serviceOrder.delete({ where: { id: osId } });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
