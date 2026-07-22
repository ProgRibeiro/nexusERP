import "dotenv/config";
import { BackupType, createBackup } from "../src/lib/backup";

const allowed: BackupType[] = ["hourly", "daily", "weekly", "manual", "pre-update", "pre-restore"];

async function main() {
  const requested = process.argv.find((arg) => arg.startsWith("--type="))?.split("=")[1] as BackupType | undefined;
  const type: BackupType = requested && allowed.includes(requested) ? requested : "manual";
  const backup = await createBackup(type);
  console.log(JSON.stringify({
    success: true,
    fileName: backup.fileName,
    sizeBytes: backup.sizeBytes,
    sha256: backup.sha256,
    remoteUploaded: backup.remoteUploaded,
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
