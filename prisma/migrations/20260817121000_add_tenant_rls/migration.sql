CREATE TABLE "Tenant" (
  "id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

INSERT INTO "Tenant" ("id", "name")
VALUES ('00000000-0000-4000-8000-000000000001', 'Empresa principal')
ON CONFLICT ("id") DO NOTHING;

-- Todas as tabelas de negócio atuais recebem a chave da empresa. Role e
-- Permission são catálogos globais; Tenant e o histórico de migrations também.
DO $$
DECLARE table_name TEXT;
BEGIN
  FOR table_name IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT IN ('Tenant', 'Role', 'Permission', '_prisma_migrations')
  LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS "tenantId" UUID NOT NULL DEFAULT %L::uuid', table_name, '00000000-0000-4000-8000-000000000001');
    EXECUTE format('ALTER TABLE %I ALTER COLUMN "tenantId" SET DEFAULT NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid', table_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I ("tenantId")', table_name || '_tenantId_idx', table_name);
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', table_name, table_name || '_tenantId_fkey');
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT', table_name, table_name || '_tenantId_fkey');
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING ("tenantId" = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK ("tenantId" = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)',
      table_name
    );
  END LOOP;
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;
