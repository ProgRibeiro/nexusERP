import "dotenv/config";
import pg from "pg";
const {Client}=pg;
const client=new Client({connectionString:process.env.DATABASE_URL});
await client.connect();
try {
  await client.query("BEGIN");
  await client.query("CREATE ROLE nexus_rls_probe NOLOGIN NOSUPERUSER NOBYPASSRLS");
  await client.query('GRANT USAGE ON SCHEMA public TO nexus_rls_probe');
  await client.query('GRANT SELECT ON "Client" TO nexus_rls_probe');
  await client.query("SET LOCAL ROLE nexus_rls_probe");
  await client.query("SELECT set_config('app.tenant_id','00000000-0000-4000-8000-000000000001',true)");
  const visible=Number((await client.query('SELECT count(*)::int AS n FROM "Client"')).rows[0].n);
  await client.query("SELECT set_config('app.tenant_id','10000000-0000-4000-8000-000000000002',true)");
  const leaked=Number((await client.query('SELECT count(*)::int AS n FROM "Client"')).rows[0].n);
  if(visible < 1) throw new Error("Tenant principal não enxerga seus próprios clientes.");
  if(leaked !== 0) throw new Error(`RLS reprovado: ${leaked} linha(s) vazaram para outro tenant.`);
  console.log(`[rls] APROVADO: ${visible} linhas próprias; zero linhas cruzadas.`);
  await client.query("RESET ROLE"); await client.query("ROLLBACK");
} catch(error) { try{await client.query("RESET ROLE");await client.query("ROLLBACK");}catch{} throw error; }
finally { await client.end(); }
