"use server";

import { logger } from "@/lib/logger";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";

export interface NotificationDTO {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  link: string | null;
  createdAt: Date;
}

/**
 * Obtém todas as notificações pendentes (não lidas primeiro)
 */
export async function getNotifications(): Promise<NotificationDTO[]> {
  try {
    await requireAuth();

    const notifications = await prisma.notification.findMany({
      orderBy: [
        { read: "asc" },
        { createdAt: "desc" },
      ],
      take: 20,
    });
    return notifications;
  } catch (error) {
    logger.error("Erro ao carregar notificações:", error);
    return [];
  }
}

/**
 * Marca uma notificação como lida
 */
export async function markNotificationAsRead(id: string) {
  try {
    await requireAuth();

    await prisma.notification.update({
      where: { id },
      data: { read: true },
    });
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    logger.error(`Erro ao marcar notificação ${id} como lida:`, error);
    return { success: false, error };
  }
}

/**
 * Marca todas as notificações como lidas
 */
export async function markAllNotificationsAsRead() {
  try {
    await requireAuth();

    await prisma.notification.updateMany({
      where: { read: false },
      data: { read: true },
    });
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    logger.error("Erro ao marcar todas as notificações como lidas:", error);
    return { success: false };
  }
}
