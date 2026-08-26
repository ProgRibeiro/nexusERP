"use server";

import { logger } from "@/lib/logger";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAuth, requirePermission } from "@/lib/auth";
import { receivePaymentSchema, payBillSchema } from "@/lib/schemas";
import { failDataAccess, mutationFailure } from "@/lib/actionErrors";

export interface ReceivableDTO {
  id: string;
  clientId: string;
  clientName: string;
  clientDocument: string | null;
  purchaseOrder?: string | null;
  invoiceNumber?: string | null;
  osCode: string | null;
  invoiceId: string | null;
  invoiceCode: string | null;
  invoicePdfUrl: string | null;
  invoiceXmlUrl: string | null;
  hasAttachedNf: boolean;
  totalValue: number;
  receivedValue: number;
  pendingValue: number;
  issueDate: Date;
  dueDate: Date;
  paymentDate: Date | null;
  status: string;
  paymentMethod: string | null;
  category: string;
  costCenter: string;
  notes: string | null;
}

export interface PayableDTO {
  id: string;
  providerName: string;
  providerDocument: string | null;
  osCode: string | null;
  purchaseOrder: string | null;
  invoiceNumber: string | null;
  description: string;
  category: string;
  costCenter: string;
  value: number;
  dueDate: Date;
  paymentDate: Date | null;
  status: string;
}

/**
 * Obtém as contas a receber
 */
export async function getReceivables(): Promise<ReceivableDTO[]> {
  try {
    await requireAuth();

    const list = await prisma.accountsReceivable.findMany({
      include: {
        client: true,
        serviceOrder: { select: { code: true } },
        invoice: { select: { id: true, code: true, pdfUrl: true, xmlUrl: true } },
      },
      orderBy: { dueDate: "desc" },
    });

    return list.map((r) => {
      const rec = r as any;
      const hasAttachedNf = Boolean(
        r.invoice?.xmlUrl || r.invoice?.pdfUrl || (r.notes && (r.notes.includes("http") || r.notes.includes(".xml") || r.notes.includes("ANEXO_XML")))
      );
      return {
        id: r.id,
        clientId: r.clientId || "",
        clientName: r.client?.name || "Cliente não informado",
        clientDocument: rec.documentNumber || r.client?.cpfCnpj || null,
        purchaseOrder: rec.purchaseOrder || null,
        invoiceNumber: rec.invoiceNumber || r.invoice?.code || null,
        osCode: r.serviceOrder?.code || null,
        invoiceId: r.invoiceId || r.invoice?.id || null,
        invoiceCode: rec.invoiceNumber || r.invoice?.code || null,
        invoicePdfUrl: r.invoice?.pdfUrl || null,
        invoiceXmlUrl: r.invoice?.xmlUrl || null,
        hasAttachedNf,
        totalValue: Number(r.totalValue || 0),
        receivedValue: Number(r.receivedValue || 0),
        pendingValue: Number(r.pendingValue || 0),
        issueDate: r.issueDate || new Date(),
        dueDate: r.dueDate || new Date(),
        paymentDate: r.paymentDate || null,
        status: r.status || "ABERTO",
        paymentMethod: r.paymentMethod || null,
        category: r.category || "GERAL",
        costCenter: r.costCenter || "GERAL",
        notes: r.notes || null,
      };
    });
  } catch (error) {
    failDataAccess("financial.receivables.list", error);
  }
}

/**
 * Obtém as contas a pagar
 */
export async function getPayables(): Promise<PayableDTO[]> {
  try {
    await requireAuth();

    const list = await prisma.accountsPayable.findMany({
      include: {
        serviceOrder: { select: { code: true } },
      },
      orderBy: { dueDate: "desc" },
    });

    return list.map((item) => {
      const pay = item as any;
      return {
        ...item,
        value: Number(item.value || 0),
        providerDocument: pay.documentNumber || pay.providerDocument || null,
        osCode: item.serviceOrder?.code || null,
        purchaseOrder: pay.purchaseOrder || null,
        invoiceNumber: pay.invoiceNumber || null,
      };
    });
  } catch (error) {
    failDataAccess("financial.payables.list", error);
  }
}

/**
 * Obtém as contas bancárias da empresa
 */
