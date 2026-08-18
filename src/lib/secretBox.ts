import { encryptData, decryptData } from "./crypto";

export function encryptSecret(value: string): string {
  if (!value) throw new Error("Não é possível criptografar um valor vazio.");
  return encryptData(value);
}

export function decryptSecret(value: string): string {
  return decryptData(value);
}
