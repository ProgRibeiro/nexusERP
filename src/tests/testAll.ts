import "dotenv/config";

// Mock next/cache before importing any other files
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nextCache = require("next/cache");
nextCache.revalidatePath = () => {};
nextCache.revalidateTag = () => {};

// Mock next/headers.cookies() so Server Actions protegidas por requireAuth()/
// requirePermission() funcionam quando chamadas diretamente por este script
// (fora do ciclo real de requisição HTTP do Next.js). O token é preenchido
// por loginAsAdminForTests() logo no início da suíte.
let mockSessionToken: string | null = null;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nextHeaders = require("next/headers");
nextHeaders.cookies = async () => ({
  get: (name: string) =>
    name === "nx_session" && mockSessionToken ? { name, value: mockSessionToken } : undefined,
  set: () => {},
  delete: () => {},
});

import { prisma } from "../lib/db";
import { encryptSession, SessionPayload } from "../lib/session";
import { getUsers } from "../app/actions/userActions";

/**
 * Helper local de teste — substitui a antiga `getUserByEmail` exportada por
 * userActions.ts (removida porque não é mais seguro expor lookup de usuário
 * por e-mail sem sessão; ver src/app/actions/userActions.ts).
 */
async function getUserByEmail(email: string) {
  const users = await getUsers();
  return users.find((u) => u.email === email) || null;
}

/**
 * Autentica o script de teste como o usuário admin@erp.com, preenchendo o
 * cookie de sessão mockado acima. Precisa rodar antes de qualquer chamada a
 * uma Server Action, já que todas exigem sessão válida agora.
 */
async function loginAsAdminForTests() {
  const adminUser = await prisma.user.findUnique({
    where: { email: "admin@erp.com" },
    include: { role: true },
  });
  if (!adminUser) {
    throw new Error(
      "Usuário admin@erp.com não encontrado. Rode `npm run db:seed` antes de rodar esta suíte."
    );
  }

  const payload: SessionPayload = {
    userId: adminUser.id,
    name: adminUser.name,
    email: adminUser.email,
    roleName: adminUser.role?.name || "Administrador",
    permissions: JSON.parse(adminUser.permissions),
    exp: Date.now() + 60 * 60 * 1000,
  };

  mockSessionToken = await encryptSession(payload);
}
import { getClients, createClient, addClientContact, addClientAddress, addClientEquipment } from "../app/actions/clientActions";
import { getCrmPipeline, createLead, moveLead, addCrmActivity, convertLeadToQuote } from "../app/actions/crmActions";
import { getQuotes, createQuote, updateQuoteStatus, approveAndConvertQuote } from "../app/actions/quoteActions";
import { getServiceOrders, scheduleServiceOrder, updateOSStatus, saveOSCompletionReport } from "../app/actions/osActions";
import { getTechnicianOS, makeOSCheckin, makeOSStartExecution, submitTechnicalExecution } from "../app/actions/executionActions";
import { getBillingQueue, processBilling } from "../app/actions/billingActions";
import { getReceivables, getPayables, getBankAccounts, getTransactions, createPayable, payBill, receivePayment } from "../app/actions/financialActions";
import { getProducts, createProduct } from "../app/actions/inventoryActions";
import { getContracts, createContract, triggerRecurrencyBilling } from "../app/actions/contractActions";

