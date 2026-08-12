import "dotenv/config";

// Server Actions executadas fora de uma requisicao Next real.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nextCache = require("next/cache");
nextCache.revalidatePath = () => {};
nextCache.revalidateTag = () => {};

let mockSessionToken: string | null = null;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nextHeaders = require("next/headers");
nextHeaders.cookies = async () => ({
  get: (name: string) => name === "nx_session" && mockSessionToken ? { name, value: mockSessionToken } : undefined,
  set: () => {},
  delete: () => {},
});

async function main() {
  const { prisma } = await import("../lib/db");
  const { encryptSession } = await import("../lib/session");
  const {
    createPayable,
    createReceivable,
    estornoTransaction,
    payBill,
    receivePayment,
  } = await import("../app/actions/financialActions");
  const { processBilling } = await import("../app/actions/billingActions");

  const admin = await prisma.user.findUnique({ where: { email: "admin@erp.com" }, include: { role: true } });
  const restricted = await prisma.user.findFirst({ where: { NOT: { permissions: { contains: "financeiro.write" } } }, include: { role: true } });
  const client = await prisma.client.findFirst();
  const bank = await prisma.bankAccount.findFirst();
  if (!admin || !restricted || !client || !bank) throw new Error("Teste exige admin, usuario restrito, cliente e conta bancaria.");

  const tokenFor = (user: typeof admin) => encryptSession({
    userId: user.id,
    name: user.name,
    email: user.email,
    roleName: user.role?.name || "Sem perfil",
    permissions: JSON.parse(user.permissions),
    exp: Date.now() + 60 * 60 * 1000,
  });

  mockSessionToken = await tokenFor(admin);
  const initialBalance = Number(bank.balance);
  const receivableIds: string[] = [];
  const payableIds: string[] = [];
  const serviceOrderIds: string[] = [];

  const assert = (condition: unknown, message: string) => {
    if (!condition) throw new Error(message);
  };

  try {
    const partial = await createReceivable({ clientId: client.id, totalValue: 100, dueDate: new Date(), notes: "RISK_TEST_PARTIAL" }, admin.id);
    assert(partial.success && partial.receivable, partial.error || "Falha ao criar recebivel parcial.");
    const partialId = partial.receivable!.id;
    receivableIds.push(partialId);

    const firstReceipt = await receivePayment({ receivableId: partialId, receivedValue: 40, paymentMethod: "PIX", bankAccountId: bank.id, userId: admin.id });
    assert(firstReceipt.success, firstReceipt.error || "Falha no recebimento parcial.");
    const partialState = await prisma.accountsReceivable.findUniqueOrThrow({ where: { id: partialId } });
    assert(Number(partialState.pendingValue) === 60 && partialState.status === "PARCIAL", "Recebimento parcial calculado incorretamente.");

    const overpayment = await receivePayment({ receivableId: partialId, receivedValue: 61, paymentMethod: "PIX", bankAccountId: bank.id, userId: admin.id });
    assert(!overpayment.success, "O sistema aceitou recebimento maior que o saldo.");

    const finalReceipt = await receivePayment({ receivableId: partialId, receivedValue: 60, paymentMethod: "PIX", bankAccountId: bank.id, userId: admin.id });
    assert(finalReceipt.success, finalReceipt.error || "Falha ao liquidar saldo restante.");
    const settled = await prisma.accountsReceivable.findUniqueOrThrow({ where: { id: partialId } });
    assert(Number(settled.pendingValue) === 0 && settled.status === "PAGO", "Liquidacao total inconsistente.");

    const lastReceipt = await prisma.financialTransaction.findFirstOrThrow({ where: { accountsReceivableId: partialId, category: { not: "ESTORNO" } }, orderBy: { date: "desc" } });
    const reversed = await estornoTransaction(lastReceipt.id, "Teste automatizado de estorno", admin.id);
    assert(reversed.success, reversed.error || "Falha ao estornar recebimento.");
    const reopened = await prisma.accountsReceivable.findUniqueOrThrow({ where: { id: partialId } });
    assert(Number(reopened.pendingValue) === 60 && reopened.status === "PARCIAL", "Estorno nao reabriu corretamente o saldo.");

    const duplicatePayable = await createPayable({ providerName: "RISK_TEST", description: "Concorrencia de pagamento", category: "TESTE", costCenter: "TESTE", value: 25, dueDate: new Date() }, admin.id);
    assert(duplicatePayable.success && duplicatePayable.payable, duplicatePayable.error || "Falha ao criar pagavel concorrente.");
    const payableId = duplicatePayable.payable!.id;
    payableIds.push(payableId);
    const payResults = await Promise.all([
      payBill({ payableId, paymentMethod: "PIX", bankAccountId: bank.id, userId: admin.id }),
      payBill({ payableId, paymentMethod: "PIX", bankAccountId: bank.id, userId: admin.id }),
    ]);
    assert(payResults.filter((item) => item.success).length === 1, "Pagamento simultaneo gerou baixa duplicada.");
    assert(await prisma.financialTransaction.count({ where: { accountsPayableId: payableId, category: { not: "ESTORNO" } } }) === 1, "Pagamento duplicou lancamentos no extrato.");

    const concurrentRec = await createReceivable({ clientId: client.id, totalValue: 80, dueDate: new Date(), notes: "RISK_TEST_CONCURRENCY" }, admin.id);
    assert(concurrentRec.success && concurrentRec.receivable, concurrentRec.error || "Falha ao criar recebivel concorrente.");
    const concurrentId = concurrentRec.receivable!.id;
    receivableIds.push(concurrentId);
    const receiptResults = await Promise.all([
      receivePayment({ receivableId: concurrentId, receivedValue: 80, paymentMethod: "PIX", bankAccountId: bank.id, userId: admin.id }),
      receivePayment({ receivableId: concurrentId, receivedValue: 80, paymentMethod: "PIX", bankAccountId: bank.id, userId: admin.id }),
    ]);
    assert(receiptResults.filter((item) => item.success).length === 1, "Recebimento simultaneo gerou baixa duplicada.");
    assert(await prisma.financialTransaction.count({ where: { accountsReceivableId: concurrentId, category: { not: "ESTORNO" } } }) === 1, "Recebimento duplicou lancamentos no extrato.");

    mockSessionToken = await tokenFor(restricted);
    const denied = await createPayable({ providerName: "RISK_TEST_DENIED", description: "Permissao", category: "TESTE", costCenter: "TESTE", value: 1, dueDate: new Date() }, restricted.id);
    assert(!denied.success, `Usuario ${restricted.email} sem financeiro.write conseguiu criar despesa.`);

    mockSessionToken = await tokenFor(admin);
    const riskCode = `OS-RISK-${Date.now()}`;
    const riskOS = await prisma.serviceOrder.create({
      data: { code: riskCode, clientId: client.id, status: "CRIADA", type: "CORRETIVA", problemReported: "Teste de concorrencia fiscal" },
    });
    serviceOrderIds.push(riskOS.id);
    const prematureBilling = await processBilling({ osId: riskOS.id, invoiceCode: `NF-PREM-${Date.now()}`, totalValue: 90, taxPercent: 5, installments: 1, paymentMethod: "PIX", userId: admin.id });
    assert(!prematureBilling.success, "OS sem liberacao foi faturada.");
    await prisma.serviceOrder.update({ where: { id: riskOS.id }, data: { status: "FATURAMENTO" } });
    const invoiceSeed = Date.now();
    const billingResults = await Promise.all([
      processBilling({ osId: riskOS.id, invoiceCode: `NF-RISK-A-${invoiceSeed}`, totalValue: 90, taxPercent: 5, installments: 3, paymentMethod: "PIX", userId: admin.id }),
      processBilling({ osId: riskOS.id, invoiceCode: `NF-RISK-B-${invoiceSeed}`, totalValue: 90, taxPercent: 5, installments: 3, paymentMethod: "PIX", userId: admin.id }),
    ]);
    assert(billingResults.filter((item) => item.success).length === 1, "Faturamento simultaneo gerou notas duplicadas para a mesma OS.");
    assert(await prisma.invoice.count({ where: { serviceOrderId: riskOS.id } }) === 1, "Mais de uma nota ficou vinculada a mesma OS.");
    assert(await prisma.accountsReceivable.count({ where: { serviceOrderId: riskOS.id } }) === 3, "Parcelamento em tres vezes foi gerado incorretamente.");

    console.log("FINANCIAL_RISK_WORKFLOW_OK", {
      partialPayment: true,
      overpaymentBlocked: true,
      settlement: true,
      reversal: true,
      duplicatePayableBlocked: true,
      duplicateReceivableBlocked: true,
      permissionDenied: true,
      prematureBillingBlocked: true,
      duplicateBillingBlocked: true,
      threeInstallments: true,
    });
  } finally {
    mockSessionToken = await tokenFor(admin);
    await prisma.auditLog.deleteMany({ where: { OR: [{ entityId: { in: receivableIds } }, { entityId: { in: payableIds } }] } });
    await prisma.financialTransaction.deleteMany({ where: { OR: [{ accountsReceivableId: { in: receivableIds } }, { accountsPayableId: { in: payableIds } }] } });
    await prisma.accountsReceivable.deleteMany({ where: { id: { in: receivableIds } } });
    await prisma.accountsPayable.deleteMany({ where: { id: { in: payableIds } } });
    if (serviceOrderIds.length) {
      const invoiceIds = (await prisma.invoice.findMany({ where: { serviceOrderId: { in: serviceOrderIds } }, select: { id: true } })).map((item) => item.id);
      await prisma.accountsReceivable.deleteMany({ where: { serviceOrderId: { in: serviceOrderIds } } });
      await prisma.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
      await prisma.serviceOrderStatusHistory.deleteMany({ where: { serviceOrderId: { in: serviceOrderIds } } });
      await prisma.auditLog.deleteMany({ where: { entityId: { in: serviceOrderIds } } });
      await prisma.serviceOrder.deleteMany({ where: { id: { in: serviceOrderIds } } });
      await prisma.notification.deleteMany({ where: { message: { contains: "RISK" } } });
    }
    await prisma.bankAccount.update({ where: { id: bank.id }, data: { balance: initialBalance } });
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
