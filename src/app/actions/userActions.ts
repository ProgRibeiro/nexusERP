"use server";

import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
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

export interface UserSession {
  id: string;
  name: string;
  email: string;
  roleName: string;
  permissions: string[];
}

/**
 * Obtém todos os usuários do sistema com seus respectivos papéis.
 * Exige sessão válida: esta lista não deve ser pública.
 */
export async function getUsers() {
  try {
    await requireAuth();

    const dbUsers = await prisma.user.findMany({
      include: { role: true },
      orderBy: { name: "asc" },
    });

    return dbUsers.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      roleName: user.role?.name || "Sem Perfil",
      permissions: JSON.parse(user.permissions) as string[],
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
    permissions: session.permissions,
  };
}

/**
 * Encerra a sessão atual removendo o cookie httpOnly do servidor.
 */
export async function logoutAction(): Promise<{ success: boolean }> {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
  return { success: true };
}

import {
  generateSalt,
  hashPassword,
  verifyPassword as passwordMatches,
} from "@/lib/crypto";

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
): Promise<{ success: boolean; user?: UserSession; error?: string }> {
  try {
    await assertLoginAllowed(email);
    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: { role: true },
    });

    if (!user) {
      await registerLoginFailure(email);
      logger.warn("login_failed", { email: email.trim().toLowerCase(), reason: "usuario_nao_encontrado" });
      return { success: false, error: "Usuário não encontrado." };
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
        logger.warn("login_failed", { email: user.email, reason: "senha_incorreta" });
        return { success: false, error: "Senha incorreta." };
      }
    }

    const roleName = user.role?.name || "Sem Perfil";
    await clearLoginFailures(email);
    const permissions = JSON.parse(user.permissions) as string[];

    const payload: SessionPayload = {
      userId: user.id,
      name: user.name,
      email: user.email,
      roleName,
      permissions,
      exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
    };

    const token = await encryptSession(payload);
    const store = await cookies();
    store.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    logger.info("login_success", { userId: user.id, email: user.email, roleName });

    return {
      success: true,
      user: { id: user.id, name: user.name, email: user.email, roleName, permissions },
    };
  } catch (error: any) {
    logger.error("login_error", { message: error.message });
    return { success: false, error: error.message };
  }
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

    const roleName = target.role?.name || "Sem Perfil";
    const permissions = JSON.parse(target.permissions) as string[];

    const payload: SessionPayload = {
      userId: target.id,
      name: target.name,
      email: target.email,
      roleName,
      permissions,
      exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
    };

    const token = await encryptSession(payload);
    const store = await cookies();
    store.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

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
      user: { id: target.id, name: target.name, email: target.email, roleName, permissions },
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

    const initialPassword = data.password && data.password.trim().length >= 3 ? data.password.trim() : "123";
    const salt = generateSalt();
    const hashedPassword = hashPassword(initialPassword, salt);

    // Permissões padrão baseadas no perfil
    let permissions = ["os.read", "clients.read"];
    if (data.roleName === "Administrador") {
      permissions = ["admin.all", "crm.manage", "quotes.manage", "os.manage", "finance.manage", "stock.manage"];
    } else if (data.roleName === "Gestor Operacional" || data.roleName === "Gestor") {
      permissions = ["crm.manage", "quotes.manage", "os.manage", "stock.manage"];
    } else if (data.roleName === "Técnico de Campo" || data.roleName === "Técnico") {
      permissions = ["os.execute", "clients.read", "stock.read"];
    } else if (data.roleName === "Financeiro") {
      permissions = ["finance.manage", "billing.manage", "quotes.read"];
    }

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
}): Promise<{ success: boolean; error?: string }> {
  try {
    const current = await requirePermission("admin.all");

    const user = await prisma.user.findUnique({
      where: { id: data.id },
    });
    if (!user) {
      return { success: false, error: "Usuário não encontrado." };
    }

    const updateData: any = {};
    if (data.name && data.name.trim()) updateData.name = data.name.trim();
    if (data.email && data.email.trim()) updateData.email = data.email.trim().toLowerCase();

    if (data.roleName) {
      const role = await prisma.role.findFirst({ where: { name: data.roleName } });
      if (role) {
        updateData.roleId = role.id;
      }
    }

    if (data.password && data.password.trim().length >= 3) {
      const salt = generateSalt();
      updateData.salt = salt;
      updateData.password = hashPassword(data.password.trim(), salt);
    }

    await prisma.user.update({
      where: { id: data.id },
      data: updateData,
    });

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

