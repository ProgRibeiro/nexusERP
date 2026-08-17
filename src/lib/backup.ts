import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { spawn } from "child_process";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { logger } from "./logger";

export type BackupType = "hourly" | "daily" | "weekly" | "manual" | "pre-update" | "pre-restore";

export interface BackupMetadata {
  version: 1;
  type: BackupType;
  createdAt: string;
  fileName: string;
  sizeBytes: number;
  sha256: string;
  database: string;
  appVersion: string;
  gitCommit: string | null;
  uploadsFileName: string | null;
  remoteUploaded: boolean;
}

const RETENTION_MS: Record<BackupType, number> = {
  hourly: 48 * 60 * 60 * 1000,
  daily: 30 * 24 * 60 * 60 * 1000,
  weekly: 12 * 7 * 24 * 60 * 60 * 1000,
  manual: 30 * 24 * 60 * 60 * 1000,
  "pre-update": 30 * 24 * 60 * 60 * 1000,
  "pre-restore": 30 * 24 * 60 * 60 * 1000,
};

function backupDirectory() {
  if (process.env.BACKUP_DIR) {
    return path.resolve(/* turbopackIgnore: true */ process.env.BACKUP_DIR);
  }
  return path.join(process.cwd(), "backups");
}

function resolveBinary(command: string): string {
  if (process.platform === "win32" && (command === "pg_dump" || command === "pg_restore")) {
    const defaultPgBin = `C:\\Program Files\\PostgreSQL\\18\\bin\\${command}.exe`;
    if (fs.existsSync(defaultPgBin)) return defaultPgBin;
  }
  return command;
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv = process.env) {
  return new Promise<string>((resolve, reject) => {
    const executable = resolveBinary(command);
    const cmdToRun = process.platform === "win32" && executable.includes(" ") ? `"${executable}"` : executable;
    const child = spawn(cmdToRun, args, { env, stdio: ["ignore", "pipe", "pipe"], shell: process.platform === "win32" });


    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) return resolve(Buffer.concat(stdout).toString("utf8"));
      reject(new Error(Buffer.concat(stderr).toString("utf8") || `${command} terminou com código ${code}`));
    });
  });
}

function databaseCommand(connectionString: string) {
  const url = new URL(connectionString);
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  const env = {
    ...process.env,
    ...(url.password ? { PGPASSWORD: decodeURIComponent(url.password) } : {}),
    ...(url.searchParams.get("sslmode") ? { PGSSLMODE: url.searchParams.get("sslmode")! } : {}),
  };
  const args = [
    "--host", url.hostname || "localhost",
    "--port", url.port || "5432",
    "--username", decodeURIComponent(url.username),
    "--dbname", database,
  ];
  return { args, env, database: `${url.hostname || "localhost"}:${url.port || "5432"}/${database}` };
}

function sha256(filePath: string) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

async function currentGitCommit() {
  try {
    return (await run("git", ["rev-parse", "--short=12", "HEAD"])).trim() || null;
  } catch {
    return null;
  }
}

function remoteClient() {
  const bucket = process.env.BACKUP_BUCKET;
  const accessKeyId = process.env.BACKUP_ACCESS_KEY_ID || process.env.STORAGE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.BACKUP_SECRET_ACCESS_KEY || process.env.STORAGE_SECRET_ACCESS_KEY;
  if (!bucket || !accessKeyId || !secretAccessKey) return null;
  return {
    bucket,
    prefix: (process.env.BACKUP_PREFIX || "nexus-erp").replace(/^\/+|\/+$/g, ""),
    client: new S3Client({
      region: process.env.BACKUP_REGION || process.env.STORAGE_REGION || "auto",
      endpoint: process.env.BACKUP_ENDPOINT || process.env.STORAGE_ENDPOINT || undefined,
      forcePathStyle: process.env.BACKUP_FORCE_PATH_STYLE === "true" || process.env.STORAGE_FORCE_PATH_STYLE === "true",
      credentials: { accessKeyId, secretAccessKey },
    }),
  };
}

async function uploadFile(filePath: string, contentType: string) {
  const remote = remoteClient();
  if (!remote) return false;
  await remote.client.send(new PutObjectCommand({
    Bucket: remote.bucket,
    Key: `${remote.prefix}/${path.basename(filePath)}`,
    Body: fs.createReadStream(filePath),
    ContentType: contentType,
  }));
  return true;
}

function cleanupExpiredBackups(directory: string) {
  const now = Date.now();
  let removed = 0;
  for (const fileName of fs.readdirSync(directory).filter((name) => name.endsWith(".json") && name !== "latest.json")) {
    const metadataPath = path.join(directory, fileName);
    try {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8")) as BackupMetadata;
      const retention = RETENTION_MS[metadata.type] || RETENTION_MS.manual;
      if (now - new Date(metadata.createdAt).getTime() <= retention) continue;
      for (const candidate of [metadata.fileName, `${metadata.fileName}.sha256`, metadata.uploadsFileName, fileName]) {
        if (!candidate) continue;
        const candidatePath = path.join(directory, candidate);
        if (fs.existsSync(candidatePath)) fs.unlinkSync(candidatePath);
      }
      removed++;
    } catch (error) {
      logger.warn("backup_metadata_cleanup_skipped", { fileName, error: String(error) });
    }
  }
  return removed;
}

