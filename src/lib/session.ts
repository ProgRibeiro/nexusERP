/**
 * Sessão criptografada por cookie (AES-256-GCM via Web Crypto API).
 *
 * Implementado com a Web Crypto API (não com o módulo `crypto` do Node) de propósito:
 * este arquivo é importado tanto pelo middleware (Edge Runtime) quanto pelas Server
 * Actions (Node.js Runtime), e Web Crypto é o único subconjunto de API disponível nos
 * dois ambientes sem configuração extra.
 */

const ALGORITHM = "AES-GCM";
const IV_LENGTH_BYTES = 12;

export interface SessionPayload {
  userId: string;
  name: string;
  email: string;
  roleName: string;
  permissions: string[];
  /** epoch ms de expiração da sessão */
  exp: number;
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET não configurado (ou muito curto). Defina uma string aleatória de pelo menos 32 caracteres na variável de ambiente SESSION_SECRET antes de iniciar o servidor."
    );
  }
  return secret;
}

async function getKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest("SHA-256", enc.encode(getSecret()));
  return crypto.subtle.importKey("raw", hash, ALGORITHM, false, ["encrypt", "decrypt"]);
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const withPadding = padded + "=".repeat((4 - (padded.length % 4)) % 4);
  const binary = atob(withPadding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Criptografa o payload de sessão em um token opaco (para gravar no cookie httpOnly).
 */
export async function encryptSession(payload: SessionPayload): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
  const data = new TextEncoder().encode(JSON.stringify(payload));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, data));

  const combined = new Uint8Array(iv.length + encrypted.length);
  combined.set(iv, 0);
  combined.set(encrypted, iv.length);
  return toBase64Url(combined);
}

/**
 * Descriptografa e valida o token de sessão. Retorna `null` se o token for inválido,
 * tiver sido adulterado (falha de autenticação do GCM) ou estiver expirado.
 */
export async function decryptSession(token: string): Promise<SessionPayload | null> {
  try {
    if (!token || token.length > 8192) return null;
    const key = await getKey();
    const combined = fromBase64Url(token);
    if (combined.length <= IV_LENGTH_BYTES + 16) return null;
    const iv = combined.slice(0, IV_LENGTH_BYTES);
    const data = combined.slice(IV_LENGTH_BYTES);
    const decrypted = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, data);
    const payload = JSON.parse(new TextDecoder().decode(decrypted)) as SessionPayload;

    if (
      !payload ||
      typeof payload.userId !== "string" ||
      typeof payload.name !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.roleName !== "string" ||
      !Array.isArray(payload.permissions) ||
      !payload.permissions.every((permission) => typeof permission === "string") ||
      typeof payload.exp !== "number" ||
      payload.exp < Date.now()
    ) return null;
    return payload;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_NAME = "nx_session";
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 dias
