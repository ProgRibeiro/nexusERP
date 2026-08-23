-- Resolve somente o tenant padrão necessário para iniciar a autenticação.
-- A função não retorna senha, perfil ou qualquer dado de negócio.
CREATE OR REPLACE FUNCTION public.resolve_login_tenant(login_email TEXT)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT uta."tenantId"
  FROM "User" u
  JOIN "UserTenantAccess" uta ON uta."userId" = u."id"
  JOIN "Tenant" t ON t."id" = uta."tenantId"
  WHERE lower(u."email") = lower(trim(login_email))
    AND uta."active" = TRUE
    AND t."active" = TRUE
  ORDER BY uta."isDefault" DESC, uta."createdAt" ASC
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.resolve_login_tenant(TEXT) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nexus_erp') THEN
    GRANT EXECUTE ON FUNCTION public.resolve_login_tenant(TEXT) TO nexus_erp;
  END IF;
END $$;
