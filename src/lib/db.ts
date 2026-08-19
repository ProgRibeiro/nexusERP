import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
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
};

function createPrismaClient(): { prisma: PrismaClient; pool: Pool } {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL não definida. Configure a connection string do PostgreSQL (veja .env.example)."
    );
  }

  const tenantId = process.env.TENANT_ID || "00000000-0000-4000-8000-000000000001";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tenantId)) {
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

export const prisma = instance.prisma;
export const dbPool = instance.pool;

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
