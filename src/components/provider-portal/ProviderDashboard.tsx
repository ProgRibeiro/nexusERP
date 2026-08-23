"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Loader2,
  LogOut,
  Play,
  Wrench,
  Search,
  Phone,
  MessageSquare,
  MapPin,
  FileText,
  Building2,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  X,
} from "lucide-react";
import { logoutProviderPortal, updateOwnProviderJob } from "@/app/actions/providerPortalActions";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Job {
  id: string;
  description: string;
  clientName: string;
  osCode: string;
  osStatus: string;
  executionStatus: string;
  paymentStatus: string;
  costValue: number;
  scheduledDate: Date | null;
  paymentDueDate: Date | null;
  paymentDate: Date | null;
}

interface ProviderDashboardProps {
  data: {
    provider: {
      name: string;
      email: string | null;
      phone: string;
    };
    jobs: Job[];
  };
}

export function ProviderDashboard({ data }: ProviderDashboardProps) {
  const router = useRouter();
  const [busyJobId, setBusyJobId] = useState("");
  const [statusFilter, setStatusFilter] = useState("TODOS");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  // Filtragem inteligente de serviços
  const filteredJobs = useMemo(() => {
    return data.jobs.filter((j) => {
      const matchStatus =
        statusFilter === "TODOS" ||
        j.executionStatus === statusFilter ||
        j.paymentStatus === statusFilter;

      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        j.osCode.toLowerCase().includes(q) ||
        j.clientName.toLowerCase().includes(q) ||
        j.description.toLowerCase().includes(q);

      return matchStatus && matchQuery;
    });
  }, [data.jobs, statusFilter, searchQuery]);

  // Cálculos de métricas do prestador
  const pendingCount = data.jobs.filter(
    (j) => !["CONCLUIDO", "CANCELADO"].includes(j.executionStatus)
  ).length;

  const inProgressCount = data.jobs.filter(
    (j) => j.executionStatus === "EXECUCAO"
  ).length;

  const receivableTotal = data.jobs
    .filter((j) => j.paymentStatus !== "PAGO" && j.executionStatus === "CONCLUIDO")
    .reduce((sum, j) => sum + j.costValue, 0);

  const paidTotal = data.jobs
    .filter((j) => j.paymentStatus === "PAGO")
    .reduce((sum, j) => sum + j.costValue, 0);

  // Atualização de status da OS pelo técnico
  const handleUpdateStatus = async (id: string, newStatus: "EXECUCAO" | "CONCLUIDO") => {
    setBusyJobId(id);
    const result = await updateOwnProviderJob(id, newStatus);
    setBusyJobId("");

    if (!result.success) {
      alert(result.error || "Não foi possível atualizar o status do serviço.");
      return;
    }

    if (selectedJob && selectedJob.id === id) {
      setSelectedJob({ ...selectedJob, executionStatus: newStatus });
    }

    router.refresh();
  };

  const handleLogout = async () => {
    await logoutProviderPortal();
    router.push("/portal/prestador/login");
    router.refresh();
  };

  return (
    <main className="min-h-screen bg-[#080a0d] text-zinc-100 font-sans pb-16">
      {/* Top Header do Portal */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0d0f14]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#155eef] to-[#1d4ed8] text-black font-black text-lg shadow-md shadow-[#155eef]/20">
              {data.provider.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black tracking-wider uppercase text-[#155eef]">
                  Prestador Técnico
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-extrabold text-emerald-400 border border-emerald-500/20">
                  <ShieldCheck size={10} /> Credenciado
                </span>
              </div>
              <h2 className="text-sm font-bold text-white tracking-tight">{data.provider.name}</h2>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-bold text-zinc-300 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400 transition-all cursor-pointer"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Sair do Portal</span>
          </button>
        </div>
      </header>

      {/* Container Principal */}
      <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 py-6 sm:py-8">
        {/* Banner do Painel Operacional */}
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r from-[#12151c] via-[#0d0f14] to-[#151a24] p-6 sm:p-8 shadow-2xl">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#155eef]/10 px-3 py-1 text-xs font-bold text-[#60a5fa] border border-[#155eef]/20">
                <Sparkles size={13} />
                <span>Painel de Operações Técnicas & Repasses</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Serviços & Atendimentos de Campo
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl">
                Acompanhe suas ordens de serviço atribuídas, execute atendimentos e controle o saldo de repasses da Nexus ERP em tempo real.
              </p>
            </div>
          </div>
        </section>

        {/* Métricas e Indicadores KPI */}
        <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {/* Card 1: A Executar */}
          <div className="rounded-2xl border border-white/10 bg-[#11141a] p-4 sm:p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                A Executar
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Wrench size={16} />
              </div>
            </div>
            <p className="mt-3 text-2xl sm:text-3xl font-black text-white">{pendingCount}</p>
            <p className="mt-1 text-[10px] text-zinc-500">Serviços pendentes na fila</p>
          </div>

          {/* Card 2: Em Execução */}
          <div className="rounded-2xl border border-white/10 bg-[#11141a] p-4 sm:p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Em Atendimento
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Clock3 size={16} className="animate-pulse" />
              </div>
            </div>
            <p className="mt-3 text-2xl sm:text-3xl font-black text-blue-400">{inProgressCount}</p>
            <p className="mt-1 text-[10px] text-zinc-500">Ordens de serviço em andamento</p>
          </div>

          {/* Card 3: A Receber */}
          <div className="rounded-2xl border border-white/10 bg-[#11141a] p-4 sm:p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Saldo A Receber
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#155eef]/10 text-[#155eef] border border-[#155eef]/20">
                <CircleDollarSign size={16} />
              </div>
            </div>
            <p className="mt-3 text-xl sm:text-2xl font-black text-[#60a5fa]">
              {formatCurrency(receivableTotal)}
            </p>
            <p className="mt-1 text-[10px] text-zinc-500">Aguardando liberação de repasse</p>
          </div>

          {/* Card 4: Já Recebido */}
          <div className="rounded-2xl border border-white/10 bg-[#11141a] p-4 sm:p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Repasses Concluídos
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 size={16} />
              </div>
            </div>
            <p className="mt-3 text-xl sm:text-2xl font-black text-emerald-400">
              {formatCurrency(paidTotal)}
            </p>
            <p className="mt-1 text-[10px] text-zinc-500">Histórico de repasses efetuados</p>
          </div>
        </section>

        {/* Toolbar de Filtro e Busca */}
        <section className="rounded-2xl border border-white/10 bg-[#11141a] p-4 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Busca por Código OS ou Cliente */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-3 text-zinc-500" size={15} />
            <input
              type="text"
              placeholder="Buscar por OS, cliente ou serviço..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#090b0e] pl-9 pr-4 py-2 text-xs font-semibold text-white placeholder:text-zinc-500 outline-none focus:border-[#155eef]"
            />
          </div>

          {/* Seleção de Filtro */}
          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto scrollbar-none pb-1 sm:pb-0">
            {["TODOS", "PENDENTE", "EXECUCAO", "CONCLUIDO", "PAGO"].map((filterKey) => (
              <button
                key={filterKey}
                onClick={() => setStatusFilter(filterKey)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  statusFilter === filterKey
                    ? "bg-[#155eef] text-black shadow-md shadow-[#155eef]/20"
                    : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white border border-white/5"
                }`}
              >
                {filterKey === "TODOS"
                  ? "Todos os Serviços"
                  : filterKey === "EXECUCAO"
                  ? "Em Execução"
                  : filterKey}
              </button>
            ))}
          </div>
        </section>

        {/* Lista de Cartões de Serviço da Ordem de Serviço */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">
              Ordens de Serviço Vinculadas ({filteredJobs.length})
            </h3>
          </div>

          {filteredJobs.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[#11141a] p-12 text-center">
              <AlertCircle className="mx-auto h-10 w-10 text-zinc-600 mb-3" />
              <p className="text-sm font-bold text-zinc-300">Nenhum serviço encontrado</p>
              <p className="mt-1 text-xs text-zinc-500 max-w-sm mx-auto">
                Altere o filtro ou o termo de busca para visualizar suas ordens de serviço.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredJobs.map((job) => {
                const isBusy = busyJobId === job.id;
                const isPending = ["PENDENTE", "AGENDADO"].includes(job.executionStatus);
                const isInProgress = job.executionStatus === "EXECUCAO";
                const isDone = job.executionStatus === "CONCLUIDO";

                return (
                  <article
                    key={job.id}
                    className="rounded-2xl border border-white/10 bg-[#11141a] p-5 sm:p-6 shadow-xl hover:border-[#155eef]/30 transition-all space-y-4"
                  >
                    {/* Topo do Cartão de Serviço */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                      <div className="flex items-center gap-3">
                        <span className="rounded-xl bg-[#155eef]/15 border border-[#155eef]/30 px-3 py-1 text-xs font-black text-[#60a5fa]">
                          {job.osCode}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase border ${
                            isInProgress
                              ? "bg-blue-500/20 text-blue-300 border-blue-500/30 animate-pulse"
                              : isDone
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                              : "bg-zinc-800 text-zinc-400 border-zinc-700"
                          }`}
                        >
                          {isInProgress
                            ? "Em Execução"
                            : isDone
                            ? "Concluído"
                            : job.executionStatus}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                          Valor Combinado:
                        </span>
                        <span className="text-base font-black text-[#60a5fa]">
                          {formatCurrency(job.costValue)}
                        </span>
                        <span
                          className={`ml-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                            job.paymentStatus === "PAGO"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          }`}
                        >
                          {job.paymentStatus === "PAGO" ? "Repasse Efetuado" : "Repasse Pendente"}
                        </span>
                      </div>
                    </div>

                    {/* Conteúdo Principal do Serviço */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
                      {/* Descrição e Cliente */}
                      <div className="space-y-1 lg:col-span-2">
                        <h4 className="text-base font-bold text-white">{job.description}</h4>
                        <div className="flex items-center gap-2 text-zinc-400 pt-1">
                          <Building2 size={14} className="text-zinc-500 shrink-0" />
                          <span>Cliente: <strong className="text-zinc-200">{job.clientName}</strong></span>
                        </div>
                      </div>

                      {/* Agendamento */}
                      <div className="bg-[#090b0e] p-3.5 rounded-xl border border-white/5 space-y-1">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                          Data do Agendamento
                        </span>
                        <div className="flex items-center gap-2 font-bold text-zinc-200">
                          <CalendarDays size={14} className="text-[#155eef]" />
                          <span>
                            {job.scheduledDate ? formatDate(job.scheduledDate) : "Data a definir"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Rodapé de Ações do Técnico */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/5">
                      {/* Links Rápidos de Contato e Mapa */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedJob(job)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 font-semibold text-xs transition-colors cursor-pointer border border-white/5"
                        >
                          <FileText size={13} className="text-[#155eef]" />
                          <span>Ver Ficha da OS</span>
                        </button>
                      </div>

                      {/* Botões de Ação de Status */}
                      <div className="flex items-center gap-2 ml-auto">
                        {isPending && (
                          <button
                            disabled={isBusy}
                            onClick={() => handleUpdateStatus(job.id, "EXECUCAO")}
                            className="flex items-center gap-2 rounded-xl border border-[#155eef]/40 bg-[#155eef]/10 px-4 py-2 text-xs font-black text-[#60a5fa] hover:bg-[#155eef]/20 transition-all cursor-pointer disabled:opacity-50"
                          >
                            {isBusy ? (
                              <Loader2 size={14} className="animate-spin text-[#155eef]" />
                            ) : (
                              <Play size={14} />
                            )}
                            <span>Iniciar Atendimento</span>
                          </button>
                        )}

                        {isInProgress && (
                          <button
                            disabled={isBusy}
                            onClick={() => handleUpdateStatus(job.id, "CONCLUIDO")}
                            className="flex items-center gap-2 rounded-xl bg-[#155eef] px-5 py-2 text-xs font-black text-black hover:bg-[#93c5fd] transition-all cursor-pointer shadow-lg shadow-[#155eef]/20 disabled:opacity-50"
                          >
                            {isBusy ? (
                              <Loader2 size={14} className="animate-spin text-black" />
                            ) : (
                              <CheckCircle2 size={14} />
                            )}
                            <span>Concluir Serviço</span>
                          </button>
                        )}

                        {isDone && (
                          <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1.5 text-xs font-bold text-emerald-400">
                            <CheckCircle2 size={14} />
                            <span>Serviço Concluído</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Modal de Detalhes da Ordem de Serviço para o Técnico */}
      {selectedJob && (
        <div
          onClick={() => setSelectedJob(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#0d0f14] p-6 text-zinc-100 shadow-2xl space-y-6"
          >
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <span className="text-xs font-black text-[#155eef]">OS #{selectedJob.osCode}</span>
                <h3 className="text-lg font-bold text-white mt-0.5">{selectedJob.description}</h3>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Informações detalhadas */}
            <div className="space-y-4 text-xs">
              <div className="bg-[#141720] p-4 rounded-2xl border border-white/5 space-y-2">
                <p className="text-[10px] font-bold uppercase text-zinc-500">Cliente Solicitante</p>
                <p className="text-sm font-bold text-white">{selectedJob.clientName}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#141720] p-4 rounded-2xl border border-white/5 space-y-1">
                  <p className="text-[10px] font-bold uppercase text-zinc-500">Status da Execução</p>
                  <p className="text-sm font-black text-[#60a5fa]">{selectedJob.executionStatus}</p>
                </div>
                <div className="bg-[#141720] p-4 rounded-2xl border border-white/5 space-y-1">
                  <p className="text-[10px] font-bold uppercase text-zinc-500">Valor a Receber</p>
                  <p className="text-sm font-black text-emerald-400">{formatCurrency(selectedJob.costValue)}</p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-white/10 flex justify-end">
              <button
                onClick={() => setSelectedJob(null)}
                className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors"
              >
                Fechar Ficha
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
