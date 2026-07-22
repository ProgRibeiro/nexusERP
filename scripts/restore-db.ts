import "dotenv/config";
import { createBackup, restoreBackup, verifyBackup } from "../src/lib/backup";

async function main() {
  const filePath = process.argv[2];
  if (!filePath) throw new Error("Uso: npm run backup:restore -- caminho/backup.dump [--confirm]");
  if (!verifyBackup(filePath)) throw new Error("Backup ausente ou checksum inválido.");
  if (!process.argv.includes("--confirm")) {
    console.log("Backup verificado. Para restaurar de verdade, repita com --confirm.");
    return;
  }
  console.log("Criando backup de segurança antes da restauração...");
  await createBackup("pre-restore");
  await restoreBackup(filePath);
  console.log("Restauração concluída com sucesso.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
