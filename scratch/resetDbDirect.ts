import { prisma } from "../src/lib/db";
import { createBackup } from "../src/lib/backup";

async function main() {
  console.log("1. Gerando snapshot de segurança pré-zeramento...");
  try {
    const backup = await createBackup("pre-restore");
    console.log("   Snapshot salvo:", backup.fileName);
  } catch (err: any) {
    console.warn("   Backup aviso:", err.message);
  }

  console.log("2. Limpando tabelas de dados operacionais de teste...");
  await prisma.$transaction(async (tx) => {
    await tx.serviceOrderAsset.deleteMany({});
    await tx.completionReport.deleteMany({});
    await tx.serviceOrderPhoto.deleteMany({});
    await tx.serviceOrderMaterial.deleteMany({});
    await tx.serviceOrderItem.deleteMany({});
    await tx.serviceOrderStatusHistory.deleteMany({});
    await tx.timeEntry.deleteMany({});
    await tx.visitStatusHistory.deleteMany({});
    await tx.measurementReading.deleteMany({});
    await tx.formSubmission.deleteMany({});
    await tx.serviceVisit.deleteMany({});
    await tx.financialTransaction.deleteMany({});
    await tx.accountsReceivable.deleteMany({});
    await tx.accountsPayable.deleteMany({});
    await tx.invoice.deleteMany({});
    await tx.nfseRecord.deleteMany({});
    await tx.serviceOrder.deleteMany({});
    await tx.quoteItem.deleteMany({});
    await tx.quoteVersion.deleteMany({});
    await tx.quoteApproval.deleteMany({});
    await tx.quote.deleteMany({});
    await tx.contractItem.deleteMany({});
    await tx.contract.deleteMany({});
    await tx.crmActivity.deleteMany({});
    await tx.lead.deleteMany({});
    await tx.clientContact.deleteMany({});
    await tx.clientAddress.deleteMany({});
    await tx.clientEquipment.deleteMany({});
    await tx.clientStoreProject.deleteMany({});
    await tx.client.deleteMany({});
    await tx.stockMovement.deleteMany({});
    await tx.product.deleteMany({});
  });

  console.log("=== BANCO DE DADOS OPERACIONAL ZERADO COM SUCESSO! ===");
  console.log("✔ Todos os Clientes, Orçamentos, Ordens de Serviço, Contratos e Faturamentos foram limpos.");
  console.log("✔ As contas de usuários, configurações da empresa e permissões foram preservadas.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
