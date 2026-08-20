import "dotenv/config";
import { getBackupReadinessStatus, verifyRecentBackups } from "../src/lib/backup";

function parseArg(prefix: string): string | undefined {
  for (let index = process.argv.length - 1; index >= 0; index -= 1) {
    const arg = process.argv[index];
    if (arg.startsWith(prefix)) return arg.slice(prefix.length);
  }
  return undefined;
}

function positiveNumber(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function main() {
  const maxToVerify = Math.max(1, Math.min(20, Math.floor(positiveNumber(parseArg("--max="), 3))));
  const maxAgeHours = positiveNumber(parseArg("--max-age-hours="), Number(process.env.BACKUP_MAX_AGE_HOURS || "26"));
  const readiness = getBackupReadinessStatus({ maxAgeHours, verifyLatestChecksum: true });
  const verifications = verifyRecentBackups(maxToVerify);

  const invalidBackups = verifications.filter((item) => !item.valid);
  const audit = {
    checkedAt: new Date().toISOString(),
    readiness,
    verifiedCount: verifications.length,
    invalidCount: invalidBackups.length,
    verifications,
  };

  if (readiness.status === "critical" || invalidBackups.length > 0) {
    console.error(JSON.stringify({ success: false, ...audit }, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify({ success: true, ...audit }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
