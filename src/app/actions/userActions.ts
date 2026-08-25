"use server";

import { prisma } from "@/lib/db";
import { cookies, headers } from "next/headers";
import crypto from "crypto";
import { assertLoginAllowed, clearLoginFailures, registerLoginFailure } from "@/lib/loginThrottle";
import {
  encryptSession,
  SessionPayload,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/session";
import { getSession, requireAuth, requirePermission, AuthError } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { enterTenantContext, resolveLoginTenant } from "@/lib/db";
import { inferLandingArea, type LandingArea } from "@/lib/portalRouting";
import { resolvePlatformRole, type PlatformRole } from "@/lib/rbac";
import { resolveEffectiveIdentity } from "@/lib/identityPermissions";
import {
  assertUserBelongsToTenant,
  bindUserToTenant,
  resolvePrimaryTenantForUser,
  resolveTenantFallback,
  tenantScopedUserFilter,
} from "@/lib/tenantAccess";

export interface UserSession {
  id: string;
  name: string;
  email: string;
  roleName: string;
  platformRole: PlatformRole;
  tenantId?: string;
  permissions: string[];
}

async function sessionCookieOptions() {
  const headerStore = await headers();
  const host = (headerStore.get("x-forwarded-host") || headerStore.get("host") || "").split(":")[0].toLowerCase();
  const configuredDomain = process.env.SESSION_COOKIE_DOMAIN?.trim();
  const configuredBase = configuredDomain?.replace(/^\./, "").toLowerCase();
  const validConfiguredDomain = configuredDomain && configuredBase && (host === configuredBase || host.endsWith(`.${configuredBase}`)) ? configuredDomain : undefined;
  const domain = validConfiguredDomain || (host === "oprestador.tech" || host.endsWith(".oprestador.tech") ? ".oprestador.tech" : undefined);
  return {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
    ...(domain ? { domain } : {}),
  };
}

/**
 * Obtém todos os usuários do sistema com seus respectivos papéis.
 * Exige sessão válida: esta lista não deve ser pública.
 */
export async function getUsers() {
  try {
    const session = await requireAuth();
    const allowPlatformWideAccess = ["SUPER_ADMIN", "DEVELOPER", "SUPPORT"].includes(session.platformRole ?? "");
    const userFilter = await tenantScopedUserFilter(session.tenantId, allowPlatformWideAccess);

    const dbUsers = await prisma.user.findMany({
      where: userFilter,
      include: { role: true },
      orderBy: { name: "asc" },
    });

    return dbUsers.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      roleName: user.role?.name || "Sem Perfil",
      permissions: JSON.parse(user.permissions) as string[],
      platformRole: resolvePlatformRole({
        roleName: user.role?.name || "Sem Perfil",
        permissions: JSON.parse(user.permissions) as string[],
      }),
    }));
  } catch (error) {
    logger.error("Erro ao obter usuários:", error);
    return [];
  }
}

/**
 * Retorna o usuário autenticado da sessão atual (lida do cookie httpOnly
 * no servidor). Substitui a antiga leitura de `localStorage` no client.
 */
export async function getSessionUserAction(): Promise<UserSession | null> {
  const session = await getSession();
  if (!session) return null;
  return {
    id: session.userId,
    name: session.name,
    email: session.email,
    roleName: session.roleName,
    platformRole: resolvePlatformRole({ roleName: session.roleName, permissions: session.permissions }),
    tenantId: resolveTenantFallback(session.tenantId),
    permissions: session.permissions,
  };
}

/**
 * Encerra a sessão atual removendo o cookie httpOnly do servidor.
 */
export async function logoutAction(): Promise<{ success: boolean }> {
  const session = await getSession();
  if (session?.tenantId) {
    enterTenantContext(session.tenantId);
    const metadata = await requestMetadata();
    await prisma.auditLog.create({ data: { userId: session.userId, action: "LOGOUT", category: "AUTH", entity: "Sessao", entityId: session.userId, changesJson: "{}", ...metadata } }).catch((error) => logger.error("logout_audit_failed", error));
  }
  const store = await cookies();
  const options = await sessionCookieOptions();
  store.set(SESSION_COOKIE_NAME, "", { ...options, maxAge: 0 });
  return { success: true };
}

