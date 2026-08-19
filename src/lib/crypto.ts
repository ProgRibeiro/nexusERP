import crypto from "crypto";

/**
 * Módulo Central de Criptografia e Segurança do Nexus ERP.
 *
 * Oferece:
 * 1. Criptografia Simétrica Militar (AES-256-GCM com IV dinâmico de 12 bytes e Tag de Autenticação AEAD).
 * 2. Criptografia de Buffers/Arquivos de Backup (Criptografia AES-256-GCM para arquivos .dump e .tar.gz).
 * 3. Hash Seguro de Senhas (PBKDF2-SHA512 com 100.000 iterações, Salt individual e comparação em tempo constante).
 * 4. Assinatura e Verificação de Integridade de Dados (HMAC-SHA256).
 * 5. Geração de Tokens de Alta Entropia (Criptograficamente Seguros).
 * 6. Utilitários de Mascaramento Seguro de Dados (LGPD/Segurança da Informação).
 */

const SECRET_KEY =
  process.env.INTEGRATION_ENCRYPTION_KEY ||
  process.env.SESSION_SECRET ||
  process.env.BACKUP_ENCRYPTION_KEY ||
  "dev-only-secret-troque-em-producao-1234567890abcdef";

const AES_VERSION = "v1";

/**
 * Deriva uma chave de 256 bits usando HKDF-SHA512.
 */
export function deriveKey(salt = "nexus-erp-salt-v1", info = "nexus-crypto-key"): Buffer {
  return Buffer.from(
    crypto.hkdfSync("sha512", Buffer.from(SECRET_KEY, "utf8"), Buffer.from(salt, "utf8"), Buffer.from(info, "utf8"), 32)
  );
}

/**
 * Criptografa qualquer texto/dado sensível com AES-256-GCM.
 * Retorna no formato v1:iv:tag:ciphertext (base64url).
 */
export function encryptData(plaintext: string): string {
  if (!plaintext) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", deriveKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    AES_VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

/**
 * Descriptografa um valor criptografado com AES-256-GCM.
 */
export function decryptData(ciphertext: string): string {
  if (!ciphertext) return "";
  const parts = ciphertext.split(":");
  if (parts.length !== 4 || parts[0] !== AES_VERSION) {
    throw new Error("Formato de dado criptografado inválido ou versão incompatível.");
  }

  const [, ivEncoded, tagEncoded, encryptedEncoded] = parts;
  const iv = Buffer.from(ivEncoded, "base64url");
  const tag = Buffer.from(tagEncoded, "base64url");
  const encrypted = Buffer.from(encryptedEncoded, "base64url");

  const decipher = crypto.createDecipheriv("aes-256-gcm", deriveKey(), iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

/**
 * Criptografa um Buffer binário (ex: arquivo de backup do banco de dados) usando AES-256-GCM.
 */
export function encryptBuffer(data: Buffer): Buffer {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", deriveKey("backup-salt-v1", "backup-key"), iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Cabeçalho de 28 bytes: Magic (4 bytes) + IV (12 bytes) + Tag (16 bytes) + Encrypted Payload
  const magic = Buffer.from("NXBK", "utf8");
  return Buffer.concat([magic, iv, tag, encrypted]);
}

/**
 * Descriptografa um Buffer binário criptografado com AES-256-GCM.
 */
export function decryptBuffer(data: Buffer): Buffer {
  if (data.length < 32) {
    throw new Error("Buffer criptografado inválido ou muito curto.");
  }

  const magic = data.subarray(0, 4).toString("utf8");
  if (magic !== "NXBK") {
    throw new Error("Assinatura de arquivo de backup criptografado inválida.");
  }

  const iv = data.subarray(4, 16);
  const tag = data.subarray(16, 32);
  const encrypted = data.subarray(32);

  const decipher = crypto.createDecipheriv("aes-256-gcm", deriveKey("backup-salt-v1", "backup-key"), iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

/**
 * Assina uma string de dados usando HMAC-SHA256 para prevenir adulteração.
 */
export function signData(data: string): string {
  return crypto.createHmac("sha256", deriveKey("signature-salt", "hmac-key")).update(data, "utf8").digest("hex");
}

/**
 * Verifica a assinatura HMAC-SHA256 de dados contra adulteração.
 */
export function verifyDataSignature(data: string, signature: string): boolean {
  const expected = signData(data);
  const actualBuf = Buffer.from(signature, "hex");
  const expectedBuf = Buffer.from(expected, "hex");
  return actualBuf.length === expectedBuf.length && crypto.timingSafeEqual(actualBuf, expectedBuf);
}

/**
 * Gera um Salt aleatório de 16 bytes em hexadecimal.
 */
export function generateSalt(bytes = 16): string {
  return crypto.randomBytes(bytes).toString("hex");
}

/**
 * Deriva o hash de uma senha usando PBKDF2-SHA512 (100.000 iterações).
 */
export function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 100_000, 64, "sha512").toString("hex");
}

/**
 * Compara a senha informada com o hash esperado de forma segura contra timing attacks.
 */
export function verifyPassword(password: string, salt: string, expectedHashHex: string): boolean {
  const actual = Buffer.from(hashPassword(password, salt), "hex");
  const expected = Buffer.from(expectedHashHex, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

/**
 * Gera um token hexadecimal aleatório e seguro (para redefinições, tokens de loja ou sessão).
 */
export function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

/**
 * Gera um hash SHA-256 unidirecional de uma string (para impressões digitais/checksums).
 */
export function sha256(data: string): string {
  return crypto.createHash("sha256").update(data, "utf8").digest("hex");
}

/**
 * Mascara dados sensíveis para exibição segura na interface (LGPD).
 * Exemplo: "123.456.789-00" -> "***.456.789-**"
 */
export function maskSensitiveField(value: string, visibleStart = 3, visibleEnd = 2): string {
  if (!value) return "";
  const len = value.length;
  if (len <= visibleStart + visibleEnd) return "*".repeat(len);

  const start = value.slice(0, visibleStart);
  const end = value.slice(len - visibleEnd);
  const maskedLength = len - visibleStart - visibleEnd;
  return `${start}${"*".repeat(maskedLength)}${end}`;
}
