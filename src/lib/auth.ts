import { cookies } from "next/headers";
import { headers } from "next/headers";
import {
  decryptSession,
  SessionPayload,
  SESSION_COOKIE_NAME,
} from "./session";
import { logger } from "./logger";
import { prisma } from "./db";
import { classifyPortalArea, normalizeHostname } from "./portalRouting";
import { hasCommercialAccess, hasDeveloperAccess, isAdminSession, resolvePlatformRole } from "./rbac";
import { bindUserToTenant, ensureUserTenantAccess, resolvePrimaryTenantForUser } from "./tenantAccess";

async function resolveUserTenantId(userId: string, fallbackTenantId?: string) {
  if (!userId) {
    throw new AuthError("NAO_AUTENTICADO", "Usuário inválido para contexto de tenant.");
  }
  return resolvePrimaryTenantForUser(userId, fallbackTenantId);
}

async function applyTenantContext(tenantId: string) {
  await prisma.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, false)`;
}

/**
 * Lê e valida a sessão atual a partir do cookie httpOnly. Uso exclusivo em
 * Server Components / Server Actions / Route Handlers (Node.js runtime).
 */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return decryptSession(token);
}

/**
 * Erro específico para falha de autenticação/autorização, para permitir
 * tratamento diferenciado no client se necessário (ex: redirecionar ao login).
 */
export class AuthError extends Error {
  code: "NAO_AUTENTICADO" | "SEM_PERMISSAO";
  constructor(code: "NAO_AUTENTICADO" | "SEM_PERMISSAO", message: string) {
    super(message);
    this.code = code;
    this.name = "AuthError";
  }
}

/**
 * Garante que existe uma sessão válida. Toda Server Action que lê ou escreve
 * dados do sistema deve chamar isso como a primeira linha dentro do try/catch.
 */
export async function requireAuth(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new AuthError(
      "NAO_AUTENTICADO",
      "Sessão inválida ou expirada. Faça login novamente."
    );
  }
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { role: true },
  });
  if (!user) {
    throw new AuthError("NAO_AUTENTICADO", "Usuário da sessão não existe mais.");
  }

  let permissions: string[];
  try {
    const parsed = JSON.parse(user.permissions);
    permissions = Array.isArray(parsed)
      ? parsed.filter((permission): permission is string => typeof permission === "string")
      : [];
  } catch {
    permissions = [];
  }

  // Autorizações são sempre atualizadas a partir do banco. Assim, revogar um
  // papel/permissão surte efeito sem esperar os sete dias do cookie.
  const platformRole = resolvePlatformRole({ roleName: user.role?.name || "Sem Perfil", permissions });
  const tenantId = await resolveUserTenantId(user.id, session.tenantId);
  if (platformRole === "CUSTOMER_ADMIN" || platformRole === "CUSTOMER_USER") {
    let hasTenantAccess = await ensureUserTenantAccess(user.id, tenantId);
    // Compatibilidade segura para administradores criados antes da tabela de
    // vínculos ou pelo bootstrap legado. Usuários comuns nunca são vinculados
    // automaticamente.
    if (!hasTenantAccess && platformRole === "CUSTOMER_ADMIN" && permissions.includes("admin.all")) {
      await bindUserToTenant(user.id, tenantId);
      hasTenantAccess = await ensureUserTenantAccess(user.id, tenantId);
      logger.info("legacy_admin_tenant_access_repaired", { userId: user.id, tenantId });
    }
    if (!hasTenantAccess) {
      throw new AuthError("SEM_PERMISSAO", "Usuário sem vínculo ativo com o tenant.");
    }
  }
  await applyTenantContext(tenantId);
  return {
    ...session,
    name: user.name,
    email: user.email,
    roleName: user.role?.name || "Sem Perfil",
    platformRole,
    tenantId,
    permissions,
  };
}

/**
 * Garante que existe uma sessão válida E que o usuário tem a permissão
 * informada (ou é Administrador / possui "admin.all").
 */
export async function requirePermission(code: string): Promise<SessionPayload> {
  const session = await requireAuth();
  const isAdmin = isAdminSession(session);

  if (!isAdmin && !session.permissions.includes(code)) {
    logger.warn("permission_denied", { userId: session.userId, email: session.email, code });
    throw new AuthError(
      "SEM_PERMISSAO",
      `Você não tem permissão ("${code}") para executar esta ação.`
    );
  }
  return session;
}

/**
 * Autoriza fluxos compartilhados por mais de um módulo. Administradores, Desenvolvedores e
 * usuários com qualquer uma das permissões informadas podem prosseguir.
 */
export async function requireAnyPermission(codes: string[]): Promise<SessionPayload> {
  const session = await requireAuth();
  const isAdmin = isAdminSession(session);
  if (!isAdmin && !codes.some((code) => session.permissions.includes(code))) {
    logger.warn("permission_denied", { userId: session.userId, email: session.email, codes });
    throw new AuthError(
      "SEM_PERMISSAO",
      `Você não tem permissão para executar esta ação (${codes.join(" ou ")}).`
    );
  }
  return session;
}

export async function requirePortalAccess(area: "app" | "commercial" | "developer"): Promise<SessionPayload> {
  const session = await requireAuth();
  const allowed = area === "developer"
    ? hasDeveloperAccess(session)
    : area === "commercial"
      ? hasCommercialAccess(session)
      : true;

  if (!allowed) {
    throw new AuthError("SEM_PERMISSAO", `Você não tem acesso ao portal ${area}.`);
  }

  try {
    const headerStore = await headers();
    const host = normalizeHostname(headerStore.get("x-forwarded-host") || headerStore.get("host"));
    const currentArea = classifyPortalArea(host);
    if (currentArea !== "unknown" && currentArea !== "marketing" && currentArea !== area) {
      throw new AuthError("SEM_PERMISSAO", `Acesso por hostname inválido para o portal ${area}.`);
    }
  } catch (error) {
    if (error instanceof AuthError) throw error;
  }

  return session;
}
