import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { AsyncLocalStorage } from "node:async_hooks";
import { logger } from "./logger";

/**
 * Módulo de Conexão com o Banco de Dados PostgreSQL & Resiliência.
 *
 * Inclui:
 * 1. Connection Pool otimizado com health check e reconexão automática.
 * 2. Isolamento RLS por Tenant ID para prevenção de vazamento de dados.
 * 3. Enforce de SSL em produção.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
  tenantInstances: Map<string, { prisma: PrismaClient; pool: Pool }> | undefined;
};
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function createPrismaClient(explicitTenantId?: string): { prisma: PrismaClient; pool: Pool } {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL não definida. Configure a connection string do PostgreSQL (veja .env.example)."
    );
  }

  const tenantId = explicitTenantId || process.env.TENANT_ID || "00000000-0000-4000-8000-000000000001";
  if (!UUID_PATTERN.test(tenantId)) {
    throw new Error("TENANT_ID inválido. Informe um UUID válido para isolar os dados da empresa.");
  }

  const isProduction = process.env.NODE_ENV === "production";

  // Pool de conexões otimizado com timeout e reconexão automática
  const pool = new Pool({
    connectionString,
    max: isProduction ? 30 : 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    options: `-c app.tenant_id=${tenantId}`,
    ssl: isProduction && !connectionString.includes("sslmode=disable")
      ? { rejectUnauthorized: false }
      : undefined,
  });

  pool.on("error", (err) => {
    logger.error("Erro inesperado no Pool de Conexões do PostgreSQL:", err);
  });

  const adapter = new PrismaPg(pool);
  const prismaClient = new PrismaClient({
    adapter,
    log: isProduction ? ["error", "warn"] : ["error", "warn"],
  });

  return { prisma: prismaClient, pool };
}

const instance = globalForPrisma.prisma && globalForPrisma.pool
  ? { prisma: globalForPrisma.prisma, pool: globalForPrisma.pool }
  : createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = instance.prisma;
  globalForPrisma.pool = instance.pool;
}

const tenantContext = new AsyncLocalStorage<string>();
const tenantInstances = globalForPrisma.tenantInstances || new Map<string, { prisma: PrismaClient; pool: Pool }>();
if (process.env.NODE_ENV !== "production") globalForPrisma.tenantInstances = tenantInstances;

function tenantInstance(tenantId: string) {
  if (!UUID_PATTERN.test(tenantId)) throw new Error("Tenant inválido no contexto do banco.");
  const defaultTenant = process.env.TENANT_ID || "00000000-0000-4000-8000-000000000001";
  if (tenantId === defaultTenant) return instance;
  const cached = tenantInstances.get(tenantId);
  if (cached) return cached;
  const created = createPrismaClient(tenantId);
  tenantInstances.set(tenantId, created);
  return created;
}

/** Fixa todas as consultas seguintes da requisição em pools do mesmo tenant. */
export function enterTenantContext(tenantId: string) {
  if (!UUID_PATTERN.test(tenantId)) throw new Error("Tenant inválido no contexto da requisição.");
  tenantContext.enterWith(tenantId);
}

export function currentTenantContext() {
  return tenantContext.getStore() || process.env.TENANT_ID || "00000000-0000-4000-8000-000000000001";
}

export async function resolveLoginTenant(email: string): Promise<string | null> {
  const rows = await instance.prisma.$queryRawUnsafe<Array<{ tenantId: string }>>(
    "SELECT public.resolve_login_tenant($1)::text AS \"tenantId\"",
    email.trim().toLowerCase(),
  );
  return rows[0]?.tenantId || null;
}

// Mantém a API Prisma existente. A escolha do client ocorre no acesso a cada
// método e não no import do módulo, preservando as centenas de Actions atuais.
export const prisma = new Proxy(instance.prisma, {
  get(_target, property) {
    const selected = tenantInstance(currentTenantContext()).prisma as unknown as Record<PropertyKey, unknown>;
    const value = selected[property];
    return typeof value === "function" ? value.bind(selected) : value;
  },
}) as PrismaClient;
export const dbPool = instance.pool;

export async function disconnectDatabase() {
  const all = [instance, ...tenantInstances.values()];
  await Promise.allSettled(all.map((item) => item.prisma.$disconnect()));
  await Promise.allSettled(all.map((item) => item.pool.end()));
  tenantInstances.clear();
}

/**
 * Health check ativo do banco de dados.
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error("Health Check do Banco de Dados falhou:", error);
    return false;
  }
}
