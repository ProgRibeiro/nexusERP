"use server";

import { prisma } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";

function normalizeDocument(value: string) {
  return value.replace(/\D/g, "");
}

function providerError(error: unknown) {
  const known = error as { code?: string; message?: string };
  if (known.code === "P2002") return "Este CPF/CNPJ já está cadastrado.";
  return error instanceof Error ? error.message : "Erro ao cadastrar prestador.";
}

export async function getProvidersWorkspace() {
  await requireAuth();
  const [suppliers, jobs] = await Promise.all([
    prisma.supplier.findMany({ orderBy: { name: "asc" } }),
    prisma.providerJob.findMany({
      include: {
        supplier: true,
        quote: { select: { code: true, client: { select: { name: true } } } },
        serviceOrder: { select: { code: true, status: true } },
        accountsPayable: { select: { id: true, status: true, dueDate: true, paymentDate: true } },
      },
      orderBy: [{ executionStatus: "asc" }, { createdAt: "desc" }],
    }),
  ]);

  return {
    suppliers: suppliers.map((item) => ({ ...item })),
    jobs: jobs.map((job) => ({
      id: job.id,
      supplierId: job.supplierId,
      supplierName: job.supplier.name,
      quoteCode: job.quote.code,
      osCode: job.serviceOrder.code,
      osStatus: job.serviceOrder.status,
      clientName: job.quote.client.name,
      description: job.description,
      quantity: job.quantity,
      unit: job.unit,
      costValue: Number(job.costValue),
      saleValue: Number(job.saleValue),
      profit: Number(job.saleValue) - Number(job.costValue),
      executionStatus: job.executionStatus,
      paymentStatus: job.accountsPayable?.status === "PAGO" ? "PAGO" : job.paymentStatus,
      scheduledDate: job.scheduledDate,
      completedAt: job.completedAt,
      paymentDueDate: job.accountsPayable?.dueDate || job.paymentDueDate,
      payableId: job.accountsPayableId,
      notes: job.notes,
    })),
  };
}

export async function getSuppliersForQuote() {
  await requireAuth();
  return prisma.supplier.findMany({
    select: { id: true, name: true, cnpj: true, phone: true },
    orderBy: { name: "asc" },
  });
}

export async function createProvider(data: { name: string; cnpj: string; phone: string; email: string; notes?: string }) {
  try {
    const session = await requirePermission("quotes.write");
    const normalized = {
      name: data.name.trim(),
      cnpj: normalizeDocument(data.cnpj),
      phone: data.phone.trim(),
      email: data.email.trim().toLowerCase(),
      notes: data.notes?.trim() || null,
    };
    if (!normalized.name || !normalized.cnpj || !normalized.phone || !normalized.email) {
      return { success: false, error: "Preencha nome, CPF/CNPJ, telefone e e-mail." };
    }
    if (![11, 14].includes(normalized.cnpj.length)) {
      return { success: false, error: "Informe um CPF com 11 dígitos ou CNPJ com 14 dígitos." };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.email)) {
      return { success: false, error: "Informe um e-mail válido." };
    }

    // Localiza também cadastros legados que guardaram pontuação no documento.
    const candidates = await prisma.supplier.findMany({ select: { id: true, name: true, cnpj: true } });
    const duplicate = candidates.find((item) => normalizeDocument(item.cnpj) === normalized.cnpj);
    if (duplicate) return { success: false, error: `Este CPF/CNPJ já pertence a ${duplicate.name}.` };

    // Cadastro e trilha de auditoria são atômicos: ou ambos são persistidos,
    // ou nenhum deles é gravado. Isso evita registros parciais e perda silenciosa.
    const supplier = await prisma.$transaction(async (tx) => {
      const created = await tx.supplier.create({ data: normalized });
      await tx.auditLog.create({
        data: {
          userId: session.userId,
          action: "CRIACAO",
          entity: "Prestador",
          entityId: created.id,
          changesJson: JSON.stringify({ name: created.name, cnpj: created.cnpj, phone: created.phone, email: created.email }),
        },
      });
      return created;
    });
    revalidatePath("/prestadores");
    revalidatePath("/orcamentos");
    return { success: true, supplier };
  } catch (error: unknown) {
    logger.error("provider_create_failed", error);
    return { success: false, error: providerError(error) };
  }
}

export async function updateProviderJob(data: {
  id: string;
  executionStatus?: string;
  scheduledDate?: string | null;
  paymentDueDate?: string | null;
  notes?: string;
}) {
  await requirePermission("os.write");
  const current = await prisma.providerJob.findUnique({ where: { id: data.id } });
  if (!current) return { success: false, error: "Serviço do prestador não encontrado." };
  const status = data.executionStatus || current.executionStatus;
  const job = await prisma.providerJob.update({
    where: { id: data.id },
    data: {
      executionStatus: status,
      scheduledDate: data.scheduledDate === undefined ? undefined : data.scheduledDate ? new Date(data.scheduledDate) : null,
      paymentDueDate: data.paymentDueDate === undefined ? undefined : data.paymentDueDate ? new Date(data.paymentDueDate) : null,
      notes: data.notes,
      completedAt: status === "CONCLUIDO" ? current.completedAt || new Date() : status === "CANCELADO" ? null : undefined,
      paymentStatus: status === "CONCLUIDO" && current.paymentStatus === "BLOQUEADO" ? "LIBERADO" : undefined,
    },
  });
  revalidatePath("/prestadores");
  return { success: true, job };
}

export async function generateProviderPayable(jobId: string, dueDate?: string) {
  await requirePermission("financeiro.write");
  try {
    const result = await prisma.$transaction(async (tx) => {
      const job = await tx.providerJob.findUnique({ where: { id: jobId }, include: { supplier: true, serviceOrder: true } });
      if (!job) throw new Error("Serviço do prestador não encontrado.");
      if (job.executionStatus !== "CONCLUIDO") throw new Error("Conclua a execução antes de liberar o pagamento.");
      if (job.accountsPayableId) return job;
      const payable = await tx.accountsPayable.create({
        data: {
          providerName: job.supplier.name,
          serviceOrderId: job.serviceOrderId,
          description: `${job.description} · ${job.serviceOrder.code}`,
          category: "OUTROS",
          costCenter: "OPERACIONAL",
          value: job.costValue,
          dueDate: dueDate ? new Date(dueDate) : job.paymentDueDate || new Date(),
        },
      });
      return tx.providerJob.update({ where: { id: job.id }, data: { accountsPayableId: payable.id, paymentStatus: "LIBERADO" } });
    });
    revalidatePath("/prestadores");
    revalidatePath("/financeiro");
    return { success: true, job: result };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Erro ao gerar conta a pagar." };
  }
}
