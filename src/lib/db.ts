import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// O schema usa PostgreSQL nativo tanto no desenvolvimento quanto em produção.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
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
  // O contexto nasce na própria conexão PostgreSQL. As políticas RLS usam
  // app.tenant_id e continuam protegendo as linhas mesmo se uma query futura
  // esquecer um filtro na aplicação.
  const pool = new Pool({ connectionString, options: `-c app.tenant_id=${tenantId}` });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: ["error", "warn"],
  });
}

const prismaInstance = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prismaInstance;
}

export const prisma = prismaInstance;