import {
  generateSalt,
  generateSecureToken,
  hashPassword,
  sha256,
  verifyPassword as passwordMatches,
} from "@/lib/crypto";

async function requestMetadata() {
  const headerStore = await headers();
  return {
    ipAddress: (headerStore.get("x-forwarded-for") || headerStore.get("x-real-ip") || "").split(",")[0].trim() || null,
    userAgent: headerStore.get("user-agent")?.slice(0, 500) || null,
  };
}

async function recordLoginHistory(input: { userId?: string; tenantId?: string; email: string; success: boolean; reason?: string }) {
  try {
    const metadata = await requestMetadata();
    await prisma.loginHistory.create({
      data: {
        userId: input.userId || null,
        tenantId: resolveTenantFallback(input.tenantId),
        email: input.email.trim().toLowerCase(),
        success: input.success,
        reason: input.reason || null,
        ...metadata,
      },
    });
  } catch (historyError) {
    logger.error("login_history_write_failed", historyError);
  }
}

// ---------------------------------------------------------------------------
// Hash de senha: PBKDF2-SHA512 com salt individual por usuário (100k iterações).
// ---------------------------------------------------------------------------

/**
 * Esquema antigo (salt fixo global, 1000 iterações) — mantido apenas para
 * permitir a migração automática (self-healing) de contas criadas antes
 * da introdução do salt individual. Não usar para novos hashes.
 */
function hashPasswordLegacyFixedSalt(password: string): string {
  return crypto.pbkdf2Sync(password, "nx_erp_salt_key_2026", 1000, 64, "sha512").toString("hex");
}

/**
 * Autentica o usuário por email e senha. Em caso de sucesso, grava um
 * cookie httpOnly criptografado (AES-256-GCM) com a sessão do servidor —
 * esta é a única fonte de verdade de autenticação a partir de agora.
 */
