"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useToast } from "@/components/ui/Toast";
import {
  createManualServiceOrder,
  createMonthlyContractPreventive,
  createQuickCompletedServiceOrder,
  deleteServiceOrder,
  getContractOperationsOverview,
  getServiceOrders,
} from "@/app/actions/osActions";
import { getClientDetails, getClients } from "@/app/actions/clientActions";
import { getInsightsForModule } from "@/app/actions/insightsActions";
import { formatCurrency, formatDate } from "@/lib/utils";
import { parseAppLink } from "@/lib/searchNavigation";
import { Select } from "../ui/Select";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Textarea } from "../ui/Textarea";
import { InsightBar, Insight } from "../ui/InsightBar";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  FileText,
  Link2,
  Loader2,
  MapPin,
  PlayCircle,
  Plus,
  Search,
  ShieldCheck,
  Store,
  Trash2,
  User,
  Wrench,
  Zap,
} from "lucide-react";
import { StatusBadge } from "../ui/StatusBadge";
import {
  getServiceChecklistTemplate,
  SERVICE_MODALITIES,
} from "@/lib/serviceChecklistTemplates";

interface OrdensServicoTabProps {
  newRecord?: boolean;
  requestId?: string;
  clientId?: string;
  contractId?: string;
  addressId?: string;
  initialType?: string;
  statusFilter?: string;
}

