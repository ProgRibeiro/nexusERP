"use server";

import { requirePermission } from "@/lib/auth";
import { createBackup, listBackups } from "@/lib/backup";
import { logger } from "@/lib/logger";

export async function triggerBackupAction() {
  try {
    await requirePermission("admin.all");
    const backup = await createBackup("manual");
    return {
      success: true,
      fileName: backup.fileName,
      sizeBytes: backup.sizeBytes,
      sha256: backup.sha256,
      remoteUploaded: backup.remoteUploaded,
    };
  } catch (error) {
    logger.error("manual_backup_failed", error);
    return { success: false, error: error instanceof Error ? error.message : "Erro desconhecido." };
  }
}

export async function getBackupStatusAction() {
  try {
    await requirePermission("admin.all");
    return { success: true, backups: listBackups(10) };
  } catch (error) {
    return { success: false, backups: [], error: error instanceof Error ? error.message : "Erro desconhecido." };
  }
}
