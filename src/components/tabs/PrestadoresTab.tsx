"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Loader2,
  Mail,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Users,
  MapPin,
  Building2,
  Copy,
  Check,
  Edit,
  ExternalLink,
  Filter,
  FileText,
  CreditCard,
  History,
  Sparkles,
  UserCheck,
  X,
} from "lucide-react";
import {
  createProvider,
  updateProviderDetails,
  generateProviderPayable,
  getProvidersWorkspace,
  updateProviderJob,
  ProviderDetailsInput,
} from "@/app/actions/providerActions";
import { useToast } from "@/components/ui/Toast";
import { consultarCNPJAction } from "@/app/actions/clientActions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency, formatDate } from "@/lib/utils";

const executionBadge: Record<string, string> = {
  PENDENTE: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  AGENDADO: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  EXECUCAO: "border-blue-500/30 bg-blue-500/10 text-blue-300 animate-pulse",
  CONCLUIDO: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  PAGO: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  LIBERADO: "border-yellow-500/30 bg-yellow-500/10 text-yellow-300",
  BLOQUEADO: "border-zinc-700 bg-zinc-800 text-zinc-400",
  CANCELADO: "border-red-500/30 bg-red-500/10 text-red-400",
};

const DEFAULT_FORM: ProviderDetailsInput = {
  name: "",
  tradeName: "",
  cnpj: "",
  phone: "",
  email: "",
  ie: "",
  specialty: "Climatização & Refrigeração",
  pixKey: "",
  pixType: "CPF_CNPJ",
  bankName: "",
  bankAgency: "",
  bankAccount: "",
  cep: "",
  address: "",
  city: "",
  state: "",
  notes: "",
};