export default function OrdensServicoTab({
  newRecord = false,
  requestId,
  clientId,
  contractId,
  addressId,
  initialType,
  statusFilter,
}: OrdensServicoTabProps) {
  const { hasPermission } = useAuth();
  const { openDrawer, openTab } = useWorkspace();
  const { toast } = useToast();

  const [orders, setOrders] = useState<any[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(statusFilter || "");
  const [originFilter, setOriginFilter] = useState("ALL");
  const [viewMode, setViewMode] = useState<"orders" | "contracts">("orders");
  const [referenceMonth, setReferenceMonth] = useState(
    new Date().toISOString().slice(0, 7),
  );
  const [contractOperations, setContractOperations] = useState<any[]>([]);
  const [contractLoading, setContractLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(newRecord);
  const [createMode, setCreateMode] = useState<"OPERACIONAL" | "RAPIDO">(
    "OPERACIONAL",
  );
  const [showAdvancedFields, setShowAdvancedFields] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [osToDelete, setOsToDelete] = useState<any | null>(null);
  const [form, setForm] = useState({
    clientId: clientId || "",
    contractId: contractId || "",
    addressId: addressId || "",
    contactId: "",
    type: initialType || "CORRETIVA",
    serviceCategory: "GERAL",
    priority: "MEDIA",
    problemReported: "",
    technicalDiagnosis: "",
    value: "",
    purchaseOrder: "",
    notes: "",
    referenceMonth: new Date().toISOString().slice(0, 7),
  });

  useEffect(() => {
    setIsCreateOpen(newRecord);
  }, [newRecord, requestId]);

  useEffect(() => {
    if (!isCreateOpen) return;
    getClients().then((list) => {
      setClients(list);
      setForm((current) => ({ ...current, clientId: current.clientId }));
    });
  }, [isCreateOpen]);

  useEffect(() => {
    if (!form.clientId || !isCreateOpen) {
      setAddresses([]);
      setContacts([]);
      setContracts([]);
      return;
    }
    getClientDetails(form.clientId).then((details) => {
      const nextAddresses = details?.addresses || [];
      const nextContacts = details?.contacts || [];
      setAddresses(nextAddresses);
      setContacts(nextContacts);
      setContracts(
        (details?.contracts || []).filter((item: any) =>
          ["ATIVO", "PROVISORIO"].includes(item.status),
        ),
      );
      setForm((current) => ({
        ...current,
        addressId: nextAddresses.some((item) => item.id === current.addressId)
          ? current.addressId
          : nextAddresses[0]?.id || "",
        contactId: nextContacts.some((item) => item.id === current.contactId)
          ? current.contactId
          : "",
      }));
    });
  }, [form.clientId, isCreateOpen]);

  async function loadContractOperations() {
    setContractLoading(true);
    try {
      setContractOperations(
        await getContractOperationsOverview(referenceMonth),
      );
    } catch (error) {
      console.error(error);
      toast("Erro ao carregar o controle dos contratos.", "error");
    } finally {
      setContractLoading(false);
    }
  }

  useEffect(() => {
    if (viewMode !== "contracts") return;
    void loadContractOperations();
  }, [viewMode, referenceMonth]);

  const handleGenerateMonthlyPreventive = async (operation: any) => {
    setActionLoading(true);
    try {
      const result = await createMonthlyContractPreventive(
        operation.id,
        referenceMonth,
      );
      if (!result.success || !result.serviceOrder) {
        toast(
          result.error || "Não foi possível gerar a visita preventiva.",
          "error",
        );
        return;
      }
      toast(
        result.created
          ? `Preventiva ${result.serviceOrder.code} criada para esta competência.`
          : `A competência já possui a OS ${result.serviceOrder.code}.`,
        result.created ? "success" : "warning",
      );
      await loadContractOperations();
      if (result.created)
        openTab("ordens-servico", result.serviceOrder.code, {
          id: result.serviceOrder.id,
        });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setActionLoading(true);
    try {
      const result =
        createMode === "RAPIDO"
          ? await createQuickCompletedServiceOrder({
              clientId: form.clientId,
              addressId: form.addressId,
              contactId: form.contactId,
              type: form.type,
              serviceCategory: form.serviceCategory,
              priority: form.priority,
              serviceDescription: form.problemReported,
              technicalDiagnosis: form.technicalDiagnosis,
              value: Number(form.value || 0),
              purchaseOrder: form.purchaseOrder,
              notes: form.notes,
            })
          : await createManualServiceOrder(form);
      if (!result.success || !result.os) {
        toast(result.error || "Não foi possível criar a OS.", "error");
        return;
      }
      toast(
        createMode === "RAPIDO"
          ? `Atendimento ${result.os.code} registrado. Complete o relatório para faturar.`
          : `OS ${result.os.code} criada e pronta para agendamento.`,
        "success",
      );
      setIsCreateOpen(false);
      await loadOrders();
      openTab("ordens-servico", result.os.code, {
        id: result.os.id,
        section: createMode === "RAPIDO" ? "relatorio" : undefined,
      });
    } finally {
      setActionLoading(false);
    }
  };

  async function loadOrders() {
    setLoading(true);
    try {
      let data = await getServiceOrders({
        search,
        status: status || undefined,
      });
      if (clientId) {
        data = data.filter((o: any) => o.clientId === clientId);
      }
      setOrders(data);
    } catch (err) {
      console.error(err);
      toast("Erro ao carregar Ordens de Serviço", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      loadOrders();
    }, 0);
    return () => clearTimeout(timer);
  }, [search, status, clientId]);

  useEffect(() => {
    getInsightsForModule("ordens-servico")
      .then((data) =>
        setInsights(
          data.map((i) => ({
            id: i.id,
            severity: i.severity,
            message: i.message,
            onClick: i.link
              ? () => {
                  const { params } = parseAppLink(i.link!);
                  setStatus(params.status || "");
                }
              : undefined,
          })),
        ),
      )
      .catch(() => {});
  }, []);

  const visibleOrders = orders.filter(
    (order) => originFilter === "ALL" || order.operationKind === originFilter,
  );
  const closedStatuses = new Set([
    "CONCLUIDA",
    "RELATORIO_ENVIADO",
    "FATURAMENTO",
    "FATURADA",
    "CANCELADA",
  ]);
  const openOrders = orders.filter(
    (order) => !closedStatuses.has(order.status),
  );
  const todayKey = new Date().toISOString().slice(0, 10);
  const scheduledToday = openOrders.filter(
    (order) =>
      order.scheduledDate &&
      new Date(order.scheduledDate).toISOString().slice(0, 10) === todayKey,
  ).length;
  const inExecution = openOrders.filter((order) =>
    [
      "DESLOCAMENTO",
      "EXECUCAO",
      "PAUSADA",
      "AGUARDANDO_PECA",
      "AGUARDANDO_CLIENTE",
    ].includes(order.status),
  ).length;
  const waitingSchedule = openOrders.filter((order) =>
    ["CRIADA", "AGUARDANDO_AGENDAMENTO"].includes(order.status),
  ).length;
  const overdueOrders = openOrders.filter(
    (order) =>
      order.scheduledDate &&
      new Date(order.scheduledDate) < new Date() &&
      new Date(order.scheduledDate).toISOString().slice(0, 10) !== todayKey,
  ).length;

  return (
    <div className="os-tab space-y-6 select-none animate-in fade-in duration-200">
      <section className="flex flex-col gap-4 rounded-[22px] border border-slate-200/80 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,.05)] dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.2em] text-blue-600">
            Operação técnica
          </p>
          <h1 className="mt-1 text-xl font-black tracking-tight text-zinc-950 dark:text-white">
            Ordens de serviço e contratos
          </h1>
          <p className="mt-1 text-xs font-medium text-zinc-500">
            Controle atendimentos avulsos, visitas mensais e chamados de cada
            loja.
          </p>
        </div>
        <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-zinc-700 dark:bg-zinc-800">
          <button
            type="button"
            onClick={() => setViewMode("orders")}
            className={`flex h-10 items-center gap-2 rounded-lg px-4 text-xs font-black transition ${viewMode === "orders" ? "bg-white text-blue-700 shadow-sm dark:bg-zinc-900 dark:text-blue-300" : "text-zinc-500"}`}
          >
            <ClipboardList size={15} /> Todas as OS
          </button>
          <button
            type="button"
            onClick={() => setViewMode("contracts")}
            className={`flex h-10 items-center gap-2 rounded-lg px-4 text-xs font-black transition ${viewMode === "contracts" ? "bg-white text-blue-700 shadow-sm dark:bg-zinc-900 dark:text-blue-300" : "text-zinc-500"}`}
          >
            <ShieldCheck size={15} /> Contratos & Preventivas
          </button>
        </div>
      </section>

      {viewMode === "orders" ? (
        <div className="space-y-5">
          <section className="grid grid-cols-2 gap-3 xl:grid-cols-5">
            {[
              {
                label: "OS em aberto",
                value: openOrders.length,
                detail: "carteira operacional",
                icon: <ClipboardList size={18} />,
                color: "bg-blue-50 text-blue-600 dark:bg-blue-950/30",
              },
              {
                label: "Programadas hoje",
                value: scheduledToday,
                detail: "agenda do dia",
                icon: <CalendarCheck size={18} />,
                color: "bg-cyan-50 text-cyan-600 dark:bg-cyan-950/30",
              },
              {
                label: "Em execução",
                value: inExecution,
                detail: "equipes em campo",
                icon: <PlayCircle size={18} />,
                color: "bg-violet-50 text-violet-600 dark:bg-violet-950/30",
              },
              {
                label: "Sem agendamento",
                value: waitingSchedule,
                detail: "aguardando programação",
                icon: <CalendarClock size={18} />,
                color: "bg-amber-50 text-amber-600 dark:bg-amber-950/30",
              },
              {
                label: "Atrasadas",
                value: overdueOrders,
                detail: overdueOrders ? "exigem atenção" : "operação em dia",
                icon: <AlertTriangle size={18} />,
                color: overdueOrders
                  ? "bg-rose-50 text-rose-600 dark:bg-rose-950/30"
                  : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30",
              },
            ].map((metric) => (
              <article
                key={metric.label}
                className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,.05)] dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${metric.color}`}
                  >
                    {metric.icon}
                  </span>
                  <span className="text-right text-[9px] font-black uppercase tracking-wider text-zinc-400">
                    {metric.label}
                  </span>
                </div>
                <p className="mt-3 text-2xl font-black tracking-tight text-zinc-950 dark:text-white">
                  {metric.value}
                </p>
                <p className="mt-1 text-[10px] font-semibold text-zinc-400">
                  {metric.detail}
                </p>
              </article>
            ))}
          </section>

          {insights.length > 0 && <InsightBar insights={insights} />}

          <section className="rounded-[22px] border border-slate-200/80 bg-white p-3 shadow-[0_10px_30px_rgba(15,23,42,.05)] dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <label className="relative min-w-0 flex-1">
                <Search
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
                  size={17}
                />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por OS, loja, cliente ou serviço..."
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-semibold text-zinc-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </label>
              <div className="min-w-[205px]">
                <Select
                  options={[
                    { value: "", label: "Todos os status" },
                    { value: "ATRASADA", label: "Atrasadas" },
                    { value: "CRIADA", label: "Criada" },
                    {
                      value: "AGUARDANDO_AGENDAMENTO",
                      label: "Aguardando agendamento",
                    },
                    { value: "AGENDADA", label: "Agendada" },
                    { value: "DESLOCAMENTO", label: "Em deslocamento" },
                    { value: "EXECUCAO", label: "Em execução" },
                    { value: "PAUSADA", label: "Pausada" },
                    { value: "AGUARDANDO_PECA", label: "Aguardando peça" },
                    {
                      value: "AGUARDANDO_CLIENTE",
                      label: "Aguardando cliente",
                    },
                    { value: "RETORNO", label: "Retorno necessário" },
                    { value: "CONCLUIDA", label: "Concluída" },
                    { value: "REVISAO", label: "Em revisão" },
                    { value: "RELATORIO_ENVIADO", label: "Relatório aprovado" },
                    { value: "FATURAMENTO", label: "Aguardando NF" },
                    { value: "FATURADA", label: "Faturada" },
                    { value: "CANCELADA", label: "Cancelada" },
                  ]}
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                />
              </div>
              <div className="min-w-[200px]">
                <Select
                  options={[
                    { value: "ALL", label: "Todas as origens" },
                    { value: "AVULSA", label: "Atendimentos avulsos" },
                    {
                      value: "VISITA_PREVENTIVA",
                      label: "Preventivas contratuais",
                    },
                    {
                      value: "CHAMADO_CONTRATO",
                      label: "Chamados de contrato",
                    },
                  ]}
                  value={originFilter}
                  onChange={(event) => setOriginFilter(event.target.value)}
                />
              </div>
              {hasPermission("os.write") && (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setCreateMode("RAPIDO");
                      setShowAdvancedFields(false);
                      setIsCreateOpen(true);
                    }}
                    className="h-11 border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-300"
                  >
                    <Zap size={16} /> Atendimento rápido
                  </Button>
                  <Button
                    onClick={() => {
                      setCreateMode("OPERACIONAL");
                      setShowAdvancedFields(false);
                      setIsCreateOpen(true);
                    }}
                    className="h-11"
                  >
                    <Plus size={16} /> Nova ordem
                  </Button>
                </div>
              )}
            </div>
          </section>

          {loading ? (
            <div className="flex min-h-[360px] items-center justify-center gap-3 text-sm font-bold text-zinc-500">
              <Loader2 className="animate-spin text-blue-600" /> Carregando
              ordens de serviço...
            </div>
          ) : visibleOrders.length === 0 ? (
            <section className="rounded-[22px] border-2 border-dashed border-slate-200 bg-white py-16 text-center dark:border-zinc-800 dark:bg-zinc-900">
              <Wrench className="mx-auto text-zinc-300" size={36} />
              <p className="mt-3 text-sm font-black text-zinc-700 dark:text-zinc-200">
                Nenhuma OS encontrada
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                Ajuste os filtros ou crie uma nova ordem de serviço.
              </p>
            </section>
          ) : (
            <section className="space-y-3">
              {visibleOrders.map((os) => {
                const technicians =
                  os.technicians
                    ?.map((item: any) => item.name || item.technician?.name)
                    .filter(Boolean)
                    .join(", ") ||
                  os.technicianName ||
                  "Equipe não atribuída";
                const isOverdue =
                  !closedStatuses.has(os.status) &&
                  os.scheduledDate &&
                  new Date(os.scheduledDate) < new Date() &&
                  new Date(os.scheduledDate).toISOString().slice(0, 10) !==
                    todayKey;
                const originStyle =
                  os.operationKind === "VISITA_PREVENTIVA"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
                    : os.operationKind === "CHAMADO_CONTRATO"
                      ? "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-300"
                      : "border-slate-200 bg-slate-50 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800";
                return (
                  <article
                    key={os.id}
                    onClick={() => openDrawer("os", `OS ${os.code}`, os)}
                    onDoubleClick={() =>
                      openTab("ordens-servico", os.code, { id: os.id })
                    }
                    className="group cursor-pointer overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-[0_7px_22px_rgba(15,23,42,.045)] transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-[0_12px_30px_rgba(37,99,235,.09)] dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div className="flex flex-col xl:flex-row xl:items-stretch">
                      <div
                        className={`h-1.5 w-full xl:h-auto xl:w-1.5 ${os.priority === "URGENTE" ? "bg-rose-600" : os.priority === "ALTA" ? "bg-orange-500" : os.operationKind === "VISITA_PREVENTIVA" ? "bg-emerald-500" : "bg-blue-600"}`}
                      />
                      <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 sm:p-5 xl:flex-row xl:items-center">
                        <div className="flex min-w-0 items-start gap-3 xl:w-[32%]">
                          <span
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${os.operationKind === "VISITA_PREVENTIVA" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30" : os.operationKind === "CHAMADO_CONTRATO" ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30" : "bg-blue-50 text-blue-600 dark:bg-blue-950/30"}`}
                          >
                            {os.operationKind === "VISITA_PREVENTIVA" ? (
                              <CalendarCheck size={20} />
                            ) : (
                              <Wrench size={20} />
                            )}
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-[11px] font-black text-blue-700 dark:text-blue-300">
                                {os.code}
                              </span>
                              <span
                                className={`rounded-full border px-2 py-0.5 text-[8px] font-black uppercase ${originStyle}`}
                              >
                                {os.operationKind === "VISITA_PREVENTIVA"
                                  ? "Preventiva"
                                  : os.operationKind === "CHAMADO_CONTRATO"
                                    ? "Chamado contrato"
                                    : "Avulsa"}
                              </span>
                            </div>
                            <h3 className="mt-1.5 truncate text-sm font-black text-zinc-950 dark:text-white">
                              {os.address?.label ||
                                os.client?.name ||
                                os.clientName}
                            </h3>
                            <p className="mt-1 truncate text-[10px] font-semibold text-zinc-400">
                              {os.address?.label
                                ? os.client?.name || os.clientName
                                : os.problemReported || "Atendimento técnico"}
                            </p>
                          </div>
                        </div>
                        <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
                          <div>
                            <p className="text-[8px] font-black uppercase tracking-wider text-zinc-400">
                              Situação
                            </p>
                            <div className="mt-1.5">
                              <StatusBadge status={os.status} />
                            </div>
                          </div>
                          <div>
                            <p className="text-[8px] font-black uppercase tracking-wider text-zinc-400">
                              Agendamento
                            </p>
                            <p
                              className={`mt-1.5 flex items-center gap-1 text-[10px] font-bold ${isOverdue ? "text-rose-600" : "text-zinc-600 dark:text-zinc-300"}`}
                            >
                              <Clock3 size={11} />{" "}
                              {os.scheduledDate
                                ? formatDate(os.scheduledDate)
                                : "A definir"}
                            </p>
                            {isOverdue && (
                              <span className="mt-1 block text-[8px] font-black uppercase text-rose-500">
                                Atrasada
                              </span>
                            )}
                          </div>
                          <div>
                            <p className="text-[8px] font-black uppercase tracking-wider text-zinc-400">
                              Equipe responsável
                            </p>
                            <p className="mt-1.5 flex items-center gap-1 truncate text-[10px] font-bold text-zinc-600 dark:text-zinc-300">
                              <User size={11} className="shrink-0" />{" "}
                              {technicians}
                            </p>
                          </div>
                          <div>
                            <p className="text-[8px] font-black uppercase tracking-wider text-zinc-400">
                              Valor da OS
                            </p>
                            <p className="mt-1.5 flex items-center gap-1 text-[11px] font-black text-zinc-800 dark:text-white">
                              <CircleDollarSign
                                size={12}
                                className="text-emerald-600"
                              />{" "}
                              {formatCurrency(os.totalValue)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openTab("ordens-servico", os.code, { id: os.id });
                            }}
                            className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 text-[10px] font-black text-blue-700 transition group-hover:border-blue-300 group-hover:bg-blue-600 group-hover:text-white dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300"
                          >
                            Abrir ficha <ArrowRight size={13} />
                          </button>
                          {hasPermission("os.write") && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setOsToDelete(os);
                              }}
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-100 bg-rose-50 text-rose-600 transition hover:bg-rose-600 hover:text-white dark:border-rose-950 dark:bg-rose-950/30"
                              title="Excluir Ordem de Serviço"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          <section className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-[#17130d] via-[#3a2d16] to-[#7a5f1d] p-5 text-white shadow-[0_20px_45px_rgba(88,66,18,.22)] sm:p-6">
            <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-blue-400/20 blur-3xl" />
            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.2em] text-blue-200">
                  <Store size={14} /> Carteira de lojas
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-tight">
                  Controle mensal das preventivas
                </h2>
                <p className="mt-2 max-w-2xl text-xs leading-relaxed text-blue-100/80">
                  Cada cartão representa o contrato de uma loja. Acompanhe a
                  visita obrigatória do mês, chamados, patrimônio mapeado e
                  relatórios.
                </p>
              </div>
              <label className="rounded-xl bg-white/10 p-3 ring-1 ring-white/15">
                <span className="mb-1 block text-[9px] font-black uppercase tracking-wider text-blue-200">
                  Competência
                </span>
                <input
                  type="month"
                  value={referenceMonth}
                  onChange={(event) => setReferenceMonth(event.target.value)}
                  className="bg-transparent text-sm font-black text-white outline-none [color-scheme:dark]"
                />
              </label>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              {
                label: "Lojas acompanhadas",
                value: contractOperations.length,
                detail: "contratos ativos/provisórios",
                icon: <Building2 size={18} />,
                color: "bg-blue-50 text-blue-600",
              },
              {
                label: "Preventivas concluídas",
                value: contractOperations.filter((item) =>
                  [
                    "CONCLUIDA",
                    "RELATORIO_ENVIADO",
                    "FATURAMENTO",
                    "FATURADA",
                  ].includes(item.preventive?.status),
                ).length,
                detail: `na competência ${referenceMonth}`,
                icon: <CheckCircle2 size={18} />,
                color: "bg-emerald-50 text-emerald-600",
              },
              {
                label: "Aguardando visita",
                value: contractOperations.filter((item) => !item.preventive)
                  .length,
                detail: "sem OS preventiva no mês",
                icon: <CalendarClock size={18} />,
                color: "bg-amber-50 text-amber-600",
              },
              {
                label: "Chamados em aberto",
                value: contractOperations.reduce(
                  (sum, item) => sum + item.openCalls,
                  0,
                ),
                detail: "em todas as lojas",
                icon: <AlertTriangle size={18} />,
                color: "bg-rose-50 text-rose-600",
              },
            ].map((metric) => (
              <article
                key={metric.label}
                className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${metric.color}`}
                  >
                    {metric.icon}
                  </span>
                  <span className="text-right text-[9px] font-black uppercase tracking-wider text-zinc-400">
                    {metric.label}
                  </span>
                </div>
                <p className="mt-3 text-2xl font-black text-zinc-950 dark:text-white">
                  {metric.value}
                </p>
                <p className="mt-1 text-[10px] font-semibold text-zinc-400">
                  {metric.detail}
                </p>
              </article>
            ))}
          </section>

          {contractLoading ? (
            <div className="flex min-h-[320px] items-center justify-center gap-3 text-sm font-bold text-zinc-500">
              <Loader2 className="animate-spin text-blue-600" /> Carregando
              contratos e visitas...
            </div>
          ) : contractOperations.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white py-16 text-center dark:border-zinc-800 dark:bg-zinc-900">
              <Store className="mx-auto text-zinc-300" size={34} />
              <p className="mt-3 text-sm font-black text-zinc-700 dark:text-zinc-200">
                Nenhuma loja com contrato operacional
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                Cadastre contratos ativos ou provisórios na Central de
                Preventivas.
              </p>
            </div>
          ) : (
            <section className="grid gap-4 xl:grid-cols-2">
              {contractOperations.map((operation) => {
                const preventiveDone = [
                  "CONCLUIDA",
                  "RELATORIO_ENVIADO",
                  "FATURAMENTO",
                  "FATURADA",
                ].includes(operation.preventive?.status);
                const preventiveScheduled =
                  operation.preventive && !preventiveDone;
                return (
                  <article
                    key={operation.id}
                    className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_10px_28px_rgba(15,23,42,.06)] dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <header className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50/50 p-5 dark:border-zinc-800 dark:from-zinc-900 dark:to-blue-950/20">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="rounded-lg bg-blue-600 px-2 py-1 font-mono text-[9px] font-black text-white">
                              {operation.code}
                            </span>
                            {operation.status === "PROVISORIO" && (
                              <span className="rounded-full bg-amber-100 px-2 py-1 text-[9px] font-black uppercase text-amber-700">
                                Provisório
                              </span>
                            )}
                          </div>
                          <h3 className="mt-3 truncate text-lg font-black text-zinc-950 dark:text-white">
                            {operation.address?.label ||
                              operation.client.fancyName ||
                              operation.client.name}
                          </h3>
                          <p className="mt-1 truncate text-xs font-semibold text-zinc-500">
                            {operation.client.name}
                          </p>
                        </div>
                        <span
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${preventiveDone ? "bg-emerald-100 text-emerald-600" : preventiveScheduled ? "bg-blue-100 text-blue-600" : "bg-amber-100 text-amber-600"}`}
                        >
                          {preventiveDone ? (
                            <CheckCircle2 size={21} />
                          ) : (
                            <CalendarCheck size={21} />
                          )}
                        </span>
                      </div>
                      {operation.address && (
                        <p className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold text-zinc-500">
                          <MapPin size={12} /> {operation.address.street},{" "}
                          {operation.address.number} · {operation.address.city}/
                          {operation.address.state}
                        </p>
                      )}
                    </header>
                    <div className="p-5">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-xl bg-slate-50 p-3 dark:bg-zinc-800/60">
                          <p className="text-[9px] font-black uppercase text-zinc-400">
                            Visita do mês
                          </p>
                          <p
                            className={`mt-1 text-xs font-black ${preventiveDone ? "text-emerald-600" : preventiveScheduled ? "text-blue-600" : "text-amber-600"}`}
                          >
                            {preventiveDone
                              ? "Concluída"
                              : preventiveScheduled
                                ? "Em andamento"
                                : "Não gerada"}
                          </p>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-3 dark:bg-zinc-800/60">
                          <p className="text-[9px] font-black uppercase text-zinc-400">
                            Chamados abertos
                          </p>
                          <p
                            className={`mt-1 text-xs font-black ${operation.openCalls ? "text-rose-600" : "text-zinc-700 dark:text-zinc-200"}`}
                          >
                            {operation.openCalls}
                          </p>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-3 dark:bg-zinc-800/60">
                          <p className="text-[9px] font-black uppercase text-zinc-400">
                            Patrimônio
                          </p>
                          <p className="mt-1 text-xs font-black text-zinc-700 dark:text-zinc-200">
                            {operation.assetCount} item(ns)
                          </p>
                        </div>
                      </div>
                      {operation.preventive ? (
                        <button
                          type="button"
                          onClick={() =>
                            openTab(
                              "ordens-servico",
                              operation.preventive.code,
                              {
                                id: operation.preventive.id,
                                section: "relatorio",
                              },
                            )
                          }
                          className="mt-4 flex w-full items-center justify-between rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-left transition hover:border-blue-300 dark:border-blue-900 dark:bg-blue-950/20"
                        >
                          <span>
                            <b className="block font-mono text-[10px] text-blue-700 dark:text-blue-300">
                              {operation.preventive.code}
                            </b>
                            <span className="mt-1 block text-[10px] font-semibold text-zinc-500">
                              Preventiva da competência · clique para executar
                              ou emitir relatório
                            </span>
                          </span>
                          <StatusBadge status={operation.preventive.status} />
                        </button>
                      ) : (
                        <div className="mt-4 rounded-xl border border-dashed border-amber-200 bg-amber-50/50 p-3 text-[10px] font-semibold text-amber-700 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300">
                          Esta loja ainda não possui visita preventiva criada
                          para {referenceMonth}.
                        </div>
                      )}
                      <div className="mt-4 flex flex-wrap gap-2">
                        {!operation.preventive && hasPermission("os.write") && (
                          <Button
                            size="sm"
                            onClick={() =>
                              void handleGenerateMonthlyPreventive(operation)
                            }
                            loading={actionLoading}
                          >
                            <Plus size={14} /> Gerar visita do mês
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            openTab("preventivas", "Central de Preventivas")
                          }
                        >
                          <Link2 size={14} /> Abrir central
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            window.open(
                              `/relatorios/loja/${operation.id}`,
                              "_blank",
                              "noopener,noreferrer",
                            )
                          }
                        >
                          <FileText size={14} /> Dossiê da loja
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setForm((current) => ({
                              ...current,
                              clientId: operation.client.id,
                              contractId: operation.id,
                              addressId: operation.address?.id || "",
                              type: "CORRETIVA",
                              referenceMonth,
                            }));
                            setIsCreateOpen(true);
                          }}
                        >
                          <Wrench size={14} /> Abrir chamado
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>
          )}
        </div>
      )}

      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title={
          createMode === "RAPIDO"
            ? "Registrar Atendimento Rápido"
            : "Nova OS rápida"
        }
        size="lg"
      >
        <form onSubmit={handleCreate} className="space-y-5">
          <div
            className={`rounded-xl border p-3 text-xs ${createMode === "RAPIDO" ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-300" : "border-blue-100 bg-blue-50 text-blue-800 dark:border-blue-950 dark:bg-blue-950/20 dark:text-blue-300"}`}
          >
            {createMode === "RAPIDO" ? (
              <span className="flex items-start gap-2">
                <ClipboardCheck size={16} className="mt-0.5 shrink-0" />
                <span>
                  Use para um serviço avulso <strong>já realizado</strong>. Não
                  exige agenda ou contrato: a OS será concluída e abrirá
                  diretamente no relatório.
                </span>
              </span>
            ) : (
              <span className="flex items-start gap-2"><Zap size={16} className="mt-0.5 shrink-0"/><span>Escolha o cliente, confirme o endereço e descreva o serviço. A OS será criada como <strong>aguardando agendamento</strong>.</span></span>
            )}
          </div>
          <Select
            label="Cliente *"
            required
            value={form.clientId}
            onChange={(e) =>
              setForm((current) => ({
                ...current,
                clientId: e.target.value,
                contractId: "",
                addressId: "",
              }))
            }
            options={clients.map((client) => ({
              value: client.id,
              label: `${client.name} · ${client.cpfCnpj || "Sem documento"}`,
            }))}
          />
          {createMode === "OPERACIONAL" && showAdvancedFields && (
            <div className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/80 to-blue-50/80 p-4 dark:border-indigo-950 dark:from-indigo-950/20 dark:to-blue-950/20">
              <div className="mb-3 flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
                  <ShieldCheck size={17} />
                </span>
                <div>
                  <p className="text-xs font-black text-indigo-950 dark:text-indigo-200">
                    Origem operacional da OS
                  </p>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-indigo-700/70 dark:text-indigo-300/70">
                    Vincule o contrato quando for uma preventiva mensal ou
                    chamado de loja. OS avulsas continuam sem contrato.
                  </p>
                </div>
              </div>
              <Select
                label="Contrato da loja (opcional)"
                value={form.contractId}
                onChange={(event) => {
                  const next = contracts.find(
                    (item) => item.id === event.target.value,
                  );
                  setForm((current) => ({
                    ...current,
                    contractId: event.target.value,
                    addressId: next?.addressId || current.addressId,
                    referenceMonth: current.referenceMonth || referenceMonth,
                  }));
                }}
                options={[
                  { value: "", label: "Atendimento avulso — sem contrato" },
                  ...contracts.map((item) => ({
                    value: item.id,
                    label: `${item.code} · ${addresses.find((address) => address.id === item.addressId)?.label || "Loja ainda não definida"} · ${item.status}`,
                  })),
                ]}
              />
              {form.contractId && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Input
                    label="Competência operacional"
                    type="month"
                    value={form.referenceMonth}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        referenceMonth: event.target.value,
                      }))
                    }
                  />
                  <div className="flex items-center rounded-xl border border-indigo-100 bg-white/70 px-3 text-[10px] font-bold text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-300">
                    Preventiva gera a visita mensal; os demais tipos entram como
                    chamado do contrato.
                  </div>
                </div>
              )}
            </div>
          )}
          <Select
            label={
              createMode === "RAPIDO"
                ? "Local do atendimento (opcional)"
                : "Endereço de execução *"
            }
            required={false}
            value={form.addressId}
            onChange={(e) =>
              setForm((current) => ({ ...current, addressId: e.target.value }))
            }
            options={
              addresses.length
                ? addresses.map((address) => ({
                    value: address.id,
                    label: `${address.label} · ${address.street}, ${address.number} · ${address.city}/${address.state}`,
                  }))
                : [
                    {
                      value: "AUTO_CADASTRO",
                      label: "Endereço do Cadastro (Matriz Principal)",
                    },
                  ]
            }
          />
          {(createMode === "RAPIDO" || showAdvancedFields) && <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Tipo de serviço *"
              value={form.type}
              onChange={(e) =>
                setForm((current) => ({ ...current, type: e.target.value }))
              }
              options={[
                { value: "CORRETIVA", label: "Manutenção corretiva" },
                { value: "PREVENTIVA", label: "Manutenção preventiva" },
                { value: "INSTALACAO", label: "Instalação" },
                { value: "VISITA_TECNICA", label: "Visita técnica" },
                { value: "EMERGENCIA", label: "Emergência" },
                { value: "GARANTIA", label: "Garantia" },
                { value: "RETORNO", label: "Retorno" },
                { value: "LAUDO_TECNICO", label: "Laudo técnico" },
              ]}
            />
            <Select
              label="Prioridade *"
              value={form.priority}
              onChange={(e) =>
                setForm((current) => ({ ...current, priority: e.target.value }))
              }
              options={[
                { value: "BAIXA", label: "Baixa" },
                { value: "MEDIA", label: "Média" },
                { value: "ALTA", label: "Alta" },
                { value: "URGENTE", label: "Urgente" },
              ]}
            />
          </div>}
          {(createMode === "RAPIDO" || showAdvancedFields) && <div className="rounded-2xl border border-teal-100 bg-teal-50/60 p-4 dark:border-teal-950 dark:bg-teal-950/20">
            <Select
              label="Modalidade técnica *"
              value={form.serviceCategory}
              onChange={(e) =>
                setForm((current) => ({
                  ...current,
                  serviceCategory: e.target.value,
                }))
              }
              options={SERVICE_MODALITIES.map((item) => ({
                value: item.value,
                label: item.label,
              }))}
            />
            <div className="mt-3 flex items-start justify-between gap-4 border-t border-teal-100 pt-3 text-xs dark:border-teal-900/50">
              <p className="leading-relaxed text-teal-800 dark:text-teal-300">
                {createMode === "RAPIDO"
                  ? "Classifica o relatório e o serviço para pesquisa. O atendimento rápido não exige checklist operacional."
                  : SERVICE_MODALITIES.find(
                      (item) => item.value === form.serviceCategory,
                    )?.description}
              </p>
              <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-teal-700 shadow-sm dark:bg-teal-950">
                {createMode === "RAPIDO"
                  ? "Relatório direto"
                  : `${getServiceChecklistTemplate(form.serviceCategory).length} verificações`}
              </span>
            </div>
          </div>}
          {(createMode === "RAPIDO" || showAdvancedFields) && <Select
            label="Contato responsável (opcional)"
            value={form.contactId}
            onChange={(e) =>
              setForm((current) => ({ ...current, contactId: e.target.value }))
            }
            options={[
              { value: "", label: "Contato principal do cliente" },
              ...contacts.map((contact) => ({
                value: contact.id,
                label: `${contact.name} · ${contact.phone}`,
              })),
            ]}
          />}
          <Textarea
            label={
              createMode === "RAPIDO"
                ? "Serviço executado / descrição do relatório *"
                : "Serviço solicitado / problema relatado *"
            }
            required
            rows={4}
            value={form.problemReported}
            onChange={(e) =>
              setForm((current) => ({
                ...current,
                problemReported: e.target.value,
              }))
            }
            placeholder={
              createMode === "RAPIDO"
                ? "Descreva objetivamente o que foi executado..."
                : "Descreva com clareza o que deve ser executado..."
            }
          />
          {createMode === "RAPIDO" && (
            <>
              <Textarea
                label="Diagnóstico técnico / resultado encontrado *"
                required
                rows={3}
                value={form.technicalDiagnosis}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    technicalDiagnosis: e.target.value,
                  }))
                }
                placeholder="Informe o problema encontrado, testes realizados e condição final..."
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Valor do atendimento (R$) *"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={form.value}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      value: e.target.value,
                    }))
                  }
                  placeholder="0,00"
                />
                <Input
                  label="Pedido de compra / referência"
                  value={form.purchaseOrder}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      purchaseOrder: e.target.value,
                    }))
                  }
                  placeholder="Ex.: PC-12345"
                />
              </div>
            </>
          )}
          {(createMode === "RAPIDO" || showAdvancedFields) && <Input
            label="Observações internas"
            value={form.notes}
            onChange={(e) =>
              setForm((current) => ({ ...current, notes: e.target.value }))
            }
          />}
          {createMode === "OPERACIONAL" && <button type="button" onClick={() => setShowAdvancedFields((value) => !value)} className="flex w-full items-center justify-between rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-3 text-left text-xs font-bold text-zinc-600 transition hover:border-[#155eef] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"><span>{showAdvancedFields ? "Ocultar opções avançadas" : "Adicionar contrato, prioridade, modalidade ou observações"}</span><Plus size={15} className={`transition-transform ${showAdvancedFields ? "rotate-45" : ""}`}/></button>}
          <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsCreateOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant={createMode === "RAPIDO" ? "success" : "primary"}
              loading={actionLoading}
            >
              {createMode === "RAPIDO"
                ? "Criar e abrir relatório"
                : "Criar OS"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal de Confirmação de Exclusão de OS */}
      <Modal
        isOpen={Boolean(osToDelete)}
        onClose={() => setOsToDelete(null)}
        title="Excluir Ordem de Serviço"
        size="md"
      >
        {osToDelete && (
          <div className="space-y-4">
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-900 dark:border-rose-950 dark:bg-rose-950/30 dark:text-rose-200">
              <strong className="block text-sm">Atenção: Exclusão Permanente</strong>
              <p className="mt-1">
                Tem certeza que deseja excluir a <strong>{osToDelete.code}</strong> ({osToDelete.clientName || osToDelete.client?.name})? Todos os histórico, materiais, visitas e fotos vinculados serão removidos.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setOsToDelete(null)}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                loading={actionLoading}
                onClick={async () => {
                  setActionLoading(true);
                  try {
                    const res = await deleteServiceOrder(osToDelete.id);
                    if (!res.success) {
                      toast(res.error || "Não foi possível excluir a OS.", "error");
                      return;
                    }
                    toast(`Ordem de Serviço ${osToDelete.code} excluída com sucesso!`, "success");
                    setOsToDelete(null);
                    await loadOrders();
                  } finally {
                    setActionLoading(false);
                  }
                }}
              >
                <Trash2 size={14} /> Confirmar Exclusão
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
