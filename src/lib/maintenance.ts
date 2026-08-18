import { prisma } from "@/lib/db";

export interface ScheduledUpdateInfo {
  scheduledAt: string; // ISO Date string
  title: string;
  description: string;
  isMaintenanceRequired: boolean;
  estimatedDurationMinutes: number;
}

export interface MaintenanceStatus {
  isMaintenanceActive: boolean;
  maintenanceReason: string | null;
  scheduledUpdate: ScheduledUpdateInfo | null;
  lastAutoUpdateCheck: string | null;
  autoUpdateIntervalHours: number;
}

const SETTING_MAINTENANCE_ACTIVE = "system.maintenance.active";
const SETTING_MAINTENANCE_REASON = "system.maintenance.reason";
const SETTING_SCHEDULED_UPDATE = "system.maintenance.scheduled_update";
const SETTING_LAST_AUTO_UPDATE_CHECK = "system.maintenance.last_check";

export async function getMaintenanceStatus(): Promise<MaintenanceStatus> {
  try {
    const settings = await prisma.setting.findMany({
      where: {
        key: {
          in: [
            SETTING_MAINTENANCE_ACTIVE,
            SETTING_MAINTENANCE_REASON,
            SETTING_SCHEDULED_UPDATE,
            SETTING_LAST_AUTO_UPDATE_CHECK,
          ],
        },
      },
    });

    const settingsMap = new Map(settings.map((s) => [s.key, s.value]));

    const isMaintenanceActive = settingsMap.get(SETTING_MAINTENANCE_ACTIVE) === "true";
    const maintenanceReason = settingsMap.get(SETTING_MAINTENANCE_REASON) || null;

    let scheduledUpdate: ScheduledUpdateInfo | null = null;
    const rawScheduled = settingsMap.get(SETTING_SCHEDULED_UPDATE);
    if (rawScheduled) {
      try {
        scheduledUpdate = JSON.parse(rawScheduled) as ScheduledUpdateInfo;
      } catch {
        scheduledUpdate = null;
      }
    }

    const lastAutoUpdateCheck = settingsMap.get(SETTING_LAST_AUTO_UPDATE_CHECK) || null;

    return {
      isMaintenanceActive,
      maintenanceReason,
      scheduledUpdate,
      lastAutoUpdateCheck,
      autoUpdateIntervalHours: 3,
    };
  } catch (err) {
    console.error("[Maintenance] Erro ao carregar status de manutenção:", err);
    return {
      isMaintenanceActive: false,
      maintenanceReason: null,
      scheduledUpdate: null,
      lastAutoUpdateCheck: null,
      autoUpdateIntervalHours: 3,
    };
  }
}

export async function setMaintenanceMode(enabled: boolean, reason?: string) {
  await prisma.setting.upsert({
    where: { key: SETTING_MAINTENANCE_ACTIVE },
    create: { key: SETTING_MAINTENANCE_ACTIVE, value: enabled ? "true" : "false" },
    update: { value: enabled ? "true" : "false" },
  });

  if (reason !== undefined) {
    await prisma.setting.upsert({
      where: { key: SETTING_MAINTENANCE_REASON },
      create: { key: SETTING_MAINTENANCE_REASON, value: reason },
      update: { value: reason },
    });
  }
}

export async function scheduleMajorUpdate(info: ScheduledUpdateInfo | null) {
  const value = info ? JSON.stringify(info) : "";
  await prisma.setting.upsert({
    where: { key: SETTING_SCHEDULED_UPDATE },
    create: { key: SETTING_SCHEDULED_UPDATE, value },
    update: { value },
  });
}

export async function recordAutoUpdateCheckTimestamp() {
  const now = new Date().toISOString();
  await prisma.setting.upsert({
    where: { key: SETTING_LAST_AUTO_UPDATE_CHECK },
    create: { key: SETTING_LAST_AUTO_UPDATE_CHECK, value: now },
    update: { value: now },
  });
  return now;
}
