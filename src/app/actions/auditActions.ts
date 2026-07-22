"use server";

import { logger } from "@/lib/logger";

import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

export interface AuditLogDTO {
  id: string;
  userName: string;
  userEmail: string;
  roleName: string;
  action: string;
  entity: string;
  entityId: string;
  changesJson: string;
  timestamp: Date;
}

/**
 * Obtém todos os logs de auditoria do sistema
 */
export async function getAuditLogs(): Promise<AuditLogDTO[]> {
  try {
    // Logs de auditoria expõem quem fez o quê no sistema todo — restrito a Administrador.
    await requirePermission("admin.all");

    const logs = await prisma.auditLog.findMany({
      include: {
        user: {
          include: {
            role: true,
          },
        },
      },
      orderBy: { timestamp: "desc" },
      take: 200, // limite para performance
    });

    return logs.map((log) => ({
      id: log.id,
      userName: log.user?.name || "Sistema / Autopass",
      userEmail: log.user?.email || "cron@nxerp.io",
      roleName: log.user?.role?.name || "Motor Interno",
      action: log.action,
      entity: log.entity,
      entityId: log.entityId,
      changesJson: log.changesJson,
      timestamp: log.timestamp,
    }));
  } catch (error) {
    logger.error("Erro ao obter logs de auditoria:", error);
    return [];
  }
}
