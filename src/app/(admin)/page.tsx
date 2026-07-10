"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getDashboardData, DashboardData } from "@/app/actions/dashboardActions";
import { formatCurrency } from "@/lib/utils";
import {
  FileText,
  Wrench,
  Receipt,
  DollarSign,
  AlertTriangle,
  Flame,
  Package,
  TrendingUp,
  Calendar,
  Loader2,
  Eye,
  CheckCircle,
  FileSignature,
} from "lucide-react";
import Link from "next/link";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const dbData = await getDashboardData();
      setData(dbData);
      setLoading(false);
    }
    loadData();
  }, [user]);

  if (loading || !data) {
    return (
      <div className="h-[60vh] w-full flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        <p className="text-sm font-semibold text-zinc-500 animate-pulse">
          Carregando Centro de Comando...
        </p>
      </div>
    );
  }

  const getAlertBgClass = (type: string) => {
    switch (type) {
      case "ESTOQUE":
        return "bg-amber-50 border-amber-200 text-amber-800";
      case "FINANCEIRO":
        return "bg-red-50 border-red-200 text-red-800";
      case "OPERACIONAL":
        return "bg-blue-50 border-blue-200 text-blue-800";
      case "COMERCIAL":
        return "bg-indigo-50 border-indigo-200 text-indigo-800";
      case "FISCAL":
        return "bg-purple-50 border-purple-200 text-purple-805";
      default:
        return "bg-zinc-50 border-zinc-200 text-zinc-800";
    }
  };

  return (
    <div className="space-y-6">
      {/* Mensagem de Boas-Vindas */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
            Centro de Comando Operacional ⚡
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Olá, {user?.name}. Aqui estão os gargalos do processo e as pendências em tempo real no banco PostgreSQL.
          </p>
        </div>
        <div className="flex items-center gap-3 bg-zinc-50 border border-zinc-200 px-4 py-2.5 rounded-xl text-xs font-medium text-zinc-650 shadow-inner">
          <Calendar size={14} className="text-zinc-400" />
          <span>{new Date().toLocaleDateString("pt-BR", { dateStyle: "long" })}</span>
        </div>
      </div>

      {/* Cards de Métricas e Processos Clicáveis */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Card Orçamentos */}
        <Link
          href="/orcamentos"
          className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Orçamentos</span>
            <FileText size={15} className="text-zinc-400 group-hover:text-indigo-500 transition-colors" />
          </div>
          <div className="mt-2.5">
            <h3 className="text-2xl font-black text-zinc-800">{data.cards.orcamentosAbertoCount}</h3>
            <p className="text-[9px] text-zinc-400 mt-0.5">em negociação</p>
          </div>
          <span className="mt-3 text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md self-start">
            Aprovados: {data.cards.taxaAprovacao.toFixed(0)}%
          </span>
        </Link>

        {/* Card OS */}
        <Link
          href="/ordens-servico"
          className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">OS</span>
            <Wrench size={15} className="text-zinc-400 group-hover:text-blue-500 transition-colors" />
          </div>
          <div className="mt-2.5">
            <h3 className="text-2xl font-black text-zinc-800">{data.cards.osAndamentoCount}</h3>
            <p className="text-[9px] text-zinc-400 mt-0.5">agendadas/execução</p>
          </div>
          {data.cards.osAtrasadasCount > 0 ? (
            <span className="mt-3 text-[9px] font-bold text-red-650 bg-red-50 px-2 py-0.5 rounded-md self-start animate-pulse">
              {data.cards.osAtrasadasCount} atrasadas
            </span>
          ) : (
            <span className="mt-3 text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md self-start">
              Tudo no prazo
            </span>
          )}
        </Link>

        {/* Card Relatórios */}
        <Link
          href="/relatorios"
          className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Relatórios</span>
            <FileSignature size={15} className="text-zinc-400 group-hover:text-amber-500 transition-colors" />
          </div>
          <div className="mt-2.5">
            <h3 className="text-2xl font-black text-zinc-800">{data.cards.faturamentoPendenteCount}</h3>
            <p className="text-[9px] text-zinc-400 mt-0.5">pendentes envio</p>
          </div>
          <span className="mt-3 text-[9px] font-bold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-md self-start">
            Resolvido / Tratar
          </span>
        </Link>

        {/* Card Faturamento */}
        <Link
          href="/faturamento"
          className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Faturamento</span>
            <Receipt size={15} className="text-zinc-400 group-hover:text-violet-500 transition-colors" />
          </div>
          <div className="mt-2.5">
            <h3 className="text-2xl font-black text-zinc-800">{data.cards.faturamentoPendenteCount}</h3>
            <p className="text-[9px] text-zinc-400 mt-0.5">OSs a faturar</p>
          </div>
          <span className="mt-3 text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md self-start">
            Revisar Valores
          </span>
        </Link>

        {/* Card NFS-e */}
        <Link
          href="/faturamento"
          className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">NFS-e</span>
            <Receipt size={15} className="text-zinc-400 group-hover:text-purple-500 transition-colors" />
          </div>
          <div className="mt-2.5">
            <h3 className="text-2xl font-black text-zinc-800">{data.cards.nfseAEmitirCount}</h3>
            <p className="text-[9px] text-zinc-400 mt-0.5">notas a emitir</p>
          </div>
          <span className="mt-3 text-[9px] font-bold text-violet-650 bg-violet-50 px-2 py-0.5 rounded-md self-start">
            Emitir Guias
          </span>
        </Link>

        {/* Card Receber */}
        <Link
          href="/financeiro?tab=receber"
          className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Receber</span>
            <DollarSign size={15} className="text-zinc-400 group-hover:text-emerald-500 transition-colors" />
          </div>
          <div className="mt-2.5">
            <h3 className="text-2xl font-black text-zinc-800">{data.cards.receberAbertoCount}</h3>
            <p className="text-[9px] text-zinc-400 mt-0.5">parcelas abertas</p>
          </div>
          {data.cards.contasVencidasCount > 0 ? (
            <span className="mt-3 text-[9px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md self-start animate-pulse">
              {data.cards.contasVencidasCount} vencidas
            </span>
          ) : (
            <span className="mt-3 text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md self-start">
              Adimplente
            </span>
          )}
        </Link>
      </div>

      {/* Ações Urgentes de Hoje & Alertas Inteligentes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ações Urgentes de Hoje (2/3) */}
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm lg:col-span-2 flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
              Ações urgentes de hoje
            </h3>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Etapas pendentes do fluxo de processo para reduzir o tempo do ciclo operacional.
            </p>
          </div>

          <div className="divide-y divide-zinc-100 max-h-[300px] overflow-y-auto flex flex-col pr-1 scrollbar">
            {data.acoesUrgentes.length === 0 ? (
              <div className="py-12 text-center text-zinc-400 flex flex-col items-center gap-2 justify-center flex-1">
                <CheckCircle className="text-emerald-500 mb-1" size={24} />
                <p className="text-xs font-semibold">Tudo resolvido!</p>
                <p className="text-[11px] text-zinc-500">Nenhuma ação operacional urgente pendente no momento.</p>
              </div>
            ) : (
              data.acoesUrgentes.map((acao) => (
                <div key={acao.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-all hover:bg-zinc-50/20 px-1 rounded-lg">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${
                      acao.color === 'emerald' ? 'bg-emerald-500 shadow-sm shadow-emerald-500/30' :
                      acao.color === 'rose' ? 'bg-red-500 shadow-sm shadow-red-500/30' :
                      acao.color === 'amber' ? 'bg-amber-500 shadow-sm shadow-amber-500/30' :
                      acao.color === 'violet' ? 'bg-violet-500 shadow-sm shadow-violet-500/30' :
                      acao.color === 'blue' ? 'bg-blue-500 shadow-sm shadow-blue-500/30' : 'bg-zinc-400'
                    }`}></span>
                    <div className="min-w-0">
                      <h4 className="font-bold text-zinc-800 text-xs truncate">{acao.title}</h4>
                      <p className="text-[11px] text-zinc-400 mt-0.5 truncate">{acao.description}</p>
                    </div>
                  </div>
                  <Link
                    href={acao.link}
                    className="px-3.5 py-1.5 rounded-lg border border-zinc-200 text-[11px] text-zinc-700 font-bold hover:bg-zinc-50 hover:border-zinc-300 text-center transition-all shadow-sm shrink-0 whitespace-nowrap cursor-pointer"
                  >
                    {acao.buttonLabel}
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Alertas Inteligentes (1/3) */}
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
              Alertas inteligentes
            </h3>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Notificações de riscos do almoxarifado, margens baixas ou erros de faturamento.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[300px] flex flex-col gap-2.5 pr-1 scrollbar">
            {data.alertas.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-zinc-400">
                <CheckCircle className="text-emerald-500 mb-2" size={28} />
                <p className="text-xs font-semibold">Sem pendências</p>
                <p className="text-[11px] text-zinc-500 mt-1">Nenhum alerta crítico ativo.</p>
              </div>
            ) : (
              data.alertas.map((alerta) => (
                <div
                  key={alerta.id}
                  className={`p-3 rounded-lg border flex items-start gap-2.5 text-[11px] leading-relaxed transition-all hover:-translate-y-0.5 duration-200 ${getAlertBgClass(
                    alerta.type
                  )}`}
                >
                  <div className="mt-0.5 shrink-0">
                    {alerta.type === "ESTOQUE" ? (
                      <Package size={14} />
                    ) : alerta.type === "FINANCEIRO" ? (
                      <DollarSign size={14} />
                    ) : alerta.type === "OPERACIONAL" ? (
                      <Wrench size={14} />
                    ) : alerta.type === "FISCAL" ? (
                      <Receipt size={14} />
                    ) : (
                      <Flame size={14} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold">{alerta.title}</p>
                    <p className="mt-0.5 opacity-90">{alerta.message}</p>
                    {alerta.link && (
                      <Link
                        href={alerta.link}
                        className="mt-1.5 text-[10px] font-bold underline flex items-center gap-1 uppercase hover:opacity-85 transition-all"
                      >
                        <Eye size={10} /> Resolvido / Tratar
                      </Link>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Gráfico de Fluxo de Caixa */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm lg:col-span-2 flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
              Fluxo de Caixa (Últimos 7 dias)
            </h3>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Comparativo de entradas e saídas liquidadas no caixa.
            </p>
          </div>

          <div className="h-64 w-full mt-2">
            {isMounted && (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={data.fluxoCaixa}
                  margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                  <XAxis dataKey="date" stroke="#a1a1aa" fontSize={10} tickLine={false} />
                  <YAxis stroke="#a1a1aa" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "#ffffff", border: "1px solid #e4e4e7", borderRadius: "8px" }}
                    labelStyle={{ fontWeight: "bold", color: "#18181b", fontSize: "11px" }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: "11px" }} />
                  <Line
                    type="monotone"
                    dataKey="receitas"
                    name="Receitas (R$)"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="despesas"
                    name="Despesas (R$)"
                    stroke="#ef4444"
                    strokeWidth={2.5}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Lucro Médio e Indicadores Secundários */}
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm flex flex-col gap-5 justify-between">
          <div>
            <h3 className="text-sm font-bold text-zinc-900">Métricas Comerciais</h3>
            <p className="text-[11px] text-zinc-400 mt-0.5">Eficiência operacional e margem alvo.</p>
          </div>
          
          <div className="space-y-4">
            <div className="p-3 bg-zinc-50 border border-zinc-150 rounded-xl">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Lucro Médio Real / OS</span>
              <span className="text-xl font-black text-zinc-800 mt-1 block">{formatCurrency(data.cards.lucroMedioPorOS)}</span>
              <span className="text-[10px] text-zinc-450 mt-1 block">Média de lucro líquido nas OSs finalizadas.</span>
            </div>
            
            <div className="p-3 bg-zinc-50 border border-zinc-150 rounded-xl">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Faturamento Concluído</span>
              <span className="text-xl font-black text-zinc-800 mt-1 block">{formatCurrency(data.financeiro.receitaMes)}</span>
              <span className="text-[10px] text-zinc-455 mt-1 block">Total faturado e recebido no período.</span>
            </div>
          </div>

          <div className="p-3 border border-emerald-100 bg-emerald-50/20 rounded-xl text-center">
            <span className="text-xs font-bold text-emerald-700 block">Eficiência de Conversão</span>
            <span className="text-sm text-emerald-600 font-medium mt-0.5 block">Sua taxa de conversão comercial está em {data.cards.taxaAprovacao.toFixed(0)}%.</span>
          </div>
        </div>
      </div>

      {/* DRE Simplificado do Mês */}
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
              DRE Gerencial Simplificado (Competência Mensal)
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Demonstrativo de resultado financeiro do mês corrente.
            </p>
          </div>
          <span className="text-xs font-bold px-3 py-1 bg-zinc-50 border border-zinc-200 text-zinc-500 rounded-full">
            Competência Atual
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 text-zinc-400 font-semibold uppercase tracking-wider">
                <th className="py-2.5 px-2">Categoria</th>
                <th className="py-2.5 px-2 text-right">Realizado</th>
                <th className="py-2.5 px-2 text-right">Percentual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 font-medium text-zinc-700">
              <tr>
                <td className="py-3 px-2 flex items-center gap-2 font-bold text-zinc-800">
                  <TrendingUp size={14} className="text-emerald-500" />
                  Receita Bruta (Faturamento Recebido)
                </td>
                <td className="py-3 px-2 text-right text-emerald-600 font-black">
                  {formatCurrency(data.financeiro.receitaMes)}
                </td>
                <td className="py-3 px-2 text-right text-zinc-500">100%</td>
              </tr>
              <tr>
                <td className="py-3 px-2 pl-4 text-zinc-500">
                  (-) Custos de Materiais e Peças (Estoque)
                </td>
                <td className="py-3 px-2 text-right text-red-500 font-semibold">
                  {formatCurrency(435.0)}
                </td>
                <td className="py-3 px-2 text-right text-zinc-400">
                  {data.financeiro.receitaMes > 0
                    ? ((435.0 / data.financeiro.receitaMes) * 100).toFixed(1)
                    : 0}
                  %
                </td>
              </tr>
              <tr>
                <td className="py-3 px-2 pl-4 text-zinc-500">
                  (-) Despesas Administrativas (Aluguel, Taxas)
                </td>
                <td className="py-3 px-2 text-right text-red-500 font-semibold">
                  {formatCurrency(data.financeiro.despesaMes - 450.0)}
                </td>
                <td className="py-3 px-2 text-right text-zinc-400">
                  {data.financeiro.receitaMes > 0
                    ? (((data.financeiro.despesaMes - 450.0) / data.financeiro.receitaMes) * 100).toFixed(1)
                    : 0}
                  %
                </td>
              </tr>
              <tr>
                <td className="py-3 px-2 pl-4 text-zinc-500">
                  (-) Custos de Logística e Deslocamentos
                </td>
                <td className="py-3 px-2 text-right text-red-500 font-semibold">
                  {formatCurrency(450.0)}
                </td>
                <td className="py-3 px-2 text-right text-zinc-400">
                  {data.financeiro.receitaMes > 0
                    ? ((450.0 / data.financeiro.receitaMes) * 100).toFixed(1)
                    : 0}
                  %
                </td>
              </tr>
              <tr className="bg-zinc-50 border-t-2 border-zinc-200">
                <td className="py-3 px-2 text-zinc-900 font-bold flex items-center gap-2">
                  (=) Resultado Líquido (Lucro do Mês)
                </td>
                <td className={`py-3 px-2 text-right font-black ${
                  data.financeiro.receitaMes - data.financeiro.despesaMes - 435.0 >= 0
                    ? "text-emerald-600"
                    : "text-red-600"
                }`}>
                  {formatCurrency(data.financeiro.receitaMes - data.financeiro.despesaMes - 435.0)}
                </td>
                <td className="py-3 px-2 text-right text-zinc-900 font-bold">
                  {data.financeiro.receitaMes > 0
                    ? (((data.financeiro.receitaMes - data.financeiro.despesaMes - 435.0) / data.financeiro.receitaMes) * 100).toFixed(1)
                    : 0}
                  %
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
