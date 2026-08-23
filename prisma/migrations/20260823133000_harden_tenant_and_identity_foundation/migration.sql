-- Fundação multiempresa e identidade. Migration exclusivamente aditiva:
-- preserva os campos legados de papel, permissão e numeração fiscal.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "blockedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMP(3);

ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'GENERAL';
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "previousJson" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "newJson" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "ipAddress" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "userAgent" TEXT;

CREATE TABLE IF NOT EXISTS "UserRole" (
  "userId" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "tenantId" UUID NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::uuid,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId", "roleId", "tenantId"),
  CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UserRole_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "RolePermission" (
  "roleId" TEXT NOT NULL,
  "permissionId" TEXT NOT NULL,
  "tenantId" UUID NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::uuid,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId", "permissionId", "tenantId"),
  CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RolePermission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "LoginHistory" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "tenantId" UUID NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::uuid,
  "email" TEXT NOT NULL,
  "success" BOOLEAN NOT NULL,
  "reason" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoginHistory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LoginHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "LoginHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tenantId" UUID NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::uuid,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "requestedIp" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PasswordResetToken_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_expiresAt_idx" ON "PasswordResetToken"("userId", "expiresAt");
CREATE INDEX IF NOT EXISTS "LoginHistory_tenantId_createdAt_idx" ON "LoginHistory"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "LoginHistory_userId_createdAt_idx" ON "LoginHistory"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "UserRole_tenantId_idx" ON "UserRole"("tenantId");
CREATE INDEX IF NOT EXISTS "RolePermission_tenantId_idx" ON "RolePermission"("tenantId");

-- Mantém compatibilidade com roleId enquanto o frontend passa a aceitar
-- múltiplos perfis. Nenhum vínculo legado é descartado.
INSERT INTO "UserRole" ("userId", "roleId", "tenantId")
SELECT u."id", u."roleId", uta."tenantId"
FROM "User" u
JOIN "UserTenantAccess" uta ON uta."userId" = u."id" AND uta."active" = TRUE
WHERE u."roleId" IS NOT NULL
ON CONFLICT DO NOTHING;

-- Fecha as lacunas deixadas por tabelas criadas após a migration geral de RLS.
ALTER TABLE "UserTenantAccess" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserTenantAccess" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "UserTenantAccess"
  USING ("tenantId" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "NfseRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NfseRecord" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "NfseRecord"
  USING ("tenantId" = NULLIF(current_setting('app.tenant_id', true), ''))
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.tenant_id', true), ''));

-- A coluna series continua como chave interna para não trocar a PK. fiscalSeries
-- guarda a série transmitida à prefeitura e pode se repetir em tenants distintos.
ALTER TABLE "DpsSequence" ADD COLUMN IF NOT EXISTS "tenantId" UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid;
ALTER TABLE "DpsSequence" ADD COLUMN IF NOT EXISTS "fiscalSeries" TEXT NOT NULL DEFAULT '1';
UPDATE "DpsSequence"
SET "fiscalSeries" = "series",
    "series" = '00000000-0000-4000-8000-000000000001:' || "series"
WHERE "series" !~ '^[0-9a-fA-F-]{36}:';
ALTER TABLE "DpsSequence" ALTER COLUMN "tenantId" SET DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::uuid;
ALTER TABLE "DpsSequence" ADD CONSTRAINT "DpsSequence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS "DpsSequence_tenantId_fiscalSeries_key" ON "DpsSequence"("tenantId", "fiscalSeries");
ALTER TABLE "DpsSequence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DpsSequence" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "DpsSequence"
  USING ("tenantId" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

DO $$
DECLARE target_table TEXT;
BEGIN
  FOREACH target_table IN ARRAY ARRAY['UserRole', 'RolePermission', 'LoginHistory', 'PasswordResetToken']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', target_table);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', target_table);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING ("tenantId" = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK ("tenantId" = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)',
      target_table
    );
  END LOOP;
END $$;