export async function getBankAccounts() {
  try {
    await requireAuth();

    let accounts = await prisma.bankAccount.findMany({ orderBy: { name: "asc" } });
    if (accounts.length === 0) {
      await prisma.bankAccount.createMany({
        data: [
          { name: "Caixa Geral / Tesouraria", bank: "Caixa", agency: "0001", accountNumber: "1000-1", balance: 0 },
          { name: "Conta Corrente Principal", bank: "Itaú / Bradesco", agency: "0001", accountNumber: "2000-2", balance: 0 },
          { name: "Cartão de Crédito Corporativo", bank: "Nubank", agency: "0001", accountNumber: "3000-3", balance: 0 },
        ],
      });
      accounts = await prisma.bankAccount.findMany({ orderBy: { name: "asc" } });
    }

    return accounts.map((account) => ({ ...account, balance: Number(account.balance) }));
  } catch (error) {
    failDataAccess("financial.bank-accounts.list", error);
  }
}

export async function createBankAccountAction(data: {
  name: string;
  bank: string;
  agency: string;
  accountNumber: string;
  initialBalance?: number;
}) {
  try {
    const session = await requirePermission("financeiro.write");
    if (!data.name?.trim()) throw new Error("Informe o nome da conta ou caixa.");

    const created = await prisma.bankAccount.create({
      data: {
        name: data.name.trim(),
        bank: data.bank?.trim() || "Geral",
        agency: data.agency?.trim() || "0001",
        accountNumber: data.accountNumber?.trim() || "0000",
        balance: data.initialBalance || 0,
      },
    });

    revalidatePath("/financeiro");
    return { success: true, account: created };
  } catch (error: any) {
    return mutationFailure("financial.bank-account.create", error, "Não foi possível criar a conta bancária.");
  }
}

export async function deleteBankAccountAction(id: string) {
  try {
    await requirePermission("financeiro.write");
    await prisma.bankAccount.delete({ where: { id } });
    revalidatePath("/financeiro");
    return { success: true };
  } catch (error: any) {
    return mutationFailure("financial.bank-account.delete", error, "Erro ao excluir conta.");
  }
}

/**
 * Obtém histórico de transações financeiras
 */
export async function getTransactions() {
  try {
    await requireAuth();

    const transactions = await prisma.financialTransaction.findMany({
      include: { bankAccount: true },
      orderBy: { date: "desc" },
    });
    return transactions.map((transaction) => ({
      ...transaction,
      value: Number(transaction.value),
      bankAccount: transaction.bankAccount
        ? { ...transaction.bankAccount, balance: Number(transaction.bankAccount.balance) }
        : null,
    }));
  } catch (error) {
    failDataAccess("financial.transactions.list", error);
  }
}

/**
 * Registra o recebimento (total ou parcial) de uma cobrança
 * REGRAS DE NEGÓCIO EXIGIDAS:
 * 1. Atualiza valores recebidos e pendentes.
 * 2. Atualiza status para Pago ou Parcial.
 * 3. Cria transação financeira correspondente.
 * 4. Altera o saldo da conta bancária.
 */
