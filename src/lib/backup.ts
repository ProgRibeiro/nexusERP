import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
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
  uploadsSha256?: string | null;
  remoteUploaded: boolean;
}

export interface BackupVerificationResult {
  fileName: string;
  valid: boolean;
  reason: string | null;
  checkedAt: string;
}

export interface BackupReadinessStatus {
  status: "ok" | "warning" | "critical";
  checkedAt: string;
  latestBackup: BackupMetadata | null;
  latestBackupAgeHours: number | null;
  maxAllowedAgeHours: number;
  issues: string[];
}

const RETENTION_MS: Record<BackupType, number> = {
  hourly: 48 * 60 * 60 * 1000,
  daily: 30 * 24 * 60 * 60 * 1000,
  weekly: 12 * 7 * 24 * 60 * 60 * 1000,
  manual: 30 * 24 * 60 * 60 * 1000,
  "pre-update": 30 * 24 * 60 * 60 * 1000,
  "pre-restore": 30 * 24 * 60 * 60 * 1000,
};

function parsePositiveNumber(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function backupDirectory() {
  if (process.env.BACKUP_DIR) {
    return path.resolve(/* turbopackIgnore: true */ process.env.BACKUP_DIR);
  }
  return path.join(process.cwd(), "backups");
}

function backupLockMaxAgeMinutes() {
  return parsePositiveNumber(process.env.BACKUP_LOCK_MAX_MINUTES, 240);
}

function backupMaxAgeHours() {
  return parsePositiveNumber(process.env.BACKUP_MAX_AGE_HOURS, 26);
}

function removeFileIfExists(filePath: string) {
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

function acquireBackupLock(lockPath: string): number {
  try {
    const fd = fs.openSync(lockPath, "wx", 0o600);
    const payload = JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() });
    fs.writeFileSync(fd, `${payload}\n`, { encoding: "utf8" });
    return fd;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
      throw error;
    }
    if (!fs.existsSync(lockPath)) {
      return acquireBackupLock(lockPath);
    }
    const maxAgeMs = backupLockMaxAgeMinutes() * 60 * 1000;
    const lockAgeMs = Date.now() - fs.statSync(lockPath).mtimeMs;
    if (lockAgeMs > maxAgeMs) {
      logger.warn("stale_backup_lock_removed", {
        lockPath,
        lockAgeMinutes: Math.round(lockAgeMs / 60_000),
        maxAgeMinutes: backupLockMaxAgeMinutes(),
      });
      removeFileIfExists(lockPath);
      return acquireBackupLock(lockPath);
    }
    const roundedMinutes = Math.max(1, Math.round(lockAgeMs / 60_000));
    throw new Error(`Já existe um backup em andamento há ${roundedMinutes} minuto(s).`);
  }
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
  const key = `${remote.prefix}/${path.basename(filePath)}`;
  const expectedSize = fs.statSync(filePath).size;
  await remote.client.send(new PutObjectCommand({
    Bucket: remote.bucket,
    Key: key,
    Body: fs.createReadStream(filePath),
    ContentType: contentType,
  }));
  const uploaded = await remote.client.send(new HeadObjectCommand({
    Bucket: remote.bucket,
    Key: key,
  }));
  if (uploaded.ContentLength !== expectedSize) {
    throw new Error(`Cópia externa incompleta para ${path.basename(filePath)}.`);
  }
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
      for (const candidate of [
        metadata.fileName,
        `${metadata.fileName}.sha256`,
        metadata.uploadsFileName,
        metadata.uploadsFileName ? `${metadata.uploadsFileName}.sha256` : null,
        fileName,
      ]) {
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
  const lock = acquireBackupLock(lockPath);

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
      const uploadsDigest = sha256(uploadsPath);
      fs.writeFileSync(`${uploadsPath}.sha256`, `${uploadsDigest}  ${uploadsName}\n`, { mode: 0o600 });
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
      uploadsSha256: uploadsName ? sha256(path.join(directory, uploadsName)) : null,
      remoteUploaded: false,
    };

    const metadataPath = path.join(directory, `${baseName}.json`);
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), { mode: 0o600 });

    const uploadsUploaded = uploadsName
      ? await uploadFile(path.join(directory, uploadsName), "application/gzip")
      : true;
    const uploadsChecksumUploaded = uploadsName
      ? await uploadFile(`${path.join(directory, uploadsName)}.sha256`, "text/plain")
      : true;
    const dumpUploaded = await uploadFile(dumpPath, "application/octet-stream");
    const checksumUploaded = await uploadFile(`${dumpPath}.sha256`, "text/plain");
    metadata.remoteUploaded = dumpUploaded && checksumUploaded && uploadsUploaded && uploadsChecksumUploaded;
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), { mode: 0o600 });
    const metadataUploaded = await uploadFile(metadataPath, "application/json");
    metadata.remoteUploaded = metadata.remoteUploaded && metadataUploaded;
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), { mode: 0o600 });
    if (metadata.remoteUploaded) await uploadFile(metadataPath, "application/json");
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
    fs.closeSync(lock);
    removeFileIfExists(lockPath);
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
  return verifyBackupDetailed(filePath).valid;
}

