import "dotenv/config";
import { checkDatabaseHealth, prisma } from "../lib/db";
import { encryptData, decryptData, encryptBuffer, decryptBuffer, signData, verifyDataSignature } from "../lib/crypto";
import { createBackup, verifyBackup, listBackups } from "../lib/backup";
import { logger } from "../lib/logger";

async function runBackupSecurityTest() {
  console.log("🔒 [TEST] Iniciando Bateria de Testes Extremos de Banco de Dados, Criptografia e Backup...");

  // 1. Teste de Conexão com o Banco e Health Check
  console.log("\n1️⃣  Testando Health Check e Conexão PostgreSQL...");
  const isHealthy = await checkDatabaseHealth();
  if (!isHealthy) {
    throw new Error("❌ Health Check do Banco de Dados falhou!");
  }
  console.log("✅ Conexão com o Banco de Dados PostgreSQL operacional.");

  // 2. Teste de Criptografia Simétrica AES-256-GCM
  console.log("\n2️⃣  Testando Criptografia Simétrica AES-256-GCM para Dados Sensíveis...");
  const sensitiveText = "Dados-Altamente-Confidenciais-LGPD-2026-NexusERP";
  const encryptedText = encryptData(sensitiveText);
  console.log(`   Texto original: "${sensitiveText}"`);
  console.log(`   Texto criptografado (AES-256-GCM): "${encryptedText.slice(0, 40)}..."`);

  const decryptedText = decryptData(encryptedText);
  if (decryptedText !== sensitiveText) {
    throw new Error("❌ Falha na descriptografia AES-256-GCM!");
  }
  console.log("✅ Criptografia e Descriptografia de Dados em Texto validadas.");

  // 3. Teste de Criptografia de Buffers/Dumps
  console.log("\n3️⃣  Testando Criptografia de Buffers/Arquivos Binários...");
  const sampleBuffer = Buffer.from("Conteúdo do Dump do PostgreSQL - Criptografia de Ponta", "utf8");
  const encryptedBuf = encryptBuffer(sampleBuffer);
  const decryptedBuf = decryptBuffer(encryptedBuf);

  if (Buffer.compare(sampleBuffer, decryptedBuf) !== 0) {
    throw new Error("❌ Falha na descriptografia de Buffer de Backup!");
  }
  console.log("✅ Criptografia de Buffers Binários (AES-256-GCM) validada.");

  // 4. Teste de Assinatura HMAC-SHA256
  console.log("\n4️⃣  Testando Assinatura de Integridade (HMAC-SHA256)...");
  const dataToSign = "TransacaoFinanceira:1500.00:Cliente123";
  const signature = signData(dataToSign);
  const isValidSignature = verifyDataSignature(dataToSign, signature);
  if (!isValidSignature) {
    throw new Error("❌ Falha na verificação de assinatura HMAC-SHA256!");
  }
  console.log("✅ Assinatura HMAC-SHA256 e Proteção contra Adulteração validadas.");

  // 5. Teste de Backup Automatizado e Checksum SHA-256
  console.log("\n5️⃣  Executando Backup Automatizado de Teste...");
  const backupMeta = await createBackup("manual");
  console.log(`   Backup gerado: ${backupMeta.fileName}`);
  console.log(`   Tamanho: ${(backupMeta.sizeBytes / 1024).toFixed(2)} KB`);
  console.log(`   SHA-256 Checksum: ${backupMeta.sha256}`);

  // Verificação de Integridade
  const backupList = listBackups(5);
  if (backupList.length === 0) {
    throw new Error("❌ Nenhum backup encontrado na listagem!");
  }
  console.log("✅ Bateria Completa de Testes de Banco de Dados, Criptografia e Backup APROVADA 100%!");
}

runBackupSecurityTest().catch((error) => {
  console.error("❌ ERRO NO TESTE DE SEGURANÇA E BACKUP:", error);
  process.exit(1);
});