export async function receivePayment(data: {
  receivableId: string;
  receivedValue: number;
  paymentMethod: string;
  bankAccountId?: string;
  userId: string;
}) {
  try {
    const session = await requirePermission("financeiro.write");
    data.userId = session.userId; // nunca confiar no valor vindo do client
    receivePaymentSchema.parse(data);

    let targetBankAccountId = data.bankAccountId;
    if (!targetBankAccountId || targetBankAccountId.trim() === "") {
      let defaultBank = await prisma.bankAccount.findFirst({ orderBy: { createdAt: "asc" } });
      if (!defaultBank) {
        defaultBank = await prisma.bankAccount.create({
          data: { name: "Caixa Geral", bank: "Caixa", agency: "0001", accountNumber: "1000-1", balance: 0 },
        });
      }
      targetBankAccountId = defaultBank.id;
    }

    const rec = await prisma.accountsReceivable.findUnique({
      where: { id: data.receivableId },
      include: { client: true },
    });

    if (!rec) throw new Error("Conta a receber não encontrada.");

    if (data.receivedValue <= 0) throw new Error("O valor recebido deve ser maior que zero.");
    if (data.receivedValue > Number(rec.pendingValue)) {
      throw new Error(`O valor recebido (R$ ${data.receivedValue}) não pode ser maior que o saldo pendente (R$ ${rec.pendingValue}).`);
    }

    const result = await prisma.$transaction(async (tx) => {
      // A baixa precisa ser atomica: duas requisicoes simultaneas nao podem
      // consumir o mesmo saldo pendente.
      const claimed = await tx.accountsReceivable.updateMany({
        where: {
          id: data.receivableId,
          pendingValue: { gte: data.receivedValue },
          status: { not: "PAGO" },
        },
        data: {
          receivedValue: { increment: data.receivedValue },
          pendingValue: { decrement: data.receivedValue },
          paymentMethod: data.paymentMethod,
          bankAccountId: targetBankAccountId,
        },
      });
      if (claimed.count !== 1) throw new Error("Esta cobrança já foi liquidada ou teve o saldo alterado por outro usuário.");

      const claimedRec = await tx.accountsReceivable.findUniqueOrThrow({ where: { id: data.receivableId } });
      const newPending = Number(claimedRec.pendingValue);
      const newStatus = newPending <= 0.01 ? "PAGO" : "PARCIAL";
      const updatedRec = await tx.accountsReceivable.update({
        where: { id: data.receivableId },
        data: { status: newStatus, paymentDate: newStatus === "PAGO" ? new Date() : null },
      });

      // 2. Lança a Transação de Caixa
      const transaction = await tx.financialTransaction.create({
        data: {
          type: "RECEITA",
          value: data.receivedValue,
          category: rec.category,
          costCenter: rec.costCenter,
          accountsReceivableId: rec.id,
          description: `Recebimento ${newStatus} de fatura - Cliente: ${rec.client.name}`,
          bankAccountId: targetBankAccountId,
          date: new Date(),
        },
      });

      // 3. Atualiza o saldo da conta bancária
      await tx.bankAccount.update({
        where: { id: targetBankAccountId },
        data: { balance: { increment: data.receivedValue } },
      });

      return { updatedRec, transaction };
    });

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: "EDICAO",
        entity: "ContasReceber",
        entityId: data.receivableId,
        changesJson: JSON.stringify({
          received: data.receivedValue,
          status: result.updatedRec.status,
          pending: result.updatedRec.pendingValue,
        }),
      },
    });

    revalidatePath("/financeiro");
    revalidatePath("/");

    return { success: true as const, error: undefined, receivable: result.updatedRec };
  } catch (error: unknown) {
    return mutationFailure("financial.receivable.receive", error, "Não foi possível registrar o recebimento.");
  }
}

/**
 * Paga uma conta (Contas a Pagar)
 */
export async function payBill(data: {
  payableId: string;
  paymentMethod: string;
  bankAccountId?: string;
  userId: string;
}) {
  try {
    const session = await requirePermission("financeiro.write");
    data.userId = session.userId; // nunca confiar no valor vindo do client
    payBillSchema.parse(data);

    let targetBankAccountId = data.bankAccountId;
    if (!targetBankAccountId || targetBankAccountId.trim() === "") {
      let defaultBank = await prisma.bankAccount.findFirst({ orderBy: { createdAt: "asc" } });
      if (!defaultBank) {
        defaultBank = await prisma.bankAccount.create({
          data: { name: "Caixa Geral", bank: "Caixa", agency: "0001", accountNumber: "1000-1", balance: 0 },
        });
      }
      targetBankAccountId = defaultBank.id;
    }

    const pay = await prisma.accountsPayable.findUnique({
      where: { id: data.payableId },
    });

    if (!pay) throw new Error("Conta a pagar não encontrada.");
    if (pay.status === "PAGO") throw new Error("Esta conta já está paga.");

    const result = await prisma.$transaction(async (tx) => {
      // Reserva atomica da conta para impedir dois pagamentos simultaneos.
      const claimed = await tx.accountsPayable.updateMany({
        where: { id: data.payableId, status: { not: "PAGO" } },
        data: {
          status: "PAGO",
          paymentDate: new Date(),
          paymentMethod: data.paymentMethod || "TRANSFERENCIA",
        },
      });
      if (claimed.count !== 1) throw new Error("Esta conta já foi paga ou está sendo processada por outro usuário.");
      const updatedPay = await tx.accountsPayable.findUniqueOrThrow({ where: { id: data.payableId } });

      // 2. Lançar transação de despesa
      const transaction = await tx.financialTransaction.create({
        data: {
          type: "DESPESA",
          value: pay.value,
          category: pay.category,
          costCenter: pay.costCenter,
          accountsPayableId: pay.id,
          description: `Pagamento de conta: ${pay.providerName} (${pay.description})`,
          bankAccountId: targetBankAccountId,
          date: new Date(),
        },
      });

      // 3. Atualizar saldo da conta bancária (subtrair)
      await tx.bankAccount.update({
        where: { id: targetBankAccountId },
        data: { balance: { decrement: pay.value } },
      });

      return { updatedPay, transaction };
    });

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: "EDICAO",
        entity: "ContasPagar",
        entityId: data.payableId,
        changesJson: JSON.stringify({
          status: "PAGO",
          value: pay.value,
        }),
      },
    });

    revalidatePath("/financeiro");
    revalidatePath("/");

    return { success: true as const, error: undefined, payable: result.updatedPay };
  } catch (error: unknown) {
    return mutationFailure("financial.payable.pay", error, "Não foi possível registrar o pagamento.");
  }
}

