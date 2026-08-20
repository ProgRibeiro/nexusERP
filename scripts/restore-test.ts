import "dotenv/config";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { Pool } from "pg";

const execFileAsync = promisify(execFile);

function normalizeConnectionString(value: string | undefined, fallback: string) {
  if (!value || !value.trim()) return fallback;
  return value.trim();
}

function parseArgs() {
  const backupArg = process.argv.find((item) => item.startsWith("--backup="));
  const dbArg = process.argv.find((item) => item.startsWith("--db-url="));
  const keepArg = process.argv.includes("--keep-db");
  const forceArg = process.argv.includes("--force");
  return {
    backupPath: backupArg ? backupArg.split("=")[1] : undefined,
    dbUrl: dbArg ? dbArg.split("=")[1] : undefined,
    keepDb: keepArg,
    force: forceArg,
  };
}

function backupDirectory() {
  return path.resolve(process.env.BACKUP_DIR || path.join(process.cwd(), "backups"));
}

function latestBackupPath() {
  const directory = backupDirectory();
  if (!fs.existsSync(directory)) return null;
  const files = fs.readdirSync(directory)
    .filter((file) => file.endsWith(".dump") || file.endsWith(".sql") || file.endsWith(".sql.gz"))
    .sort()
    .reverse();
  return files.length > 0 ? path.join(directory, files[0]) : null;
}

async function run(command: string, args: string[], env: NodeJS.ProcessEnv = process.env) {
  await execFileAsync(command, args, { env });
}

function withTempDbUrl(value: string, name: string) {
  const url = new URL(value);
  url.pathname = `/${name}`;
  return url.toString();
}

async function ensureTempDatabase(databaseUrl: string, tempName: string) {
  const adminUrl = new URL(databaseUrl);
  adminUrl.pathname = "/postgres";
  const pool = new Pool({ connectionString: adminUrl.toString() });

  try {
    const existing = await pool.query("SELECT 1 FROM pg_database WHERE datname = $1", [tempName]);
    if (existing.rowCount && existing.rowCount > 0) {
      await pool.query(`DROP DATABASE IF EXISTS "${tempName}" WITH (FORCE)`);
    }
    await pool.query(`CREATE DATABASE "${tempName}"`);
    return { pool, tempUrl: withTempDbUrl(databaseUrl, tempName) };
  } finally {
    await pool.end();
  }
}

async function dropTempDatabase(databaseUrl: string, tempName: string) {
  const adminUrl = new URL(databaseUrl);
  adminUrl.pathname = "/postgres";
  const pool = new Pool({ connectionString: adminUrl.toString() });
  try {
    await pool.query(`DROP DATABASE IF EXISTS "${tempName}" WITH (FORCE)`);
  } finally {
    await pool.end();
  }
}

function buildRestoreEnv(connectionString: string) {
  const url = new URL(connectionString);
  const env = { ...process.env };
  if (url.password) {
    env.PGPASSWORD = decodeURIComponent(url.password);
  }
  if (url.searchParams.get("sslmode")) {
    env.PGSSLMODE = url.searchParams.get("sslmode")!;
  }
  return env;
}

async function main() {
  const args = parseArgs();
  const sourceUrl = normalizeConnectionString(args.dbUrl, process.env.DATABASE_URL || "");
  if (!sourceUrl) {
    throw new Error("É necessário DATABASE_URL ou --db-url=. Configure a conexão do PostgreSQL para testar a restauração.");
  }

  const selectedBackup = args.backupPath ? path.resolve(args.backupPath) : latestBackupPath();
  if (!selectedBackup || !fs.existsSync(selectedBackup)) {
    throw new Error(`Backup não encontrado para teste de restauração. Verifique o path ou o diretório do backups: ${backupDirectory()}`);
  }

  const validatedSql = selectedBackup.endsWith(".sql") || selectedBackup.endsWith(".sql.gz");
  if (validatedSql) {
    const maybeCompressed = selectedBackup.endsWith(".sql.gz");
    if (!maybeCompressed) {
      throw new Error("Teste automatizado suporta arquivos .dump gerados pelo pg_dump. Para .sql/.sql.gz, use restauracão manual.");
    }
  }

  const tempName = `nexus_restore_test_${Date.now()}`;
  const { tempUrl } = await ensureTempDatabase(sourceUrl, tempName);
  const restoreEnv = buildRestoreEnv(tempUrl);

  const startedAt = Date.now();
  try {
    await run("pg_restore", [
      "--clean",
      "--if-exists",
      "--no-owner",
      "--no-privileges",
      "--exit-on-error",
      "--dbname",
      tempUrl,
      selectedBackup,
    ], restoreEnv);

    const pool = new Pool({ connectionString: tempUrl });
    try {
      const result = await pool.query("SELECT 1 AS ok");
      if (!result.rows[0] || result.rows[0].ok !== 1) {
        throw new Error("Restauração concluída, mas a verificação de consulta falhou.");
      }
    } finally {
      await pool.end();
    }

    console.log(JSON.stringify({
      success: true,
      backupFile: selectedBackup,
      tempDatabase: tempName,
      restoredAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      keepDb: args.keepDb,
    }));
  } catch (error) {
    console.error(JSON.stringify({
      success: false,
      backupFile: selectedBackup,
      tempDatabase: tempName,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startedAt,
    }));
    process.exitCode = 1;
  } finally {
    if (!args.keepDb) {
      try {
        await dropTempDatabase(sourceUrl, tempName);
      } catch (error) {
        console.warn(JSON.stringify({
          warning: "Não foi possível remover o banco de teste temporário.",
          tempDatabase: tempName,
          error: error instanceof Error ? error.message : String(error),
        }));
      }
    }
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }));
  process.exit(1);
});
