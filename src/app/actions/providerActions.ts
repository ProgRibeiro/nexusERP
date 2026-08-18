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
  return error instanceof Error ? error.message : "Erro ao salvar prestador.";
}

export interface ProviderDetailsInput {
  name: string;
  tradeName?: string;
  cnpj: string;
  phone: string;
  email: string;
  ie?: string;
  specialty?: string;
  pixKey?: string;
  pixType?: string;
  bankName?: string;
  bankAgency?: string;
  bankAccount?: string;
  cep?: string;
  address?: string;
  city?: string;
  state?: string;
  notes?: string;
}

export async function getProvidersWorkspace() {
  await requireAuth();
  const [suppliers, jobs] = await Promise.all([
    prisma.supplier.findMany({
      include: {
        providerJobs: {
          include: {
            serviceOrder: { select: { code: true, status: true } },
            accountsPayable: { select: { id: true, status: true, dueDate: true, paymentDate: true } },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
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
    suppliers: suppliers.map((item) => {
      let extraData: Record<string, any> = {};
      if (item.notes) {
        try {
          if (item.notes.startsWith("{")) {
            extraData = JSON.parse(item.notes);
          }
        } catch {
          // Se não for JSON, trata como observação pura
        }
      }

      const totalJobs = item.providerJobs.length;
      const completedJobs = item.providerJobs.filter((j) => j.executionStatus === "CONCLUIDO").length;
      const totalEarned = item.providerJobs
        .filter((j) => j.executionStatus === "CONCLUIDO")
        .reduce((sum, j) => sum + Number(j.costValue), 0);

      return {
        ...item,
        tradeName: extraData.tradeName || "",
        ie: extraData.ie || "",
        specialty: extraData.specialty || "Climatização & Refrigeração",
        pixKey: extraData.pixKey || "",
        pixType: extraData.pixType || "CHAVE_PIX",
        bankName: extraData.bankName || "",
        bankAgency: extraData.bankAgency || "",
        bankAccount: extraData.bankAccount || "",
        cep: extraData.cep || "",
        address: extraData.address || "",
        city: extraData.city || "",
        state: extraData.state || "",
        customNotes: extraData.notes || (item.notes && !item.notes.startsWith("{") ? item.notes : ""),
        totalJobs,
        completedJobs,
        totalEarned,
      };
    }),
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

export async function createProvider(data: ProviderDetailsInput) {
  try {
    const session = await requirePermission("quotes.write");

    const name = data.name.trim();
    const cnpj = normalizeDocument(data.cnpj);
    const phone = data.phone.trim();
    const email = data.email.trim().toLowerCase();

    if (!name || !cnpj || !phone || !email) {
      return { success: false, error: "Preencha Nome/Razão Social, CPF/CNPJ, Telefone e E-mail." };
    }
    if (![11, 14].includes(cnpj.length)) {
      return { success: false, error: "Informe um CPF com 11 dígitos ou CNPJ com 14 dígitos." };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { success: false, error: "Informe um e-mail válido." };
    }

    const candidates = await prisma.supplier.findMany({ select: { id: true, name: true, cnpj: true } });
    const duplicate = candidates.find((item) => normalizeDocument(item.cnpj) === cnpj);
    if (duplicate) return { success: false, error: `Este CPF/CNPJ já pertence a ${duplicate.name}.` };

    const structuredNotes = JSON.stringify({
      tradeName: data.tradeName?.trim() || "",
      ie: data.ie?.trim() || "",
      specialty: data.specialty?.trim() || "Climatização",
      pixKey: data.pixKey?.trim() || "",
      pixType: data.pixType || "CHAVE_PIX",
      bankName: data.bankName?.trim() || "",
      bankAgency: data.bankAgency?.trim() || "",
      bankAccount: data.bankAccount?.trim() || "",
      cep: data.cep?.trim() || "",
      address: data.address?.trim() || "",
      city: data.city?.trim() || "",
      state: data.state?.trim() || "",
      notes: data.notes?.trim() || "",
    });

    const supplier = await prisma.$transaction(async (tx) => {
      const created = await tx.supplier.create({
        data: {
          name,
          cnpj,
          phone,
          email,
          notes: structuredNotes,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: session.userId,
          action: "CRIACAO",
          entity: "Prestador",
          entityId: created.id,
          changesJson: JSON.stringify({ name, cnpj, phone, email }),
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

export async function updateProviderDetails(id: string, data: ProviderDetailsInput) {
  try {
    const session = await requirePermission("quotes.write");
    const existing = await prisma.supplier.findUnique({ where: { id } });
    if (!existing) return { success: false, error: "Prestador não encontrado." };

    const name = data.name.trim();
    const cnpj = normalizeDocument(data.cnpj);
    const phone = data.phone.trim();
    const email = data.email.trim().toLowerCase();

    if (!name || !cnpj || !phone || !email) {
      return { success: false, error: "Preencha Nome/Razão Social, CPF/CNPJ, Telefone e E-mail." };
    }

    const structuredNotes = JSON.stringify({
      tradeName: data.tradeName?.trim() || "",
      ie: data.ie?.trim() || "",
      specialty: data.specialty?.trim() || "Climatização",
      pixKey: data.pixKey?.trim() || "",
      pixType: data.pixType || "CHAVE_PIX",
      bankName: data.bankName?.trim() || "",
      bankAgency: data.bankAgency?.trim() || "",
      bankAccount: data.bankAccount?.trim() || "",
      cep: data.cep?.trim() || "",
      address: data.address?.trim() || "",
      city: data.city?.trim() || "",
      state: data.state?.trim() || "",
      notes: data.notes?.trim() || "",
    });

    const updated = await prisma.supplier.update({
      where: { id },
      data: {
        name,
        cnpj,
        phone,
        email,
        notes: structuredNotes,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "ATUALIZACAO",
        entity: "Prestador",
        entityId: updated.id,
        changesJson: JSON.stringify({ name, cnpj, phone, email }),
      },
    });

    revalidatePath("/prestadores");
    return { success: true, supplier: updated };
  } catch (error: unknown) {
    logger.error("provider_update_failed", error);
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