/**
 * Cria uma nova Conta a Pagar (Despesa)
 */
export async function createPayable(
  data: {
    providerName: string;
    description: string;
    category: string;
    costCenter?: string;
    value: number;
    dueDate: Date;
  },
  userId: string
) {
  try {
    const session = await requirePermission("financeiro.write");
    userId = session.userId; // nunca confiar no valor vindo do client

    const payable = await prisma.accountsPayable.create({
      data: {
        providerName: data.providerName,
        description: data.description,
        category: data.category,
        costCenter: data.costCenter || "GERAL",
        value: data.value,
        dueDate: data.dueDate,
        status: "ABERTO",
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: "CRIACAO",
        entity: "ContasPagar",
        entityId: payable.id,
        changesJson: JSON.stringify(payable),
      },
    });

    revalidatePath("/financeiro");
    return { success: true as const, error: undefined, payable };
  } catch (error: unknown) {
    return mutationFailure("financial.payable.create", error, "Não foi possível criar a conta a pagar.");
  }
}

export async function updatePayable(
  id: string,
  data: {
    providerName: string;
    description: string;
    category: string;
    costCenter: string;
    value: number;
    dueDate: Date;
  }
) {
  try {
    const session = await requirePermission("financeiro.write");
    const current = await prisma.accountsPayable.findUnique({ where: { id } });
    if (!current) throw new Error("Conta a pagar não encontrada.");
    if (!data.providerName.trim()) throw new Error("Informe o credor ou fornecedor.");
    if (!Number.isFinite(data.value) || data.value <= 0) throw new Error("O valor deve ser maior que zero.");
    if (Number.isNaN(data.dueDate.getTime())) throw new Error("Informe uma data de vencimento válida.");
    if (["PAGO", "ESTORNADO"].includes(current.status) && Math.abs(Number(current.value) - data.value) > 0.001) {
      throw new Error("O valor de uma conta já liquidada não pode ser alterado. Estorne o pagamento antes de corrigir o valor.");
    }

    const updated = await prisma.accountsPayable.update({
      where: { id },
      data: {
        providerName: data.providerName.trim(),
        description: data.description.trim(),
        category: data.category,
        costCenter: data.costCenter,
        value: data.value,
        dueDate: data.dueDate,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "EDICAO",
        entity: "ContasPagar",
        entityId: id,
        changesJson: JSON.stringify({ before: current, after: updated }),
      },
    });
    revalidatePath("/financeiro");
    revalidatePath("/");
    return { success: true as const, error: undefined, payable: updated };
  } catch (error: unknown) {
    return mutationFailure("financial.payable.update", error, "Não foi possível editar a conta a pagar.");
  }
}

/**
 * Estorna uma transação financeira (Cancelamento/Reversão de pagamento)
 * REGRAS DE NEGÓCIO EXIGIDAS:
 * 1. Estorno deve registrar motivo e usuário responsável.
 * 2. Atualiza os saldos da conta a receber/pagar correspondentes.
 * 3. Corrige o saldo da conta bancária.
 * 4. Remove ou cria transação reversa (aqui criaremos um log de estorno e mudamos a transação para ESTORNADA).
 */
