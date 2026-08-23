ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sessionVersion" INTEGER NOT NULL DEFAULT 1;

CREATE OR REPLACE FUNCTION public.resolve_reset_token_tenant(reset_token_hash TEXT)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT prt."tenantId"
  FROM "PasswordResetToken" prt
  JOIN "Tenant" t ON t."id" = prt."tenantId"
  WHERE prt."tokenHash" = reset_token_hash
    AND prt."usedAt" IS NULL
    AND prt."expiresAt" > CURRENT_TIMESTAMP
    AND t."active" = TRUE
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.resolve_reset_token_tenant(TEXT) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nexus_erp') THEN
    GRANT EXECUTE ON FUNCTION public.resolve_reset_token_tenant(TEXT) TO nexus_erp;
  END IF;
END $$;
