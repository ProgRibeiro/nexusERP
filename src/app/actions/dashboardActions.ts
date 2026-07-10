"use server";

import { prisma } from "@/lib/db";

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
  };
  financeiro: {
    receitaMes: number;
    despesaMes: number;
    saldoPrevisto: number;
  };
  acoesUrgentes: UrgentAction[];
  alertas: {
    id: string;
    title: string;
    message: string;
    type: "ESTOQUE" | "FINANCEIRO" | "OPERACIONAL" | "COMERCIAL" | "FISCAL";
    link?: string;
  }[];
  fluxoCaixa: CashFlowPoint[];
}

export async function getDashboardData(): Promise<DashboardData> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

    // 1. Buscar Orçamentos
    const allQuotes = await prisma.quote.findMany();
    const orcamentosAberto = allQuotes.filter(
      (q) => q.status === "ENVIADO" || q.status === "NEGOCIACAO"
    );
    const orcamentosAbertoCount = orcamentosAberto.length;
    const orcamentosAbertoTotal = orcamentosAberto.reduce((sum, q) => sum + q.total, 0);

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
      },
    });
    const osAndamento = allOS.filter(
      (os) => os.status === "AGENDADA" || os.status === "DESLOCAMENTO" || os.status === "EXECUCAO"
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
      (os) => os.status === "CONCLUIDA" || os.status === "FATURAMENTO"
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
    const contasVencidasTotal = contasVencidas.reduce((sum, r) => sum + r.pendingValue, 0);
    const receberAbertoCount = allReceivables.filter((r) => r.status !== "PAGO" && r.status !== "CANCELADA").length;

    // Receita do mês
    const receitaMes = allReceivables
      .filter((r) => {
        if (!r.paymentDate) return false;
        const pDate = new Date(r.paymentDate);
        return pDate >= startOfMonth && pDate <= endOfMonth && r.status === "PAGO";
      })
      .reduce((sum, r) => sum + r.receivedValue, 0);

    // 4. Buscar Contas a Pagar
    const allPayables = await prisma.accountsPayable.findMany();
    const despesaMes = allPayables
      .filter((p) => {
        if (!p.paymentDate) return false;
        const pDate = new Date(p.paymentDate);
        return pDate >= startOfMonth && pDate <= endOfMonth && p.status === "PAGO";
      })
      .reduce((sum, p) => sum + p.value, 0);

    // Saldo Previsto
    const receivablesMonth = allReceivables
      .filter((r) => {
        const dDate = new Date(r.dueDate);
        return dDate >= startOfMonth && dDate <= endOfMonth && r.status !== "CANCELADO" && r.status !== "PAGO";
      })
      .reduce((sum, r) => sum + r.pendingValue, 0);

    const payablesMonth = allPayables
      .filter((p) => {
        const dDate = new Date(p.dueDate);
        return dDate >= startOfMonth && dDate <= endOfMonth && p.status !== "CANCELADO" && p.status !== "PAGO";
      })
      .reduce((sum, p) => sum + p.value, 0);

    const saldoPrevisto = 14850.0 + receitaMes - despesaMes + receivablesMonth - payablesMonth;

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
    const nfseAEmitirCount = allInvoices.filter((i) => i.status === "PENDENTE" || i.status === "RASCUNHO").length;
    const faturamentoPendenteCount = osAguardandoFaturamentoCount;

    // 6. Montar Ações Urgentes de Hoje
    const acoesUrgentes: UrgentAction[] = [];

    // NFS-e a Emitir
    allInvoices
      .filter((i) => i.status === "PENDENTE")
      .slice(0, 2)
      .forEach((invoice) => {
        acoesUrgentes.push({
          id: `nfse-emit-${invoice.id}`,
          title: `Emitir NFS-e da OS #${invoice.serviceOrder.code}`,
          description: `Faturamento conferido para o cliente ${invoice.serviceOrder.client.name}.`,
          buttonLabel: "Emitir agora",
          link: `/faturamento?id=${invoice.id}`,
          color: "violet",
        });
      });

    // OS Concluídas a Faturar
    allOS
      .filter((os) => os.status === "CONCLUIDA")
      .slice(0, 2)
      .forEach((os) => {
        acoesUrgentes.push({
          id: `os-bill-${os.id}`,
          title: `Faturar OS #${os.code} concluída`,
          description: `Serviço finalizado pelo técnico. Pronto para faturar para ${os.client.name}.`,
          buttonLabel: "Faturar",
          link: `/faturamento?id=${os.id}`,
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
      .filter((os) => os.status === "CRIADA")
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
          message: `NFS-e do cliente ${i.serviceOrder.client.name} foi rejeitada pelo provedor municipal.`,
          type: "FISCAL",
          link: "/faturamento?tab=rejeitadas",
        });
      });

    // OSs com Margem Crítica (Abaixo de 18% da OS)
    allOS
      .filter((os) => (os.status === "CONCLUIDA" || os.status === "FATURADA") && os.marginReal > 0)
      .forEach((os) => {
        const totalItemsValue = os.items.reduce((sum, item) => sum + item.total, 0);
        const usedMaterials = os.materials.filter((m) => m.status === "UTILIZADO");
        const totalMaterialsSale = usedMaterials.reduce((sum, m) => sum + m.usedQuantity * m.salePrice, 0);
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
        .reduce((sum, t) => sum + t.value, 0);

      const despesas = dayTransactions
        .filter((t) => t.type === "DESPESA")
        .reduce((sum, t) => sum + t.value, 0);

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
      },
      financeiro: {
        receitaMes,
        despesaMes,
        saldoPrevisto,
      },
      acoesUrgentes,
      alertas,
      fluxoCaixa: last7Days,
    };
  } catch (error) {
    console.error("Erro no getDashboardData:", error);
    return {
      cards: {
        orcamentosAbertoCount: 0,
        orcamentosAbertoTotal: 0,
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
      },
      financeiro: {
        receitaMes: 0,
        despesaMes: 0,
        saldoPrevisto: 0,
      },
      acoesUrgentes: [],
      alertas: [],
      fluxoCaixa: [],
    };
  }
}