export async function loginAction(
  email: string,
  password: string
): Promise<{ success: boolean; user?: UserSession; landingArea?: LandingArea; error?: string }> {
  try {
    await assertLoginAllowed(email);
    const normalizedEmail = email.trim().toLowerCase();
    const loginTenantId = await resolveLoginTenant(normalizedEmail);
    if (loginTenantId) enterTenantContext(loginTenantId);

    let user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { role: true, userRoles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } } },
    });

    // Fallback de resiliência: se o tenant resolver não localizou o usuário ou se o contexto RLS isolou o registro,
    // tenta localizar o usuário globalmente para associar o tenantId e auto-reparar o acesso.
    if (!user) {
      try {
        const globalUser = await prisma.user.findFirst({
          where: { email: normalizedEmail },
          select: { id: true },
        });
        if (globalUser) {
          const tenantRows = await prisma.$queryRawUnsafe<Array<{ tenantId: string }>>(
            `SELECT "tenantId"::text AS "tenantId" FROM "UserTenantAccess" WHERE "userId" = $1 AND "active" = true ORDER BY "isDefault" DESC LIMIT 1`,
            globalUser.id
          ).catch(() => []);
          const resolvedTenant = resolveTenantFallback(tenantRows[0]?.tenantId);
          enterTenantContext(resolvedTenant);
          await bindUserToTenant(globalUser.id, resolvedTenant).catch(() => {});
          user = await prisma.user.findUnique({
            where: { email: normalizedEmail },
            include: { role: true, userRoles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } } },
          });
        }
      } catch (globalFallbackErr) {
        logger.warn("login_global_user_fallback_failed", { email: normalizedEmail, globalFallbackErr });
      }
    }

    if (!user) {
      await registerLoginFailure(email);
      await recordLoginHistory({ email: normalizedEmail, success: false, reason: "USUARIO_NAO_ENCONTRADO" });
      logger.warn("login_failed", { email: normalizedEmail, reason: "usuario_nao_encontrado" });
      return { success: false, error: "Usuário ou senha incorretos." };
    }

    if (!user.active || user.blockedAt) {
      await registerLoginFailure(email);
      await recordLoginHistory({ userId: user.id, email: user.email, success: false, reason: user.blockedAt ? "USUARIO_BLOQUEADO" : "USUARIO_INATIVO" });
      logger.warn("login_failed", { userId: user.id, email: user.email, reason: "usuario_inativo_ou_bloqueado" });
      return { success: false, error: "Acesso bloqueado. Procure o administrador da sua empresa." };
    }

    let salt = user.salt;

    if (!salt) {
      // Migração automática: conta antiga sem salt individual. Valida contra
      // o esquema legado (ou texto plano, se veio direto do seed) e, se
      // bater, gera um salt novo e re-hasheia a senha antes de prosseguir.
      const legacyHash = hashPasswordLegacyFixedSalt(password);
      const matchesLegacy = user.password === legacyHash || user.password === password;

      if (!matchesLegacy) {
        await registerLoginFailure(email);
        await recordLoginHistory({ userId: user.id, email: user.email, success: false, reason: "SENHA_INCORRETA" });
        logger.warn("login_failed", { email: user.email, reason: "senha_incorreta" });
        return { success: false, error: "Senha incorreta." };
      }

      salt = generateSalt();
      const migratedHash = hashPassword(password, salt);
      await prisma.user.update({
        where: { id: user.id },
        data: { password: migratedHash, salt },
      });
    } else {
      if (!passwordMatches(password, salt, user.password)) {
        await registerLoginFailure(email);
        await recordLoginHistory({ userId: user.id, email: user.email, success: false, reason: "SENHA_INCORRETA" });
        logger.warn("login_failed", { email: user.email, reason: "senha_incorreta" });
        return { success: false, error: "Senha incorreta." };
      }
    }

    const identity = resolveEffectiveIdentity(user);
    const roleName = identity.roleName;
    await clearLoginFailures(email);
    const permissions = identity.permissions;
    const platformRole = resolvePlatformRole({ roleName, permissions });
    const tenantId = await resolvePrimaryTenantForUser(user.id);

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await recordLoginHistory({ userId: user.id, tenantId, email: user.email, success: true, reason: "LOGIN" });
    const loginMetadata = await requestMetadata();
    await prisma.auditLog.create({ data: { userId: user.id, action: "LOGIN", category: "AUTH", entity: "Sessao", entityId: user.id, changesJson: "{}", ipAddress: loginMetadata.ipAddress, userAgent: loginMetadata.userAgent } });

    const payload: SessionPayload = {
      userId: user.id,
      name: user.name,
      email: user.email,
      roleName,
      platformRole,
      tenantId,
      permissions,
      sessionVersion: user.sessionVersion,
      exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
    };

    const token = await encryptSession(payload);
    const store = await cookies();
    store.set(SESSION_COOKIE_NAME, token, await sessionCookieOptions());

    logger.info("login_success", { userId: user.id, email: user.email, roleName });
    const landingArea = inferLandingArea({ roleName, permissions });

    return {
      success: true,
      landingArea,
      user: { id: user.id, name: user.name, email: user.email, roleName, platformRole, tenantId, permissions },
    };
  } catch (error: any) {
    logger.error("login_error", { message: error.message });
    return { success: false, error: error.message };
  }
}

const RESET_GENERIC_MESSAGE = "Se o e-mail estiver ativo, você receberá as instruções para redefinir a senha.";

