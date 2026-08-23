import "dotenv/config";
import pg from "pg";

const { Client } = pg;
const connectionString = (process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL || "").replace(/\?schema=[^&]+/, "");
if (!connectionString) throw new Error("DATABASE_URL não configurada.");

const PRIMARY = process.env.TENANT_ID || "00000000-0000-4000-8000-000000000001";
const SECONDARY = "10000000-0000-4000-8000-000000000002";
const db = new Client({ connectionString });

await db.connect();
try {
  await db.query("BEGIN");
  await db.query(`CREATE ROLE nexus_tenant_foundation_probe NOLOGIN NOSUPERUSER NOBYPASSRLS`);
  await db.query(`GRANT USAGE ON SCHEMA public TO nexus_tenant_foundation_probe`);
  await db.query(`GRANT SELECT, INSERT, UPDATE ON "DpsSequence" TO nexus_tenant_foundation_probe`);
  await db.query(`GRANT SELECT ON "UserTenantAccess", "NfseRecord" TO nexus_tenant_foundation_probe`);
  await db.query(`INSERT INTO "Tenant" ("id", "name") VALUES ($1::uuid, 'Tenant isolado de teste') ON CONFLICT ("id") DO NOTHING`, [SECONDARY]);

  const uncovered = await db.query(`
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN information_schema.columns col ON col.table_schema = n.nspname AND col.table_name = c.relname AND col.column_name = 'tenantId'
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity)
    ORDER BY c.relname
  `);
  if (uncovered.rowCount) throw new Error(`Tabelas com tenantId sem RLS/FORCE RLS: ${uncovered.rows.map((row) => row.relname).join(", ")}`);

  await db.query("SET LOCAL ROLE nexus_tenant_foundation_probe");
  await db.query("SELECT set_config('app.tenant_id', $1, true)", [PRIMARY]);
  await db.query(`INSERT INTO "DpsSequence" ("series", "tenantId", "fiscalSeries", "lastNumber", "updatedAt") VALUES ($1, $2::uuid, 'TESTE', 7, NOW())`, [`${PRIMARY}:TESTE`, PRIMARY]);
  const primaryCount = Number((await db.query(`SELECT count(*)::int AS n FROM "DpsSequence" WHERE "fiscalSeries"='TESTE'`)).rows[0].n);

  await db.query("SELECT set_config('app.tenant_id', $1, true)", [SECONDARY]);
  const leakedPrimary = Number((await db.query(`SELECT count(*)::int AS n FROM "DpsSequence" WHERE "fiscalSeries"='TESTE'`)).rows[0].n);
  await db.query(`INSERT INTO "DpsSequence" ("series", "tenantId", "fiscalSeries", "lastNumber", "updatedAt") VALUES ($1, $2::uuid, 'TESTE', 3, NOW())`, [`${SECONDARY}:TESTE`, SECONDARY]);
  const secondaryCount = Number((await db.query(`SELECT count(*)::int AS n FROM "DpsSequence" WHERE "fiscalSeries"='TESTE'`)).rows[0].n);
  const leakedAccess = Number((await db.query(`SELECT count(*)::int AS n FROM "UserTenantAccess" WHERE "tenantId"=$1::uuid`, [PRIMARY])).rows[0].n);

  if (primaryCount !== 1 || leakedPrimary !== 0 || secondaryCount !== 1 || leakedAccess !== 0) {
    throw new Error(JSON.stringify({ primaryCount, leakedPrimary, secondaryCount, leakedAccess }));
  }

  await db.query("RESET ROLE");
  await db.query("ROLLBACK");
  console.log("TENANT_FOUNDATION_OK", { primaryCount, secondaryCount, crossTenantRows: 0, rlsTablesChecked: "all tenantId tables" });
} catch (error) {
  try { await db.query("RESET ROLE"); await db.query("ROLLBACK"); } catch {}
  throw error;
} finally {
  await db.end();
}
