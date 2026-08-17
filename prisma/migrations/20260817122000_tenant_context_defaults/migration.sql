DO $$
DECLARE table_name TEXT;
BEGIN
  FOR table_name IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT IN ('Tenant', 'Role', 'Permission', '_prisma_migrations')
  LOOP
    EXECUTE format('ALTER TABLE %I ALTER COLUMN "tenantId" SET DEFAULT NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid', table_name);
  END LOOP;
END $$;
