import { prisma } from "../src/lib/db";
import crypto from "crypto";

async function main() {
  console.log("Ajustando coluna tenantId e desativando manutenção...");
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Setting" ALTER COLUMN "tenantId" SET DEFAULT '00000000-0000-4000-8000-000000000001';
  `);
  await prisma.$executeRawUnsafe(`
    UPDATE "Setting" SET "tenantId" = '00000000-0000-4000-8000-000000000001' WHERE "tenantId" IS NULL;
  `);
  await prisma.$executeRawUnsafe(`
    DELETE FROM "Setting" WHERE key = 'system.maintenance.active';
  `);
  await prisma.$executeRawUnsafe(`
    INSERT INTO "Setting" ("id", "key", "value", "updatedAt", "tenantId") 
    VALUES ('${crypto.randomUUID()}', 'system.maintenance.active', 'false', NOW(), '00000000-0000-4000-8000-000000000001');
  `);
  console.log("Modo de manutenção desativado e tenantId corrigido com sucesso!");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
