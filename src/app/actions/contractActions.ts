"use server";

import { logger } from "@/lib/logger";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAuth, requirePermission } from "@/lib/auth";
import { contractCreateSchema } from "@/lib/schemas";

export interface ContractDTO {
  id: string;
  code: string;
  clientId: string;
  clientName: string;
  value: number;
  billingPeriod: string;
  startDate: Date;
  endDate: Date;
  status: string;
  notes: string | null;
  nextMaintenanceDate: Date | null;
  items: { id: string; description: string; quantity: number; unitPrice: number }[];
}

function calculateNextMaintenanceDate(startDate: Date, endDate: Date, billingPeriod: string, status: string) {
  if (status !== "ATIVO") return null;
  const months = billingPeriod === "ANUAL" ? 12 : billingPeriod === "TRIMESTRAL" ? 3 : 1;
  const next = new Date(startDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  while (next < today) next.setMonth(next.getMonth() + months);
  return next <= endDate ? next : null;
}

/**
 * Obtém todos os contratos cadastrados
 */
export async function getContracts(): Promise<ContractDTO[]> {
  try {
    await requireAuth();

    const list = await prisma.contract.findMany({
      include: { client: true, items: true },
      orderBy: { code: "desc" },
    });

    return list.map((c) => ({
      id: c.id,
      code: c.code,
      clientId: c.clientId,
      clientName: c.client.name,
      value: Number(c.value),
      billingPeriod: c.billingPeriod,
      startDate: c.startDate,
      endDate: c.endDate,
      status: c.status,
      notes: c.notes,
      nextMaintenanceDate: calculateNextMaintenanceDate(c.startDate, c.endDate, c.billingPeriod, c.status),
      items: c.items.map((item) => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
      })),
    }));
  } catch (error) {
    logger.error("Erro ao obter contratos:", error);
    return [];
  }
}

/**
 * Cadastra um novo contrato recorrente
 */
export async function createContract(
  data: {
    clientId: string;
    value: number;
    billingPeriod: string; // MENSAL, TRIMESTRAL, ANUAL
    startDate: Date;
    endDate: Date;
    notes?: string;
    items: { description: string; quantity: number; unitPrice: number }[];
  },
  userId: string
) {
  try {
    const session = await requirePermission("contratos.write");
    userId = session.userId; // nunca confiar no valor vindo do client
    const parsed = contractCreateSchema.parse(data);
    if (parsed.endDate < parsed.startDate) throw new Error("O vencimento não pode ser anterior ao início do contrato.");

    const count = await prisma.contract.count();
    const code = `C-2026-${String(count + 1).padStart(4, "0")}`;

    const contract = await prisma.contract.create({
      data: {
        code,
        clientId: data.clientId,
        value: data.value,
        billingPeriod: data.billingPeriod,
        startDate: data.startDate,
        endDate: data.endDate,
        notes: data.notes || null,
        status: "ATIVO",
        items: {
          create: data.items.map((i) => ({
            description: i.description,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
          })),
        },
      },
    });

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        userId,
        action: "CRIACAO",
        entity: "Contrato",
        entityId: contract.id,
        changesJson: JSON.stringify(contract),
      },
    });

    revalidatePath("/contratos");
    return { success: true, contract };
  } catch (error: any) {
    logger.error("Erro ao cadastrar contrato:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Atualiza a proposta do contrato sem alterar OS e cobranças já geradas.
 * O escopo atualizado passa a valer somente para as próximas recorrências.
 */
export async function updateContract(
  contractId: string,
  data: {
    clientId: string;
    value: number;
    billingPeriod: string;
    startDate: Date;
    endDate: Date;
    notes?: string;
    items: { description: string; quantity: number; unitPrice: number }[];
  }
) {
  try {
    const session = await requirePermission("contratos.write");
    const parsed = contractCreateSchema.parse(data);
    if (parsed.endDate < parsed.startDate) throw new Error("O vencimento não pode ser anterior ao início do contrato.");

    const previous = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { items: true },
    });
    if (!previous) throw new Error("Contrato não encontrado.");

    const updated = await prisma.$transaction(async (tx) => {
      const contract = await tx.contract.update({
        where: { id: contractId },
        data: {
          clientId: parsed.clientId,
          value: parsed.value,
          billingPeriod: parsed.billingPeriod,
          startDate: parsed.startDate,
          endDate: parsed.endDate,
          notes: parsed.notes || null,
          items: {
            deleteMany: {},
            create: parsed.items.map((item) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
            })),
          },
        },
        include: { items: true },
      });

      await tx.auditLog.create({
        data: {
          userId: session.userId,
          action: "ATUALIZACAO",
          entity: "Contrato",
          entityId: contractId,
          changesJson: JSON.stringify({ before: previous, after: contract }),
        },
      });
      return contract;
    });

    revalidatePath("/contratos");
    return { success: true, contract: updated };
  } catch (error: unknown) {
    logger.error("Erro ao atualizar contrato:", error);
    const message = error instanceof Error ? error.message : "Não foi possível atualizar o contrato.";
    return { success: false, error: message };
  }
}

/**
 * Simula o disparo periódico (Cron Job) de cobrança recorrente e geração de OS preventiva
 * REGRAS DE NEGÓCIO EXIGIDAS:
 * 1. Gera contas a receber automático da parcela mensal do contrato.
 * 2. Gera ordem de serviço preventiva automaticamente vinculada.
 * 3. Grava log de auditoria do cron.
 */
