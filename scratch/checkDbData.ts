import { Pool } from "pg";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL not set");
    return;
  }

  const pool = new Pool({ connectionString });

  console.log("=== RAW POSTGRESQL DATABASE RECORD COUNTS ===");

  const clientsRes = await pool.query("SELECT count(*), \"tenantId\" FROM \"Client\" GROUP BY \"tenantId\"");
  console.log("Clients by tenantId:", clientsRes.rows);

  const quotesRes = await pool.query("SELECT count(*), \"tenantId\" FROM \"Quote\" GROUP BY \"tenantId\"");
  console.log("Quotes by tenantId:", quotesRes.rows);

  const osRes = await pool.query("SELECT count(*), status, \"tenantId\" FROM \"ServiceOrder\" GROUP BY status, \"tenantId\"");
  console.log("ServiceOrders by status and tenantId:", osRes.rows);

  const usersRes = await pool.query("SELECT id, name, email, \"tenantId\", \"roleName\" FROM \"User\"");
  console.log("Users:", usersRes.rows);

  const tenantsRes = await pool.query("SELECT id, name, slug FROM \"Tenant\"");
  console.log("Tenants:", tenantsRes.rows);

  await pool.end();
}

main().catch(console.error);
