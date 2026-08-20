import { Pool } from "pg";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL not set");
    return;
  }

  const pool = new Pool({ connectionString });

  console.log("=== CHECKING USERS AND TENANTS ===");

  const usersRes = await pool.query("SELECT id, email, name, \"tenantId\" FROM \"User\"");
  console.log("Users in DB:", usersRes.rows);

  const tenantsRes = await pool.query("SELECT id, name, slug FROM \"Tenant\"");
  console.log("Tenants in DB:", tenantsRes.rows);

  const osTenantCount = await pool.query("SELECT \"tenantId\", count(*) FROM \"ServiceOrder\" GROUP BY \"tenantId\"");
  console.log("OS count by tenantId:", osTenantCount.rows);

  const clientTenantCount = await pool.query("SELECT \"tenantId\", count(*) FROM \"Client\" GROUP BY \"tenantId\"");
  console.log("Client count by tenantId:", clientTenantCount.rows);

  const quoteTenantCount = await pool.query("SELECT \"tenantId\", count(*) FROM \"Quote\" GROUP BY \"tenantId\"");
  console.log("Quote count by tenantId:", quoteTenantCount.rows);

  await pool.end();
}

main().catch(console.error);