export async function triggerRecurrencyBilling(contractId: string, userId: string) {
  try {
    const session = await requirePermission("contratos.write");
    userId = session.userId; // nunca confiar no valor vindo do client

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        client: {
          include: {
            addresses: true,
            contacts: true,
          },
        },
        items: true,
        serviceOrders: true,
      },
    });

    if (!contract) throw new Error("Contrato não encontrado.");
    if (contract.status !== "ATIVO") throw new Error("Apenas contratos ATIVOS geram recorrências.");

    // Encontrar endereço de execução padrão do cliente
    const defaultAddress = contract.client.addresses[0];
    if (!defaultAddress) throw new Error("O cliente contratante não possui nenhum endereço cadastrado. Insira um endereço fiscal/execução.");

    const result = await prisma.$transaction(async (tx) => {
      // 1. Gerar Ordem de Serviço Preventiva Automática
      const osCount = await tx.serviceOrder.count();
      const osCode = `OS-PREV-${String(osCount + 1).padStart(4, "0")}`;

      const scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() + 5); // Agenda para 5 dias após disparo

      const os = await tx.serviceOrder.create({
        data: {
          code: osCode,
          clientId: contract.clientId,
          contractId: contract.id,
          addressId: defaultAddress.id,
          contactId: contract.client.contacts[0]?.id || null,
          status: "CRIADA",
          priority: "MEDIA",
          type: "PREVENTIVA",
          problemReported: `Preventiva automática gerada conforme contrato recorrente ${contract.code}.\n\nServiços previstos:\n${contract.items
            .map((i) => `- ${i.description} (${i.quantity}x)`)
            .join("\n")}`,
          notes: "Serviço com cobrança inclusa na mensalidade contratual.",
          scheduledDate,
          scheduledTime: "09:00",
        },
      });

      // Copiar itens do contrato como ServiceOrderItems
      const osItems = contract.items.map((i) => ({
        serviceOrderId: os.id,
        description: i.description,
        quantity: i.quantity,
        unit: "UN",
        unitPrice: i.unitPrice,
        total: i.quantity * Number(i.unitPrice),
      }));

      if (osItems.length > 0) {
        await tx.serviceOrderItem.createMany({
          data: osItems,
        });
      }

      // 2. Gerar Fatura no Contas a Receber
      const count = await tx.accountsReceivable.count();
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 10); // 10 dias para pagar a fatura do mês

      const receivable = await tx.accountsReceivable.create({
        data: {
          clientId: contract.clientId,
          totalValue: contract.value,
          receivedValue: 0.0,
          pendingValue: contract.value,
          dueDate,
          status: "ABERTO",
          category: "CONTRATO",
          costCenter: "GERAL",
          notes: `Mensalidade contratual automática - Contrato ${contract.code} - OS vinculada: ${osCode}`,
        },
      });

      // 3. Registrar histórico na OS
      await tx.serviceOrderStatusHistory.create({
        data: {
          serviceOrderId: os.id,
          oldStatus: "NENHUM",
          newStatus: "CRIADA",
          changedById: userId,
          justification: `OS de manutenção preventiva mensal gerada automaticamente pelo motor de recorrência do Contrato ${contract.code}.`,
        },
      });

      // 4. Emitir notificações
      await tx.notification.create({
        data: {
          title: "Recorrência Disparada",
          message: `Gerada cobrança (R$ ${contract.value.toFixed(2)}) e OS Preventiva (${osCode}) para o contrato ${
            contract.code
          } - ${contract.client.name}.`,
          type: "OPERACIONAL",
          link: "/ordens-servico",
        },
      });

      return { os, receivable };
    });

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        userId,
        action: "APROVACAO",
        entity: "Contrato",
        entityId: contractId,
        changesJson: JSON.stringify({
          action: "Processamento de Recorrência Automática (Cron)",
          osId: result.os.id,
          receivableId: result.receivable.id,
        }),
      },
    });

    revalidatePath("/contratos");
    revalidatePath("/ordens-servico");
    revalidatePath("/financeiro");
    revalidatePath("/");

    return { success: true, os: result.os, receivable: result.receivable };
  } catch (error: any) {
    logger.error("Erro ao rodar recorrência de contrato:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Dispara o faturamento e a preventiva em lote para TODOS os contratos ATIVOS.
 */
export async function triggerAllActiveRecurrences(userId: string) {
  try {
    const session = await requirePermission("contratos.write");
    userId = session.userId; // nunca confiar no valor vindo do client

    const activeContracts = await prisma.contract.findMany({
      where: { status: "ATIVO" },
      select: { id: true, code: true }
    });

    if (activeContracts.length === 0) {
      return { success: true, count: 0, message: "Nenhum contrato ativo para processar." };
    }

    let processedCount = 0;
    let errors: string[] = [];

    for (const contract of activeContracts) {
      const res = await triggerRecurrencyBilling(contract.id, userId);
      if (res.success) {
        processedCount++;
      } else {
        errors.push(`Contrato ${contract.code}: ${res.error}`);
      }
    }

    return {
      success: true,
      count: processedCount,
      total: activeContracts.length,
      errors
    };
  } catch (error: any) {
    logger.error("Erro ao rodar lote de recorrências:", error);
    return { success: false, error: error.message };
  }
}
