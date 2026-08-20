"use server";

import { prisma } from "@/lib/db";
import { requireAuth, AuthError } from "@/lib/auth";
import { cookies } from "next/headers";
import {
  encryptSession,
  SessionPayload,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/session";
import { createBackup, listBackups } from "@/lib/backup";
import { getMaintenanceStatus, setMaintenanceMode } from "@/lib/maintenance";
import { revalidatePath } from "next/cache";
import { verifyPassword as passwordMatches, hashPassword, generateSalt } from "@/lib/crypto";

/**
 * Autenticação dedicada no Portal do Desenvolvedor (/dev/login)
 */
export async function devLoginAction(email: string, password: string) {
  try {
    const emailClean = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: emailClean },
      include: { role: true },
    });

    if (!user) {
      return { success: false as const, error: "Credenciais inválidas." };
    }

    const roleName = user.role?.name || "";
    let permissions: string[] = [];
    try {
      permissions = JSON.parse(user.permissions);
    } catch {
      permissions = [];
    }

    const isDev = roleName === "Desenvolvedor" || roleName === "SuperAdmin" || permissions.includes("dev.all");
    if (!isDev) {
      return {
        success: false as const,
        error: "Acesso negado: Este portal é restrito exclusivamente ao perfil Desenvolvedor.",
      };
    }

    let isValid = false;
    if (user.salt) {
      isValid = passwordMatches(password, user.salt, user.password);
    } else {
      isValid = user.password === password;
    }

    if (!isValid) {
      return { success: false as const, error: "Credenciais inválidas." };
    }

    const payload: SessionPayload = {
      userId: user.id,
      name: user.name,
      email: user.email,
      roleName: user.role?.name || "Desenvolvedor",
      permissions: permissions.includes("dev.all") ? permissions : [...permissions, "dev.all", "admin.all"],
      exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
    };

    const token = await encryptSession(payload);
    const store = await cookies();
    store.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    return { success: true as const, user: payload };
  } catch (err: any) {
    return { success: false as const, error: err.message || "Erro de autenticação no portal dev." };
  }
}

/**
 * Garante que o usuário da requisição seja do perfil Desenvolvedor
 */
async function requireDevPermission() {
  const session = await requireAuth();
  const isDev = session.roleName === "Desenvolvedor" || session.roleName === "SuperAdmin" || session.permissions.includes("dev.all");
  if (!isDev) {
    throw new AuthError("SEM_PERMISSAO", "Acesso restrito ao Console do Desenvolvedor.");
  }
  return session;
}

/**
 * Telemetria de saúde do sistema e métricas do banco de dados
 */
export async function getDevSystemHealthAction() {
  try {
    await requireDevPermission();

    const startTime = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbLatencyMs = Date.now() - startTime;

    const [userCount, clientCount, osCount, invoiceCount, nfseCount, errorCount] = await Promise.all([
      prisma.user.count(),
      prisma.client.count(),
      prisma.serviceOrder.count(),
      prisma.invoice.count(),
      prisma.nfseRecord.count(),
      prisma.errorReport.count({ where: { status: "OPEN" } }),
    ]);

    const maintenance = await getMaintenanceStatus();
    const backups = await listBackups();

    return {
      success: true as const,
      health: {
        status: "OPERACIONAL",
        dbLatencyMs,
        userCount,
        clientCount,
        osCount,
        invoiceCount,
        nfseCount,
        openErrorsCount: errorCount,
        backupCount: backups.length,
        maintenanceActive: maintenance.isMaintenanceActive,
        lastAutoCheck: maintenance.lastAutoUpdateCheck,
        environment: process.env.NODE_ENV || "production",
        nodeVersion: process.version,
      },
    };
  } catch (err: any) {
    return { success: false as const, error: err.message || "Erro ao obter telemetria." };
  }
}

/**
 * Carrega a lista de licenciados / empresas do ERP
 */
export async function getDevLicensingAction() {
  try {
    await requireDevPermission();

    const setting = await prisma.setting.findUnique({
      where: { key: "dev.licensing.tenants" },
    });

    const defaultLicensing = [
      {
        id: "tenant-primary",
        cnpj: "12.345.678/0001-99",
        companyName: "Nexus Climatização e Serviços Ltda",
        plan: "ENTERPRISE",
        status: "ATIVO",
        maxUsers: 50,
        expiresAt: "2030-12-31",
        createdAt: "2026-01-01",
      },
    ];

    const tenants = setting ? JSON.parse(setting.value) : defaultLicensing;
    return { success: true as const, tenants };
  } catch (err: any) {
    return { success: false as const, error: err.message || "Erro ao carregar licenciados." };
  }
}

/**
 * Salva ou atualiza a lista de empresas licenciadas do ERP
 */
export async function saveDevLicensingAction(tenants: any[]) {
  try {
    await requireDevPermission();

    await prisma.setting.upsert({
      where: { key: "dev.licensing.tenants" },
      update: { value: JSON.stringify(tenants) },
      create: { key: "dev.licensing.tenants", value: JSON.stringify(tenants) },
    });

    revalidatePath("/dev");
    return { success: true as const };
  } catch (err: any) {
    return { success: false as const, error: err.message || "Erro ao salvar licenciamento." };
  }
}

/**
 * Dispara um backup manual snapshot via console do desenvolvedor
 */
export async function triggerDevBackupAction() {
  try {
    await requireDevPermission();
    const backup = await createBackup("manual");
    revalidatePath("/dev");
    return { success: true as const, backup };
  } catch (err: any) {
    return { success: false as const, error: err.message || "Erro ao disparar backup." };
  }
}

/**
 * Carrega os logs de auditoria e relatórios de erro
 */
export async function getDevLogsAndErrorsAction() {
  try {
    await requireDevPermission();

    const [auditLogs, errorReports] = await Promise.all([
      prisma.auditLog.findMany({
        take: 30,
        orderBy: { timestamp: "desc" },
        include: { user: { select: { name: true, email: true } } },
      }),
      prisma.errorReport.findMany({
        take: 30,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true, email: true } } },
      }),
    ]);

    return {
      success: true as const,
      auditLogs,
      errorReports,
    };
  } catch (err: any) {
    return { success: false as const, error: err.message || "Erro ao carregar logs." };
  }
}
