"use server";

import { logger } from "@/lib/logger";

import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export interface CashFlowPoint {
  date: string;
  receitas: number;
  despesas: number;
}

export interface UrgentAction {
  id: string;
  title: string;
  description: string;
  buttonLabel: string;
  link: string;
  color: "emerald" | "blue" | "amber" | "rose" | "violet" | "zinc";
}

export interface DashboardData {
  cards: {
    orcamentosAbertoCount: number;
    orcamentosAbertoTotal: number;
    orcamentosAprovadosCount: number;
    taxaAprovacao: number;
    osAndamentoCount: number;
    osAtrasadasCount: number;
    osAguardandoFaturamentoCount: number;
    contasVencidasCount: number;
    contasVencidasTotal: number;
    lucroMedioPorOS: number;
    faturamentoPendenteCount: number;
    nfseAEmitirCount: number;
    receberAbertoCount: number;
    receberHojeTotal: number;
    pagosHojeCount: number;
    contasPagarCount: number;
    contasPagarTotal: number;
    notasRejeitadasCount: number;
    relatoriosPendentesCount: number;
    estoqueCriticoCount: number;
    contratosVencendoCount: number;
    osAbertasCount: number;
    osConcluidasCount: number;
    leadsNovosCount: number;
    leadsNegociacaoCount: number;
    orcamentosRecusadosCount: number;
  };
  financeiro: {
    receitaMes: number;
    despesaMes: number;
    saldoPrevisto: number;
    saldoCaixa: number;
    lucroEstimado: number;
    receberAbertoTotal: number;
    pagarAbertoTotal: number;
    inadimplencia: number;
    variacaoReceita: number;
    variacaoDespesa: number;
  };
  acoesUrgentes: UrgentAction[];
  alertas: {
    id: string;
    title: string;
    message: string;
    type: "ESTOQUE" | "FINANCEIRO" | "OPERACIONAL" | "COMERCIAL" | "FISCAL" | "CONTRATOS";
    link?: string;
  }[];
  fluxoCaixa: CashFlowPoint[];
  tabelas: {
    ultimasOS: { id: string; code: string; client: string; status: string; date: Date }[];
    contasVencidas: { id: string; client: string; value: number; dueDate: Date }[];
    orcamentosNegociacao: { id: string; code: string; client: string; value: number; validUntil: Date }[];
    notasComErro: { id: string; code: string; client: string; value: number }[];
  };
}

export type DashboardPeriod = "today" | "week" | "month" | "30days";

