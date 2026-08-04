import { Prisma } from "@prisma/client";

/**
 * Gera códigos sequenciais dentro da mesma transação que cria o registro.
 * O UPSERT do PostgreSQL elimina a colisão existente no padrão count()+1.
 */
export async function nextServiceOrderCode(
  tx: Prisma.TransactionClient,
  year = new Date().getFullYear(),
) {
  const key = `SERVICE_ORDER:${year}`;
  const prefix = `OS-${year}-`;
  const rows = await tx.$queryRaw<Array<{ value: number }>>(Prisma.sql`
    INSERT INTO "SequenceCounter" ("key", "value", "updatedAt")
    VALUES (
      ${key},
      COALESCE(
        (
          SELECT MAX(NULLIF(split_part("code", '-', 3), '')::integer) + 1
          FROM "ServiceOrder"
          WHERE "code" LIKE ${`${prefix}%`}
        ),
        1
      ),
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("key") DO UPDATE
      SET "value" = "SequenceCounter"."value" + 1,
          "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "value"
  `);

  const value = Number(rows[0]?.value || 1);
  return `${prefix}${String(value).padStart(4, "0")}`;
}
