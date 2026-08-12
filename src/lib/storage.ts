import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import crypto from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { logger } from "./logger";

const UPLOADS_DIR = path.resolve(process.cwd(), "public", "uploads");
// Arquivos criados depois do `next build` não entram no manifesto estático do
// Next e, por isso, `/uploads/...` podia responder 404 apesar de o arquivo
// existir no disco. A rota de API lê o diretório em tempo de execução.
const PUBLIC_URL_PREFIX = "/api/uploads";
const LEGACY_PUBLIC_URL_PREFIX = "/uploads";
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

function objectStorageConfig() {
  const bucket = process.env.STORAGE_BUCKET;
  const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY;
  if (!bucket || !accessKeyId || !secretAccessKey) return null;

  return {
    bucket,
    publicUrl: process.env.STORAGE_PUBLIC_URL?.replace(/\/$/, ""),
    client: new S3Client({
      region: process.env.STORAGE_REGION || "auto",
      endpoint: process.env.STORAGE_ENDPOINT || undefined,
      forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE === "true",
      credentials: { accessKeyId, secretAccessKey },
    }),
  };
}

function parseDataUrl(value: string) {
  const match = value.match(/^data:([a-zA-Z0-9/+.-]+);base64,([\s\S]*)$/);
  if (!match) throw new Error("Arquivo em formato data URL inválido.");

  const mime = match[1].toLowerCase();
  const extension = MIME_TO_EXT[mime];
  if (!extension) throw new Error(`Tipo de arquivo não permitido: ${mime}.`);

  const body = Buffer.from(match[2], "base64");
  if (body.length === 0 || body.length > MAX_UPLOAD_BYTES) {
    throw new Error("O arquivo deve ter entre 1 byte e 10 MB.");
  }
  return { mime, extension, body };
}

function safePrefix(prefix: string) {
  return prefix.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80) || "arquivo";
}

/** Salva uma imagem no S3/R2 quando configurado; caso contrário, usa public/uploads. */
export async function saveBase64Asset(value: string, prefix: string): Promise<string> {
  if (!value || !value.startsWith("data:")) return value;

  const { mime, extension, body } = parseDataUrl(value);
  const fileName = `${safePrefix(prefix)}-${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${extension}`;
  const objectKey = `uploads/${fileName}`;
  const remote = objectStorageConfig();

  if (remote) {
    await remote.client.send(
      new PutObjectCommand({ Bucket: remote.bucket, Key: objectKey, Body: body, ContentType: mime })
    );
    if (remote.publicUrl) return `${remote.publicUrl}/${objectKey}`;
    if (process.env.STORAGE_ENDPOINT) {
      return `${process.env.STORAGE_ENDPOINT.replace(/\/$/, "")}/${remote.bucket}/${objectKey}`;
    }
    return `https://${remote.bucket}.s3.${process.env.STORAGE_REGION || "us-east-1"}.amazonaws.com/${objectKey}`;
  }

  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOADS_DIR, fileName), body, { flag: "wx" });
  return `${PUBLIC_URL_PREFIX}/${fileName}`;
}

/** Remove apenas arquivos gerenciados por este serviço. */
export async function deleteUploadedAsset(url: string | null | undefined): Promise<void> {
  if (!url) return;

  const remote = objectStorageConfig();
  if (remote) {
    const markerIndex = url.indexOf("/uploads/");
    if (markerIndex === -1) return;
    const key = url.slice(markerIndex + 1);
    if (!/^uploads\/[a-zA-Z0-9_-]+\.[a-z0-9]+$/.test(key)) return;
    await remote.client.send(new DeleteObjectCommand({ Bucket: remote.bucket, Key: key }));
    return;
  }

  const localPrefix = [PUBLIC_URL_PREFIX, LEGACY_PUBLIC_URL_PREFIX]
    .find((prefix) => url.startsWith(`${prefix}/`));
  if (!localPrefix) return;
  const fileName = url.slice(localPrefix.length + 1);
  if (!/^[a-zA-Z0-9_-]+\.[a-z0-9]+$/.test(fileName)) return;
  try {
    await fs.unlink(path.join(UPLOADS_DIR, fileName));
  } catch (error) {
    const code = error instanceof Error && "code" in error ? String(error.code) : "UNKNOWN";
    if (code !== "ENOENT") logger.error("upload_delete_failed", { fileName, code });
  }
}
