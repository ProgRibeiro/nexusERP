type PermissionLink = { permission: { code: string } };
type RoleLink = { role: { name: string; rolePermissions?: PermissionLink[] } };

export type IdentityPermissionSource = {
  permissions: string;
  role?: { name: string } | null;
  userRoles?: RoleLink[];
};

function parseLegacyPermissions(raw: string) {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((code): code is string => typeof code === "string") : [];
  } catch {
    return [];
  }
}

const ROLE_PRIORITY = ["SuperAdmin", "Desenvolvedor", "Administrador", "Gestor", "Supervisor", "Financeiro", "Comercial", "Operacional", "Técnico"];

export function resolveEffectiveIdentity(source: IdentityPermissionSource) {
  const roleNames = new Set<string>();
  if (source.role?.name) roleNames.add(source.role.name);
  for (const link of source.userRoles || []) roleNames.add(link.role.name);

  const permissions = new Set(parseLegacyPermissions(source.permissions));
  for (const link of source.userRoles || []) {
    for (const permissionLink of link.role.rolePermissions || []) permissions.add(permissionLink.permission.code);
  }

  const names = [...roleNames];
  const roleName = ROLE_PRIORITY.find((candidate) => names.some((name) => name.toLowerCase() === candidate.toLowerCase())) || names[0] || "Sem Perfil";
  return { roleName, roleNames: names, permissions: [...permissions].sort() };
}