async function runSuite() {
  console.log("\n========================================================");
  console.log("   INICIANDO SUÍTE DE TESTES DE INTEGRAÇÃO DO ERP 🛠️    ");
  console.log("========================================================\n");

  await loginAsAdminForTests();
  console.log("[SETUP] Sessão de teste autenticada como admin@erp.com.\n");

  let testCount = 0;
  let successCount = 0;

  async function test(name: string, fn: () => Promise<void>) {
    testCount++;
    console.log(`[TESTE ${testCount}] ${name}...`);
    try {
      await fn();
      console.log(`  🟢 SUCESSO!\n`);
      successCount++;
    } catch (err: any) {
      console.error(`  🔴 FALHA: ${err.message || err}\n`);
    }
  }

  // 1. Usuários e Autenticação
  await test("Usuários e Autenticação", async () => {
    const users = await getUsers();
    if (users.length === 0) throw new Error("Nenhum usuário cadastrado no seed.");
    console.log(`  - Encontrados ${users.length} usuários.`);

    const admin = await getUserByEmail("admin@erp.com");
    if (!admin) throw new Error("Usuário administrador não encontrado.");
    console.log(`  - Usuário recuperado: ${admin.name} (${admin.roleName})`);
  });

  // 2. Cadastro e Relacionamentos de Clientes
  let clientId = "";
  await test("Cadastro e Relacionamentos de Clientes", async () => {
    // Documento sintético com 14 dígitos para respeitar a validação de CNPJ.
    const uniqueDoc = `${Date.now()}${Math.floor(Math.random() * 10)}`.slice(-14);
    const res = await createClient({
      name: "Cliente de Teste Automatizado",
      socialName: "Automated Testing LTDA",
      cpfCnpj: uniqueDoc,
      email: "test@automated.com",
      phone: "11999999999",
    });

    if (!res.success || !res.client) throw new Error(res.error || "Falha ao criar cliente.");
    clientId = res.client.id;
    console.log(`  - Cliente criado com ID: ${clientId}`);

    // Adiciona contato
    const contactRes = await addClientContact({
      clientId,
      name: "Contato Financeiro Teste",
      email: "financeiro@test.com",
      phone: "11888888888",
      isFinancial: true,
      isTechnical: false,
      isApproval: false,
    });
    if (!contactRes.success) throw new Error("Falha ao adicionar contato.");
    console.log("  - Contato financeiro adicionado.");

    // Adiciona endereço
    const addrRes = await addClientAddress({
      clientId,
      label: "Sede Execução",
      street: "Avenida Paulista",
      number: "1000",
      neighborhood: "Bela Vista",
      city: "São Paulo",
      state: "SP",
      cep: "01310-100",
    });
    if (!addrRes.success) throw new Error("Falha ao adicionar endereço.");
    console.log("  - Endereço de execução adicionado.");

    // Adiciona equipamento
    const equipRes = await addClientEquipment({
      clientId,
      type: "Chiller Carrier 40TR",
      brand: "Carrier",
      model: "30HXC",
      serialNumber: "SN-TEST-123",
    });
    if (!equipRes.success) throw new Error("Falha ao adicionar equipamento.");
    console.log("  - Equipamento Chiller adicionado.");
  });

  // 3. CRM Funil Comercial
  let leadId = "";
  await test("Pipeline do CRM e Interações", async () => {
    const pipelineBefore = await getCrmPipeline();
    const stageId = pipelineBefore[0]?.id;
    if (!stageId) throw new Error("Nenhuma etapa de CRM disponível.");

    const res = await createLead({
      name: "Oportunidade Manutenção Shopping",
      company: "Shopping Central",
      phone: "11777777777",
      email: "comercial@shopping.com",
      value: 12000,
    });

    if (!res.success || !res.lead) throw new Error(res.error || "Falha ao criar lead.");
    leadId = res.lead.id;
    console.log(`  - Lead criado com ID: ${leadId}`);

    // Adiciona interação
    const actRes = await addCrmActivity({
      leadId,
      userId: (await getUsers())[0].id,
      type: "LIGACAO",
      description: "Conversa com gerente técnico do shopping",
      date: new Date(),
      done: true,
    });
    if (!actRes.success) throw new Error("Falha ao registrar atividade.");
    console.log("  - Atividade de follow-up registrada.");

    // Move de etapa no kanban
    const nextStageId = pipelineBefore[1]?.id;
    if (nextStageId) {
      const moveRes = await moveLead(leadId, nextStageId);
      if (!moveRes.success) throw new Error("Falha ao mover lead.");
      console.log(`  - Lead movido para etapa: ${nextStageId}`);
    }
  });

  // 4. Proposta e Conversão em OS
  let quoteId = "";
  let serviceOrderId = "";
  let serviceOrderCode = "";
  await test("Orçamentos e Conversão em OS", async () => {
    const admin = await getUserByEmail("admin@erp.com");
    if (!admin) throw new Error("Admin offline.");

    // Converte o lead em proposta
    const convRes = await convertLeadToQuote(leadId);
    if (!convRes.success || !convRes.quote) throw new Error(convRes.error || "Falha ao converter lead em orçamento.");
    quoteId = convRes.quote.id;
    console.log(`  - Lead convertido em Orçamento com ID: ${quoteId}`);

    // Encontrar o cliente do orçamento
    const quoteData = await prisma.quote.findUnique({
      where: { id: quoteId },
    });
    if (!quoteData) throw new Error("Orçamento recém-criado não foi encontrado.");

    // Criar um endereço para o cliente do orçamento para passar na validação de OS
    const addr = await prisma.clientAddress.create({
      data: {
        clientId: quoteData.clientId,
        label: "Endereço Principal",
        street: "Rua do Comércio",
        number: "500",
        neighborhood: "Centro",
        city: "São Paulo",
        state: "SP",
        cep: "01001-000",
      }
    });

    // Atualizar o orçamento com o addressId e adicionar um item de serviço faturável
    await prisma.quote.update({
      where: { id: quoteId },
      data: {
        addressId: addr.id,
        items: {
          create: {
            description: "Instalação de Ar Condicionado Split",
            type: "SERVICO",
            quantity: 1,
            unitPrice: 12000,
            total: 12000,
          }
        }
      }
    });

    // Aprova orçamento e gera Ordem de Serviço
    const approveRes = await approveAndConvertQuote(quoteId, admin.id);
    if (!approveRes.success || !approveRes.os) throw new Error(approveRes.error || "Falha ao aprovar orçamento.");
    serviceOrderId = (approveRes.os as any).id;
    serviceOrderCode = (approveRes.os as any).code;
    console.log(`  - Orçamento aprovado. OS gerada com ID: ${serviceOrderId}`);
  });

  // 5. Planejamento e Agendamento da OS
  await test("Agendamento e Equipe da OS", async () => {
    const admin = await getUserByEmail("admin@erp.com");
    if (!admin) throw new Error("Admin offline.");

    const techs = (await getUsers()).filter((u) => u.roleName === "Técnico");
    if (techs.length === 0) throw new Error("Nenhum técnico disponível no banco.");

    const schedRes = await scheduleServiceOrder(serviceOrderId, {
      scheduledDate: new Date(),
      scheduledTime: "09:00",
      techIds: [techs[0].id],
      priority: "ALTA",
    }, admin.id);

    if (!schedRes.success) throw new Error(schedRes.error || "Falha ao agendar OS.");
    console.log(`  - OS agendada para técnico ${techs[0].name}.`);
  });

  // 6. Fluxo Mobile do Técnico (Execução)
  await test("Fluxo de Execução Técnica Mobile", async () => {
    const techs = (await getUsers()).filter((u) => u.roleName === "Técnico");
    const tech = techs[0];
    if (!tech) throw new Error("Técnico indisponível.");

    // Técnico inicia deslocamento
    const checkinRes = await makeOSCheckin(serviceOrderId, tech.id);
    if (!checkinRes.success) throw new Error(checkinRes.error || "Falha no check-in técnico.");
    console.log("  - Técnico iniciou deslocamento para o local.");

    // Técnico inicia serviço no local
    const startRes = await makeOSStartExecution(serviceOrderId, tech.id);
    if (!startRes.success) throw new Error(startRes.error || "Falha ao iniciar serviço.");
    console.log("  - Técnico chegou no local e iniciou a manutenção.");

    // Técnico finaliza a OS
    const submitRes = await submitTechnicalExecution(serviceOrderId, {
      technicalDiagnosis: "Realizada limpeza preventiva e troca de filtro de ar condicionado.",
      checklistJson: JSON.stringify([{ task: "Limpeza concluída", checked: true }]),
      measurementsJson: "Voltagem: 220V | Corrente: 10A",
      photos: [],
      signatureBase64: "data:image/png;base64,mockSignature",
      signatureName: "Gerente do Shopping",
      clientFeedback: "Serviço rápido e limpo.",
      userId: tech.id,
    });

    if (!submitRes.success) throw new Error(submitRes.error || "Falha ao submeter execução.");
    console.log("  - Relatório técnico enviado. OS finalizada.");
  });

  // 7. Faturamento Fiscal (NFS-e)
  await test("Faturamento Fiscal e Emissão de NFS-e", async () => {
    const reviewRes = await saveOSCompletionReport(serviceOrderId, {
      executedServices: "Limpeza preventiva, substituição de filtro e testes operacionais.",
      technicalObservations: "Equipamento entregue em funcionamento normal.",
      operationalResult: "OPERACIONAL",
      clientRepresentative: "Gerente do Shopping",
      approvedByClient: true,
      sendToBilling: true,
    });
    if (!reviewRes.success) throw new Error(reviewRes.error || "Falha ao revisar e liberar o relatório.");
    console.log("  - Relatório técnico revisado, aprovado e liberado para faturamento.");

    const billingQueue = await getBillingQueue();
    const itemInQueue = billingQueue.find((q) => q.id === serviceOrderId);
    if (!itemInQueue) throw new Error("OS finalizada não apareceu na fila de faturamento.");
    console.log("  - OS confirmada na fila de faturamento.");

    const admin = await getUserByEmail("admin@erp.com");
    if (!admin) throw new Error("Admin offline.");

    const billRes = await processBilling({
      osId: serviceOrderId,
      invoiceCode: `NF-${Date.now().toString().slice(-6)}`,
      totalValue: itemInQueue.value || 500,
      taxPercent: 5,
      installments: 1,
      paymentMethod: "PIX",
      userId: admin.id,
    });

    if (!billRes.success) throw new Error(billRes.error || "Falha ao faturar nota fiscal.");
    console.log(`  - Faturamento consolidado. Nota fiscal emitida e contas a receber registradas.`);
  });

  // 8. Financeiro e Extrato de Caixa
  await test("Financeiro e Extrato de Caixa", async () => {
    const receivables = await getReceivables();
    const invoiceReceivable = receivables.find(
      (r) => r.osCode === serviceOrderCode && r.pendingValue > 0
    );
    if (!invoiceReceivable) throw new Error("Parcela a receber do faturamento pendente não encontrada.");
    console.log(`  - Conta a receber localizada: ${invoiceReceivable.totalValue} (Pendente: ${invoiceReceivable.pendingValue})`);

    const admin = await getUserByEmail("admin@erp.com");
    if (!admin) throw new Error("Admin offline.");

    const bankAccounts = await getBankAccounts();
    const bank = bankAccounts[0];
    if (!bank) throw new Error("Nenhuma conta bancária disponível.");
    const transactionsBefore = await getTransactions();

    // Receber pagamento
    const payRes = await receivePayment({
      receivableId: invoiceReceivable.id,
      receivedValue: invoiceReceivable.pendingValue,
      paymentMethod: "PIX",
      bankAccountId: bank.id,
      userId: admin.id,
    });
    if (!payRes.success) throw new Error(payRes.error || "Falha ao liquidar recebimento.");
    console.log("  - Pagamento recebido e liquidado na conta bancária.");

    // Lançar despesa (pagar)
    const payableRes = await createPayable({
      providerName: "Distribuidora Carrier",
      description: "Compra de filtros de reposição",
      category: "PECA",
      costCenter: "OPERACIONAL",
      value: 120,
      dueDate: new Date(),
    }, admin.id);

    if (!payableRes.success || !payableRes.payable) throw new Error("Falha ao lançar conta a pagar.");
    const payableId = payableRes.payable.id;
    console.log(`  - Conta a pagar cadastrada com ID: ${payableId}`);

    // Pagar despesa
    const spendRes = await payBill({
      payableId,
      paymentMethod: "TRANSFERENCIA",
      bankAccountId: bank.id,
      userId: admin.id,
    });
    if (!spendRes.success) throw new Error(spendRes.error || "Falha ao pagar despesa.");
    console.log("  - Despesa paga e baixada do caixa.");

    const transactionsAfter = await getTransactions();
    if (transactionsAfter.length < transactionsBefore.length + 2) {
      throw new Error("Recebimento e pagamento não geraram os dois lançamentos esperados no extrato.");
    }
    const settledReceivable = (await getReceivables()).find((item) => item.id === invoiceReceivable.id);
    if (!settledReceivable || settledReceivable.pendingValue !== 0) {
      throw new Error("A conta a receber permaneceu com saldo após a liquidação.");
    }
    const settledPayable = (await getPayables()).find((item) => item.id === payableId);
    if (!settledPayable || settledPayable.status !== "PAGO") {
      throw new Error("A conta a pagar não ficou marcada como paga.");
    }
    console.log("  - Extrato, baixa do recebível e liquidação do pagável conferidos.");
  });

  // 9. Estoque e Peças
  await test("Gestão de Estoque e Compras", async () => {
    const admin = await getUserByEmail("admin@erp.com");
    if (!admin) throw new Error("Admin offline.");

    const prodRes = await createProduct({
      code: `SKU-${Date.now().toString().slice(-6)}`,
      name: "Filtro de Ar G4 Plissado",
      costPrice: 40,
      salePrice: 85,
      stockQuantity: 15,
      minStock: 5,
      unit: "UN",
      userId: admin.id,
    });

    if (!prodRes.success) throw new Error(prodRes.error || "Falha ao cadastrar produto.");
    console.log("  - Novo produto cadastrado no estoque.");

    const products = await getProducts();
    const match = products.find((p) => p.name.includes("Filtro"));
    if (!match) throw new Error("Produto cadastrado não retornado pela listagem.");
    console.log(`  - Item localizado no almoxarifado: ${match.name} (Qtd: ${match.stockQuantity})`);
  });

  // 10. Contratos de Manutenção PMOC
  await test("Gestão de Contratos de Manutenção PMOC", async () => {
    const admin = await getUserByEmail("admin@erp.com");
    if (!admin) throw new Error("Admin offline.");

    const contractRes = await createContract({
      clientId,
      value: 1500,
      billingPeriod: "MENSAL",
      startDate: new Date(),
      endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
      items: [{ description: "Manutenção PMOC mensal", quantity: 1, unitPrice: 1500 }],
    }, admin.id);

    if (!contractRes.success || !contractRes.contract) throw new Error(contractRes.error || "Falha ao criar contrato.");
    const contractId = contractRes.contract.id;
    console.log(`  - Contrato PMOC ativo com ID: ${contractId}`);

    // Faturar frequência mensal
    const recurRes = await triggerRecurrencyBilling(contractId, admin.id);
    if (!recurRes.success) throw new Error(recurRes.error || "Falha ao faturar recorrência do contrato.");
    console.log("  - Faturamento recorrente mensal PMOC gerado com sucesso no financeiro.");
  });

  console.log("\n========================================================");
  console.log(`   SUÍTE FINALIZADA: ${successCount}/${testCount} PASSARAM COM SUCESSO! 🎉   `);
  console.log("========================================================\n");

  if (successCount !== testCount) {
    process.exit(1);
  }
}

runSuite();