export async function requestPasswordResetAction(email: string): Promise<{ success: true; message: string; developmentToken?: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const tenantId = normalizedEmail.includes("@") ? await resolveLoginTenant(normalizedEmail) : null;
  if (!tenantId) return { success: true, message: RESET_GENERIC_MESSAGE };

  enterTenantContext(tenantId);
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user?.active || user.blockedAt) return { success: true, message: RESET_GENERIC_MESSAGE };

  const token = generateSecureToken(32);
  const tokenHash = sha256(token);
  const metadata = await requestMetadata();
  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
    await tx.passwordResetToken.create({ data: { userId: user.id, tenantId, tokenHash, expiresAt: new Date(Date.now() + 30 * 60_000), requestedIp: metadata.ipAddress } });
    await tx.auditLog.create({ data: { userId: user.id, action: "PASSWORD_RESET_REQUEST", category: "AUTH", entity: "Usuario", entityId: user.id, changesJson: "{}", ipAddress: metadata.ipAddress, userAgent: metadata.userAgent } });
  });

  const baseUrl = process.env.NEXT_PUBLIC_NEXUS_APP_URL || process.env.APP_BASE_URL || "http://localhost:3000";
  const resetUrl = `${baseUrl.replace(/\/$/, "")}/recuperar-senha?token=${encodeURIComponent(token)}`;
  const webhook = process.env.PASSWORD_RESET_WEBHOOK_URL?.trim();
  if (webhook) {
    try {
      const response = await fetch(webhook, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "password.reset", email: normalizedEmail, resetUrl, expiresInMinutes: 30 }) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      logger.error("password_reset_delivery_failed", error);
    }
  } else if (process.env.NODE_ENV === "production") {
    logger.error("password_reset_delivery_not_configured", { userId: user.id });
  }

  return { success: true, message: RESET_GENERIC_MESSAGE, ...(process.env.NODE_ENV !== "production" ? { developmentToken: token } : {}) };
}

export async function confirmPasswordResetAction(token: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  if (token.length < 32) return { success: false, error: "Link de recuperação inválido." };
  if (newPassword.trim().length < 12) return { success: false, error: "A nova senha deve possuir pelo menos 12 caracteres." };
  const tokenHash = sha256(token);
  const rows = await prisma.$queryRawUnsafe<Array<{ tenantId: string }>>("SELECT public.resolve_reset_token_tenant($1)::text AS \"tenantId\"", tokenHash);
  const tenantId = rows[0]?.tenantId;
  if (!tenantId) return { success: false, error: "O link expirou ou já foi utilizado." };
  enterTenantContext(tenantId);

  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!record || record.usedAt || record.expiresAt <= new Date()) return { success: false, error: "O link expirou ou já foi utilizado." };
  const salt = generateSalt();
  const metadata = await requestMetadata();
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: record.userId }, data: { password: hashPassword(newPassword.trim(), salt), salt, passwordChangedAt: new Date(), sessionVersion: { increment: 1 } } });
    await tx.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    await tx.auditLog.create({ data: { userId: record.userId, action: "PASSWORD_RESET_COMPLETE", category: "AUTH", entity: "Usuario", entityId: record.userId, changesJson: "{}", ipAddress: metadata.ipAddress, userAgent: metadata.userAgent } });
  });
  return { success: true };
}

/**
 * Alterna a sessão para outro usuário (usado pelo seletor de perfis para
 * QA/demonstração de RBAC). Diferente do fluxo antigo, isto agora exige que
 * o usuário JÁ autenticado seja Administrador — deixou de ser possível
 * assumir qualquer perfil sem estar logado.
 *
 * Em ambientes com dados reais de clientes, recomenda-se desabilitar esta
 * função por completo definindo ALLOW_ROLE_SWITCH=false no ambiente.
 */
