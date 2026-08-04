import { cookies } from "next/headers";
import {
  decryptSession,
  SessionPayload,
  SESSION_COOKIE_NAME,
} from "./session";
import { logger } from "./logger";
import { prisma } from "./db";

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
  return {
    ...session,
    name: user.name,
    email: user.email,
    roleName: user.role?.name || "Sem Perfil",
    permissions,
  };
}

/**
 * Garante que existe uma sessão válida E que o usuário tem a permissão
 * informada (ou é Administrador / possui "admin.all").
 */
export async function requirePermission(code: string): Promise<SessionPayload> {
  const session = await requireAuth();
  const isAdmin =
    session.roleName === "Administrador" || session.permissions.includes("admin.all");

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
 * Autoriza fluxos compartilhados por mais de um módulo. Administradores e
 * usuários com qualquer uma das permissões informadas podem prosseguir.
 */
export async function requireAnyPermission(codes: string[]): Promise<SessionPayload> {
  const session = await requireAuth();
  const isAdmin =
    session.roleName === "Administrador" || session.permissions.includes("admin.all");
  if (!isAdmin && !codes.some((code) => session.permissions.includes(code))) {
    logger.warn("permission_denied", { userId: session.userId, email: session.email, codes });
    throw new AuthError(
      "SEM_PERMISSAO",
      `Você não tem permissão para executar esta ação (${codes.join(" ou ")}).`
    );
  }
  return session;
}
