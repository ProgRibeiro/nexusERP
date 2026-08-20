CREATE TABLE IF NOT EXISTS "UserTenantAccess" (
  "userId" TEXT NOT NULL,
  "tenantId" UUID NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT FALSE,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserTenantAccess_pkey" PRIMARY KEY ("userId", "tenantId"),
  CONSTRAINT "UserTenantAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UserTenantAccess_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "UserTenantAccess_tenantId_idx" ON "UserTenantAccess"("tenantId");
CREATE INDEX IF NOT EXISTS "UserTenantAccess_userId_active_idx" ON "UserTenantAccess"("userId", "active");
CREATE UNIQUE INDEX IF NOT EXISTS "UserTenantAccess_default_per_user_idx"
  ON "UserTenantAccess" ("userId")
  WHERE "isDefault" = TRUE;

INSERT INTO "UserTenantAccess" ("userId", "tenantId", "isDefault", "active")
SELECT "id", '00000000-0000-4000-8000-000000000001'::uuid, TRUE, TRUE
FROM "User"
ON CONFLICT ("userId", "tenantId")
DO UPDATE SET "active" = TRUE;
