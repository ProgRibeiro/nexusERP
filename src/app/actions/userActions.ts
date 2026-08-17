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

// ---------------------------------------------------------------------------
// Hash de senha: PBKDF2-SHA512 com salt individual por usuário (100k iterações).
// ---------------------------------------------------------------------------

function generateSalt(): string {
  return crypto.randomBytes(16).toString("hex");
}

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 100_000, 64, "sha512").toString("hex");
}

function passwordMatches(password: string, salt: string, expectedHex: string): boolean {
  const actual = Buffer.from(hashPassword(password, salt), "hex");
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

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