export async function estornoTransaction(
  transactionId: string,
  justification: string,
  userId: string
) {
  try {
    const session = await requirePermission("financeiro.write");
    userId = session.userId; // nunca confiar no valor vindo do client

    const transaction = await prisma.financialTransaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) throw new Error("Transação não encontrada.");
    if (transaction.category === "ESTORNO") throw new Error("Esta transação já é um estorno.");

    const result = await prisma.$transaction(async (tx) => {
      // 1. Atualizar a transação para categoria "ESTORNADA"
      await tx.financialTransaction.update({
        where: { id: transactionId },
        data: {
          category: "ESTORNO",
          description: `[ESTORNADO] ${transaction.description}. Motivo: ${justification}`,
        },
      });

      // 2. Corrigir saldo da conta bancária
      const bank = await tx.bankAccount.findUnique({ where: { id: transaction.bankAccountId || "" } });
      if (bank) {
        const transactionValue = Number(transaction.value);
        const balanceAdjustment = transaction.type === "RECEITA" ? -transactionValue : transactionValue;
        await tx.bankAccount.update({
          where: { id: bank.id },
          data: { balance: Number(bank.balance) + balanceAdjustment },
        });
      }

      // 3. Ajustar contas a receber ou pagar vinculadas
      if (transaction.accountsReceivableId) {
        const rec = await tx.accountsReceivable.findUnique({ where: { id: transaction.accountsReceivableId } });
        if (rec) {
          const newReceived = Math.max(0, Number(rec.receivedValue) - Number(transaction.value));
          const newPending = Number(rec.totalValue) - newReceived;
          const newStatus = newReceived <= 0 ? "ABERTO" : "PARCIAL";

          await tx.accountsReceivable.update({
            where: { id: rec.id },
            data: {
              receivedValue: newReceived,
              pendingValue: newPending,
              status: newStatus,
              paymentDate: null,
            },
          });
        }
      }

      if (transaction.accountsPayableId) {
        const pay = await tx.accountsPayable.findUnique({ where: { id: transaction.accountsPayableId } });
        if (pay) {
          await tx.accountsPayable.update({
            where: { id: pay.id },
            data: {
              status: "ABERTO",
              paymentDate: null,
              paymentMethod: null,
            },
          });
        }
      }

      return { success: true as const, error: undefined };
    });

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        userId,
        action: "CANCELAMENTO",
        entity: "TransacaoFinanceira",
        entityId: transactionId,
        changesJson: JSON.stringify({
          action: "Estorno de transação",
          value: transaction.value,
          justification,
        }),
      },
    });

    revalidatePath("/financeiro");
    revalidatePath("/");

    return { success: true as const, error: undefined };
  } catch (error: unknown) {
    return mutationFailure("financial.transaction.reverse", error, "Não foi possível realizar o estorno.");
  }
}

/**
 * Cria uma nova Conta a Receber (Receita)
 */
export async function createReceivable(
  data: {
    clientId: string;
    totalValue: number;
    dueDate: Date;
    category?: string;
    costCenter?: string;
    notes?: string;
  },
  userId: string
) {
  try {
    const session = await requirePermission("financeiro.write");
    userId = session.userId; // nunca confiar no valor vindo do client

    const receivable = await prisma.accountsReceivable.create({
      data: {
        clientId: data.clientId,
        totalValue: data.totalValue,
        pendingValue: data.totalValue,
        dueDate: data.dueDate,
        category: data.category || "RECEITA_SERVICO",
        costCenter: data.costCenter || "GERAL",
        notes: data.notes || null,
        status: "PENDENTE",
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: "CRIACAO",
        entity: "ContasReceber",
        entityId: receivable.id,
        changesJson: JSON.stringify(receivable),
      },
    });

    revalidatePath("/financeiro");
    return { success: true as const, error: undefined, receivable };
  } catch (error: unknown) {
    return mutationFailure("financial.receivable.create", error, "Não foi possível criar a conta a receber.");
  }
}

