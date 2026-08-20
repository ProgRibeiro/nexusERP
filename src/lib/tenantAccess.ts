import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export const DEFAULT_TENANT_ID = "00000000-0000-4000-8000-000000000001";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isMissingTenantAccessTable(error: unknown) {
  if (!(error instanceof Error)) return false;
  return error.message.includes("UserTenantAccess") && error.message.includes("does not exist");
}

export function resolveTenantFallback(tenantId?: string) {
  const candidate = tenantId || process.env.TENANT_ID || DEFAULT_TENANT_ID;
  if (!UUID_PATTERN.test(candidate)) {
    throw new Error("Tenant inválido. Configure TENANT_ID com um UUID válido.");
  }
  return candidate;
}

export async function resolvePrimaryTenantForUser(userId: string, fallbackTenantId?: string) {
  try {
    const rows = await prisma.$queryRaw<Array<{ tenantId: string }>>`
      SELECT "tenantId"::text AS "tenantId"
      FROM "UserTenantAccess"
      WHERE "userId" = ${userId}
        AND "active" = true
      ORDER BY "isDefault" DESC, "createdAt" ASC
      LIMIT 1
    `;
    const tenantId = rows[0]?.tenantId;
    return resolveTenantFallback(tenantId || fallbackTenantId);
  } catch (error) {
    if (isMissingTenantAccessTable(error)) {
      logger.warn("tenant_access_table_missing", { userId });
      return resolveTenantFallback(fallbackTenantId);
    }
    throw error;
  }
}

export async function ensureUserTenantAccess(userId: string, tenantId: string) {
  try {
    const rows = await prisma.$queryRaw<Array<{ hasAccess: number }>>`
      SELECT 1::int AS "hasAccess"
      FROM "UserTenantAccess"
      WHERE "userId" = ${userId}
        AND "tenantId" = ${tenantId}::uuid
        AND "active" = true
      LIMIT 1
    `;
    return rows.length > 0 && rows[0]?.hasAccess === 1;
  } catch (error) {
    if (isMissingTenantAccessTable(error)) {
      logger.warn("tenant_access_table_missing", { userId, tenantId });
      return false;
    }
    throw error;
  }
}

export async function bindUserToTenant(userId: string, tenantId?: string) {
  const resolvedTenantId = resolveTenantFallback(tenantId);
  try {
    await prisma.$executeRaw`
      INSERT INTO "UserTenantAccess" ("userId", "tenantId", "isDefault", "active")
      VALUES (${userId}, ${resolvedTenantId}::uuid, true, true)
      ON CONFLICT ("userId", "tenantId")
      DO UPDATE SET "active" = true
    `;
  } catch (error) {
    if (isMissingTenantAccessTable(error)) {
      logger.warn("tenant_access_table_missing", { userId, tenantId: resolvedTenantId });
      return;
    }
    throw error;
  }
}

export async function getTenantUserIds(tenantId?: string): Promise<string[]> {
  const resolvedTenantId = resolveTenantFallback(tenantId);

  try {
    const rows = await prisma.$queryRaw<Array<{ userId: string }>>`
      SELECT "userId"::text AS "userId"
      FROM "UserTenantAccess"
      WHERE "tenantId" = ${resolvedTenantId}::uuid
        AND "active" = true
    `;
    return rows.map((row) => row.userId);
  } catch (error) {
    if (isMissingTenantAccessTable(error)) {
      logger.warn("tenant_access_table_missing", { tenantId: resolvedTenantId });
      return [];
    }
    throw error;
  }
}

export async function tenantScopedUserFilter(tenantId?: string, allowPlatformWideAccess = false) {
  if (allowPlatformWideAccess) {
    return {};
  }

  const tenantUserIds = await getTenantUserIds(tenantId);
  return {
    id: { in: tenantUserIds.length > 0 ? tenantUserIds : ["00000000-0000-0000-0000-000000000000"] },
  };
}