export function verifyBackupDetailed(filePath: string): BackupVerificationResult {
  const checkedAt = new Date().toISOString();
  const absolute = path.resolve(filePath);
  const checksumPath = `${absolute}.sha256`;
  const fileName = path.basename(absolute);

  if (!fs.existsSync(absolute)) {
    return { fileName, valid: false, reason: "Arquivo de backup não encontrado.", checkedAt };
  }
  if (!fs.existsSync(checksumPath)) {
    return { fileName, valid: false, reason: "Arquivo de checksum (.sha256) não encontrado.", checkedAt };
  }
  const expected = fs.readFileSync(checksumPath, "utf8").trim().split(/\s+/)[0]?.toLowerCase() || "";
  if (!/^[a-f0-9]{64}$/.test(expected)) {
    return { fileName, valid: false, reason: "Checksum esperado inválido no arquivo .sha256.", checkedAt };
  }

  const current = sha256(absolute);
  const valid = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(current));
  return {
    fileName,
    valid,
    reason: valid ? null : "Checksum divergente: arquivo pode estar corrompido.",
    checkedAt,
  };
}

export function verifyRecentBackups(limit = 3): BackupVerificationResult[] {
  const checkedLimit = Math.max(1, Math.min(20, Math.floor(limit)));
  const directory = backupDirectory();
  return listBackups(checkedLimit).map((backup) => {
    const result = verifyBackupDetailed(path.join(directory, backup.fileName));
    if (!result.valid) return result;
    if (backup.uploadsFileName && !fs.existsSync(path.join(directory, backup.uploadsFileName))) {
      return {
        fileName: backup.fileName,
        valid: false,
        reason: `Pacote de uploads ausente: ${backup.uploadsFileName}.`,
        checkedAt: new Date().toISOString(),
      };
    }
    if (backup.uploadsFileName && backup.uploadsSha256) {
      const uploadsPath = path.join(directory, backup.uploadsFileName);
      const checksumPath = `${uploadsPath}.sha256`;
      if (!fs.existsSync(checksumPath) || sha256(uploadsPath) !== backup.uploadsSha256) {
        return {
          fileName: backup.fileName,
          valid: false,
          reason: `Checksum do pacote de uploads inválido: ${backup.uploadsFileName}.`,
          checkedAt: new Date().toISOString(),
        };
      }
    }
    return result;
  });
}

export function getBackupReadinessStatus(options?: { maxAgeHours?: number; verifyLatestChecksum?: boolean }): BackupReadinessStatus {
  const checkedAt = new Date().toISOString();
  const maxAllowedAgeHours = options?.maxAgeHours && options.maxAgeHours > 0
    ? options.maxAgeHours
    : backupMaxAgeHours();
  const latestBackup = listBackups(1)[0] ?? null;
  const issues: string[] = [];
  let latestBackupAgeHours: number | null = null;
  let hasCriticalIssue = false;

  if (!latestBackup) {
    issues.push("Nenhum backup disponível.");
    hasCriticalIssue = true;
  } else {
    latestBackupAgeHours = (Date.now() - new Date(latestBackup.createdAt).getTime()) / (60 * 60 * 1000);
    if (latestBackupAgeHours > maxAllowedAgeHours) {
      hasCriticalIssue = true;
      issues.push(
        `Último backup está antigo (${latestBackupAgeHours.toFixed(1)}h, limite ${maxAllowedAgeHours}h).`
      );
    }
    if (!latestBackup.remoteUploaded) {
      issues.push("Último backup sem cópia externa (BACKUP_BUCKET não confirmado).");
    }
    if (options?.verifyLatestChecksum) {
      const verification = verifyBackupDetailed(path.join(backupDirectory(), latestBackup.fileName));
      if (!verification.valid) {
        hasCriticalIssue = true;
        issues.push(verification.reason || "Falha de integridade no último backup.");
      }
    }
  }

  const status: BackupReadinessStatus["status"] = hasCriticalIssue
    ? "critical"
    : issues.length > 0
      ? "warning"
      : "ok";

  return {
    status,
    checkedAt,
    latestBackup,
    latestBackupAgeHours: latestBackupAgeHours === null ? null : Number(latestBackupAgeHours.toFixed(2)),
    maxAllowedAgeHours,
    issues,
  };
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