export async function updateReceivable(
  id: string,
  data: {
    clientId: string;
    totalValue: number;
    dueDate: Date;
    category: string;
    costCenter: string;
    notes?: string;
  }
) {
  try {
    const session = await requirePermission("financeiro.write");
    const current = await prisma.accountsReceivable.findUnique({ where: { id } });
    if (!current) throw new Error("Conta a receber não encontrada.");
    if (!data.clientId) throw new Error("Selecione o cliente.");
    if (!Number.isFinite(data.totalValue) || data.totalValue <= 0) throw new Error("O valor deve ser maior que zero.");
    if (Number.isNaN(data.dueDate.getTime())) throw new Error("Informe uma data de vencimento válida.");

    const receivedValue = Number(current.receivedValue);
    if (data.totalValue + 0.001 < receivedValue) {
      throw new Error(`O valor total não pode ser menor que o valor já recebido (R$ ${receivedValue.toFixed(2)}).`);
    }
    const pendingValue = Math.max(0, data.totalValue - receivedValue);
    const status = pendingValue <= 0.01 ? "PAGO" : receivedValue > 0 ? "PARCIAL" : current.status === "VENCIDO" ? "VENCIDO" : "PENDENTE";

    const updated = await prisma.accountsReceivable.update({
      where: { id },
      data: {
        clientId: data.clientId,
        totalValue: data.totalValue,
        pendingValue,
        dueDate: data.dueDate,
        category: data.category,
        costCenter: data.costCenter,
        notes: data.notes?.trim() || null,
        status,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "EDICAO",
        entity: "ContasReceber",
        entityId: id,
        changesJson: JSON.stringify({ before: current, after: updated }),
      },
    });
    revalidatePath("/financeiro");
    revalidatePath("/");
    return { success: true as const, error: undefined, receivable: updated };
  } catch (error: unknown) {
    return mutationFailure("financial.receivable.update", error, "Não foi possível editar a conta a receber.");
  }
}

/**
 * Estorna o recebimento de uma conta a receber, voltando o status para ABERTO,
 * restaurando o saldo pendente e ajustando o saldo bancário.
 */
export async function revertReceivablePaymentAction(receivableId: string) {
  try {
    const session = await requirePermission("financeiro.write");

    const rec = await prisma.accountsReceivable.findUnique({
      where: { id: receivableId },
      include: { transactions: true },
    });

    if (!rec) throw new Error("Conta a receber não encontrada.");
    const receivedVal = Number(rec.receivedValue);
    if (rec.status !== "PAGO" && receivedVal <= 0) {
      throw new Error("Esta cobrança não possui valores recebidos para estornar.");
    }

    const totalVal = Number(rec.totalValue);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Volta o status para ABERTO e zera valor recebido
      const updatedRec = await tx.accountsReceivable.update({
        where: { id: receivableId },
        data: {
          status: "ABERTO",
          receivedValue: 0,
          pendingValue: totalVal,
          paymentDate: null,
          paymentMethod: null,
        },
      });

      // 2. Decrementa o saldo bancário se houver conta vinculada
      if (rec.bankAccountId && receivedVal > 0) {
        await tx.bankAccount.update({
          where: { id: rec.bankAccountId },
          data: { balance: { decrement: receivedVal } },
        });
      }

      // 3. Deleta a transação de caixa de receita vinculada
      await tx.financialTransaction.deleteMany({
        where: { accountsReceivableId: receivableId },
      });

      return updatedRec;
    });

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "ESTORNO",
        entity: "ContasReceber",
        entityId: receivableId,
        changesJson: JSON.stringify({
          previousStatus: rec.status,
          revertedAmount: receivedVal,
        }),
      },
    });

    revalidatePath("/financeiro");
    revalidatePath("/");

    return { success: true as const, error: undefined, receivable: result };
  } catch (error: unknown) {
    return mutationFailure("financial.receivable.revert", error, "Não foi possível estornar o recebimento.");
  }
}

/**
 * Estorna o pagamento de uma conta a pagar (Despesa), voltando o status para ABERTO,
 * restaurando o saldo bancário debitado.
 */
export async function revertPayablePaymentAction(payableId: string) {
  try {
    const session = await requirePermission("financeiro.write");

    const pay = await prisma.accountsPayable.findUnique({
      where: { id: payableId },
    });

    if (!pay) throw new Error("Conta a pagar não encontrada.");
    if (pay.status !== "PAGO") {
      throw new Error("Esta conta não está paga para ser estornada.");
    }

    const val = Number(pay.value);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Volta o status para ABERTO
      const updatedPay = await tx.accountsPayable.update({
        where: { id: payableId },
        data: {
          status: "ABERTO",
          paymentDate: null,
          paymentMethod: null,
        },
      });

      // 2. Encontra a última transação de despesa vinculada para saber a conta bancária
      const txRecord = await tx.financialTransaction.findFirst({
        where: { accountsPayableId: payableId },
      });

      const bankId = txRecord?.bankAccountId;
      if (bankId && val > 0) {
        await tx.bankAccount.update({
          where: { id: bankId },
          data: { balance: { increment: val } },
        });
      }

      // 3. Remove as transações financeiras vinculadas
      await tx.financialTransaction.deleteMany({
        where: { accountsPayableId: payableId },
      });

      return updatedPay;
    });

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "ESTORNO",
        entity: "ContasPagar",
        entityId: payableId,
        changesJson: JSON.stringify({
          previousStatus: "PAGO",
          revertedAmount: val,
        }),
      },
    });

    revalidatePath("/financeiro");
    revalidatePath("/");

    return { success: true as const, error: undefined, payable: result };
  } catch (error: unknown) {
    return mutationFailure("financial.payable.revert", error, "Não foi possível estornar o pagamento.");
  }
}

