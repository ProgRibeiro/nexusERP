import { createReadStream, promises as fs } from "fs";
import path from "path";
import { Readable } from "stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPLOADS_DIR = path.resolve(process.cwd(), "public", "uploads");
const SAFE_FILE_NAME = /^[a-zA-Z0-9_-]+\.(?:jpg|jpeg|png|webp|gif|pdf|xml)$/i;

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
  ".xml": "application/xml; charset=utf-8",
};

function notFound() {
  return new Response("Arquivo não encontrado.", {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  });
}

async function getStoredFile(filename: string) {
  if (!SAFE_FILE_NAME.test(filename)) return null;
  const filePath = path.join(UPLOADS_DIR, filename);
  const stat = await fs.stat(filePath).catch(() => null);
  if (!stat?.isFile()) return null;
  return { filePath, stat };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ filename: string }> },
) {
  const { filename } = await context.params;
  const stored = await getStoredFile(filename);
  if (!stored) return notFound();

  const etag = `\"${stored.stat.size.toString(16)}-${Math.trunc(stored.stat.mtimeMs).toString(16)}\"`;
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  const stream = createReadStream(/* turbopackIgnore: true */ stored.filePath);
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      "Content-Type": CONTENT_TYPES[path.extname(filename).toLowerCase()] || "application/octet-stream",
      "Content-Length": String(stored.stat.size),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      ETag: etag,
    },
  });
}

export async function HEAD(
  _request: Request,
  context: { params: Promise<{ filename: string }> },
) {
  const { filename } = await context.params;
  const stored = await getStoredFile(filename);
  if (!stored) return notFound();
  return new Response(null, {
    headers: {
      "Content-Type": CONTENT_TYPES[path.extname(filename).toLowerCase()] || "application/octet-stream",
      "Content-Length": String(stored.stat.size),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
