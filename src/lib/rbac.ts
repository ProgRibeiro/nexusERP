export type PlatformRole =
  | "SUPER_ADMIN"
  | "DEVELOPER"
  | "SUPPORT"
  | "SALES_MANAGER"
  | "SALES_ANALYST"
  | "CUSTOMER_ADMIN"
  | "CUSTOMER_USER";

export type LandingArea = "app" | "commercial" | "developer";

function normalizeRoleName(roleName: string) {
  return roleName.trim().toUpperCase();
}

export function resolvePlatformRole(input: { roleName: string; permissions: string[] }): PlatformRole {
  const role = normalizeRoleName(input.roleName);
  const permissions = input.permissions;
  const has = (code: string) => permissions.includes(code);

  if (role === "SUPER_ADMIN" || role === "SUPERADMIN") return "SUPER_ADMIN";
  if (role === "DEVELOPER" || role === "DESENVOLVEDOR") return "DEVELOPER";
  if (role === "SUPPORT" || role === "SUPORTE") return "SUPPORT";
  if (role === "SALES_MANAGER") return "SALES_MANAGER";
  if (role === "SALES_ANALYST") return "SALES_ANALYST";
  if (role === "CUSTOMER_ADMIN") return "CUSTOMER_ADMIN";
  if (role === "CUSTOMER_USER") return "CUSTOMER_USER";

  // Compatibilidade com papéis legados
  if (has("dev.all")) return "DEVELOPER";
  if (has("admin.all") || role === "ADMINISTRADOR") return "CUSTOMER_ADMIN";
  if (role === "COMERCIAL" || has("crm.manage")) return "SALES_MANAGER";
  if (has("crm.write") || has("crm.read")) return "SALES_ANALYST";
  return "CUSTOMER_USER";
}

export function isAdminSession(input: { roleName: string; permissions: string[] }) {
  const role = resolvePlatformRole(input);
  return role === "SUPER_ADMIN" || role === "DEVELOPER" || input.permissions.includes("admin.all") || input.permissions.includes("dev.all");
}

export function inferLandingArea(input: { roleName: string; permissions: string[] }): LandingArea {
  const role = resolvePlatformRole(input);
  if (role === "SUPER_ADMIN" || role === "DEVELOPER" || role === "SUPPORT") return "developer";
  if (role === "SALES_MANAGER" || role === "SALES_ANALYST") return "commercial";
  return "app";
}

export function hasDeveloperAccess(input: { roleName: string; permissions: string[] }) {
  const role = resolvePlatformRole(input);
  return role === "SUPER_ADMIN" || role === "DEVELOPER" || role === "SUPPORT" || input.permissions.includes("dev.all");
}

export function hasCommercialAccess(input: { roleName: string; permissions: string[] }) {
  const role = resolvePlatformRole(input);
  return role === "SUPER_ADMIN" || role === "SALES_MANAGER" || role === "SALES_ANALYST" || input.permissions.includes("sales.portal") || input.permissions.includes("crm.read") || input.permissions.includes("crm.write") || input.permissions.includes("crm.manage");
}
