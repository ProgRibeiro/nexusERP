import { Prisma } from "@prisma/client";

export const CLOSED_VISIT_STATUSES = ["CONCLUIDA", "CANCELADA"];

export function visitStatusFromLegacyOS(status?: string | null) {
  switch ((status || "").toUpperCase()) {
    case "AGENDADA":
    case "AGENDADO":
      return "AGENDADA";
    case "DESLOCAMENTO":
      return "EM_DESLOCAMENTO";
    case "EXECUCAO":
    case "EM_EXECUCAO":
      return "EM_EXECUCAO";
    case "PAUSADA":
      return "PAUSADA";
    case "AGUARDANDO_PECA":
    case "AGUARDANDO_CLIENTE":
    case "RETORNO":
      return "IMPEDIDA";
    case "CONCLUIDA":
    case "CONCLUIDO":
    case "RELATORIO_ENVIADO":
    case "REVISAO":
    case "FATURAMENTO":
    case "FATURADA":
    case "FATURADO":
      return "CONCLUIDA";
    case "CANCELADA":
    case "CANCELADO":
      return "CANCELADA";
    default:
      return "NAO_AGENDADA";
  }
}

export async function lockServiceOrderVisits(tx: Prisma.TransactionClient, serviceOrderId: string) {
  // A função do PostgreSQL retorna `void`, tipo que o Prisma não desserializa.
  // Transformar o resultado em boolean mantém a trava transacional e retorna
  // somente um tipo suportado pelo client.
  await tx.$queryRaw<Array<{ locked: boolean }>>(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`service-visits:${serviceOrderId}`})) IS NULL AS locked`,
  );
}

export async function nextVisitNumber(tx: Prisma.TransactionClient, serviceOrderId: string) {
  await lockServiceOrderVisits(tx, serviceOrderId);
  const last = await tx.serviceVisit.findFirst({
    where: { serviceOrderId },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  return (last?.number || 0) + 1;
}

export async function createInitialVisit(
  tx: Prisma.TransactionClient,
  input: {
    serviceOrderId: string;
    status?: string | null;
    kind?: string;
    scheduledStart?: Date | null;
    scheduledTime?: string | null;
    technicianIds?: string[];
    changedById?: string | null;
  },
) {
  const existing = await tx.serviceVisit.findFirst({
    where: { serviceOrderId: input.serviceOrderId },
    orderBy: { number: "desc" },
  });
  if (existing) return existing;

  const scheduledStart = input.scheduledStart ? new Date(input.scheduledStart) : null;
  if (scheduledStart && input.scheduledTime) {
    const [hours, minutes] = input.scheduledTime.split(":").map(Number);
    if (Number.isFinite(hours) && Number.isFinite(minutes)) scheduledStart.setHours(hours, minutes, 0, 0);
  }
  const scheduledEnd = scheduledStart ? new Date(scheduledStart.getTime() + 60 * 60_000) : null;
  const visitStatus = visitStatusFromLegacyOS(input.status);

  return tx.serviceVisit.create({
    data: {
      serviceOrderId: input.serviceOrderId,
      number: 1,
      kind: input.kind || "ATENDIMENTO",
      status: visitStatus,
      scheduledStart,
      scheduledEnd,
      result: visitStatus === "CONCLUIDA" ? "RESOLVIDO" : null,
      technicians: input.technicianIds?.length
        ? { create: [...new Set(input.technicianIds)].map((userId) => ({ userId })) }
        : undefined,
      statusHistory: {
        create: {
          oldStatus: "NENHUM",
          newStatus: visitStatus,
          changedById: input.changedById || null,
          justification: "Primeira visita criada junto com a ordem de serviço.",
        },
      },
    },
  });
}