export default function PrestadoresTab() {
  const { toast } = useToast();
  const [data, setData] = useState<{ suppliers: any[]; jobs: any[] }>({ suppliers: [], jobs: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("TODOS");
  const [viewTab, setViewTab] = useState<"CADASTROS" | "SERVICOS">("CADASTROS");

  // Controle de Modais
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  const [selectedProviderDetails, setSelectedProviderDetails] = useState<any | null>(null);
  const [detailTab, setDetailTab] = useState<"GERAL" | "HISTORICO" | "FINANCEIRO">("GERAL");
  const [copiedPix, setCopiedPix] = useState(false);

  const [form, setForm] = useState<ProviderDetailsInput>(DEFAULT_FORM);
  const [cnpjLoading, setCnpjLoading] = useState(false);

  const handleLookupCNPJ = async () => {
    const clean = form.cnpj.replace(/\D/g, "");
    if (clean.length !== 14) {
      toast("Informe um CNPJ válido com 14 dígitos para consultar online.", "warning");
      return;
    }

    setCnpjLoading(true);
    try {
      const res = await consultarCNPJAction(clean);
      if (res.success && res.data) {
        setForm((prev) => ({
          ...prev,
          name: res.data.corporateName || prev.name,
          tradeName: res.data.tradeName || prev.tradeName,
          email: res.data.email || prev.email,
          phone: res.data.phone || prev.phone,
          address: res.data.addressDetails?.street
            ? `${res.data.addressDetails.street}, ${res.data.addressDetails.number}${
                res.data.addressDetails.neighborhood ? ` - ${res.data.addressDetails.neighborhood}` : ""
              }`
            : prev.address,
          city: res.data.addressDetails?.city || prev.city,
          state: res.data.addressDetails?.state || prev.state,
          cep: res.data.addressDetails?.cep || prev.cep,
          pixKey: prev.pixKey ? prev.pixKey : clean,
          pixType: prev.pixType ? prev.pixType : "CPF_CNPJ",
        }));
        toast("Dados do prestador importados com sucesso da Receita Federal!", "success");
      } else {
        toast(res.error || "Não foi possível consultar os dados deste CNPJ.", "error");
      }
    } catch {
      toast("Erro de conexão ao buscar dados do CNPJ.", "error");
    } finally {
      setCnpjLoading(false);
    }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const workspaceData = await getProvidersWorkspace();
      setData(workspaceData);
    } catch {
      toast("Não foi possível carregar as informações dos prestadores.", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Filtragem de serviços
  const filteredJobs = useMemo(() => {
    return data.jobs.filter((job) => {
      const matchSearch = `${job.supplierName} ${job.clientName} ${job.osCode} ${job.description}`
        .toLowerCase()
        .includes(search.toLowerCase());
      return matchSearch && (filter === "TODOS" || job.executionStatus === filter || job.paymentStatus === filter);
    });
  }, [data.jobs, filter, search]);

  // Filtragem de fornecedores/prestadores
  const filteredSuppliers = useMemo(() => {
    return data.suppliers.filter((supplier) => {
      const q = search.toLowerCase();
      return (
        !q ||
        supplier.name.toLowerCase().includes(q) ||
        (supplier.tradeName && supplier.tradeName.toLowerCase().includes(q)) ||
        supplier.cnpj.includes(q) ||
        (supplier.city && supplier.city.toLowerCase().includes(q)) ||
        (supplier.specialty && supplier.specialty.toLowerCase().includes(q))
      );
    });
  }, [data.suppliers, search]);

  // Métricas financeiras e operacionais
  const pendingCost = data.jobs
    .filter((j) => j.paymentStatus !== "PAGO" && j.executionStatus !== "CANCELADO")
    .reduce((sum, j) => sum + j.costValue, 0);

  const pendingJobsCount = data.jobs.filter((j) => !["CONCLUIDO", "CANCELADO"].includes(j.executionStatus)).length;
  const totalProfit = data.jobs.reduce((sum, j) => sum + j.profit, 0);

  // Ações em serviços
  const setJobStatus = async (id: string, executionStatus: string) => {
    setBusy(id);
    const result = await updateProviderJob({ id, executionStatus });
    if (result.success) {
      toast("Status da execução atualizado.", "success");
    } else {
      toast(result.error || "Erro ao atualizar status.", "error");
    }
    await loadData();
    setBusy("");
  };

  const handleGeneratePayable = async (id: string) => {
    setBusy(id);
    const result = await generateProviderPayable(id);
    if (result.success) {
      toast("Conta a pagar enviada para a Gestão Financeira com sucesso!", "success");
    } else {
      toast(result.error || "Erro ao liberar pagamento.", "error");
    }
    await loadData();
    setBusy("");
  };

  // Abrir Modal para criar novo
  const handleOpenCreate = () => {
    setEditingProviderId(null);
    setForm(DEFAULT_FORM);
    setIsModalOpen(true);
  };

  // Abrir Modal para editar
  const handleOpenEdit = (provider: any) => {
    setEditingProviderId(provider.id);
    setForm({
      name: provider.name || "",
      tradeName: provider.tradeName || "",
      cnpj: provider.cnpj || "",
      phone: provider.phone || "",
      email: provider.email || "",
      ie: provider.ie || "",
      specialty: provider.specialty || "Climatização & Refrigeração",
      pixKey: provider.pixKey || "",
      pixType: provider.pixType || "CPF_CNPJ",
      bankName: provider.bankName || "",
      bankAgency: provider.bankAgency || "",
      bankAccount: provider.bankAccount || "",
      cep: provider.cep || "",
      address: provider.address || "",
      city: provider.city || "",
      state: provider.state || "",
      notes: provider.customNotes || "",
    });
    setIsModalOpen(true);
  };

  // Salvar Prestador (Criar ou Atualizar)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("saving");
    try {
      const res = editingProviderId
        ? await updateProviderDetails(editingProviderId, form)
        : await createProvider(form);

      if (res.success) {
        toast(
          editingProviderId
            ? "Cadastro do prestador atualizado com sucesso!"
            : "Novo prestador cadastrado e salvo no banco de dados!",
          "success"
        );
        setIsModalOpen(false);
        setForm(DEFAULT_FORM);
        await loadData();

        if (selectedProviderDetails && selectedProviderDetails.id === editingProviderId) {
          const updated = (await getProvidersWorkspace()).suppliers.find((s) => s.id === editingProviderId);
          if (updated) setSelectedProviderDetails(updated);
        }
      } else {
        toast(res.error || "Erro ao salvar prestador.", "error");
      }
    } catch {
      toast("Erro de conexão ao salvar prestador.", "error");
    } finally {
      setBusy("");
    }
  };

  // Copiar chave PIX
  const handleCopyPix = (pixKey: string) => {
    if (!pixKey) return;
    navigator.clipboard.writeText(pixKey);
    setCopiedPix(true);
    toast("Chave PIX copiada para a área de transferência!", "info");
    setTimeout(() => setCopiedPix(false), 2000);
  };

  return (
    <div className="space-y-6 text-zinc-100 font-sans">
      {/* Banner Principal / Dashboard KPI */}
      <section className="overflow-hidden rounded-3xl border border-[#d4af37]/30 bg-[#0d0f14] shadow-2xl">
        <div className="flex flex-col justify-between gap-4 border-b border-zinc-800 bg-gradient-to-r from-[#17130b] via-[#111318] to-[#161a24] p-6 sm:p-8 md:flex-row md:items-center">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#d4af37]/15 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#e6c653] border border-[#d4af37]/30">
              <Sparkles size={12} /> Gestão de Terceirizados & Parceiros
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Prestadores de Serviço & Credenciados
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl">
              Gerencie a base de parceiros técnicos, controle custos privados de OS, acompanhe o histórico de execuções e libere pagamentos via PIX/Financeiro.
            </p>
          </div>

          <Button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 bg-gradient-to-r from-[#d4af37] to-[#b88d1b] text-black font-black hover:opacity-95 shadow-lg shadow-[#d4af37]/20"
          >
            <Plus size={16} /> Novo Prestador
          </Button>
        </div>

        {/* Módulos KPI */}
        <div className="grid grid-cols-2 divide-x divide-y divide-zinc-800/80 md:grid-cols-4 md:divide-y-0 bg-[#0a0c10]">
          <div className="p-5 space-y-1">
            <div className="flex items-center justify-between text-[#d4af37]">
              <Users size={20} />
              <span className="text-[9px] font-black uppercase text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                Ativos
              </span>
            </div>
            <p className="text-[10px] font-bold uppercase text-zinc-400 pt-2">Prestadores Base</p>
            <p className="text-2xl font-black text-white">{data.suppliers.length}</p>
          </div>

          <div className="p-5 space-y-1">
            <div className="flex items-center justify-between text-amber-400">
              <BriefcaseBusiness size={20} />
              <span className="text-[9px] font-black uppercase text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                Em Andamento
              </span>
            </div>
            <p className="text-[10px] font-bold uppercase text-zinc-400 pt-2">OS A Executar</p>
            <p className="text-2xl font-black text-white">{pendingJobsCount}</p>
          </div>

          <div className="p-5 space-y-1">
            <div className="flex items-center justify-between text-[#d4af37]">
              <CircleDollarSign size={20} />
              <span className="text-[9px] font-black uppercase text-zinc-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                A Pagar
              </span>
            </div>
            <p className="text-[10px] font-bold uppercase text-zinc-400 pt-2">Custo Pendente OS</p>
            <p className="text-2xl font-black text-[#e6c653]">{formatCurrency(pendingCost)}</p>
          </div>

          <div className="p-5 space-y-1">
            <div className="flex items-center justify-between text-emerald-400">
              <CheckCircle2 size={20} />
              <span className="text-[9px] font-black uppercase text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                Lucro Operacional
              </span>
            </div>
            <p className="text-[10px] font-bold uppercase text-zinc-400 pt-2">Margem Prevista</p>
            <p className="text-2xl font-black text-emerald-400">{formatCurrency(totalProfit)}</p>
          </div>
        </div>
      </section>

      {/* Navegação entre Abas (Cadastros vs Serviços) */}
      <section className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-[#11141a] p-4 shadow-xl">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setViewTab("CADASTROS")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              viewTab === "CADASTROS"
                ? "bg-[#d4af37] text-black shadow-md shadow-[#d4af37]/20"
                : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white border border-white/5"
            }`}
          >
            <Users size={15} />
            <span>Fichas & Prestadores ({filteredSuppliers.length})</span>
          </button>
          <button
            onClick={() => setViewTab("SERVICOS")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              viewTab === "SERVICOS"
                ? "bg-[#d4af37] text-black shadow-md shadow-[#d4af37]/20"
                : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white border border-white/5"
            }`}
          >
            <BriefcaseBusiness size={15} />
            <span>Gestão de OS Terceirizadas ({filteredJobs.length})</span>
          </button>
        </div>

        {/* Busca Global na Aba Ativa */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-3 text-zinc-500" size={15} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              viewTab === "CADASTROS"
                ? "Buscar por nome, CNPJ, cidade ou especialidade..."
                : "Buscar por prestador, cliente ou código da OS..."
            }
            className="w-full rounded-xl border border-zinc-800 bg-[#090b0e] pl-9 pr-4 py-2 text-xs font-semibold text-white placeholder:text-zinc-500 outline-none focus:border-[#d4af37]"
          />
        </div>
      </section>

      {/* VISÃO 1: FICHAS DOS PRESTADORES */}
      {viewTab === "CADASTROS" && (
        <section className="space-y-4">
          {filteredSuppliers.length === 0 ? (
            <div className="rounded-3xl border border-zinc-800 bg-[#11141a] p-12 text-center">
              <Users className="mx-auto h-10 w-10 text-zinc-600 mb-3" />
              <p className="text-sm font-bold text-zinc-300">Nenhum prestador encontrado</p>
              <p className="mt-1 text-xs text-zinc-500 max-w-sm mx-auto">
                Altere o filtro de busca ou cadastre um novo prestador credenciado para a equipe.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredSuppliers.map((supplier) => (
                <article
                  key={supplier.id}
                  className="rounded-3xl border border-zinc-800 bg-[#11141a] p-5 shadow-xl hover:border-[#d4af37]/40 transition-all flex flex-col justify-between space-y-4 group"
                >
                  <div className="space-y-3">
                    {/* Header do Cartão */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#d4af37]/20 to-[#d4af37]/5 border border-[#d4af37]/30 text-xs font-black text-[#e6c653] shadow-md">
                        {supplier.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[9px] font-black uppercase text-emerald-400">
                          Credenciado
                        </span>
                      </div>
                    </div>

                    {/* Dados Básicos */}
                    <div>
                      <h3 className="text-sm font-black text-white group-hover:text-[#e6c653] transition-colors truncate">
                        {supplier.tradeName || supplier.name}
                      </h3>
                      {supplier.tradeName && (
                        <p className="text-[11px] font-semibold text-zinc-400 truncate">{supplier.name}</p>
                      )}
                      <p className="text-[10px] font-mono text-zinc-500 mt-0.5">CPF/CNPJ: {supplier.cnpj}</p>
                    </div>

                    {/* Especialidade e Cidade */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span className="rounded-lg bg-zinc-900 border border-zinc-800 px-2 py-1 text-[9px] font-bold text-zinc-300">
                        {supplier.specialty || "Climatização"}
                      </span>
                      {supplier.city && (
                        <span className="rounded-lg bg-zinc-900 border border-zinc-800 px-2 py-1 text-[9px] font-bold text-zinc-400 flex items-center gap-1">
                          <MapPin size={10} className="text-[#d4af37]" />
                          {supplier.city}/{supplier.state || "SP"}
                        </span>
                      )}
                    </div>

                    {/* Contatos */}
                    <div className="space-y-1.5 border-t border-zinc-800/80 pt-3 text-[11px] text-zinc-400">
                      <p className="flex items-center gap-2 truncate">
                        <Phone size={12} className="text-zinc-500 shrink-0" />
                        <span>{supplier.phone}</span>
                      </p>
                      <p className="flex items-center gap-2 truncate">
                        <Mail size={12} className="text-zinc-500 shrink-0" />
                        <span className="truncate">{supplier.email}</span>
                      </p>
                      {supplier.pixKey && (
                        <p className="flex items-center gap-2 truncate text-[10px] text-[#e6c653]">
                          <CreditCard size={12} className="shrink-0" />
                          <span className="font-mono truncate">PIX: {supplier.pixKey}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Rodapé de Ações do Cartão */}
                  <div className="flex items-center gap-2 pt-3 border-t border-zinc-800/80">
                    <button
                      onClick={() => {
                        setSelectedProviderDetails(supplier);
                        setDetailTab("GERAL");
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-white/5 hover:bg-white/10 py-2 text-xs font-bold text-zinc-200 transition-colors border border-white/5 cursor-pointer"
                    >
                      <FileText size={13} className="text-[#d4af37]" />
                      <span>Ficha Completa & OS</span>
                    </button>
                    <button
                      onClick={() => handleOpenEdit(supplier)}
                      className="flex items-center justify-center p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors border border-white/5 cursor-pointer"
                      title="Editar cadastro"
                    >
                      <Edit size={14} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* VISÃO 2: GESTÃO DE ORDENS DE SERVIÇO TERCEIRIZADAS */}
      {viewTab === "SERVICOS" && (
        <section className="rounded-3xl border border-zinc-800 bg-[#11141a] p-5 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
            <div>
              <h2 className="text-base font-black text-white">Ordens de Serviço dos Prestadores</h2>
              <p className="text-xs text-zinc-400">
                Controle interno de custos e repasses atribuídos a prestadores cadastrados.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-500">Filtrar por Status:</span>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="rounded-xl border border-zinc-800 bg-[#090b0e] px-3 py-1.5 text-xs font-bold text-white outline-none focus:border-[#d4af37]"
              >
                {["TODOS", "PENDENTE", "AGENDADO", "EXECUCAO", "CONCLUIDO", "LIBERADO", "PAGO"].map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto scrollbar-none">
            <table className="w-full min-w-[1000px] text-left text-xs">
              <thead className="border-b border-zinc-800 bg-[#090b0e] text-[10px] uppercase tracking-wider text-zinc-400">
                <tr>
                  <th className="px-4 py-3">Prestador / Serviço</th>
                  <th className="px-4 py-3">Cliente Solicitante</th>
                  <th className="px-4 py-3">OS / Proposta</th>
                  <th className="px-4 py-3">Execução</th>
                  <th className="px-4 py-3">Custo Interno</th>
                  <th className="px-4 py-3">Venda / Margem</th>
                  <th className="px-4 py-3">Pagamento PIX</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80">
                {filteredJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-white/[.02] transition-colors">
                    <td className="px-4 py-3.5">
                      <p className="font-bold text-white">{job.supplierName}</p>
                      <p className="mt-0.5 max-w-[220px] truncate text-[11px] text-zinc-400">{job.description}</p>
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-zinc-300">{job.clientName}</td>
                    <td className="px-4 py-3.5">
                      <p className="font-bold text-[#e6c653]">{job.osCode}</p>
                      <p className="text-[10px] text-zinc-500">Ref: {job.quoteCode}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`rounded-full border px-2.5 py-0.5 text-[9px] font-black ${executionBadge[job.executionStatus]}`}>
                        {job.executionStatus}
                      </span>
                      {job.scheduledDate && (
                        <p className="mt-1 text-[10px] text-zinc-400 flex items-center gap-1">
                          <CalendarDays size={11} className="text-[#d4af37]" />
                          {formatDate(job.scheduledDate)}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3.5 font-black text-[#e6c653]">{formatCurrency(job.costValue)}</td>
                    <td className="px-4 py-3.5">
                      <p className="text-zinc-300">{formatCurrency(job.saleValue)}</p>
                      <p className="text-[10px] font-bold text-emerald-400">+ {formatCurrency(job.profit)}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`rounded-full border px-2.5 py-0.5 text-[9px] font-black ${executionBadge[job.paymentStatus]}`}>
                        {job.paymentStatus === "PAGO" ? "Repassado" : job.paymentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {job.executionStatus === "PENDENTE" && (
                          <Button size="sm" variant="secondary" disabled={busy === job.id} onClick={() => setJobStatus(job.id, "AGENDADO")}>
                            Agendar
                          </Button>
                        )}
                        {["PENDENTE", "AGENDADO"].includes(job.executionStatus) && (
                          <Button size="sm" variant="secondary" disabled={busy === job.id} onClick={() => setJobStatus(job.id, "EXECUCAO")}>
                            Iniciar
                          </Button>
                        )}
                        {job.executionStatus === "EXECUCAO" && (
                          <Button size="sm" disabled={busy === job.id} onClick={() => setJobStatus(job.id, "CONCLUIDO")}>
                            Concluir
                          </Button>
                        )}
                        {job.executionStatus === "CONCLUIDO" && !job.payableId && (
                          <Button size="sm" className="bg-[#d4af37] text-black font-bold" disabled={busy === job.id} onClick={() => handleGeneratePayable(job.id)}>
                            Liberar Pagamento
                          </Button>
                        )}
                        {busy === job.id && <Loader2 className="animate-spin text-[#d4af37]" size={16} />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!loading && !filteredJobs.length && (
              <p className="py-12 text-center text-xs text-zinc-500">
                Nenhuma ordem de serviço terceirizada vinculada nesta visualização.
              </p>
            )}
          </div>
        </section>
      )}

      {/* MODAL 1: FORMULÁRIO DE CADASTRO E EDIÇÃO COMPLETA DE PRESTADOR */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => busy !== "saving" && setIsModalOpen(false)}
        title={editingProviderId ? "Editar Cadastro do Prestador" : "Cadastrar Prestador Credenciado"}
        size="lg"
      >
        <form onSubmit={handleSubmitForm} className="space-y-4">
          {/* Seção 1: Dados Cadastrais Principais */}
          <div className="space-y-3 bg-[#12151d] p-4 rounded-2xl border border-zinc-800">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#d4af37] block">
              1. Identificação Cadastral
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Nome / Razão Social *"
                required
                disabled={busy === "saving"}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: SILVA REFRIGERACAO LTDA"
              />
              <Input
                label="Nome Fantasia"
                disabled={busy === "saving"}
                value={form.tradeName}
                onChange={(e) => setForm({ ...form, tradeName: e.target.value })}
                placeholder="Ex: Silva Ar Condicionado"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div className="sm:col-span-2 flex items-end gap-2">
                <div className="flex-1">
                  <Input
                    label="CPF ou CNPJ *"
                    required
                    disabled={busy === "saving" || cnpjLoading}
                    placeholder="Apenas números (11 ou 14 dígitos)"
                    value={form.cnpj}
                    onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={cnpjLoading || busy === "saving" || form.cnpj.replace(/\D/g, "").length !== 14}
                  onClick={handleLookupCNPJ}
                  className="bg-[#d4af37]/15 border border-[#d4af37]/40 text-[#e6c653] hover:bg-[#d4af37]/25 h-10 px-3 font-bold text-xs shrink-0"
                  title="Consultar dados da empresa na Receita Federal"
                >
                  {cnpjLoading ? <Loader2 className="animate-spin text-[#d4af37]" size={15} /> : <Search size={15} />}
                  <span className="hidden sm:inline">{cnpjLoading ? "Buscando..." : "Buscar CNPJ"}</span>
                </Button>
              </div>

              <div>
                <Input
                  label="Inscrição Estadual (IE)"
                  disabled={busy === "saving"}
                  placeholder="Isento ou nº da IE"
                  value={form.ie}
                  onChange={(e) => setForm({ ...form, ie: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label="Especialidade Principal"
                value={form.specialty}
                onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                options={[
                  { value: "Climatização & Refrigeração", label: "Climatização & Refrigeração" },
                  { value: "PMOC & Laudos Técnicos", label: "PMOC & Laudos Técnicos" },
                  { value: "Instalação VRF / Chiller", label: "Instalação VRF / Chiller" },
                  { value: "Elétrica & Comandos", label: "Elétrica & Comandos" },
                  { value: "Dutos & Exaustão", label: "Dutos & Exaustão" },
                  { value: "Limpeza & Higienização", label: "Limpeza & Higienização" },
                ]}
              />
            </div>
          </div>

          {/* Seção 2: Contatos e Endereço */}
          <div className="space-y-3 bg-[#12151d] p-4 rounded-2xl border border-zinc-800">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#d4af37] block">
              2. Contatos & Região de Atendimento
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Telefone com DDD / WhatsApp *"
                required
                disabled={busy === "saving"}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="(11) 99999-8888"
              />
              <Input
                label="E-mail *"
                type="email"
                required
                disabled={busy === "saving"}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="prestador@empresa.com.br"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                label="CEP"
                disabled={busy === "saving"}
                value={form.cep}
                onChange={(e) => setForm({ ...form, cep: e.target.value })}
                placeholder="00000-000"
              />
              <Input
                label="Cidade de Atendimento"
                disabled={busy === "saving"}
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="São Paulo"
              />
              <Input
                label="Estado (UF)"
                disabled={busy === "saving"}
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                placeholder="SP"
              />
            </div>
          </div>

          {/* Seção 3: Dados Bancários / Chave PIX */}
          <div className="space-y-3 bg-[#12151d] p-4 rounded-2xl border border-zinc-800">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#d4af37] block">
              3. Dados de Pagamento & Chave PIX
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label="Tipo de Chave PIX"
                value={form.pixType}
                onChange={(e) => setForm({ ...form, pixType: e.target.value })}
                options={[
                  { value: "CPF_CNPJ", label: "CPF / CNPJ" },
                  { value: "EMAIL", label: "E-mail" },
                  { value: "TELEFONE", label: "Telefone / Celular" },
                  { value: "ALEATORIA", label: "Chave Aleatória (EVP)" },
                ]}
              />
              <Input
                label="Chave PIX"
                disabled={busy === "saving"}
                value={form.pixKey}
                onChange={(e) => setForm({ ...form, pixKey: e.target.value })}
                placeholder="Informe a chave PIX exata"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                label="Nome do Banco"
                disabled={busy === "saving"}
                value={form.bankName}
                onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                placeholder="Ex: Itaú / Nubank"
              />
              <Input
                label="Agência"
                disabled={busy === "saving"}
                value={form.bankAgency}
                onChange={(e) => setForm({ ...form, bankAgency: e.target.value })}
                placeholder="0001"
              />
              <Input
                label="Conta Corrente"
                disabled={busy === "saving"}
                value={form.bankAccount}
                onChange={(e) => setForm({ ...form, bankAccount: e.target.value })}
                placeholder="12345-6"
              />
            </div>
          </div>

          {/* Seção 4: Observações */}
          <Input
            label="Observações Internas / Certificações"
            disabled={busy === "saving"}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Anotações técnicas, certificações CREA/CFT ou restrições"
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy === "saving"} className="bg-[#d4af37] text-black font-black">
              {busy === "saving" ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
              <span>{editingProviderId ? "Atualizar Cadastro" : "Cadastrar e Salvar no Banco"}</span>
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: FICHA TÉCNICA E HISTÓRICO COMPLETO DO PRESTADOR */}
      {selectedProviderDetails && (
        <Modal
          isOpen={Boolean(selectedProviderDetails)}
          onClose={() => setSelectedProviderDetails(null)}
          title={`Ficha Técnica — ${selectedProviderDetails.name}`}
          size="lg"
        >
          <div className="space-y-5 text-zinc-100">
            {/* Header da Ficha */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#12151d] p-4 rounded-2xl border border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#d4af37] to-[#8d701a] text-black font-black text-base">
                  {selectedProviderDetails.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-black text-white">{selectedProviderDetails.name}</h3>
                  <p className="text-xs text-zinc-400">
                    CPF/CNPJ: <span className="font-mono text-zinc-200">{selectedProviderDetails.cnpj}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    handleOpenEdit(selectedProviderDetails);
                  }}
                >
                  <Edit size={14} /> Editar
                </Button>
              </div>
            </div>

            {/* Abas da Ficha do Prestador */}
            <div className="flex border-b border-zinc-800 gap-2">
              <button
                onClick={() => setDetailTab("GERAL")}
                className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                  detailTab === "GERAL"
                    ? "border-[#d4af37] text-[#d4af37]"
                    : "border-transparent text-zinc-400 hover:text-white"
                }`}
              >
                Visão Geral & Cadastro
              </button>
              <button
                onClick={() => setDetailTab("HISTORICO")}
                className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                  detailTab === "HISTORICO"
                    ? "border-[#d4af37] text-[#d4af37]"
                    : "border-transparent text-zinc-400 hover:text-white"
                }`}
              >
                Histórico de OS Atribuídas
              </button>
              <button
                onClick={() => setDetailTab("FINANCEIRO")}
                className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                  detailTab === "FINANCEIRO"
                    ? "border-[#d4af37] text-[#d4af37]"
                    : "border-transparent text-zinc-400 hover:text-white"
                }`}
              >
                Dados Bancários & Repasses
              </button>
            </div>

            {/* ABA GERAL */}
            {detailTab === "GERAL" && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-[#12151d] p-3.5 rounded-xl border border-zinc-800 space-y-1">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase">Especialidade</span>
                    <p className="font-bold text-zinc-200">{selectedProviderDetails.specialty || "Climatização"}</p>
                  </div>
                  <div className="bg-[#12151d] p-3.5 rounded-xl border border-zinc-800 space-y-1">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase">Região de Atendimento</span>
                    <p className="font-bold text-zinc-200">
                      {selectedProviderDetails.city || "Não informada"}/{selectedProviderDetails.state || "SP"}
                    </p>
                  </div>
                </div>

                <div className="bg-[#12151d] p-4 rounded-xl border border-zinc-800 space-y-2">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase">Contatos Rápidos</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-zinc-300">
                    <div className="flex items-center gap-2">
                      <Phone size={14} className="text-[#d4af37]" />
                      <span>{selectedProviderDetails.phone}</span>
                    </div>
                    <div className="flex items-center gap-2 truncate">
                      <Mail size={14} className="text-[#d4af37]" />
                      <span className="truncate">{selectedProviderDetails.email}</span>
                    </div>
                  </div>
                </div>

                {selectedProviderDetails.customNotes && (
                  <div className="bg-[#12151d] p-4 rounded-xl border border-zinc-800 space-y-1">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase">Observações Internas</span>
                    <p className="text-zinc-300 whitespace-pre-wrap">{selectedProviderDetails.customNotes}</p>
                  </div>
                )}
              </div>
            )}

            {/* ABA HISTÓRICO DE OS */}
            {detailTab === "HISTORICO" && (
              <div className="space-y-3 text-xs">
                {(() => {
                  const providerJobs = data.jobs.filter((j) => j.supplierId === selectedProviderDetails.id);
                  if (providerJobs.length === 0) {
                    return <p className="py-8 text-center text-zinc-500">Nenhuma OS atribuída a este prestador ainda.</p>;
                  }
                  return (
                    <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-none pr-1">
                      {providerJobs.map((job) => (
                        <div key={job.id} className="bg-[#12151d] p-3.5 rounded-xl border border-zinc-800 flex items-center justify-between gap-3">
                          <div>
                            <span className="font-bold text-[#e6c653]">{job.osCode}</span>
                            <p className="font-semibold text-zinc-200 mt-0.5">{job.description}</p>
                            <p className="text-[10px] text-zinc-500">Cliente: {job.clientName}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-black text-[#e6c653]">{formatCurrency(job.costValue)}</p>
                            <span className={`rounded-full border px-2 py-0.5 text-[8px] font-black ${executionBadge[job.executionStatus]}`}>
                              {job.executionStatus}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* ABA DADOS BANCÁRIOS */}
            {detailTab === "FINANCEIRO" && (
              <div className="space-y-4 text-xs">
                <div className="bg-[#12151d] p-4 rounded-2xl border border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase">Chave PIX para Transmissão</span>
                    {selectedProviderDetails.pixKey && (
                      <button
                        onClick={() => handleCopyPix(selectedProviderDetails.pixKey)}
                        className="flex items-center gap-1 text-[11px] font-bold text-[#d4af37] hover:underline cursor-pointer"
                      >
                        {copiedPix ? <Check size={13} /> : <Copy size={13} />}
                        <span>{copiedPix ? "Copiado!" : "Copiar Chave"}</span>
                      </button>
                    )}
                  </div>
                  <p className="text-base font-black font-mono text-[#e6c653]">
                    {selectedProviderDetails.pixKey || "Nenhuma chave PIX cadastrada"}
                  </p>
                  <p className="text-[10px] text-zinc-500">
                    Tipo de Chave: {selectedProviderDetails.pixType || "CPF / CNPJ"}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-[#12151d] p-3.5 rounded-xl border border-zinc-800 space-y-1">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase">Banco</span>
                    <p className="font-bold text-zinc-200">{selectedProviderDetails.bankName || "Não informado"}</p>
                  </div>
                  <div className="bg-[#12151d] p-3.5 rounded-xl border border-zinc-800 space-y-1">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase">Agência</span>
                    <p className="font-bold text-zinc-200">{selectedProviderDetails.bankAgency || "Não informada"}</p>
                  </div>
                  <div className="bg-[#12151d] p-3.5 rounded-xl border border-zinc-800 space-y-1">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase">Conta Corrente</span>
                    <p className="font-bold text-zinc-200">{selectedProviderDetails.bankAccount || "Não informada"}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Footer do Modal */}
            <div className="pt-3 border-t border-zinc-800 flex justify-end">
              <Button variant="secondary" onClick={() => setSelectedProviderDetails(null)}>
                Fechar Ficha
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