/**
 * Realiza a liquidação consolidada em lote de múltiplos títulos de faturas/POs
 */
export async function bulkSettleConsolidatedInvoiceAction(data: {
  receivableIds: string[];
  paymentMethod: string;
  bankAccountId?: string;
  notes?: string;
}) {
  try {
    const session = await requirePermission("financeiro.write");

    if (!data.receivableIds || data.receivableIds.length === 0) {
      return { success: false, error: "Nenhum título selecionado para baixa." };
    }

    const receivables = await prisma.accountsReceivable.findMany({
      where: { id: { in: data.receivableIds } },
      include: { client: true, serviceOrder: true },
    });

    if (receivables.length === 0) {
      return { success: false, error: "Títulos não encontrados." };
    }

    let caixaGeralId = data.bankAccountId;
    if (!caixaGeralId) {
      const caixaGeral = await prisma.bankAccount.findFirst({
        where: { name: { contains: "Caixa Geral" } },
      });
      caixaGeralId = caixaGeral?.id;
    }

    let totalLiquidated = 0;
    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      for (const rec of receivables) {
        const val = Number(rec.pendingValue);
        if (val <= 0 || rec.status === "PAGO") continue;

        totalLiquidated += val;

        await tx.accountsReceivable.update({
          where: { id: rec.id },
          data: {
            status: "PAGO",
            receivedValue: Number(rec.totalValue),
            pendingValue: 0,
            paymentDate: now,
            paymentMethod: data.paymentMethod,
            bankAccountId: caixaGeralId || null,
          },
        });

        await tx.financialTransaction.create({
          data: {
            type: "RECEITA",
            value: val,
            date: now,
            category: rec.category || "RECEITA_CONSOLIDADA",
            costCenter: rec.costCenter || "GERAL",
            accountsReceivableId: rec.id,
            description: `Baixa Fatura Consolidada — Cliente: ${rec.client?.name || "N/A"} ${rec.serviceOrder?.purchaseOrder ? `(PO: ${rec.serviceOrder.purchaseOrder})` : ""}`,
            bankAccountId: caixaGeralId || null,
          },
        });
      }

      if (caixaGeralId && totalLiquidated > 0) {
        await tx.bankAccount.update({
          where: { id: caixaGeralId },
          data: { balance: { increment: totalLiquidated } },
        });
      }

      return { totalLiquidated, count: receivables.length };
    });

    revalidatePath("/financeiro");
    revalidatePath("/faturamento");
    return { success: true, ...result };
  } catch (error: any) {
    logger.error("Erro na liquidação consolidada em lote:", error);
    return { success: false, error: error.message || "Erro ao dar baixa consolidada." };
  }
}

/**
 * Varre e sincroniza automaticamente todas as Ordens de Serviço, Faturas, Contratos e Orçamentos,
 * gerando ou atualizando os títulos financeiros em Contas a Receber e Contas a Pagar.
 */