export async function getDashboardData(period: DashboardPeriod = "month"): Promise<DashboardData> {
  try {
    await requireAuth();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endOfMonth = new Date();
    const startOfMonth = new Date(today);
    if (period === "week") startOfMonth.setDate(today.getDate() - today.getDay());
    else if (period === "month") startOfMonth.setDate(1);
    else if (period === "30days") startOfMonth.setDate(today.getDate() - 29);
    const periodDuration = Math.max(86_400_000, endOfMonth.getTime() - startOfMonth.getTime());
    const previousStart = new Date(startOfMonth.getTime() - periodDuration);
    const previousEnd = new Date(startOfMonth.getTime() - 1);

    // 1. Buscar Orçamentos
    const allQuotes = await prisma.quote.findMany({ include: { client: true } });
    const orcamentosAberto = allQuotes.filter(
      (q) => q.status === "ENVIADO" || q.status === "NEGOCIACAO"
    );
    const orcamentosAbertoCount = orcamentosAberto.length;
    const orcamentosAbertoTotal = orcamentosAberto.reduce((sum, q) => sum + Number(q.total), 0);

    // Calcular Taxa de Aprovação
    const approvedQuotes = allQuotes.filter((q) => q.status === "APROVADO" || q.status === "CONVERTIDO").length;
    const rejectedQuotes = allQuotes.filter((q) => q.status === "REPROVADO" || q.status === "PERDIDO").length;
    const totalFinishedQuotes = approvedQuotes + rejectedQuotes;
    const taxaAprovacao = totalFinishedQuotes > 0 ? (approvedQuotes / totalFinishedQuotes) * 100 : 0;

    // 2. Buscar OS
    const allOS = await prisma.serviceOrder.findMany({
      include: {
        client: true,
        items: true,
        materials: true,
        completionReport: true,
      },
    });
    const osAndamento = allOS.filter(
      (os) => ["AGENDADA", "DESLOCAMENTO", "EXECUCAO", "PAUSADA", "AGUARDANDO_PECA", "AGUARDANDO_CLIENTE", "RETORNO"].includes(os.status)
    );
    const osAndamentoCount = osAndamento.length;

    // OS Atrasadas
    const osAtrasadas = allOS.filter((os) => {
      if (!os.scheduledDate) return false;
      const sched = new Date(os.scheduledDate);
      sched.setHours(0, 0, 0, 0);
      const isPendingStatus = !["CONCLUIDA", "FATURAMENTO", "FATURADA", "CANCELADA"].includes(os.status);
      return sched.getTime() < today.getTime() && isPendingStatus;
    });
    const osAtrasadasCount = osAtrasadas.length;

    // OS Aguardando Faturamento
    const osAguardandoFaturamento = allOS.filter(
      (os) => os.status === "RELATORIO_ENVIADO" || os.status === "FATURAMENTO"
    );
    const osAguardandoFaturamentoCount = osAguardandoFaturamento.length;

    // Lucro Médio Real por OS
    const finishedOS = allOS.filter((os) => os.status === "FATURADA" || os.status === "CONCLUIDA");
    const totalMargin = finishedOS.reduce((sum, os) => sum + os.marginReal, 0);
    const lucroMedioPorOS = finishedOS.length > 0 ? totalMargin / finishedOS.length : 0;

    // 3. Buscar Contas a Receber
    const allReceivables = await prisma.accountsReceivable.findMany({
      include: {
        client: true,
      },
    });
    const contasVencidas = allReceivables.filter(
      (r) => r.status !== "PAGO" && r.status !== "CANCELADA" && new Date(r.dueDate).getTime() < today.getTime()
    );
    const contasVencidasCount = contasVencidas.length;
    const contasVencidasTotal = contasVencidas.reduce((sum, r) => sum + Number(r.pendingValue), 0);
    const receberAbertoCount = allReceivables.filter((r) => r.status !== "PAGO" && r.status !== "CANCELADA").length;

    // Valor a receber com vencimento hoje
    const receberHojeTotal = allReceivables
      .filter((r) => {
        if (r.status === "PAGO" || r.status === "CANCELADA") return false;
        const d = new Date(r.dueDate);
        d.setHours(0, 0, 0, 0);
        return d.getTime() === today.getTime();
      })
      .reduce((sum, r) => sum + Number(r.pendingValue), 0);

    // Receita do mês
    const receitaMes = allReceivables
      .filter((r) => {
        if (!r.paymentDate) return false;
        const pDate = new Date(r.paymentDate);
        return pDate >= startOfMonth && pDate <= endOfMonth && r.status === "PAGO";
      })
      .reduce((sum, r) => sum + Number(r.receivedValue), 0);

    // 4. Buscar Contas a Pagar
    const allPayables = await prisma.accountsPayable.findMany();
    const contasPagar = allPayables.filter((p) => p.status !== "PAGO" && p.status !== "CANCELADO" && p.status !== "CANCELADA");
    const contasPagarTotal = contasPagar.reduce((sum, p) => sum + Number(p.value), 0);

    // Contas pagas hoje
    const pagosHojeCount = allPayables.filter((p) => {
      if (p.status !== "PAGO" || !p.paymentDate) return false;
      const d = new Date(p.paymentDate);
      d.setHours(0, 0, 0, 0);
      return d.getTime() === today.getTime();
    }).length;

    const despesaMes = allPayables
      .filter((p) => {
        if (!p.paymentDate) return false;
        const pDate = new Date(p.paymentDate);
        return pDate >= startOfMonth && pDate <= endOfMonth && p.status === "PAGO";
      })
      .reduce((sum, p) => sum + Number(p.value), 0);

    const receitaAnterior = allReceivables
      .filter((r) => r.paymentDate && new Date(r.paymentDate) >= previousStart && new Date(r.paymentDate) <= previousEnd && r.status === "PAGO")
      .reduce((sum, r) => sum + Number(r.receivedValue), 0);
    const despesaAnterior = allPayables
      .filter((p) => p.paymentDate && new Date(p.paymentDate) >= previousStart && new Date(p.paymentDate) <= previousEnd && p.status === "PAGO")
      .reduce((sum, p) => sum + Number(p.value), 0);
    const percentChange = (current: number, previous: number) => previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0;

    // Saldo Previsto
    const receivablesMonth = allReceivables
      .filter((r) => {
        const dDate = new Date(r.dueDate);
        return dDate >= startOfMonth && dDate <= endOfMonth && r.status !== "CANCELADO" && r.status !== "PAGO";
      })
      .reduce((sum, r) => sum + Number(r.pendingValue), 0);

    const payablesMonth = allPayables
      .filter((p) => {
        const dDate = new Date(p.dueDate);
        return dDate >= startOfMonth && dDate <= endOfMonth && p.status !== "CANCELADO" && p.status !== "PAGO";
      })
      .reduce((sum, p) => sum + Number(p.value), 0);

    const bankAccounts = await prisma.bankAccount.findMany({ select: { balance: true } });
    const saldoCaixa = bankAccounts.reduce((sum, account) => sum + Number(account.balance), 0);
    const saldoPrevisto = saldoCaixa + receivablesMonth - payablesMonth;

    // 5. Notas Fiscais (NFS-e) e Faturamento
    const allInvoices = await prisma.invoice.findMany({
      include: {
        serviceOrder: {
          include: {
            client: true,
          },
        },
      },
    });
    const nfseAEmitirCount = allOS.filter((os) => os.status === "FATURAMENTO").length;
    const notasRejeitadas = allInvoices.filter((i) => i.status === "REJEITADA");
    const faturamentoPendenteCount = osAguardandoFaturamentoCount;

    // 6. Montar Ações Urgentes de Hoje
    const acoesUrgentes: UrgentAction[] = [];

    // NFS-e a Emitir
    allOS
      .filter((os) => os.status === "FATURAMENTO")
      .slice(0, 2)
      .forEach((os) => {
        acoesUrgentes.push({
          id: `nfse-emit-${os.id}`,
          title: `Registrar NFS-e da ${os.code}`,
          description: `Relatório aprovado e faturamento liberado para ${os.client.name}.`,
          buttonLabel: "Registrar nota",
          link: `/faturamento?id=${os.id}`,
          color: "violet",
        });
      });

    // Relatórios aprovados que ainda precisam ser liberados ao fiscal
    allOS
      .filter((os) => os.status === "RELATORIO_ENVIADO")
      .slice(0, 2)
      .forEach((os) => {
        acoesUrgentes.push({
          id: `os-bill-${os.id}`,
          title: `Liberar ${os.code} para faturamento`,
          description: `Relatório aprovado. Falta encaminhar a OS de ${os.client.name} para o controle fiscal.`,
          buttonLabel: "Abrir OS",
          link: `/ordens-servico?id=${os.id}`,
          color: "emerald",
        });
      });

    // Parcelas Vencidas para Cobrança
    contasVencidas.slice(0, 2).forEach((c) => {
      acoesUrgentes.push({
        id: `collect-late-${c.id}`,
        title: `Cobrar fatura vencida de R$ ${c.pendingValue.toFixed(2)}`,
        description: `Parcela vencida em ${new Date(c.dueDate).toLocaleDateString("pt-BR")} do cliente ${c.client.name}.`,
        buttonLabel: "Abrir cobrança",
        link: `/financeiro?tab=receber`,
        color: "rose",
      });
    });

    // OSs Criadas precisando de Agendamento
    allOS
      .filter((os) => os.status === "CRIADA" || os.status === "AGUARDANDO_AGENDAMENTO")
      .slice(0, 2)
      .forEach((os) => {
        acoesUrgentes.push({
          id: `schedule-os-${os.id}`,
          title: `Agendar e alocar equipe na OS #${os.code}`,
          description: `Orçamento de ${os.client.name} aprovado. OS aguardando técnico e agendamento.`,
          buttonLabel: "Agendar",
          link: `/ordens-servico?id=${os.id}`,
          color: "blue",
        });
      });

    // 7. Alertas (Estoque Baixo, Contas Vencidas, Margem Crítica, Notas Rejeitadas)
    const alertas: DashboardData["alertas"] = [];

    // Produtos abaixo do estoque mínimo
    const lowStockProducts = await prisma.product.findMany({
      where: {
        stockQuantity: {
          lte: prisma.product.fields.minStock,
        },
      },
    });
    lowStockProducts.forEach((p) => {
      alertas.push({
        id: `stock-${p.id}`,
        title: "Estoque Mínimo Atingido",
        message: `O produto '${p.name}' possui apenas ${p.stockQuantity} ${p.unit} em estoque (Mínimo: ${p.minStock}).`,
        type: "ESTOQUE",
        link: "/estoque",
      });
    });

    // Notas Rejeitadas
    allInvoices
      .filter((i) => i.status === "REJEITADA")
      .forEach((i) => {
        alertas.push({
          id: `invoice-rejected-${i.id}`,
          title: "Nota Fiscal Rejeitada",
          message: `NFS-e do cliente ${i.serviceOrder?.client?.name || "Cliente"} foi rejeitada pelo provedor municipal.`,
          type: "FISCAL",
          link: "/faturamento?tab=rejeitadas",
        });
      });

    // OSs com Margem Crítica (Abaixo de 18% da OS)
    allOS
      .filter((os) => (os.status === "CONCLUIDA" || os.status === "FATURADA") && os.marginReal > 0)
      .forEach((os) => {
        const totalItemsValue = os.items.reduce((sum, item) => sum + Number(item.total), 0);
        const usedMaterials = os.materials.filter((m) => m.status === "UTILIZADO");
        const totalMaterialsSale = usedMaterials.reduce((sum, m) => sum + m.usedQuantity * Number(m.salePrice), 0);
        const totalOSRevenue = totalItemsValue + totalMaterialsSale;

        const targetMarginPercent = 18;
        // Se a margem real representa menos do que 18% do valor cobrado
        if (totalOSRevenue > 0 && (os.marginReal / totalOSRevenue) * 100 < targetMarginPercent) {
          alertas.push({
            id: `margin-${os.id}`,
            title: "Margem Crítica Detectada",
            message: `A OS #${os.code} registrou uma margem real de R$ ${os.marginReal.toFixed(2)} (${((os.marginReal / totalOSRevenue) * 100).toFixed(1)}%), abaixo da meta de 18%.`,
            type: "FINANCEIRO",
            link: `/ordens-servico?id=${os.id}`,
          });
        }
      });

    // Contas vencidas adicionais no alerta
    contasVencidas.slice(0, 2).forEach((c) => {
      alertas.push({
        id: `receivable-late-${c.id}`,
        title: "Fatura Vencida",
        message: `Fatura pendente no valor de R$ ${c.pendingValue.toFixed(2)} vencida em ${new Date(
          c.dueDate
        ).toLocaleDateString("pt-BR")}.`,
        type: "FINANCEIRO",
        link: "/financeiro?tab=receber",
      });
    });

    // Contratos vencendo nos próximos 30 dias
    const in30Days = new Date(today);
    in30Days.setDate(today.getDate() + 30);
    const expiringContracts = await prisma.contract.findMany({
      where: {
        status: "ATIVO",
        endDate: { gte: today, lte: in30Days },
      },
      include: { client: true },
    });
    expiringContracts.slice(0, 2).forEach((c) => {
      alertas.push({
        id: `contract-expiring-${c.id}`,
        title: "Contrato Vencendo em Breve",
        message: `O contrato ${c.code} do cliente ${c.client.name} vence em ${new Date(c.endDate).toLocaleDateString("pt-BR")}.`,
        type: "CONTRATOS",
        link: "/contratos",
      });
    });

    const leads = await prisma.lead.findMany();
    const leadsNovosCount = leads.filter((lead) => lead.status === "NOVO" && lead.createdAt >= startOfMonth).length;
    const leadsNegociacaoCount = leads.filter((lead) => lead.status === "EM_ANDAMENTO").length;
    const osConcluidasCount = allOS.filter((os) => os.completedAt && os.completedAt >= startOfMonth && os.completedAt <= endOfMonth).length;
    const osAbertasCount = allOS.filter((os) => !["CONCLUIDA", "FATURADA", "CANCELADA"].includes(os.status)).length;
    const relatoriosPendentesCount = allOS.filter((os) => ["CONCLUIDA", "REVISAO"].includes(os.status) && !os.completionReport?.approvedByClient).length;
    const receberAbertoTotal = allReceivables
      .filter((r) => r.status !== "PAGO" && r.status !== "CANCELADO" && r.status !== "CANCELADA")
      .reduce((sum, r) => sum + Number(r.pendingValue), 0);
    const totalReceberBase = allReceivables.reduce((sum, r) => sum + Number(r.totalValue), 0);
    const inadimplencia = totalReceberBase > 0 ? (contasVencidasTotal / totalReceberBase) * 100 : 0;

    // OS Atrasadas adicionais no alerta
    osAtrasadas.slice(0, 2).forEach((os) => {
      alertas.push({
        id: `os-late-${os.id}`,
        title: "OS Atrasada",
        message: `A OS #${os.code} estava agendada para ${
          os.scheduledDate ? new Date(os.scheduledDate).toLocaleDateString("pt-BR") : ""
        } e ainda está pendente.`,
        type: "OPERACIONAL",
        link: "/ordens-servico",
      });
    });

    // 8. Fluxo de Caixa (Últimos 7 dias)
    const transactions = await prisma.financialTransaction.findMany({
      orderBy: { date: "asc" },
    });

    const last7Days: CashFlowPoint[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dStr = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

      const dayTransactions = transactions.filter((t) => {
        const tDate = new Date(t.date);
        return (
          tDate.getDate() === d.getDate() &&
          tDate.getMonth() === d.getMonth() &&
          tDate.getFullYear() === d.getFullYear()
        );
      });

      const receitas = dayTransactions
        .filter((t) => t.type === "RECEITA")
        .reduce((sum, t) => sum + Number(t.value), 0);

      const despesas = dayTransactions
        .filter((t) => t.type === "DESPESA")
        .reduce((sum, t) => sum + Number(t.value), 0);

      last7Days.push({
        date: dStr,
        receitas,
        despesas,
      });
    }

    return {
      cards: {
        orcamentosAbertoCount,
        orcamentosAbertoTotal,
        orcamentosAprovadosCount: approvedQuotes,
        taxaAprovacao,
        osAndamentoCount,
        osAtrasadasCount,
        osAguardandoFaturamentoCount,
        contasVencidasCount,
        contasVencidasTotal,
        lucroMedioPorOS,
        faturamentoPendenteCount,
        nfseAEmitirCount,
        receberAbertoCount,
        receberHojeTotal,
        pagosHojeCount,
        contasPagarCount: contasPagar.length,
        contasPagarTotal,
        notasRejeitadasCount: notasRejeitadas.length,
        relatoriosPendentesCount,
        estoqueCriticoCount: lowStockProducts.length,
        contratosVencendoCount: expiringContracts.length,
        osAbertasCount,
        osConcluidasCount,
        leadsNovosCount,
        leadsNegociacaoCount,
        orcamentosRecusadosCount: rejectedQuotes,
      },
      financeiro: {
        receitaMes,
        despesaMes,
        saldoPrevisto,
        saldoCaixa,
        lucroEstimado: receitaMes - despesaMes,
        receberAbertoTotal,
        pagarAbertoTotal: contasPagarTotal,
        inadimplencia,
        variacaoReceita: percentChange(receitaMes, receitaAnterior),
        variacaoDespesa: percentChange(despesaMes, despesaAnterior),
      },
      acoesUrgentes,
      alertas,
      fluxoCaixa: last7Days,
      tabelas: {
        ultimasOS: [...allOS].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 6).map((os) => ({ id: os.id, code: os.code, client: os.client.name, status: os.status, date: os.createdAt })),
        contasVencidas: contasVencidas.slice(0, 6).map((item) => ({ id: item.id, client: item.client.name, value: Number(item.pendingValue), dueDate: item.dueDate })),
        orcamentosNegociacao: orcamentosAberto.slice(0, 6).map((quote) => ({ id: quote.id, code: quote.code, client: quote.client.name, value: Number(quote.total), validUntil: quote.validUntil })),
        notasComErro: notasRejeitadas.slice(0, 6).map((invoice) => ({ id: invoice.id, code: invoice.code, client: invoice.serviceOrder?.client?.name || "—", value: invoice.value })),
      },
    };
  } catch (error) {
    logger.error("Erro no getDashboardData:", error);
    return {
      cards: {
        orcamentosAbertoCount: 0,
        orcamentosAbertoTotal: 0,
        orcamentosAprovadosCount: 0,
        taxaAprovacao: 0,
        osAndamentoCount: 0,
        osAtrasadasCount: 0,
        osAguardandoFaturamentoCount: 0,
        contasVencidasCount: 0,
        contasVencidasTotal: 0,
        lucroMedioPorOS: 0,
        faturamentoPendenteCount: 0,
        nfseAEmitirCount: 0,
        receberAbertoCount: 0,
        receberHojeTotal: 0,
        pagosHojeCount: 0,
        contasPagarCount: 0,
        contasPagarTotal: 0,
        notasRejeitadasCount: 0,
        relatoriosPendentesCount: 0,
        estoqueCriticoCount: 0,
        contratosVencendoCount: 0,
        osAbertasCount: 0,
        osConcluidasCount: 0,
        leadsNovosCount: 0,
        leadsNegociacaoCount: 0,
        orcamentosRecusadosCount: 0,
      },
      financeiro: {
        receitaMes: 0,
        despesaMes: 0,
        saldoPrevisto: 0,
        saldoCaixa: 0,
        lucroEstimado: 0,
        receberAbertoTotal: 0,
        pagarAbertoTotal: 0,
        inadimplencia: 0,
        variacaoReceita: 0,
        variacaoDespesa: 0,
      },
      acoesUrgentes: [],
      alertas: [],
      fluxoCaixa: [],
      tabelas: { ultimasOS: [], contasVencidas: [], orcamentosNegociacao: [], notasComErro: [] },
    };
  }
}