export async function createBackup(type: BackupType = "manual"): Promise<BackupMetadata> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL não configurada.");

  const directory = backupDirectory();
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const lockPath = path.join(directory, ".backup.lock");
  let lock: number | null = null;

  try {
    lock = fs.openSync(lockPath, "wx", 0o600);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error("Já existe um backup em andamento.");
    }
    throw error;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const baseName = `nexus-${type}-${timestamp}`;
  const dumpName = `${baseName}.dump`;
  const dumpPath = path.join(directory, dumpName);
  const temporaryDump = `${dumpPath}.tmp`;
  let uploadsName: string | null = null;

  try {
    const database = databaseCommand(connectionString);
    await run("pg_dump", [
      ...database.args,
      "--format=custom",
      "--compress=9",
      "--no-owner",
      "--no-privileges",
      "--file", temporaryDump,
    ], database.env);

    if (!fs.existsSync(temporaryDump) || fs.statSync(temporaryDump).size < 1024) {
      throw new Error("O dump gerado está vazio ou incompleto.");
    }
    await run("pg_restore", ["--list", temporaryDump], database.env);
    fs.renameSync(temporaryDump, dumpPath);
    fs.chmodSync(dumpPath, 0o600);

    const digest = sha256(dumpPath);
    fs.writeFileSync(`${dumpPath}.sha256`, `${digest}  ${dumpName}\n`, { mode: 0o600 });

    const uploadsDirectory = path.resolve(process.cwd(), "public", "uploads");
    if (fs.existsSync(uploadsDirectory) && fs.readdirSync(uploadsDirectory).some((name) => name !== ".gitkeep")) {
      uploadsName = `${baseName}-uploads.tar.gz`;
      const uploadsPath = path.join(directory, uploadsName);
      const temporaryUploads = `${uploadsPath}.tmp`;
      await run("tar", ["-czf", temporaryUploads, "-C", path.dirname(uploadsDirectory), path.basename(uploadsDirectory)]);
      await run("tar", ["-tzf", temporaryUploads]);
      fs.renameSync(temporaryUploads, uploadsPath);
      fs.chmodSync(uploadsPath, 0o600);
    }

    const metadata: BackupMetadata = {
      version: 1,
      type,
      createdAt: new Date().toISOString(),
      fileName: dumpName,
      sizeBytes: fs.statSync(dumpPath).size,
      sha256: digest,
      database: database.database,
      appVersion: process.env.npm_package_version || "unknown",
      gitCommit: await currentGitCommit(),
      uploadsFileName: uploadsName,
      remoteUploaded: false,
    };

    const metadataPath = path.join(directory, `${baseName}.json`);
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), { mode: 0o600 });

    const uploadsUploaded = uploadsName
      ? await uploadFile(path.join(directory, uploadsName), "application/gzip")
      : true;
    const dumpUploaded = await uploadFile(dumpPath, "application/octet-stream");
    const checksumUploaded = await uploadFile(`${dumpPath}.sha256`, "text/plain");
    metadata.remoteUploaded = dumpUploaded && checksumUploaded && uploadsUploaded;
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), { mode: 0o600 });
    await uploadFile(metadataPath, "application/json");
    fs.writeFileSync(path.join(directory, "latest.json"), JSON.stringify(metadata, null, 2), { mode: 0o600 });

    const cleanedCount = cleanupExpiredBackups(directory);
    logger.info("backup_completed", {
      type,
      fileName: dumpName,
      sizeBytes: metadata.sizeBytes,
      sha256: digest,
      remoteUploaded: metadata.remoteUploaded,
      cleanedCount,
    });
    return metadata;
  } catch (error) {
    for (const temporary of [temporaryDump, `${path.join(directory, baseName)}-uploads.tar.gz.tmp`]) {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
    throw error;
  } finally {
    if (lock !== null) fs.closeSync(lock);
    if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath);
  }
}

export function listBackups(limit = 20): BackupMetadata[] {
  const directory = backupDirectory();
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory)
    .filter((name) => name.endsWith(".json") && name !== "latest.json")
    .flatMap((name) => {
      try {
        return [JSON.parse(fs.readFileSync(path.join(directory, name), "utf8")) as BackupMetadata];
      } catch {
        return [];
      }
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export function verifyBackup(filePath: string) {
  const absolute = path.resolve(filePath);
  const checksumPath = `${absolute}.sha256`;
  if (!fs.existsSync(absolute) || !fs.existsSync(checksumPath)) return false;
  const expected = fs.readFileSync(checksumPath, "utf8").trim().split(/\s+/)[0];
  return expected.length === 64 && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sha256(absolute)));
}

export async function restoreBackup(filePath: string) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL não configurada.");
  const absolute = path.resolve(filePath);
  if (!verifyBackup(absolute)) throw new Error("Checksum inválido: o backup pode estar corrompido.");
  await run("pg_restore", [
    ...databaseCommand(connectionString).args,
    "--clean",
    "--if-exists",
    "--no-owner",
    "--no-privileges",
    "--exit-on-error",
    absolute,
  ], databaseCommand(connectionString).env);
}
