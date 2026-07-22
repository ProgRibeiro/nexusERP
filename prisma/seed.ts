import { prisma } from "../src/lib/db";
import crypto from "crypto";

function hashPassword(password: string): string {
  return crypto.pbkdf2Sync(password, "nx_erp_salt_key_2026", 1000, 64, "sha512").toString("hex");
}

async function main() {
  console.log("Iniciando limpeza do banco de dados...");

  // Limpar tabelas em ordem reversa de dependência
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.setting.deleteMany(),
    prisma.attachment.deleteMany(),
    prisma.financialTransaction.deleteMany(),
    prisma.accountsReceivable.deleteMany(),
    prisma.accountsPayable.deleteMany(),
    prisma.bankReconciliation.deleteMany(),
    prisma.bankAccount.deleteMany(),
    prisma.stockMovement.deleteMany(),
    prisma.serviceOrderMaterial.deleteMany(),
    prisma.serviceOrderItem.deleteMany(),
    prisma.serviceOrderPhoto.deleteMany(),
    prisma.serviceOrderStatusHistory.deleteMany(),
    prisma.serviceOrderTechnician.deleteMany(),
    prisma.completionReport.deleteMany(),
    prisma.invoice.deleteMany(),
    prisma.serviceOrder.deleteMany(),
    prisma.quoteApproval.deleteMany(),
    prisma.quoteVersion.deleteMany(),
    prisma.quoteItem.deleteMany(),
    prisma.quote.deleteMany(),
    prisma.crmActivity.deleteMany(),
    prisma.lead.deleteMany(),
    prisma.crmStage.deleteMany(),
    prisma.crmPipeline.deleteMany(),
    prisma.clientContact.deleteMany(),
    prisma.clientAddress.deleteMany(),
    prisma.clientEquipment.deleteMany(),
    prisma.contractItem.deleteMany(),
    prisma.contract.deleteMany(),
    prisma.client.deleteMany(),
    prisma.user.deleteMany(),
    prisma.role.deleteMany(),
    prisma.permission.deleteMany(),
    prisma.product.deleteMany(),
    prisma.service.deleteMany(),
    prisma.supplier.deleteMany(),
  ]);

  console.log("Banco de dados limpo. Criando permissões e papéis...");

  // 1. Criar Permissões
  const permissionsData = [
    { code: "dashboard.view", name: "Visualizar Dashboard" },
    { code: "crm.read", name: "Visualizar Leads/Funil" },
    { code: "crm.write", name: "Criar/Editar Leads" },
    { code: "clients.read", name: "Visualizar Clientes" },
    { code: "clients.write", name: "Criar/Editar Clientes" },
    { code: "quotes.read", name: "Visualizar Orçamentos" },
    { code: "quotes.write", name: "Criar/Editar Orçamentos" },
    { code: "quotes.approve", name: "Aprovar Orçamentos" },
    { code: "os.read", name: "Visualizar Ordens de Serviço" },
    { code: "os.write", name: "Criar/Editar OS" },
    { code: "os.execute", name: "Executar OS (Técnico)" },
    { code: "faturamento.read", name: "Visualizar Faturamento" },
    { code: "faturamento.write", name: "Faturar e Emitir NF" },
    { code: "financeiro.read", name: "Visualizar Contas e DRE" },
    { code: "financeiro.write", name: "Baixar e Agendar Contas" },
    { code: "estoque.read", name: "Visualizar Estoque" },
    { code: "estoque.write", name: "Movimentar Estoque" },
    { code: "contratos.read", name: "Visualizar Contratos" },
    { code: "contratos.write", name: "Criar/Editar Contratos" },
    { code: "admin.all", name: "Acesso Geral e Configurações" },
  ];

  const permissions: Record<string, any> = {};
  for (const perm of permissionsData) {
    permissions[perm.code] = await prisma.permission.create({ data: perm });
  }

  // 2. Criar Papéis (Roles)
  const rolesData = [
    { name: "Administrador", description: "Acesso total ao sistema", permCodes: ["admin.all"] },
    { name: "Gestor", description: "Gerenciamento e aprovação geral", permCodes: ["dashboard.view", "crm.read", "clients.read", "quotes.read", "quotes.approve", "os.read", "os.write", "faturamento.read", "financeiro.read", "estoque.read", "contratos.read"] },
    { name: "Comercial", description: "Vendas, leads e orçamentos", permCodes: ["dashboard.view", "crm.read", "crm.write", "clients.read", "clients.write", "quotes.read", "quotes.write"] },
    { name: "Operacional", description: "Agendamento e controle de equipe", permCodes: ["dashboard.view", "clients.read", "os.read", "os.write", "estoque.read", "contratos.read"] },
    { name: "Técnico", description: "Execução de serviços em campo", permCodes: ["os.read", "os.execute"] },
    { name: "Faturamento", description: "Conferência e emissão de notas fiscais", permCodes: ["dashboard.view", "os.read", "faturamento.read", "faturamento.write"] },
    { name: "Financeiro", description: "Contas a pagar/receber e conciliação", permCodes: ["dashboard.view", "financeiro.read", "financeiro.write", "faturamento.read"] },
    { name: "Estoque", description: "Cadastro e movimentação de peças", permCodes: ["dashboard.view", "estoque.read", "estoque.write"] },
  ];

  const roles: Record<string, any> = {};
  for (const r of rolesData) {
    roles[r.name] = await prisma.role.create({
      data: {
        name: r.name,
        description: r.description,
      },
    });
  }

  console.log("Criando usuários...");

  // 3. Criar Usuários para teste (senhas simples '123456')
  const usersData = [
    { name: "Lucas Souza (Admin)", email: "admin@erp.com", role: "Administrador", perms: ["admin.all"] },
    { name: "Roberto Silva (Gestor)", email: "gestor@erp.com", role: "Gestor", perms: ["dashboard.view", "crm.read"] },
    { name: "Paula Vendas (Comercial)", email: "comercial@erp.com", role: "Comercial", perms: ["dashboard.view", "crm.read", "crm.write", "clients.read", "clients.write", "quotes.read", "quotes.write"] },
    { name: "Julio Mello (Operacional)", email: "operacional@erp.com", role: "Operacional", perms: ["dashboard.view", "clients.read", "os.read", "os.write"] },
    { name: "Carlos Técnico (Técnico)", email: "tecnico@erp.com", role: "Técnico", perms: ["os.read", "os.execute"] },
    { name: "Marcos Técnico 2 (Técnico)", email: "tecnico2@erp.com", role: "Técnico", perms: ["os.read", "os.execute"] },
    { name: "Fabiola Notas (Faturamento)", email: "faturamento@erp.com", role: "Faturamento", perms: ["dashboard.view", "os.read", "faturamento.read", "faturamento.write"] },
    { name: "Flavio Finanças (Financeiro)", email: "financeiro@erp.com", role: "Financeiro", perms: ["dashboard.view", "financeiro.read", "financeiro.write", "faturamento.read"] },
    { name: "Edmilson Almoxarife (Estoque)", email: "estoque@erp.com", role: "Estoque", perms: ["dashboard.view", "estoque.read", "estoque.write"] },
  ];

  const users: Record<string, any> = {};
  for (const u of usersData) {
    users[u.email] = await prisma.user.create({
      data: {
        name: u.name,
        email: u.email,
        password: hashPassword("123"), // Hasheada com pbkdf2 seguro
        roleId: roles[u.role].id,
        permissions: JSON.stringify(u.perms),
      },
    });
  }

  console.log("Criando Fornecedores e Produtos...");

  // 4. Fornecedores
  const supplier1 = await prisma.supplier.create({
    data: {
      name: "Distribuidora Refrigeração Norte",
      cnpj: "12.345.678/0001-90",
      phone: "(11) 3344-5566",
      email: "vendas@refrinorte.com.br",
    },
  });

  const supplier2 = await prisma.supplier.create({
    data: {
      name: "Elétrica Schneider Ltda",
      cnpj: "98.765.432/0001-21",
      phone: "(21) 2233-4455",
      email: "contato@eltschneider.com.br",
    },
  });

  // 5. Produtos (Peças)
  const productsData = [
    { code: "P-0001", name: "Compressor Rotativo 12000 BTUs R410A", costPrice: 420.0, salePrice: 680.0, stockQuantity: 15, minStock: 5, unit: "UN", supplierId: supplier1.id },
    { code: "P-0002", name: "Capacitor de Partida 35uF 450V", costPrice: 15.0, salePrice: 35.0, stockQuantity: 50, minStock: 10, unit: "UN", supplierId: supplier1.id },
    { code: "P-0003", name: "Sensor de Temperatura Climatizador", costPrice: 8.0, salePrice: 22.0, stockQuantity: 3, minStock: 8, unit: "UN", supplierId: supplier1.id }, // Alerta de Estoque Baixo!
    { code: "P-0004", name: "Placa Eletrônica Principal Split", costPrice: 110.0, salePrice: 240.0, stockQuantity: 8, minStock: 3, unit: "UN", supplierId: supplier1.id },
    { code: "P-0005", name: "Disjuntor Termomagnético DIN 20A", costPrice: 12.0, salePrice: 28.0, stockQuantity: 40, minStock: 15, unit: "UN", supplierId: supplier2.id },
    { code: "P-0006", name: "Cabo Flexível Cobre 2.5mm² (Rolo 100m)", costPrice: 180.0, salePrice: 290.0, stockQuantity: 12, minStock: 4, unit: "RL", supplierId: supplier2.id },
  ];

  const products: Record<string, any> = {};
  for (const prod of productsData) {
    products[prod.code] = await prisma.product.create({ data: prod });
  }

  // 6. Serviços
  const servicesData = [
    { name: "Instalação Completa de Split 12000 BTU", description: "Instalação mecânica, hidráulica e elétrica da evaporadora e condensadora com até 3 metros de linha de cobre.", defaultPrice: 450.0 },
    { name: "Manutenção Preventiva Climatizador (Limpeza)", description: "Limpeza de filtros, turbina, serpentina, bandeja de condensado e verificação de carga de fluido.", defaultPrice: 150.0 },
    { name: "Diagnóstico Técnico & Visita", description: "Visita ao local para análise do equipamento, testes de componentes e levantamento de causa de defeito.", defaultPrice: 80.0 },
    { name: "Carga de Gás Ecológico R410a", description: "Vácuo no sistema, teste de estanqueidade e recarga completa de fluido refrigerante por peso.", defaultPrice: 220.0 },
    { name: "Instalação de Ponto de Força AC", description: "Passagem de fiação, instalação de disjuntor dedicado e tomada conforme NBR.", defaultPrice: 180.0 },
  ];

  const services: Record<string, any> = {};
  for (const serv of servicesData) {
    services[serv.name] = await prisma.service.create({ data: serv });
  }

  console.log("Criando Clientes...");

  // 7. Clientes
  const client1 = await prisma.client.create({
    data: {
      name: "Clínica Odontológica Sorriso Perfeito Ltda",
      socialName: "Sorriso Perfeito Prestação de Serviços Odontológicos Ltda",
      fancyName: "Sorriso Perfeito",
      cpfCnpj: "45.123.654/0001-09",
      stateRegistration: "123.456.789.111",
      municipalRegistration: "998877",
      email: "financeiro@sorrisoperfeito.com.br",
      phone: "(11) 2233-8899",
      whatsapp: "(11) 98888-7777",
      segment: "Saúde / Odontologia",
      origin: "Google Ads",
      status: "ATIVO",
      notes: "Cliente exige agendamento apenas no período da manhã (08:00 - 12:00) devido ao atendimento aos pacientes à tarde.",
    },
  });

  const client2 = await prisma.client.create({
    data: {
      name: "Condomínio Edifício Residencial Splendor",
      socialName: "Condomínio Edifício Residencial Splendor",
      cpfCnpj: "90.987.654/0001-88",
      email: "sindico@edificiosplendor.com.br",
      phone: "(11) 3456-1122",
      whatsapp: "(11) 97777-6666",
      segment: "Condomínio Residencial",
      origin: "Indicação Comercial",
      status: "ATIVO",
      notes: "Falar com Síndico Sr. Amilton. Entrada liberada apenas por portaria de serviço.",
    },
  });

  const client3 = await prisma.client.create({
    data: {
      name: "Mariana Medeiros de Souza",
      cpfCnpj: "123.456.789-00",
      email: "mariana.medeiros@gmail.com",
      phone: "(11) 96543-2109",
      whatsapp: "(11) 96543-2109",
      segment: "Residencial",
      origin: "Orgânico / Redes Sociais",
      status: "ATIVO",
    },
  });

  // 8. Contatos dos Clientes
  await prisma.clientContact.create({
    data: {
      clientId: client1.id,
      name: "Dr. André Santos",
      role: "Sócio Diretor",
      email: "andre@sorrisoperfeito.com.br",
      phone: "(11) 2233-8899",
      isApproval: true,
    },
  });

  const contactFin1 = await prisma.clientContact.create({
    data: {
      clientId: client1.id,
      name: "Joana Dark",
      role: "Auxiliar Administrativo",
      email: "joana@sorrisoperfeito.com.br",
      phone: "(11) 2233-8890",
      isFinancial: true,
    },
  });

  const contactTech2 = await prisma.clientContact.create({
    data: {
      clientId: client2.id,
      name: "Sr. Geraldo",
      role: "Zelador",
      email: "geraldo@edificiosplendor.com.br",
      phone: "(11) 98888-1234",
      isTechnical: true,
    },
  });

  // 9. Endereços dos Clientes
  const addr1 = await prisma.clientAddress.create({
    data: {
      clientId: client1.id,
      label: "Execução (Consultório)",
      street: "Av. Paulista",
      number: "1000",
      complement: "Conjunto 41",
      neighborhood: "Bela Vista",
      city: "São Paulo",
      state: "SP",
      cep: "01310-100",
      reference: "Próximo ao metrô Trianon-Masp",
    },
  });

  const addr2 = await prisma.clientAddress.create({
    data: {
      clientId: client2.id,
      label: "Principal (Portaria)",
      street: "Rua das Figueiras",
      number: "450",
      neighborhood: "Jardins",
      city: "São Paulo",
      state: "SP",
      cep: "01420-000",
    },
  });

  const addr3 = await prisma.clientAddress.create({
    data: {
      clientId: client3.id,
      label: "Residência",
      street: "Rua João Cachoeira",
      number: "201",
      complement: "Apto 152",
      neighborhood: "Itaim Bibi",
      city: "São Paulo",
      state: "SP",
      cep: "04535-000",
    },
  });

  // 10. Equipamentos
  const equip1 = await prisma.clientEquipment.create({
    data: {
      clientId: client1.id,
      type: "Ar Condicionado Split",
      brand: "Midea Liva",
      model: "42MQA12C5",
      serialNumber: "SN-99881234AA",
      capacity: "12000 BTU / Frio",
      tag: "AC-CONSULTORIO-01",
      location: "Sala de Espera",
      installDate: new Date("2024-05-10"),
    },
  });

  const equip2 = await prisma.clientEquipment.create({
    data: {
      clientId: client1.id,
      type: "Ar Condicionado Split",
      brand: "Daikin Inverter",
      model: "FTKP09Q5VL",
      serialNumber: "SN-Daikin-4433-21",
      capacity: "9000 BTU / Inverter",
      tag: "AC-SALA-CIRURGIA-01",
      location: "Sala de Cirurgia A",
      installDate: new Date("2025-01-15"),
    },
  });

  await prisma.clientEquipment.create({
    data: {
      clientId: client2.id,
      type: "Sistema de Pressurização de Incêndio (Quadro)",
      brand: "WEG / Siemens",
      model: "QTA-50HP-440V",
      serialNumber: "ELET-12932",
      tag: "QTA-PRESSURIZACAO",
      location: "Subsolo 2 - Casa de Máquinas",
      installDate: new Date("2022-08-20"),
    },
  });

  console.log("Criando Funil do CRM...");

  // 11. CRM Pipeline & Estágios
  const pipeline = await prisma.crmPipeline.create({
    data: {
      name: "Funil Comercial de Serviços",
      description: "Pipeline principal para captação de novos clientes de climatização e elétrica.",
    },
  });

  const stagesData = [
    { name: "Novo lead", order: 1 },
    { name: "Contato realizado", order: 2 },
    { name: "Diagnóstico feito", order: 3 },
    { name: "Visita técnica agendada", order: 4 },
    { name: "Orçamento em criação", order: 5 },
    { name: "Orçamento enviado", order: 6 },
    { name: "Negociação", order: 7 },
    { name: "Aprovado", order: 8 },
    { name: "Perdido", order: 9 },
  ];

  const stages: Record<string, any> = {};
  for (const stg of stagesData) {
    stages[stg.name] = await prisma.crmStage.create({
      data: {
        pipelineId: pipeline.id,
        name: stg.name,
        order: stg.order,
      },
    });
  }

  // 12. Leads
  const lead1 = await prisma.lead.create({
    data: {
      name: "Guilherme Ramos (Hotel Plaza)",
      email: "manutencao@hotelplaza.com.br",
      phone: "(11) 98111-2222",
      company: "Hotel Plaza Prime",
      status: "EM_ANDAMENTO",
      pipelineStageId: stages["Diagnóstico feito"].id,
      value: 4500.0,
      closePrediction: new Date("2026-07-25"),
      source: "Indicação",
      ownerId: users["comercial@erp.com"].id,
      notes: "Precisa de preventiva em 15 aparelhos de ar condicionado de gaveta e split no lobby.",
    },
  });

  const lead2 = await prisma.lead.create({
    data: {
      name: "Clara Gouveia (Academia FitLife)",
      email: "gerencia@fitlifesp.com.br",
      phone: "(11) 98765-4321",
      company: "FitLife Academia",
      status: "EM_ANDAMENTO",
      pipelineStageId: stages["Contato realizado"].id,
      value: 1200.0,
      source: "Google Ads",
      ownerId: users["comercial@erp.com"].id,
      notes: "Entrou em contato reclamando que o ar condicionado principal da sala de spinning está vazando água.",
    },
  });

  // Atividades do CRM
  await prisma.crmActivity.create({
    data: {
      leadId: lead1.id,
      userId: users["comercial@erp.com"].id,
      type: "LIGACAO",
      description: "Feito contato inicial e agendado diagnóstico para levantamento de escopo técnico.",
      date: new Date("2026-07-08T10:00:00Z"),
      done: true,
    },
  });

  await prisma.crmActivity.create({
    data: {
      leadId: lead1.id,
      userId: users["comercial@erp.com"].id,
      type: "VISITA",
      description: "Realizar visita diagnóstica para verificar os modelos e capacidades de todos os 15 aparelhos.",
      date: new Date("2026-07-15T09:00:00Z"),
      done: false,
    },
  });

  console.log("Criando Orçamentos (Quotes)...");

  // 13. Orçamentos

  // Orçamento 1: Aprovado e já convertido em OS
  const quote1 = await prisma.quote.create({
    data: {
      code: "Q-2026-0001",
      clientId: client1.id,
      addressId: addr1.id,
      contactId: contactFin1.id,
      status: "CONVERTIDO",
      version: 1,
      validUntil: new Date("2026-07-30"),
      warrantyDays: 90,
      executionTerm: "2 dias úteis",
      paymentTerms: "Faturado 15 dias após conclusão",
      subtotal: 1070.0,
      discount: 70.0,
      tax: 50.0,
      total: 1050.0,
      costEstimate: 450.0,
      estimatedMargin: 600.0,
      notes: "Valor especial acordado para aprovação em lote.",
      approvedAt: new Date("2026-07-09T10:00:00Z"),
      approvedBy: "Roberto Silva (Gestor)",
    },
  });

  await prisma.quoteItem.createMany({
    data: [
      { quoteId: quote1.id, type: "SERVICO", description: "Instalação Completa de Split 12000 BTU", quantity: 1, unit: "UN", unitPrice: 450.0, costPrice: 150.0, total: 450.0 },
      { quoteId: quote1.id, type: "PRODUTO", description: "Compressor Rotativo 12000 BTUs R410A", quantity: 1, unit: "UN", unitPrice: 620.0, costPrice: 420.0, total: 620.0 }, // Desconto inserido na cabeceira
    ],
  });

  // Orçamento 2: Enviado ao cliente, aguardando aprovação
  const quote2 = await prisma.quote.create({
    data: {
      code: "Q-2026-0002",
      clientId: client3.id,
      addressId: addr3.id,
      status: "ENVIADO",
      version: 1,
      validUntil: new Date("2026-07-20"),
      warrantyDays: 90,
      executionTerm: "1 dia",
      paymentTerms: "À vista no Pix com 5% de desconto ou 3x sem juros no cartão",
      subtotal: 370.0,
      discount: 0.0,
      tax: 0.0,
      total: 370.0,
      costEstimate: 95.0,
      estimatedMargin: 275.0,
      notes: "Proposta enviada por e-mail e WhatsApp.",
    },
  });

  await prisma.quoteItem.createMany({
    data: [
      { quoteId: quote2.id, type: "SERVICO", description: "Manutenção Preventiva Climatizador (Limpeza)", quantity: 1, unit: "UN", unitPrice: 150.0, costPrice: 30.0, total: 150.0 },
      { quoteId: quote2.id, type: "SERVICO", description: "Carga de Gás Ecológico R410a", quantity: 1, unit: "UN", unitPrice: 220.0, costPrice: 65.0, total: 220.0 },
    ],
  });

  // Orçamento 3: Em Rascunho
  const quote3 = await prisma.quote.create({
    data: {
      code: "Q-2026-0003",
      clientId: client2.id,
      addressId: addr2.id,
      status: "RASCUNHO",
      version: 1,
      validUntil: new Date("2026-08-05"),
      total: 80.0,
      notes: "Elaborando levantamento de horas necessárias para readequação do quadro elétrico.",
    },
  });

  await prisma.quoteItem.create({
    data: { quoteId: quote3.id, type: "SERVICO", description: "Diagnóstico Técnico & Visita", quantity: 1, unit: "UN", unitPrice: 80.0, costPrice: 20.0, total: 80.0 },
  });

  console.log("Criando Contas Bancárias...");

  // 14. Contas Bancárias
  const bankAccount1 = await prisma.bankAccount.create({
    data: {
      name: "Itaú Corporate",
      bank: "Itaú Unibanco",
      agency: "0100",
      accountNumber: "23456-7",
      balance: 14500.0,
    },
  });

  const bankAccount2 = await prisma.bankAccount.create({
    data: {
      name: "Caixa Geral",
      bank: "Dinheiro Físico",
      agency: "0000",
      accountNumber: "00000-0",
      balance: 350.0,
    },
  });

  console.log("Criando Ordens de Serviço (OS)...");

  // 15. Ordens de Serviço

  // OS 1: Vinda do Orçamento 1 - Concluída, Relatório de Conclusão emitido, Faturada, Nota Fiscal Emitida, e Paga!
  const os1 = await prisma.serviceOrder.create({
    data: {
      code: "OS-2026-0001",
      quoteId: quote1.id,
      clientId: client1.id,
      addressId: addr1.id,
      contactId: contactFin1.id,
      status: "FATURADA",
      priority: "ALTA",
      type: "CORRETIVA",
      scheduledDate: new Date("2026-07-09"),
      scheduledTime: "09:00",
      problemReported: "Ar condicionado da sala de espera parou de refrigerar e está fazendo estalos.",
      technicalDiagnosis: "Verificado que o compressor antigo sofreu queima por sobretensão elétrica. Foi necessária a substituição do compressor e do capacitor de partida.",
      checklistJson: JSON.stringify([
        { question: "Equipamento desenergizado antes do início?", checked: true },
        { question: "Teste de estanqueidade realizado?", checked: true },
        { question: "Pressão de trabalho verificada?", answer: "120 PSI", checked: true },
        { question: "Corrente do compressor dentro do padrão?", answer: "5.4 A", checked: true },
        { question: "Limpeza da bandeja realizada?", checked: true },
      ]),
      signatureBase64: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJYAAABkCAYAAABg...", // Simulado
      signatureName: "Dr. André Santos",
      marginReal: 550.0, // Preço venda 1050 - Materiais 435 - técnico 65
      faturamentoStatus: "NF_ENVIADA",
      notes: "Serviço emergencial executado com sucesso.",
      completedAt: new Date("2026-07-09T12:00:00Z"),
    },
  });

  // Itens da OS 1
  await prisma.serviceOrderItem.createMany({
    data: [
      { serviceOrderId: os1.id, description: "Instalação Completa de Split 12000 BTU", quantity: 1, unit: "UN", unitPrice: 450.0, total: 450.0 },
      { serviceOrderId: os1.id, description: "Compressor Rotativo 12000 BTUs R410A", quantity: 1, unit: "UN", unitPrice: 600.0, total: 600.0 },
    ],
  });

  // Peças usadas na OS 1
  await prisma.serviceOrderMaterial.createMany({
    data: [
      { serviceOrderId: os1.id, productId: products["P-0001"].id, quantity: 1, costPrice: 420.0, salePrice: 600.0, usedQuantity: 1, status: "UTILIZADO" },
      { serviceOrderId: os1.id, productId: products["P-0002"].id, quantity: 1, costPrice: 15.0, salePrice: 0.0, usedQuantity: 1, status: "UTILIZADO" }, // Cortesia / Garantia
    ],
  });

  // Movimentação de estoque (saída) para a OS 1
  await prisma.stockMovement.createMany({
    data: [
      { productId: products["P-0001"].id, type: "SAIDA", quantity: 1, reason: "OS_UTILIZADO", serviceOrderId: os1.id, cost: 420.0 },
      { productId: products["P-0002"].id, type: "SAIDA", quantity: 1, reason: "OS_UTILIZADO", serviceOrderId: os1.id, cost: 15.0 },
    ],
  });

  // Técnico vinculado à OS 1
  await prisma.serviceOrderTechnician.create({
    data: { serviceOrderId: os1.id, userId: users["tecnico@erp.com"].id },
  });

  // Histórico de status da OS 1
  await prisma.serviceOrderStatusHistory.createMany({
    data: [
      { serviceOrderId: os1.id, oldStatus: "CRIADA", newStatus: "AGENDADA", changedById: users["operacional@erp.com"].id, justification: "Agendado técnico para o dia 09 às 09:00" },
      { serviceOrderId: os1.id, oldStatus: "AGENDADA", newStatus: "EXECUCAO", changedById: users["tecnico@erp.com"].id, justification: "Check-in realizado pelo técnico no cliente." },
      { serviceOrderId: os1.id, oldStatus: "EXECUCAO", newStatus: "CONCLUIDA", changedById: users["tecnico@erp.com"].id, justification: "Serviço finalizado, testes aprovados e assinatura coletada." },
      { serviceOrderId: os1.id, oldStatus: "CONCLUIDA", newStatus: "FATURAMENTO", changedById: users["operacional@erp.com"].id, justification: "Relatório de conclusão aprovado internamente." },
      { serviceOrderId: os1.id, oldStatus: "FATURAMENTO", newStatus: "FATURADA", changedById: users["faturamento@erp.com"].id, justification: "Conferido dados, emitida NF-e e enviada cobrança." },
    ],
  });

  // Relatório de Conclusão da OS 1
  const report1 = await prisma.completionReport.create({
    data: {
      serviceOrderId: os1.id,
      clientFeedback: "Atendimento muito rápido e equipe técnica extremamente educada e limpa.",
      technicalObservations: "O disjuntor do ar condicionado está dimensionado corretamente, porém a rede da região sofre constantes picos de energia. Recomendado a instalação de um supressor de surto (DPS) no quadro elétrico.",
      warrantyTerms: "Garantia de 90 dias nos serviços prestados e 1 ano no compressor conforme regras da fabricante.",
      approvedByClient: true,
      approvedAt: new Date("2026-07-09T12:00:00Z"),
    },
  });

  // Nota Fiscal da OS 1
  const invoice1 = await prisma.invoice.create({
    data: {
      code: "NF-000101",
      serviceOrderId: os1.id,
      clientId: client1.id,
      issueDate: new Date("2026-07-09T14:00:00Z"),
      value: 1050.0,
      taxValue: 52.5, // 5% ISS
      status: "ENVIADA",
      pdfUrl: "/invoices/nf-000101.pdf",
    },
  });

  // Atualizar a OS com a nota
  await prisma.serviceOrder.update({
    where: { id: os1.id },
    data: { invoiceId: invoice1.id },
  });

  // Financeiro da OS 1: Contas a Receber (já Pago)
  const receivable1 = await prisma.accountsReceivable.create({
    data: {
      clientId: client1.id,
      serviceOrderId: os1.id,
      quoteId: quote1.id,
      invoiceId: invoice1.id,
      totalValue: 1050.0,
      receivedValue: 1050.0,
      pendingValue: 0.0,
      issueDate: new Date("2026-07-09"),
      dueDate: new Date("2026-07-09"), // Pago na hora
      paymentDate: new Date("2026-07-09"),
      paymentMethod: "PIX",
      status: "PAGO",
      bankAccountId: bankAccount1.id,
      category: "RECEITA_SERVICO",
      notes: "Pagamento via Pix confirmado no Itaú.",
    },
  });

  // Transação financeira vinculada
  await prisma.financialTransaction.create({
    data: {
      type: "RECEITA",
      value: 1050.0,
      date: new Date("2026-07-09T14:30:00Z"),
      category: "RECEITA_SERVICO",
      accountsReceivableId: receivable1.id,
      description: "Recebimento OS-2026-0001 - Sorriso Perfeito",
      bankAccountId: bankAccount1.id,
    },
  });

  // OS 2: Em andamento (EXECUCAO)
  const os2 = await prisma.serviceOrder.create({
    data: {
      code: "OS-2026-0002",
      clientId: client2.id,
      addressId: addr2.id,
      contactId: contactTech2.id,
      status: "EXECUCAO",
      priority: "MEDIA",
      type: "PREVENTIVA",
      scheduledDate: new Date("2026-07-09"),
      scheduledTime: "14:00",
      problemReported: "Contrato Recorrente - Manutenção preventiva mensal do quadro de pressurização.",
      notes: "Técnico já realizou check-in e está efetuando os testes de torque nos disjuntores.",
    },
  });

  await prisma.serviceOrderItem.create({
    data: { serviceOrderId: os2.id, description: "Preventiva Mensal Quadro Elétrico", quantity: 1, unit: "UN", unitPrice: 250.0, total: 250.0 },
  });

  await prisma.serviceOrderTechnician.create({
    data: { serviceOrderId: os2.id, userId: users["tecnico@erp.com"].id },
  });

  await prisma.serviceOrderStatusHistory.createMany({
    data: [
      { serviceOrderId: os2.id, oldStatus: "CRIADA", newStatus: "AGENDADA", changedById: users["operacional@erp.com"].id, justification: "Agendado conforme contrato." },
      { serviceOrderId: os2.id, oldStatus: "AGENDADA", newStatus: "EXECUCAO", changedById: users["tecnico@erp.com"].id, justification: "Check-in em campo." },
    ],
  });

  // OS 3: Agendada para amanhã (AGENDADA)
  const os3 = await prisma.serviceOrder.create({
    data: {
      code: "OS-2026-0003",
      clientId: client1.id,
      addressId: addr1.id,
      status: "AGENDADA",
      priority: "BAIXA",
      type: "VISITA_TECNICA",
      scheduledDate: new Date("2026-07-10"),
      scheduledTime: "10:00",
      problemReported: "Revisão de barulhos no ar condicionado da Sala B.",
    },
  });

  await prisma.serviceOrderItem.create({
    data: { serviceOrderId: os3.id, description: "Diagnóstico Técnico & Visita", quantity: 1, unit: "UN", unitPrice: 80.0, total: 80.0 },
  });

  await prisma.serviceOrderTechnician.create({
    data: { serviceOrderId: os3.id, userId: users["tecnico2@erp.com"].id },
  });

  // OS 4: Aguardando Peças (AGUARDANDO_PECA)
  const os4 = await prisma.serviceOrder.create({
    data: {
      code: "OS-2026-0004",
      clientId: client2.id,
      addressId: addr2.id,
      status: "AGUARDANDO_PECA",
      priority: "ALTA",
      type: "CORRETIVA",
      scheduledDate: new Date("2026-07-05"),
      problemReported: "Bomba reserva de pressurização não parte automaticamente no painel elétrico.",
      technicalDiagnosis: "Identificado que o contator da bomba 2 está com os contatos colados devido a arco elétrico. Necessária a substituição da peça.",
      notes: "Aguardando chegada da peça comprada com o fornecedor Schneider.",
    },
  });

  await prisma.serviceOrderItem.create({
    data: { serviceOrderId: os4.id, description: "Substituição de Contator de Potência 32A", quantity: 1, unit: "UN", unitPrice: 150.0, total: 150.0 },
  });

  await prisma.serviceOrderMaterial.create({
    data: { serviceOrderId: os4.id, productId: products["P-0005"].id, quantity: 1, costPrice: 12.0, salePrice: 35.0, usedQuantity: 0, status: "PREVISTO" },
  });

  // OS 5: Concluída, na Fila de Faturamento (CONCLUIDA)
  const os5 = await prisma.serviceOrder.create({
    data: {
      code: "OS-2026-0005",
      clientId: client3.id,
      addressId: addr3.id,
      status: "CONCLUIDA",
      priority: "MEDIA",
      type: "INSTALACAO",
      scheduledDate: new Date("2026-07-08"),
      problemReported: "Deseja instalar ar condicionado split novo comprado pela cliente.",
      technicalDiagnosis: "Instalado o aparelho conforme manual, pressurizado linha e efetuado vácuo de 450 microns. Aparelho refrigerando normalmente.",
      checklistJson: JSON.stringify([
        { question: "Tubulação isolada termicamente?", checked: true },
        { question: "Dreno testado com escoamento livre?", checked: true },
        { question: "Tensão de alimentação aferida?", answer: "223V", checked: true },
      ]),
      signatureBase64: "data:image/png;base64,iVBORw0KGgoAAA...",
      signatureName: "Mariana M. Souza",
      notes: "Instalado no quarto principal.",
      completedAt: new Date("2026-07-08T17:30:00Z"),
    },
  });

  await prisma.serviceOrderItem.create({
    data: { serviceOrderId: os5.id, description: "Instalação Completa de Split 12000 BTU", quantity: 1, unit: "UN", unitPrice: 450.0, total: 450.0 },
  });

  await prisma.serviceOrderTechnician.create({
    data: { serviceOrderId: os5.id, userId: users["tecnico2@erp.com"].id },
  });

  await prisma.completionReport.create({
    data: {
      serviceOrderId: os5.id,
      clientFeedback: "Muito satisfeita, o técnico foi rápido e muito atencioso.",
      technicalObservations: "Instalação atende as normas do fabricante para manutenção da garantia.",
      approvedByClient: true,
      approvedAt: new Date("2026-07-08T17:30:00Z"),
    },
  });

  console.log("Criando Contas a Receber e Contas a Pagar fictícias...");

  // 16. Contas a Receber Adicionais

  // Uma conta a receber pendente (a vencer) do Condomínio Splendor
  await prisma.accountsReceivable.create({
    data: {
      clientId: client2.id,
      totalValue: 600.0,
      receivedValue: 0.0,
      pendingValue: 600.0,
      issueDate: new Date("2026-07-01"),
      dueDate: new Date("2026-07-25"),
      status: "ABERTO",
      category: "CONTRATO",
      notes: "Mensalidade do contrato de manutenção preventiva.",
    },
  });

  // Uma conta a receber VENCIDA (inadimplência) da Sorriso Perfeito
  await prisma.accountsReceivable.create({
    data: {
      clientId: client1.id,
      totalValue: 850.0,
      receivedValue: 200.0,
      pendingValue: 650.0, // Saldo em aberto
      issueDate: new Date("2026-05-15"),
      dueDate: new Date("2026-06-15"), // Venceu mês passado
      status: "PARCIAL",
      category: "RECEITA_SERVICO",
      notes: "Cobrança de serviço de instalação de tomadas e pontos AC. Cliente solicitou prorrogação e pagou apenas parcial.",
    },
  });

  // 17. Contas a Pagar

  // Conta a Pagar 1: Peças compradas com a Distribuidora Norte (A vencer)
  await prisma.accountsPayable.create({
    data: {
      providerName: "Distribuidora Refrigeração Norte",
      description: "Compra de 3 compressores 12K BTUs para reposição de estoque.",
      category: "PECA",
      value: 1260.0,
      dueDate: new Date("2026-07-28"),
      status: "ABERTO",
    },
  });

  // Conta a Pagar 2: Aluguel da Sede Comercial (Paga dia 05)
  const payable2 = await prisma.accountsPayable.create({
    data: {
      providerName: "Imobiliária Aluga Rápido S/A",
      description: "Aluguel da sala comercial - Referência Junho/2026",
      category: "ALUGUEL",
      value: 2200.0,
      dueDate: new Date("2026-07-05"),
      paymentDate: new Date("2026-07-05"),
      paymentMethod: "BOLETO",
      status: "PAGO",
    },
  });

  // Transação financeira para o Aluguel (saída)
  await prisma.financialTransaction.create({
    data: {
      type: "DESPESA",
      value: 2200.0,
      date: new Date("2026-07-05T10:00:00Z"),
      category: "ALUGUEL",
      accountsPayableId: payable2.id,
      description: "Pagamento Aluguel Escritório",
      bankAccountId: bankAccount1.id,
    },
  });

  // Conta a Pagar 3: Combustível Frota Técnica (Paga dia 08)
  const payable3 = await prisma.accountsPayable.create({
    data: {
      providerName: "Posto Ipiranga",
      description: "Reembolso combustível carros técnicos",
      category: "COMBUSTIVEL",
      value: 450.0,
      dueDate: new Date("2026-07-08"),
      paymentDate: new Date("2026-07-08"),
      paymentMethod: "DINHEIRO",
      status: "PAGO",
    },
  });

  // Transação financeira para combustível (saída)
  await prisma.financialTransaction.create({
    data: {
      type: "DESPESA",
      value: 450.0,
      date: new Date("2026-07-08T18:00:00Z"),
      category: "COMBUSTIVEL",
      accountsPayableId: payable3.id,
      description: "Abastecimento frota carros",
      bankAccountId: bankAccount2.id,
    },
  });

  console.log("Criando Contratos Recorrentes...");

  // 18. Contrato Recorrente
  const contract = await prisma.contract.create({
    data: {
      clientId: client2.id,
      code: "C-2026-0001",
      value: 600.0,
      billingPeriod: "MENSAL",
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
      status: "ATIVO",
      notes: "Preventiva mensal no quadro elétrico de incêndio e pressurização. Reajuste anual pelo IGPM em Janeiro.",
    },
  });

  await prisma.contractItem.createMany({
    data: [
      { contractId: contract.id, description: "Inspeção mensal barramentos e disjuntores", quantity: 1, unitPrice: 400.0 },
      { contractId: contract.id, description: "Limpeza de contatores e testes de alternância das bombas", quantity: 1, unitPrice: 200.0 },
    ],
  });

  console.log("Criando Notificações e Alertas...");

  // 19. Alertas e Notificações
  await prisma.notification.createMany({
    data: [
      { title: "Estoque Baixo!", message: "Produto 'Sensor de Temperatura' atingiu o saldo mínimo de 3 unidades. Reposição recomendada.", type: "ESTOQUE", read: false, link: "/estoque" },
      { title: "Conta a Receber Vencida", message: "Cliente 'Sorriso Perfeito' possui fatura vencida desde 15/06 no valor pendente de R$ 650,00.", type: "FINANCEIRO", read: false, link: "/financeiro" },
      { title: "Nova OS por Orçamento", message: "OS-2026-0001 gerada automaticamente após aprovação do orçamento Q-2026-0001.", type: "OPERACIONAL", read: true, link: "/ordens-servico" },
      { title: "Contrato próximo do vencimento", message: "Contrato C-2026-0001 com Condomínio Splendor vence em menos de 180 dias.", type: "COMERCIAL", read: false, link: "/contratos" },
    ],
  });

  // 20. Configurações Gerais
  await prisma.setting.createMany({
    data: [
      { key: "company.name", value: "Antigravity Climatização & Elétrica" },
      { key: "company.cnpj", value: "07.889.332/0001-00" },
      { key: "company.address", value: "Rua do Engenho, 100 - Centro, São Paulo - SP" },
      { key: "company.phone", value: "(11) 3300-4400" },
      { key: "company.email", value: "contato@antigravityclima.com.br" },
      { key: "company.im", value: "324312-9" }, // Inscrição Municipal
      { key: "company.ie", value: "110.220.330.123" }, // Inscrição Estadual
      { key: "company.serviceCode", value: "14.01" }, // Código serviço padrão ISS (Manutenção)
      { key: "company.fiscalRegime", value: "SIMPLES_NACIONAL" },
      { key: "company.taxRate", value: "6" },
    ],
  });

  // 21. Histórico de auditoria
  await prisma.auditLog.createMany({
    data: [
      { userId: users["comercial@erp.com"].id, action: "CRIACAO", entity: "Orçamento", entityId: quote1.id, changesJson: JSON.stringify({ code: "Q-2026-0001", total: 1050.0 }) },
      { userId: users["gestor@erp.com"].id, action: "APROVACAO", entity: "Orçamento", entityId: quote1.id, changesJson: JSON.stringify({ oldStatus: "ENVIADO", newStatus: "APROVADO" }) },
      { userId: users["operacional@erp.com"].id, action: "CRIACAO", entity: "OrdemServico", entityId: os1.id, changesJson: JSON.stringify({ code: "OS-2026-0001", source: "Orçamento Q-2026-0001" }) },
      { userId: users["tecnico@erp.com"].id, action: "EDICAO", entity: "OrdemServico", entityId: os1.id, changesJson: JSON.stringify({ newStatus: "CONCLUIDA", hasSignature: true }) },
      { userId: users["faturamento@erp.com"].id, action: "CRIACAO", entity: "NotaFiscal", entityId: invoice1.id, changesJson: JSON.stringify({ code: "NF-000101", value: 1050.0 }) },
    ],
  });

  console.log("Banco de dados populado com sucesso!");
}

main()
  .catch((e) => {
    console.error("Erro ao rodar seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
