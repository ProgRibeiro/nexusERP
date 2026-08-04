import crypto from "crypto";

const VERSION = "v1";

function encryptionKey() {
  const secret = process.env.INTEGRATION_ENCRYPTION_KEY || process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("INTEGRATION_ENCRYPTION_KEY não configurada. Defina uma chave aleatória com pelo menos 32 caracteres.");
  }
  return crypto.createHash("sha256").update(secret, "utf8").digest();
}

export function encryptSecret(value: string) {
  if (!value) throw new Error("Não é possível criptografar um valor vazio.");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(":");
}

export function decryptSecret(value: string) {
  const [version, ivEncoded, tagEncoded, encryptedEncoded] = value.split(":");
  if (version !== VERSION || !ivEncoded || !tagEncoded || !encryptedEncoded) {
    throw new Error("Credencial criptografada em formato inválido.");
  }
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivEncoded, "base64url"));
  decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedEncoded, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