export async function syncAllFinancialsAction() {
  try {
    const session = await requirePermission("financeiro.write");

    let createdReceivablesCount = 0;
    let updatedReceivablesCount = 0;
    let totalSyncedValue = 0;

    // 1. Busca todas as Ordens de Serviço que possuem cliente vinculado
    const serviceOrders = await prisma.serviceOrder.findMany({
      include: {
        client: true,
        invoices: true,
        items: true,
        accountsReceivable: true,
      },
    });

    for (const os of serviceOrders) {
      if (!os.clientId) continue;

      // Calcula valor total da OS (baseado na soma dos itens)
      const osValue = os.items.reduce(
        (sum: number, item: any) => sum + (Number(item.total) || Number(item.unitPrice) * item.quantity),
        0
      );

      if (osValue <= 0) continue;

      const primaryInvoiceNumber = os.invoices?.[0]?.code || null;
      const osStatus = os.status;
      const isPaid = ["FATURADA", "FATURADO", "CONCLUIDA", "CONCLUIDO"].includes(osStatus);

      // Verifica se já existe título a receber vinculado a esta OS
      const existingReceivable = os.accountsReceivable?.[0] || await prisma.accountsReceivable.findFirst({
        where: { serviceOrderId: os.id },
      });

      if (existingReceivable) {
        // Atualiza título existente com informações de PO, NF e CNPJ
        await prisma.accountsReceivable.update({
          where: { id: existingReceivable.id },
          data: {
            totalValue: osValue,
            pendingValue: isPaid ? 0 : osValue,
            receivedValue: isPaid ? osValue : Number(existingReceivable.receivedValue),
            purchaseOrder: os.purchaseOrder || existingReceivable.purchaseOrder,
            invoiceNumber: primaryInvoiceNumber || existingReceivable.invoiceNumber,
            documentNumber: os.client?.cpfCnpj || existingReceivable.documentNumber,
            status: isPaid ? "PAGO" : (os.scheduledDate && new Date(os.scheduledDate) < new Date() ? "VENCIDO" : "ABERTO"),
          },
        });
        updatedReceivablesCount++;
      } else {
        // Cria novo título a receber para a OS
        await prisma.accountsReceivable.create({
          data: {
            clientId: os.clientId,
            serviceOrderId: os.id,
            totalValue: osValue,
            pendingValue: isPaid ? 0 : osValue,
            receivedValue: isPaid ? osValue : 0,
            issueDate: os.createdAt,
            dueDate: os.scheduledDate || os.createdAt,
            paymentDate: isPaid ? new Date() : null,
            status: isPaid ? "PAGO" : (os.scheduledDate && new Date(os.scheduledDate) < new Date() ? "VENCIDO" : "ABERTO"),
            purchaseOrder: os.purchaseOrder || null,
            invoiceNumber: primaryInvoiceNumber,
            documentNumber: os.client?.cpfCnpj || null,
            category: "RECEITA_SERVICO",
            costCenter: "OPERACIONAL",
            notes: `Gerado automaticamente via sincronização financeira da OS #${os.code}`,
          },
        });
        createdReceivablesCount++;
      }
      totalSyncedValue += osValue;
    }

    // 2. Busca todas as Faturas (Invoices) avulsas
    const invoices = await prisma.invoice.findMany({
      include: { client: true, receivables: true },
    });

    for (const inv of invoices) {
      if (!inv.clientId) continue;
      const invValue = Number(inv.value);
      if (invValue <= 0) continue;

      const existingRec = inv.receivables?.[0] || await prisma.accountsReceivable.findFirst({
        where: { invoiceId: inv.id },
      });

      if (!existingRec) {
        await prisma.accountsReceivable.create({
          data: {
            clientId: inv.clientId,
            invoiceId: inv.id,
            invoiceNumber: inv.code,
            totalValue: invValue,
            pendingValue: inv.status === "PAGA" ? 0 : invValue,
            receivedValue: inv.status === "PAGA" ? invValue : 0,
            issueDate: inv.issueDate,
            dueDate: inv.issueDate,
            status: inv.status === "PAGA" ? "PAGO" : "ABERTO",
            documentNumber: inv.client?.cpfCnpj || null,
            category: "RECEITA_SERVICO",
            notes: `Gerado via sincronização de faturas - NF ${inv.code}`,
          },
        });
        createdReceivablesCount++;
        totalSyncedValue += invValue;
      }
    }

    revalidatePath("/financeiro");
    revalidatePath("/faturamento");
    revalidatePath("/ordens-servico");

    return {
      success: true,
      createdReceivablesCount,
      updatedReceivablesCount,
      totalSyncedValue,
      message: `Sincronização financeira concluída com sucesso! ${createdReceivablesCount} novo(s) título(s) criado(s), ${updatedReceivablesCount} título(s) atualizados (Total recalculado: R$ ${totalSyncedValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}).`,
    };
  } catch (error: any) {
    logger.error("Erro na sincronização financeira:", error);
    return { success: false, error: error.message || "Erro ao sincronizar valores financeiros." };
  }
}
