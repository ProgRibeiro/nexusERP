"use server";

import { requireAuth, requirePermission } from "@/lib/auth";
import {
  getMaintenanceStatus,
  setMaintenanceMode,
  scheduleMajorUpdate,
  recordAutoUpdateCheckTimestamp,
  ScheduledUpdateInfo,
} from "@/lib/maintenance";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getMaintenanceStatusAction() {
  await requireAuth();
  return getMaintenanceStatus();
}

export async function toggleMaintenanceModeAction(enabled: boolean, reason?: string) {
  try {
    const session = await requirePermission("admin.all");

    await setMaintenanceMode(enabled, reason || "Manutenção programada no sistema.");

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: enabled ? "ATIVACAO_MANUTENCAO" : "DESATIVACAO_MANUTENCAO",
        entity: "Sistema",
        entityId: "system.maintenance",
        changesJson: JSON.stringify({ enabled, reason }),
      },
    });

    revalidatePath("/");
    revalidatePath("/configuracoes");
    return { success: true as const };
  } catch (error: unknown) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Erro ao alterar modo de manutenção.",
    };
  }
}

export async function saveScheduledMajorUpdateAction(input: ScheduledUpdateInfo | null) {
  try {
    const session = await requirePermission("admin.all");

    await scheduleMajorUpdate(input);

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "AGENDAMENTO_UPDATE_GRANDE",
        entity: "Sistema",
        entityId: "system.maintenance.scheduled_update",
        changesJson: JSON.stringify(input),
      },
    });

    revalidatePath("/");
    revalidatePath("/configuracoes");
    return { success: true as const };
  } catch (error: unknown) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Erro ao agendar atualização grande.",
    };
  }
}

export async function triggerAutoUpdateCheckAction() {
  try {
    const session = await requirePermission("admin.all");
    const timestamp = await recordAutoUpdateCheckTimestamp();

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "CHECK_AUTONOMO_3H",
        entity: "Sistema",
        entityId: "system.maintenance.auto_update",
        changesJson: JSON.stringify({ timestamp, manualTrigger: true }),
      },
    });

    revalidatePath("/configuracoes");
    return { success: true as const, timestamp };
  } catch (error: unknown) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Erro ao registrar verificação de atualização.",
    };
  }
}
