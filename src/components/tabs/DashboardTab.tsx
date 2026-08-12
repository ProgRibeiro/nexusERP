"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import {
  DashboardData,
  DashboardPeriod,
  getDashboardData,
} from "@/app/actions/dashboardActions";
import {
  getDashboardMetrics,
  SLAAndMTBFMetrics,
} from "@/app/actions/dashboardMetrics";
import { formatCurrency, formatDate } from "@/lib/utils";
import { parseAppLink } from "@/lib/searchNavigation";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  FileText,
  Filter,
  HandCoins,
  Loader2,
  Package,
  Receipt,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  WalletCards,
  Wrench,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { StatusBadge } from "../ui/StatusBadge";

const panel =
  "brand-surface rounded-[18px] border border-slate-200/80 bg-white/95 shadow-[0_12px_35px_rgba(15,23,42,.055)] ring-1 ring-white/70 dark:bg-zinc-900/95 dark:ring-white/[.03]";

type IconType = React.ComponentType<{ size?: number; className?: string }>;

interface KpiCardProps {
  title: string;
  value: string;
  helper: string;
  action: string;
  icon: IconType;
  tone: "blue" | "green" | "orange" | "red" | "slate";
  variation?: number;
  onClick: () => void;
}

const tones = {
  blue: "bg-[#f6edcf] text-[#8a6511] dark:bg-[#d4af37]/12 dark:text-[#e3bf58] dark:ring-1 dark:ring-[#d4af37]/15",
  green:
    "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/35 dark:text-emerald-400",
  orange:
    "bg-orange-50 text-orange-600 dark:bg-orange-950/35 dark:text-orange-400",
  red: "bg-red-50 text-red-600 dark:bg-red-950/35 dark:text-red-400",
  slate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

function KpiCard({
  title,
  value,
  helper,
  action,
  icon: Icon,
  tone,
  variation,
  onClick,
}: KpiCardProps) {
  return (
    <button
      onClick={onClick}
      className={`${panel} group relative min-h-40 overflow-hidden p-4 text-left transition-all duration-300 hover:-translate-y-1 hover:border-[#d4af37]/55 hover:shadow-[0_20px_45px_rgba(212,175,55,.12)] dark:hover:border-[#d4af37]/45`}
    >
      <span className="pointer-events-none absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-[#d4af37] transition-transform duration-300 group-hover:scale-x-100" />
      <div className="flex items-start justify-between gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}
        >
          <Icon size={19} />
        </div>
        {variation !== undefined && (
          <span
            className={`flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${variation >= 0 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400"}`}
          >
            {variation >= 0 ? (
              <TrendingUp size={11} />
            ) : (
              <TrendingDown size={11} />
            )}
            {Math.abs(variation).toFixed(0)}%
          </span>
        )}
      </div>
      <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
        {title}
      </p>
      <p className="mt-1 truncate text-2xl font-black tracking-tight text-zinc-950 dark:text-white">
        {value}
      </p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="truncate text-[10px] text-zinc-500">{helper}</span>
        <span className="flex shrink-0 items-center gap-1 text-[10px] font-bold text-[#9b7416] dark:text-[#e2bd52]">
          {action}
          <ChevronRight size={12} />
        </span>
      </div>
    </button>
  );
}

export default function DashboardTab() {
  const { user } = useAuth();
  const { openTab } = useWorkspace();
  const [data, setData] = useState<DashboardData | null>(null);
  const [metrics, setMetrics] = useState<SLAAndMTBFMetrics | null>(null);
  const [period, setPeriod] = useState<DashboardPeriod>("month");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [clientFilter, setClientFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const loadData = async (soft = false) => {
    soft ? setRefreshing(true) : setLoading(true);
    try {
      const [dashboard, operational] = await Promise.all([
        getDashboardData(period),
        getDashboardMetrics(),
      ]);
      setData(dashboard);
      setMetrics(operational);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [period, user?.id]);

  const navigate = (link: string, title: string) => {
    const { tabType, params } = parseAppLink(link);
    openTab(tabType, title, params);
  };

  const filteredOS = useMemo(() => {
    if (!data) return [];
    const term = clientFilter.trim().toLowerCase();
    return data.tabelas.ultimasOS.filter(
      (item) =>
        (!term ||
          item.client.toLowerCase().includes(term) ||
          item.code.toLowerCase().includes(term)) &&
        (!statusFilter || item.status === statusFilter),
    );
  }, [data, clientFilter, statusFilter]);

  if (loading || !data) {
    return (
      <div className="flex h-[65vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#d4af37]" />
        <p className="text-xs font-semibold text-zinc-500">
          Preparando sua Central de Comando...
        </p>
      </div>
    );
  }

  const c = data.cards;
  const f = data.financeiro;
  const periodLabels: Record<DashboardPeriod, string> = {
    today: "Hoje",
    week: "Esta semana",
    month: "Este mês",
    "30days": "Últimos 30 dias",
  };

  const kpis: KpiCardProps[] = [
    {
      title: "Receita",
      value: formatCurrency(f.receitaMes),
      helper: periodLabels[period],
      action: "Ver financeiro",
      icon: CircleDollarSign,
      tone: "green",
      variation: f.variacaoReceita,
      onClick: () => navigate("/financeiro?tab=extrato", "Receitas"),
    },
    {
      title: "Despesas",
      value: formatCurrency(f.despesaMes),
      helper: periodLabels[period],
      action: "Ver despesas",
      icon: WalletCards,
      tone: "red",
      variation: f.variacaoDespesa,
      onClick: () => navigate("/financeiro?tab=pagar", "Despesas"),
    },
    {
      title: "Lucro estimado",
      value: formatCurrency(f.lucroEstimado),
      helper: "Receitas menos despesas",
      action: "Analisar",
      icon: TrendingUp,
      tone: f.lucroEstimado >= 0 ? "green" : "red",
      onClick: () => navigate("/financeiro", "Resultado"),
    },
    {
      title: "Contas a receber",
      value: formatCurrency(f.receberAbertoTotal),
      helper: `${c.receberAbertoCount} parcela(s) aberta(s)`,
      action: "Receber",
      icon: HandCoins,
      tone: "blue",
      onClick: () => navigate("/financeiro?tab=receber", "Contas a receber"),
    },
    {
      title: "Contas a pagar",
      value: formatCurrency(f.pagarAbertoTotal),
      helper: `${c.contasPagarCount} compromisso(s)`,
      action: "Pagar",
      icon: Banknote,
      tone: "orange",
      onClick: () => navigate("/financeiro?tab=pagar", "Contas a pagar"),
    },
    {
      title: "Contas vencidas",
      value: formatCurrency(c.contasVencidasTotal),
      helper: `${c.contasVencidasCount} cobrança(s) atrasada(s)`,
      action: "Cobrar",
      icon: ShieldAlert,
      tone: "red",
      onClick: () => navigate("/financeiro?tab=receber", "Cobranças"),
    },
    {
      title: "OS em andamento",
      value: String(c.osAndamentoCount),
      helper: `${c.osAbertasCount} OS abertas`,
      action: "Acompanhar",
      icon: Wrench,
      tone: "blue",
      onClick: () => navigate("/ordens-servico", "Ordens de Serviço"),
    },
    {
      title: "OS atrasadas",
      value: String(c.osAtrasadasCount),
      helper: c.osAtrasadasCount ? "Exigem ação imediata" : "Operação no prazo",
      action: "Resolver",
      icon: Clock3,
      tone: c.osAtrasadasCount ? "red" : "green",
      onClick: () =>
        navigate("/ordens-servico?status=ATRASADA", "OS atrasadas"),
    },
    {
      title: "Orçamentos pendentes",
      value: String(c.orcamentosAbertoCount),
      helper: formatCurrency(c.orcamentosAbertoTotal),
      action: "Negociar",
      icon: FileText,
      tone: "orange",
      onClick: () => navigate("/orcamentos", "Orçamentos"),
    },
    {
      title: "Aguardando faturamento",
      value: String(c.osAguardandoFaturamentoCount),
      helper: `${c.nfseAEmitirCount} nota(s) a emitir`,
      action: "Faturar",
      icon: Receipt,
      tone: "orange",
      onClick: () => navigate("/faturamento", "Faturamento"),
    },
  ];

  const pendencias = [
    {
      label: "OS atrasadas",
      value: c.osAtrasadasCount,
      action: "Ver OS",
      link: "/ordens-servico?status=ATRASADA",
      icon: Clock3,
      danger: true,
    },
    {
      label: "Relatórios pendentes",
      value: c.relatoriosPendentesCount,
      action: "Revisar",
      link: "/relatorios",
      icon: FileCheck2,
    },
    {
      label: "Aguardando faturamento",
      value: c.osAguardandoFaturamentoCount,
      action: "Faturar",
      link: "/faturamento",
      icon: Receipt,
    },
    {
      label: "Notas a emitir",
      value: c.nfseAEmitirCount,
      action: "Emitir",
      link: "/faturamento",
      icon: FileText,
    },
    {
      label: "Notas rejeitadas",
      value: c.notasRejeitadasCount,
      action: "Corrigir",
      link: "/faturamento?tab=rejeitadas",
      icon: AlertTriangle,
      danger: true,
    },
    {
      label: "Contas vencidas",
      value: c.contasVencidasCount,
      action: "Cobrar",
      link: "/financeiro?tab=receber",
      icon: HandCoins,
      danger: true,
    },
    {
      label: "Estoque crítico",
      value: c.estoqueCriticoCount,
      action: "Comprar",
      link: "/estoque",
      icon: Package,
    },
    {
      label: "Contratos vencendo",
      value: c.contratosVencendoCount,
      action: "Renovar",
      link: "/contratos",
      icon: CalendarDays,
    },
  ];

  const flow = [
    {
      name: "Orçamentos",
      value: c.orcamentosAbertoCount,
      sub: "em negociação",
      link: "/orcamentos",
    },
    {
      name: "OS",
      value: c.osAndamentoCount,
      sub: "em execução",
      link: "/ordens-servico",
    },
    {
      name: "Relatórios",
      value: c.relatoriosPendentesCount,
      sub: "pendentes",
      link: "/relatorios",
    },
    {
      name: "Faturamento",
      value: c.osAguardandoFaturamentoCount,
      sub: "aguardando",
      link: "/faturamento",
    },
    {
      name: "NFS-e",
      value: c.nfseAEmitirCount,
      sub: "a emitir",
      link: "/faturamento",
    },
    {
      name: "Pagamento",
      value: c.receberAbertoCount,
      sub: "em aberto",
      link: "/financeiro?tab=receber",
    },
    {
      name: "Financeiro",
      value: c.pagosHojeCount,
      sub: "pagos hoje",
      link: "/financeiro",
    },
  ];

  return (
    <div className="space-y-6 pb-10 text-zinc-900 dark:text-zinc-100">
      <section className="relative overflow-hidden rounded-[22px] border border-[#d4af37]/25 bg-[#090a0c] shadow-[0_28px_70px_rgba(0,0,0,.38)]">
        <Image
          src="/brand/nx-operations-hero.webp"
          alt="Visão integrada da operação predial"
          fill
          priority
          unoptimized
          sizes="(min-width: 1280px) 1280px, 100vw"
          className="object-cover object-[68%_center] opacity-60 grayscale"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,7,9,.98)_0%,rgba(9,10,12,.88)_48%,rgba(9,10,12,.38)_100%)]" />
        <div className="absolute -bottom-28 -right-20 h-80 w-80 rounded-full border-[2px] border-[#d4af37]/55" />
        <div className="absolute -bottom-36 -right-12 h-80 w-80 rounded-full border border-[#f0cd62]/20" />
        <div className="relative p-5 text-white md:p-8 lg:p-9">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#d4af37]/30 bg-[#d4af37]/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-[#f0d477] backdrop-blur">
                <Sparkles size={13} /> Central de Comando Operacional
              </div>
              <h2 className="text-3xl font-black tracking-[-0.045em] md:text-4xl">
                Bom trabalho, {user?.name?.split(" ")[0]}.
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-300/80">
                Veja o que exige atenção agora e avance cada etapa da operação
                sem procurar informação em várias telas.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 rounded-2xl border border-[#d4af37]/20 bg-black/35 p-2 backdrop-blur-md">
              {(Object.keys(periodLabels) as DashboardPeriod[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setPeriod(key)}
                  className={`rounded-xl px-3 py-2 text-[11px] font-bold transition ${period === key ? "bg-[#d4af37] text-[#111216] shadow-lg" : "text-zinc-300 hover:bg-white/10 hover:text-white"}`}
                >
                  {periodLabels[key]}
                </button>
              ))}
              <button
                onClick={() => setShowFilters((v) => !v)}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-bold text-zinc-300 hover:bg-white/10 hover:text-white"
              >
                <Filter size={14} /> Filtros
              </button>
              <button
                onClick={() => void loadData(true)}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-zinc-300 hover:bg-white/10 hover:text-white"
                title="Atualizar"
              >
                <RefreshCw
                  size={15}
                  className={refreshing ? "animate-spin" : ""}
                />
              </button>
            </div>
          </div>
        </div>
        {showFilters && (
          <div className="relative grid grid-cols-1 gap-4 border-t border-white/10 bg-white/95 p-4 sm:grid-cols-2 lg:grid-cols-4 dark:bg-zinc-900/95">
            <Input
              label="Cliente ou registro"
              placeholder="Filtrar tabelas rápidas"
              icon={<Search size={14} />}
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
            />
            <Select
              label="Status da OS"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: "", label: "Todos os status" },
                { value: "CRIADA", label: "Criada" },
                { value: "AGENDADA", label: "Agendada" },
                { value: "EXECUCAO", label: "Em execução" },
                { value: "CONCLUIDA", label: "Concluída" },
                { value: "FATURADA", label: "Faturada" },
              ]}
            />
            <Select
              label="Empresa / filial"
              value="matriz"
              onChange={() => {}}
              options={[{ value: "matriz", label: "NX Climatização · Matriz" }]}
            />
            <div className="flex items-end">
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => {
                  setClientFilter("");
                  setStatusFilter("");
                }}
              >
                Limpar filtros
              </Button>
            </div>
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h3 className="text-base font-black">Visão executiva</h3>
            <p className="text-xs text-zinc-500">
              Os dez números que definem a situação da empresa agora.
            </p>
          </div>
          <span className="hidden text-[11px] text-zinc-500 sm:block">
            Atualizado em{" "}
            {new Date().toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {kpis.map((kpi) => (
            <KpiCard key={kpi.title} {...kpi} />
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <section className={`${panel} p-5 xl:col-span-5`}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-black">Pendências de hoje</h3>
              <p className="text-xs text-zinc-500">
                Prioridades agrupadas por área.
              </p>
            </div>
            <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-black text-red-600 dark:bg-red-950/30">
              {pendencias.reduce((sum, item) => sum + item.value, 0)}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {pendencias.map((item) => (
              <button
                key={item.label}
                onClick={() => navigate(item.link, item.label)}
                className="flex items-center gap-3 rounded-xl border border-zinc-100 p-3 text-left hover:border-[#d4af37]/45 hover:bg-[#d4af37]/5 dark:border-white/[.06] dark:bg-black/10 dark:hover:border-[#d4af37]/35 dark:hover:bg-[#d4af37]/[.07]"
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${item.danger && item.value ? tones.red : tones.slate}`}
                >
                  <item.icon size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold">
                    {item.label}
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    {item.action}
                  </span>
                </span>
                <strong
                  className={item.danger && item.value ? "text-red-600" : ""}
                >
                  {item.value}
                </strong>
              </button>
            ))}
          </div>
        </section>

        <section className={`${panel} p-5 xl:col-span-7`}>
          <div className="mb-5">
            <h3 className="font-black">Fluxo principal do ERP</h3>
            <p className="text-xs text-zinc-500">
              Clique na etapa que deseja destravar.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
            {flow.map((step, index) => (
              <button
                key={step.name}
                onClick={() => navigate(step.link, step.name)}
                className="relative rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-left transition hover:border-[#d4af37]/60 hover:bg-[#d4af37]/5 dark:border-white/[.06] dark:bg-black/15 dark:hover:border-[#d4af37]/40 dark:hover:bg-[#d4af37]/[.07]"
              >
                <span className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                  {step.name}
                </span>
                <strong className="mt-2 block text-2xl font-black">
                  {step.value}
                </strong>
                <span className="text-[9px] text-zinc-500">{step.sub}</span>
                {index < flow.length - 1 && (
                  <ArrowRight
                    size={13}
                    className="absolute -right-2 top-1/2 z-10 hidden text-zinc-400 xl:block"
                  />
                )}
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <section className={`${panel} p-5 xl:col-span-7`}>
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h3 className="font-black">Próximas ações recomendadas</h3>
              <p className="text-xs text-zinc-500">
                Sugestões ordenadas pelo impacto no fluxo.
              </p>
            </div>
            <Sparkles size={18} className="text-[#d4af37]" />
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {data.acoesUrgentes.length ? (
              data.acoesUrgentes.slice(0, 6).map((action, index) => (
                <div
                  key={action.id}
                  className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center"
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black ${index < 2 ? "bg-red-50 text-red-600 dark:bg-red-950/30" : "bg-[#f6edcf] text-[#8a6511] dark:bg-[#d4af37]/12 dark:text-[#e3bf58]"}`}
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{action.title}</p>
                    <p className="mt-0.5 truncate text-xs text-zinc-500">
                      {action.description}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={index < 2 ? "primary" : "secondary"}
                    onClick={() => navigate(action.link, action.buttonLabel)}
                  >
                    {action.buttonLabel}
                    <ChevronRight size={13} />
                  </Button>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center py-12 text-center">
                <CheckCircle2 size={28} className="text-emerald-500" />
                <p className="mt-2 text-sm font-bold">Nenhuma ação urgente</p>
                <p className="text-xs text-zinc-500">O fluxo está em dia.</p>
              </div>
            )}
          </div>
        </section>

        <section className={`${panel} p-5 xl:col-span-5`}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-black">Alertas inteligentes</h3>
              <p className="text-xs text-zinc-500">
                Riscos detectados automaticamente.
              </p>
            </div>
            <AlertTriangle size={18} className="text-orange-500" />
          </div>
          <div className="max-h-[410px] space-y-2 overflow-y-auto pr-1">
            {data.alertas.length ? (
              data.alertas.slice(0, 8).map((alert) => (
                <button
                  key={alert.id}
                  onClick={() =>
                    alert.link && navigate(alert.link, alert.title)
                  }
                  className="w-full rounded-xl border border-zinc-100 bg-zinc-50 p-3 text-left hover:border-orange-200 dark:border-zinc-800 dark:bg-zinc-950/40"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${alert.type === "FINANCEIRO" || alert.type === "FISCAL" ? "bg-red-500" : alert.type === "ESTOQUE" ? "bg-orange-500" : "bg-[#d4af37]"}`}
                    />
                    <div>
                      <p className="text-xs font-bold">{alert.title}</p>
                      <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">
                        {alert.message}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <div className="py-12 text-center">
                <CheckCircle2 size={28} className="mx-auto text-emerald-500" />
                <p className="mt-2 text-xs font-bold">Nenhum alerta crítico</p>
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <section className={`${panel} p-5 xl:col-span-8`}>
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <h3 className="font-black">Receitas x despesas</h3>
              <p className="text-xs text-zinc-500">
                Movimentações liquidadas nos últimos sete dias.
              </p>
            </div>
            <div className="flex gap-4 text-xs">
              <span className="font-bold text-emerald-600">
                Receitas {formatCurrency(f.receitaMes)}
              </span>
              <span className="font-bold text-red-600">
                Despesas {formatCurrency(f.despesaMes)}
              </span>
            </div>
          </div>
          <div className="mt-5 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data.fluxoCaixa}
                margin={{ left: -20, right: 8 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e5e7eb"
                  opacity={0.45}
                />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  fontSize={10}
                />
                <YAxis tickLine={false} axisLine={false} fontSize={10} />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value))}
                  contentStyle={{
                    borderRadius: 12,
                    borderColor: "#e5e7eb",
                    fontSize: 11,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area
                  type="monotone"
                  dataKey="receitas"
                  name="Receitas"
                  stroke="#16a34a"
                  strokeWidth={2.5}
                  fill="#16a34a33"
                />
                <Area
                  type="monotone"
                  dataKey="despesas"
                  name="Despesas"
                  stroke="#dc2626"
                  strokeWidth={2.5}
                  fill="#dc262633"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className={`${panel} p-5 xl:col-span-4`}>
          <h3 className="font-black">Saúde financeira</h3>
          <p className="text-xs text-zinc-500">
            Posição e projeção do período.
          </p>
          <div className="mt-5 space-y-3">
            {[
              ["Saldo em caixa", f.saldoCaixa, "text-[#b98c20] dark:text-[#e0bb50]"],
              ["Saldo previsto", f.saldoPrevisto, "text-[#b98c20] dark:text-[#e0bb50]"],
              [
                "Lucro estimado",
                f.lucroEstimado,
                f.lucroEstimado >= 0 ? "text-emerald-600" : "text-red-600",
              ],
              ["A receber", f.receberAbertoTotal, "text-emerald-600"],
              ["A pagar", f.pagarAbertoTotal, "text-orange-600"],
            ].map(([label, value, color]) => (
              <div
                key={String(label)}
                className="flex items-center justify-between rounded-xl bg-zinc-50 p-3 dark:bg-zinc-950/40"
              >
                <span className="text-xs font-semibold text-zinc-500">
                  {label}
                </span>
                <strong className={`text-sm ${color}`}>
                  {formatCurrency(Number(value))}
                </strong>
              </div>
            ))}
            <div className="rounded-xl border border-red-100 bg-red-50 p-4 dark:border-red-950 dark:bg-red-950/20">
              <div className="flex justify-between text-xs font-bold text-red-700 dark:text-red-400">
                <span>Inadimplência</span>
                <span>{f.inadimplencia.toFixed(1)}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-red-100 dark:bg-red-950">
                <div
                  className="h-full rounded-full bg-red-500"
                  style={{ width: `${Math.min(100, f.inadimplencia)}%` }}
                />
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className={`${panel} p-5`}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-black">Indicadores operacionais</h3>
              <p className="text-xs text-zinc-500">
                Ritmo e qualidade das ordens de serviço.
              </p>
            </div>
            <Wrench size={18} className="text-[#d4af37]" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              ["OS abertas", c.osAbertasCount],
              ["Em andamento", c.osAndamentoCount],
              ["Concluídas", c.osConcluidasCount],
              ["Atrasadas", c.osAtrasadasCount],
              ["SLA cumprido", `${metrics?.slaRate ?? 0}%`],
              ["MTBF", `${metrics?.mtbfDays ?? 0} dias`],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-xl border border-zinc-100 p-3 dark:border-zinc-800"
              >
                <strong className="text-xl font-black">{value}</strong>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </section>
        <section className={`${panel} p-5`}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-black">Indicadores comerciais</h3>
              <p className="text-xs text-zinc-500">
                Pipeline, propostas e conversão.
              </p>
            </div>
            <BarChart3 size={18} className="text-[#d4af37]" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              ["Novos leads", c.leadsNovosCount],
              ["Em negociação", c.leadsNegociacaoCount],
              ["Orçamentos", c.orcamentosAbertoCount],
              ["Aprovados", c.orcamentosAprovadosCount],
              ["Recusados", c.orcamentosRecusadosCount],
              ["Taxa aprovação", `${c.taxaAprovacao.toFixed(0)}%`],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-xl border border-zinc-100 p-3 dark:border-zinc-800"
              >
                <strong className="text-xl font-black">{value}</strong>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className={`${panel} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-zinc-100 p-5 dark:border-zinc-800">
            <div>
              <h3 className="font-black">Últimas ordens de serviço</h3>
              <p className="text-xs text-zinc-500">
                Aberturas e movimentações recentes.
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigate("/ordens-servico", "Ordens de Serviço")}
            >
              Ver todas
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-500 dark:bg-zinc-950/40">
                  <th className="px-5 py-3">OS</th>
                  <th className="px-3 py-3">Cliente</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {filteredOS.slice(0, 6).map((item) => (
                  <tr
                    key={item.id}
                    onClick={() =>
                      navigate(`/ordens-servico?id=${item.id}`, item.code)
                    }
                    className="cursor-pointer text-xs hover:bg-[#d4af37]/5 dark:hover:bg-[#d4af37]/[.07]"
                  >
                    <td className="px-5 py-3 font-bold">{item.code}</td>
                    <td className="max-w-48 truncate px-3 py-3">
                      {item.client}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-5 py-3 text-right text-zinc-500">
                      {formatDate(item.date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filteredOS.length && (
              <p className="p-8 text-center text-xs text-zinc-500">
                Nenhuma OS corresponde aos filtros.
              </p>
            )}
          </div>
        </section>
        <section className={`${panel} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-zinc-100 p-5 dark:border-zinc-800">
            <div>
              <h3 className="font-black">Contas vencidas</h3>
              <p className="text-xs text-zinc-500">
                Clientes que precisam de cobrança.
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                navigate("/financeiro?tab=receber", "Contas vencidas")
              }
            >
              Ver todas
            </Button>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {data.tabelas.contasVencidas.length ? (
              data.tabelas.contasVencidas.map((item) => (
                <button
                  key={item.id}
                  onClick={() =>
                    navigate("/financeiro?tab=receber", "Cobrança")
                  }
                  className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-red-50/40 dark:hover:bg-red-950/20"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-600 dark:bg-red-950/30">
                    <HandCoins size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-xs">
                      {item.client}
                    </strong>
                    <span className="text-[10px] text-zinc-500">
                      Venceu em {formatDate(item.dueDate)}
                    </span>
                  </span>
                  <strong className="text-sm text-red-600">
                    {formatCurrency(item.value)}
                  </strong>
                </button>
              ))
            ) : (
              <div className="p-10 text-center">
                <CheckCircle2 className="mx-auto text-emerald-500" />
                <p className="mt-2 text-xs font-bold">Nenhuma conta vencida</p>
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className={`${panel} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-zinc-100 p-5 dark:border-zinc-800">
            <div>
              <h3 className="font-black">Orçamentos em negociação</h3>
              <p className="text-xs text-zinc-500">
                Propostas que precisam de acompanhamento comercial.
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigate("/orcamentos", "Orçamentos")}
            >
              Ver todos
            </Button>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {data.tabelas.orcamentosNegociacao.length ? (
              data.tabelas.orcamentosNegociacao.map((item) => (
                <button
                  key={item.id}
                  onClick={() =>
                    navigate(`/orcamentos?id=${item.id}`, item.code)
                  }
                  className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-[#d4af37]/5 dark:hover:bg-[#d4af37]/[.07]"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f6edcf] text-[#8a6511] dark:bg-[#d4af37]/12 dark:text-[#e3bf58]">
                    <FileText size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-xs">
                      {item.code} · {item.client}
                    </strong>
                    <span className="text-[10px] text-zinc-500">
                      Válido até {formatDate(item.validUntil)}
                    </span>
                  </span>
                  <strong className="text-sm">
                    {formatCurrency(item.value)}
                  </strong>
                </button>
              ))
            ) : (
              <div className="p-10 text-center">
                <CheckCircle2 className="mx-auto text-emerald-500" />
                <p className="mt-2 text-xs font-bold">
                  Nenhum orçamento parado
                </p>
              </div>
            )}
          </div>
        </section>
        <section className={`${panel} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-zinc-100 p-5 dark:border-zinc-800">
            <div>
              <h3 className="font-black">Notas fiscais com erro</h3>
              <p className="text-xs text-zinc-500">
                Rejeições que impedem o avanço do faturamento.
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                navigate("/faturamento?tab=rejeitadas", "Notas rejeitadas")
              }
            >
              Ver todas
            </Button>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {data.tabelas.notasComErro.length ? (
              data.tabelas.notasComErro.map((item) => (
                <button
                  key={item.id}
                  onClick={() =>
                    navigate(`/faturamento?id=${item.id}`, item.code)
                  }
                  className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-red-50/40 dark:hover:bg-red-950/20"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-600 dark:bg-red-950/30">
                    <AlertTriangle size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-xs">
                      {item.code} · {item.client}
                    </strong>
                    <span className="text-[10px] text-red-600">
                      Requer correção antes do reenvio
                    </span>
                  </span>
                  <strong className="text-sm">
                    {formatCurrency(item.value)}
                  </strong>
                </button>
              ))
            ) : (
              <div className="p-10 text-center">
                <CheckCircle2 className="mx-auto text-emerald-500" />
                <p className="mt-2 text-xs font-bold">Nenhuma nota com erro</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