export async function switchUserAction(
  targetEmail: string
): Promise<{ success: boolean; user?: UserSession; error?: string }> {
  try {
    if (process.env.ALLOW_ROLE_SWITCH !== "true") {
      return { success: false, error: "Troca de perfil desabilitada neste ambiente." };
    }

    const current = await requirePermission("admin.all");

    const target = await prisma.user.findUnique({
      where: { email: targetEmail.trim().toLowerCase() },
      include: { role: true },
    });
    if (!target) {
      return { success: false, error: "Usuário-alvo não encontrado." };
    }

    const canAccessPlatformWide = ["SUPER_ADMIN", "DEVELOPER", "SUPPORT"].includes(current.platformRole ?? "");
    if (!canAccessPlatformWide) {
      await assertUserBelongsToTenant(target.id, current.tenantId, { allowPlatformWide: false });
    }

    const roleName = target.role?.name || "Sem Perfil";
    const permissions = JSON.parse(target.permissions) as string[];
    const platformRole = resolvePlatformRole({ roleName, permissions });
    const tenantId = await resolvePrimaryTenantForUser(target.id, current.tenantId);

    const payload: SessionPayload = {
      userId: target.id,
      name: target.name,
      email: target.email,
      roleName,
      platformRole,
      tenantId,
      permissions,
      exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
    };

    const token = await encryptSession(payload);
    const store = await cookies();
    store.set(SESSION_COOKIE_NAME, token, await sessionCookieOptions());

    await prisma.auditLog.create({
      data: {
        userId: current.userId,
        action: "TROCA_PERFIL",
        entity: "Usuario",
        entityId: target.id,
        changesJson: JSON.stringify({ de: current.email, para: target.email }),
      },
    });

    return {
      success: true,
      user: { id: target.id, name: target.name, email: target.email, roleName, platformRole, tenantId, permissions },
    };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    logger.error("Erro ao trocar de usuário:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Obtém todos os papéis (Roles) cadastrados no sistema.
 */
export async function getRolesAction() {
  try {
    await requireAuth();
    const roles = await prisma.role.findMany({
      orderBy: { name: "asc" },
    });
    return roles;
  } catch (error) {
    logger.error("Erro ao buscar papéis:", error);
    return [];
  }
}

/**
 * Cria um novo usuário/operador no sistema com senha e perfil atribuído.
 */
export async function createUserAction(data: {
  name: string;
  email: string;
  roleName: string;
  password?: string;
}): Promise<{ success: boolean; user?: any; error?: string }> {
  try {
    const current = await requirePermission("admin.all");

    const emailClean = data.email.trim().toLowerCase();
    if (!data.name.trim() || !emailClean) {
      return { success: false, error: "Nome e e-mail são obrigatórios." };
    }

    const existing = await prisma.user.findUnique({
      where: { email: emailClean },
    });
    if (existing) {
      return { success: false, error: "Já existe um usuário cadastrado com este e-mail." };
    }

    const role = await prisma.role.findFirst({
      where: { name: data.roleName },
    });
    if (!role) {
      return { success: false, error: `Perfil de acesso '${data.roleName}' não foi encontrado.` };
    }

    if (!data.password || data.password.trim().length < 12) {
      return { success: false, error: "A senha inicial deve possuir pelo menos 12 caracteres." };
    }
    const initialPassword = data.password.trim();
    const salt = generateSalt();
    const hashedPassword = hashPassword(initialPassword, salt);

    // Permissões padrão baseadas no perfil
    let permissions = ["os.read", "clients.read"];
    if (data.roleName === "Desenvolvedor" || data.roleName === "SuperAdmin") {
      permissions = ["dev.all", "admin.all", "crm.manage", "quotes.manage", "os.manage", "finance.manage", "stock.manage", "system.reset"];
    } else if (data.roleName === "Administrador") {
      permissions = ["admin.all", "crm.manage", "quotes.manage", "os.manage", "finance.manage", "stock.manage"];
    } else if (data.roleName === "Gestor Operacional" || data.roleName === "Gestor") {
      permissions = ["crm.manage", "quotes.manage", "os.manage", "stock.manage"];
    } else if (data.roleName === "Técnico de Campo" || data.roleName === "Técnico") {
      permissions = ["os.execute", "clients.read", "stock.read"];
    } else if (data.roleName === "Financeiro") {
      permissions = ["finance.manage", "billing.manage", "quotes.read"];
    }

    const targetTenantId = resolveTenantFallback(current.tenantId);
    const newUser = await prisma.user.create({
      data: {
        name: data.name.trim(),
        email: emailClean,
        password: hashedPassword,
        salt: salt,
        roleId: role.id,
        permissions: JSON.stringify(permissions),
      },
      include: { role: true },
    });
    await bindUserToTenant(newUser.id, targetTenantId);
    await prisma.userRole.create({
      data: { userId: newUser.id, roleId: role.id, tenantId: targetTenantId },
    });

    await prisma.auditLog.create({
      data: {
        userId: current.userId,
        action: "CRIAR_USUARIO",
        entity: "Usuario",
        entityId: newUser.id,
        changesJson: JSON.stringify({ email: newUser.email, papel: data.roleName }),
      },
    });

    logger.info("user_created", { createdBy: current.userId, userId: newUser.id, email: newUser.email });

    return {
      success: true,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        roleName: newUser.role?.name || data.roleName,
        platformRole: resolvePlatformRole({ roleName: newUser.role?.name || data.roleName, permissions }),
        permissions,
      },
    };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    logger.error("Erro ao criar usuário:", error);
    return { success: false, error: error.message || "Não foi possível criar o usuário." };
  }
}

/**
 * Atualiza um usuário ou redefine a senha.
 */
export async function updateUserAction(data: {
  id: string;
  name?: string;
  email?: string;
  roleName?: string;
  password?: string;
  active?: boolean;
  blocked?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const current = await requirePermission("admin.all");

    const user = await prisma.user.findUnique({
      where: { id: data.id },
    });
    if (!user) {
      return { success: false, error: "Usuário não encontrado." };
    }

    const canManagePlatformWide = ["SUPER_ADMIN", "DEVELOPER", "SUPPORT"].includes(current.platformRole ?? "");
    if (!canManagePlatformWide) {
      await assertUserBelongsToTenant(user.id, current.tenantId, { allowPlatformWide: false });
    }

    const updateData: any = {};
    if (data.name && data.name.trim()) updateData.name = data.name.trim();
    if (data.email && data.email.trim()) updateData.email = data.email.trim().toLowerCase();
    if (typeof data.active === "boolean") updateData.active = data.active;
    if (typeof data.blocked === "boolean") updateData.blockedAt = data.blocked ? new Date() : null;

    let selectedRoleId: string | null = null;
    if (data.roleName) {
      const role = await prisma.role.findFirst({ where: { name: data.roleName } });
      if (role) {
        updateData.roleId = role.id;
        selectedRoleId = role.id;
      }
    }

    if (data.password && data.password.trim().length < 12) {
      return { success: false, error: "A nova senha deve possuir pelo menos 12 caracteres." };
    }
    if (data.password) {
      const salt = generateSalt();
      updateData.salt = salt;
      updateData.password = hashPassword(data.password.trim(), salt);
      updateData.passwordChangedAt = new Date();
    }

    await prisma.user.update({
      where: { id: data.id },
      data: updateData,
    });
    if (selectedRoleId) {
      await prisma.userRole.upsert({
        where: { userId_roleId_tenantId: { userId: user.id, roleId: selectedRoleId, tenantId: resolveTenantFallback(current.tenantId) } },
        update: {},
        create: { userId: user.id, roleId: selectedRoleId, tenantId: resolveTenantFallback(current.tenantId) },
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: current.userId,
        action: "ATUALIZAR_USUARIO",
        entity: "Usuario",
        entityId: user.id,
        changesJson: JSON.stringify(updateData),
      },
    });

    return { success: true };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    logger.error("Erro ao atualizar usuário:", error);
    return { success: false, error: error.message || "Erro ao atualizar o usuário." };
  }
}

/**
 * Exclui um usuário do sistema.
 */
export async function deleteUserAction(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const current = await requirePermission("admin.all");

    if (current.userId === userId) {
      return { success: false, error: "Não é possível excluir a sua própria conta ativa." };
    }

    await prisma.user.delete({
      where: { id: userId },
    });

    await prisma.auditLog.create({
      data: {
        userId: current.userId,
        action: "EXCLUIR_USUARIO",
        entity: "Usuario",
        entityId: userId,
        changesJson: "{}",
      },
    });


    return { success: true };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    logger.error("Erro ao excluir usuário:", error);
    return { success: false, error: error.message || "Não foi possível excluir o usuário." };
  }
}
