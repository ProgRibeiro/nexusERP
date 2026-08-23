"use client";

import React, { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useToast } from "@/components/ui/Toast";
import {
  addCrmActivity,
  convertLeadToQuote,
  createLead,
  getCrmPipeline,
  LeadDTO,
  moveLead,
  PipelineStageDTO,
  setCrmActivityDone,
  updateLead,
} from "@/app/actions/crmActions";
import { formatCurrency, formatDateTime, formatPhone } from "@/lib/utils";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Modal } from "../ui/Modal";
import { Drawer } from "../ui/Drawer";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Calendar,
  CalendarClock,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Edit3,
  FileText,
  Flame,
  GripVertical,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  Search,
  Target,
  TrendingUp,
  User,
  Users,
} from "lucide-react";

interface CrmTabProps {
  newRecord?: boolean;
  requestId?: string;
}

type LeadForm = {
  name: string;
  email: string;
  phone: string;
  company: string;
  value: string;
  source: string;
  ownerId: string;
  notes: string;
  closePrediction: string;
};

const emptyLeadForm: LeadForm = {
  name: "",
  email: "",
  phone: "",
  company: "",
  value: "",
  source: "Indicação",
  ownerId: "",
  notes: "",
  closePrediction: "",
};

const stageStyles = [
  {
    dot: "bg-sky-500",
    bar: "bg-sky-500",
    badge: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  },
  {
    dot: "bg-cyan-500",
    bar: "bg-cyan-500",
    badge: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300",
  },
  {
    dot: "bg-violet-500",
    bar: "bg-violet-500",
    badge:
      "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  },
  {
    dot: "bg-amber-500",
    bar: "bg-amber-500",
    badge:
      "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  },
  {
    dot: "bg-fuchsia-500",
    bar: "bg-fuchsia-500",
    badge:
      "bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950/40 dark:text-fuchsia-300",
  },
  {
    dot: "bg-blue-600",
    bar: "bg-blue-600",
    badge: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  },
  {
    dot: "bg-orange-500",
    bar: "bg-orange-500",
    badge:
      "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
  },
  {
    dot: "bg-emerald-500",
    bar: "bg-emerald-500",
    badge:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  {
    dot: "bg-rose-500",
    bar: "bg-rose-500",
    badge: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  },
];

const activityIcons: Record<string, React.ReactNode> = {
  LIGACAO: <Phone size={14} />,
  WHATSAPP: <MessageCircle size={14} />,
  EMAIL: <Mail size={14} />,
  REUNIAO: <Users size={14} />,
  VISITA: <Calendar size={14} />,
  NOTA: <FileText size={14} />,
  ETAPA: <TrendingUp size={14} />,
};

function dateInputValue(date: Date | string | null) {
  if (!date) return "";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function getLeadForm(lead?: LeadDTO | null): LeadForm {
  if (!lead) return { ...emptyLeadForm };
  return {
    name: lead.name,
    email: lead.email || "",
    phone: lead.phone,
    company: lead.company || "",
    value: String(lead.value || ""),
    source: lead.source || "",
    ownerId: lead.ownerId || "",
    notes: lead.notes || "",
    closePrediction: dateInputValue(lead.closePrediction),
  };
}

export default function CrmTab({ newRecord = false, requestId }: CrmTabProps) {
  const pathname = usePathname();
  const { user: currentUser, users: systemUsers, hasPermission } = useAuth();
  const { openTab } = useWorkspace();
  const { toast } = useToast();
  const [pipeline, setPipeline] = useState<PipelineStageDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(newRecord);
  const [editingLead, setEditingLead] = useState<LeadDTO | null>(null);
  const [selectedLead, setSelectedLead] = useState<LeadDTO | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [leadForm, setLeadForm] = useState<LeadForm>(emptyLeadForm);
  const [activityForm, setActivityForm] = useState({
    type: "LIGACAO",
    description: "",
    date: new Date().toISOString().slice(0, 16),
    done: true,
  });
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("ALL");
  const [onlyPending, setOnlyPending] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [movingLeadId, setMovingLeadId] = useState<string | null>(null);
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);

  useEffect(() => {
    if (!newRecord) return;
    setEditingLead(null);
    setLeadForm(getLeadForm());
    setIsLeadModalOpen(true);
  }, [newRecord, requestId]);

  async function loadPipeline(keepLeadId?: string) {
    setLoading(true);
    try {
      const data = await getCrmPipeline();
      setPipeline(data);
      const id = keepLeadId || selectedLead?.id;
      if (id) {
        const refreshed = data
          .flatMap((stage) => stage.leads)
          .find((lead) => lead.id === id);
        if (refreshed) setSelectedLead(refreshed);
      }
    } catch (error) {
      console.error(error);
      toast("Erro ao carregar o funil comercial.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (pathname !== "/crm") return;
    const timer = window.setTimeout(() => void loadPipeline(), 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const allLeads = useMemo(
    () => pipeline.flatMap((stage) => stage.leads),
    [pipeline],
  );
  const metrics = useMemo(() => {
    const now = new Date();
    const active = allLeads.filter(
      (lead) => !["CONVERTIDO", "PERDIDO"].includes(lead.status),
    );
    const won = allLeads.filter((lead) => lead.status === "CONVERTIDO");
    const closed = allLeads.filter((lead) =>
      ["CONVERTIDO", "PERDIDO"].includes(lead.status),
    );
    const pendingActivities = active.flatMap((lead) =>
      lead.activities.filter((activity) => !activity.done),
    );
    const overdue = pendingActivities.filter(
      (activity) => new Date(activity.date) < now,
    );
    const weighted = pipeline.reduce((sum, stage, index) => {
      if (stage.name.toLowerCase().includes("perd")) return sum;
      const probability = Math.min(
        0.95,
        Math.max(0.1, (index + 1) / Math.max(2, pipeline.length)),
      );
      return (
        sum +
        stage.leads
          .filter((lead) => !["CONVERTIDO", "PERDIDO"].includes(lead.status))
          .reduce((subtotal, lead) => subtotal + lead.value * probability, 0)
      );
    }, 0);
    return {
      activeCount: active.length,
      activeValue: active.reduce((sum, lead) => sum + lead.value, 0),
      weighted,
      conversion: closed.length ? (won.length / closed.length) * 100 : 0,
      overdue: overdue.length,
      pending: pendingActivities.length,
    };
  }, [allLeads, pipeline]);

  const visiblePipeline = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return pipeline.map((stage) => ({
      ...stage,
      leads: stage.leads.filter((lead) => {
        const matchesSearch =
          !term ||
          [lead.name, lead.company, lead.email, lead.phone, lead.source].some(
            (value) => value?.toLocaleLowerCase("pt-BR").includes(term),
          );
        const matchesOwner =
          ownerFilter === "ALL" ||
          (ownerFilter === "ME"
            ? lead.ownerId === currentUser?.id
            : lead.ownerId === ownerFilter);
        const matchesPending =
          !onlyPending || lead.activities.some((activity) => !activity.done);
        return matchesSearch && matchesOwner && matchesPending;
      }),
    }));
  }, [pipeline, search, ownerFilter, onlyPending, currentUser?.id]);

  const openNewLead = () => {
    setEditingLead(null);
    setLeadForm(getLeadForm());
    setIsLeadModalOpen(true);
  };

  const openEditLead = (lead: LeadDTO) => {
    setEditingLead(lead);
    setLeadForm(getLeadForm(lead));
    setIsDetailOpen(false);
    setIsLeadModalOpen(true);
  };

  const handleSaveLead = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!leadForm.name.trim() || !leadForm.phone.trim()) {
      toast("Informe o nome e o telefone da oportunidade.", "warning");
      return;
    }
    setActionLoading(true);
    try {
      const payload = {
        name: leadForm.name.trim(),
        email: leadForm.email.trim(),
        phone: leadForm.phone.trim(),
        company: leadForm.company.trim() || undefined,
        value: Number(leadForm.value) || 0,
        source: leadForm.source || undefined,
        ownerId: leadForm.ownerId || currentUser?.id || undefined,
        notes: leadForm.notes.trim() || undefined,
        closePrediction: leadForm.closePrediction
          ? new Date(`${leadForm.closePrediction}T12:00:00`)
          : null,
      };
      const response = editingLead
        ? await updateLead({ id: editingLead.id, ...payload })
        : await createLead(payload);
      if (!response.success)
        throw new Error(response.error || "Não foi possível salvar.");
      toast(
        editingLead
          ? "Oportunidade atualizada."
          : "Oportunidade criada no funil.",
        "success",
      );
      setIsLeadModalOpen(false);
      setEditingLead(null);
      await loadPipeline(editingLead?.id);
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Erro ao salvar oportunidade.",
        "error",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleMoveLead = async (leadId: string, targetStageId: string) => {
    const sourceStage = pipeline.find((stage) =>
      stage.leads.some((lead) => lead.id === leadId),
    );
    const targetStage = pipeline.find((stage) => stage.id === targetStageId);
    if (!sourceStage || !targetStage || sourceStage.id === targetStage.id)
      return;
    const isBackward = targetStage.order < sourceStage.order;
    if (
      isBackward &&
      !window.confirm(`Voltar esta oportunidade para “${targetStage.name}”?`)
    )
      return;
    setMovingLeadId(leadId);
    try {
      const response = await moveLead(leadId, targetStageId);
      if (!response.success)
        throw new Error(
          response.error || "Não foi possível mover a oportunidade.",
        );
      toast(
        isBackward
          ? `Oportunidade retornada para ${targetStage.name}.`
          : `Oportunidade avançou para ${targetStage.name}.`,
        "success",
      );
      await loadPipeline(leadId);
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Erro ao mover oportunidade.",
        "error",
      );
    } finally {
      setMovingLeadId(null);
      setDraggedLeadId(null);
      setDragOverStageId(null);
    }
  };

  const handleAddActivity = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedLead || !activityForm.description.trim()) return;
    setActionLoading(true);
    try {
      const response = await addCrmActivity({
        leadId: selectedLead.id,
        userId: currentUser?.id || "",
        type: activityForm.type,
        description: activityForm.description.trim(),
        date: new Date(activityForm.date),
        done: activityForm.done,
      });
      if (!response.success)
        throw new Error(
          response.error || "Não foi possível registrar a atividade.",
        );
      toast(
        activityForm.done ? "Interação registrada." : "Próximo passo agendado.",
        "success",
      );
      setActivityForm({
        type: "LIGACAO",
        description: "",
        date: new Date().toISOString().slice(0, 16),
        done: true,
      });
      await loadPipeline(selectedLead.id);
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Erro ao registrar atividade.",
        "error",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleActivity = async (activityId: string, done: boolean) => {
    if (!selectedLead) return;
    const response = await setCrmActivityDone(activityId, done);
    if (!response.success) {
      toast(
        response.error || "Não foi possível atualizar o compromisso.",
        "error",
      );
      return;
    }
    toast(done ? "Compromisso concluído." : "Compromisso reaberto.", "success");
    await loadPipeline(selectedLead.id);
  };

  const handleConvertToQuote = async (leadId: string) => {
    if (
      !window.confirm("Gerar cliente e orçamento a partir desta oportunidade?")
    )
      return;
    setActionLoading(true);
    try {
      const response = await convertLeadToQuote(leadId);
      if (!response.success)
        throw new Error(
          response.error || "Não foi possível gerar o orçamento.",
        );
      toast("Cliente e orçamento criados com sucesso.", "success");
      setIsDetailOpen(false);
      await loadPipeline();
      openTab("orcamentos", "Orçamentos");
    } catch (error) {
      toast(
        error instanceof Error
          ? error.message
          : "Erro ao converter oportunidade.",
        "error",
      );
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="crm-tab space-y-5 pb-8 animate-in fade-in duration-300">
      <section className="relative overflow-hidden rounded-[26px] border border-zinc-200 bg-white px-5 py-6 text-zinc-950 shadow-sm dark:border-blue-500/25 dark:bg-gradient-to-br dark:from-zinc-950 dark:via-[#0b1730] dark:to-[#102a50] dark:text-white dark:shadow-[0_22px_55px_rgba(2,12,27,.35)] sm:px-7">
        <div className="absolute -right-24 -top-28 h-72 w-72 rounded-full bg-blue-400/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-28 w-80 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[.22em] text-blue-600 dark:text-blue-200">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                <Flame size={16} />
              </span>
              Central comercial
            </div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
              CRM e gestão de oportunidades
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-600 dark:text-blue-100/80">
              Acompanhe cada negociação, organize os próximos contatos e
              transforme oportunidades em propostas sem perder o histórico.
            </p>
          </div>
          {hasPermission("crm.write") && (
            <Button
              onClick={openNewLead}
              size="lg"
              className="border border-white/15 bg-white !text-blue-800 shadow-xl hover:!bg-blue-50"
            >
              <Plus size={18} /> Nova oportunidade
            </Button>
          )}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        {[
          {
            label: "Pipeline aberto",
            value: formatCurrency(metrics.activeValue),
            detail: `${metrics.activeCount} oportunidade(s)`,
            icon: <CircleDollarSign size={19} />,
            color: "text-blue-600 bg-blue-50 dark:bg-blue-950/30",
          },
          {
            label: "Previsão ponderada",
            value: formatCurrency(metrics.weighted),
            detail: "estimativa por avanço",
            icon: <TrendingUp size={19} />,
            color: "text-violet-600 bg-violet-50 dark:bg-violet-950/30",
          },
          {
            label: "Conversão",
            value: `${metrics.conversion.toFixed(0)}%`,
            detail: "ganhos entre encerrados",
            icon: <Target size={19} />,
            color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30",
          },
          {
            label: "Próximos passos",
            value: String(metrics.pending),
            detail: "atividades em aberto",
            icon: <CalendarClock size={19} />,
            color: "text-cyan-600 bg-cyan-50 dark:bg-cyan-950/30",
          },
          {
            label: "Atrasados",
            value: String(metrics.overdue),
            detail: metrics.overdue ? "precisam de atenção" : "tudo em dia",
            icon: <AlertTriangle size={19} />,
            color: metrics.overdue
              ? "text-rose-600 bg-rose-50 dark:bg-rose-950/30"
              : "text-zinc-500 bg-zinc-100 dark:bg-zinc-800",
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
            <p className="mt-4 truncate text-xl font-black tracking-tight text-zinc-950 dark:text-white">
              {metric.value}
            </p>
            <p className="mt-1 text-[10px] font-semibold text-zinc-400">
              {metric.detail}
            </p>
          </article>
        ))}
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 lg:flex-row lg:items-center">
        <label className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
            size={17}
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por contato, empresa, telefone, e-mail ou origem..."
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-medium text-zinc-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
        </label>
        <div className="w-full lg:w-64">
          <Select
            value={ownerFilter}
            onChange={(event) => setOwnerFilter(event.target.value)}
            searchPlaceholder="Pesquisar responsável"
            options={[
              { value: "ALL", label: "Todos os responsáveis" },
              { value: "ME", label: "Minhas oportunidades" },
              ...systemUsers.map((user) => ({
                value: user.id,
                label: user.name,
              })),
            ]}
          />
        </div>
        <button
          type="button"
          onClick={() => setOnlyPending((value) => !value)}
          className={`flex h-11 items-center justify-center gap-2 rounded-xl border px-4 text-xs font-bold transition ${onlyPending ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300" : "border-slate-200 text-zinc-500 hover:bg-slate-50 dark:border-zinc-700 dark:hover:bg-zinc-800"}`}
        >
          <Clock3 size={15} /> Com próximo passo
        </button>
      </section>

      {loading ? (
        <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 text-zinc-400">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-xs font-bold">Carregando funil comercial...</p>
        </div>
      ) : (
        <section className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-5">
          {visiblePipeline.map((stage, stageIndex) => {
            const style = stageStyles[stageIndex % stageStyles.length];
            const stageTotal = stage.leads.reduce(
              (sum, lead) => sum + lead.value,
              0,
            );
            return (
              <div
                key={stage.id}
                onDragOver={(event) => {
                  if (!hasPermission("crm.write")) return;
                  event.preventDefault();
                  setDragOverStageId(stage.id);
                }}
                onDragLeave={() =>
                  setDragOverStageId((current) =>
                    current === stage.id ? null : current,
                  )
                }
                onDrop={(event) => {
                  event.preventDefault();
                  const id =
                    event.dataTransfer.getData("text/lead-id") || draggedLeadId;
                  if (id) void handleMoveLead(id, stage.id);
                }}
                className={`flex min-h-[500px] w-[310px] shrink-0 snap-start flex-col overflow-hidden rounded-[20px] border bg-slate-50/70 transition dark:bg-zinc-900/50 ${dragOverStageId === stage.id ? "border-blue-400 ring-4 ring-blue-500/10" : "border-slate-200 dark:border-zinc-800"}`}
              >
                <div className={`h-1 ${style.bar}`} />
                <header className="border-b border-slate-200/80 bg-white/80 p-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="flex min-w-0 items-center gap-2 truncate text-sm font-black text-zinc-900 dark:text-white">
                      <span
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${style.dot}`}
                      />
                      {stage.name}
                    </h2>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-black ${style.badge}`}
                    >
                      {stage.leads.length}
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] font-bold text-zinc-400">
                    {formatCurrency(stageTotal)} nesta etapa
                  </p>
                </header>
                <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-3">
                  {stage.leads.length === 0 ? (
                    <div className="flex flex-1 items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center text-xs font-semibold text-zinc-400 dark:border-zinc-800">
                      Arraste uma oportunidade para esta etapa
                    </div>
                  ) : (
                    stage.leads.map((lead) => {
                      const nextActivity = lead.activities
                        .filter((activity) => !activity.done)
                        .sort(
                          (a, b) => +new Date(a.date) - +new Date(b.date),
                        )[0];
                      const overdue =
                        nextActivity &&
                        new Date(nextActivity.date) < new Date();
                      const daysInPipeline = Math.max(
                        0,
                        Math.floor(
                          (Date.now() - +new Date(lead.updatedAt)) / 86400000,
                        ),
                      );
                      return (
                        <article
                          key={lead.id}
                          draggable={hasPermission("crm.write")}
                          onDragStart={(event) => {
                            event.dataTransfer.setData("text/lead-id", lead.id);
                            setDraggedLeadId(lead.id);
                          }}
                          onDragEnd={() => {
                            setDraggedLeadId(null);
                            setDragOverStageId(null);
                          }}
                          onClick={() => {
                            setSelectedLead(lead);
                            setIsDetailOpen(true);
                          }}
                          className={`group relative cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_7px_20px_rgba(15,23,42,.05)] transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-[0_12px_28px_rgba(37,99,235,.10)] dark:border-zinc-800 dark:bg-zinc-900 ${draggedLeadId === lead.id ? "scale-95 opacity-50" : ""}`}
                        >
                          <div className="flex items-start gap-2 pr-14">
                            {hasPermission("crm.write") && (
                              <GripVertical
                                size={14}
                                className="mt-0.5 shrink-0 text-zinc-300"
                              />
                            )}
                            <div className="min-w-0">
                              <h3 className="truncate text-sm font-black text-zinc-950 dark:text-white">
                                {lead.company || lead.name}
                              </h3>
                              <p className="mt-0.5 truncate text-[11px] font-semibold text-zinc-400">
                                {lead.company ? lead.name : "Pessoa física"}
                              </p>
                            </div>
                          </div>
                          {hasPermission("crm.write") && (
                            <div className="absolute right-3 top-3 flex gap-1">
                              {stageIndex > 0 && (
                                <button
                                  type="button"
                                  disabled={movingLeadId === lead.id}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void handleMoveLead(
                                      lead.id,
                                      pipeline[stageIndex - 1].id,
                                    );
                                  }}
                                  title="Voltar uma etapa"
                                  className="rounded-lg border border-slate-200 p-1.5 text-zinc-400 transition hover:border-amber-200 hover:bg-amber-50 hover:text-amber-600 dark:border-zinc-700"
                                >
                                  <ArrowLeft size={12} />
                                </button>
                              )}
                              {stageIndex < pipeline.length - 1 && (
                                <button
                                  type="button"
                                  disabled={movingLeadId === lead.id}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void handleMoveLead(
                                      lead.id,
                                      pipeline[stageIndex + 1].id,
                                    );
                                  }}
                                  title="Avançar uma etapa"
                                  className="rounded-lg border border-slate-200 p-1.5 text-zinc-400 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 dark:border-zinc-700"
                                >
                                  <ArrowRight size={12} />
                                </button>
                              )}
                            </div>
                          )}
                          <div className="mt-4 flex items-end justify-between gap-3">
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-wider text-zinc-400">
                                Valor potencial
                              </p>
                              <p className="mt-0.5 text-base font-black text-zinc-900 dark:text-white">
                                {formatCurrency(lead.value)}
                              </p>
                            </div>
                            <span className="flex items-center gap-1 text-[10px] font-bold text-zinc-400">
                              <Clock3 size={11} /> {daysInPipeline}d
                            </span>
                          </div>
                          {nextActivity ? (
                            <div
                              className={`mt-3 rounded-xl border px-3 py-2 ${overdue ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/30" : "border-blue-100 bg-blue-50/70 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30"}`}
                            >
                              <p className="flex items-center gap-1.5 text-[10px] font-black uppercase">
                                <CalendarClock size={12} />{" "}
                                {overdue
                                  ? "Follow-up atrasado"
                                  : "Próximo passo"}
                              </p>
                              <p className="mt-1 truncate text-[10px] font-semibold">
                                {nextActivity.description}
                              </p>
                              <p className="mt-0.5 text-[9px] opacity-70">
                                {formatDateTime(nextActivity.date)}
                              </p>
                            </div>
                          ) : (
                            <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-[10px] font-semibold text-zinc-400 dark:bg-zinc-800/50">
                              Nenhum próximo passo agendado
                            </p>
                          )}
                          <footer className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-zinc-800">
                            <span className="flex min-w-0 items-center gap-1.5 truncate text-[10px] font-bold text-zinc-500">
                              <User size={11} />{" "}
                              {lead.ownerName || "Sem responsável"}
                            </span>
                            {lead.source && (
                              <span
                                className={`max-w-[88px] truncate rounded-full px-2 py-1 text-[9px] font-black ${style.badge}`}
                              >
                                {lead.source}
                              </span>
                            )}
                          </footer>
                        </article>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}

      <Modal
        isOpen={isLeadModalOpen}
        onClose={() => setIsLeadModalOpen(false)}
        title={
          editingLead ? "Editar oportunidade" : "Nova oportunidade comercial"
        }
        size="lg"
      >
        <form onSubmit={handleSaveLead} className="space-y-5">
          <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 dark:border-blue-900 dark:from-blue-950/30 dark:to-indigo-950/30">
            <p className="flex items-center gap-2 text-sm font-black text-blue-900 dark:text-blue-200">
              <Target size={17} /> Dados da negociação
            </p>
            <p className="mt-1 text-xs text-blue-700/70 dark:text-blue-300/60">
              Cadastre o contato, potencial financeiro e uma data realista para
              o fechamento.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Nome do contato *"
              required
              value={leadForm.name}
              onChange={(event) =>
                setLeadForm((form) => ({ ...form, name: event.target.value }))
              }
            />
            <Input
              label="Empresa / grupo"
              value={leadForm.company}
              onChange={(event) =>
                setLeadForm((form) => ({
                  ...form,
                  company: event.target.value,
                }))
              }
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Telefone / WhatsApp *"
              required
              value={leadForm.phone}
              onChange={(event) =>
                setLeadForm((form) => ({ ...form, phone: event.target.value }))
              }
            />
            <Input
              label="E-mail"
              type="email"
              value={leadForm.email}
              onChange={(event) =>
                setLeadForm((form) => ({ ...form, email: event.target.value }))
              }
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Valor potencial (R$)"
              type="number"
              min="0"
              step="0.01"
              value={leadForm.value}
              onChange={(event) =>
                setLeadForm((form) => ({ ...form, value: event.target.value }))
              }
            />
            <Input
              label="Previsão de fechamento"
              type="date"
              value={leadForm.closePrediction}
              onChange={(event) =>
                setLeadForm((form) => ({
                  ...form,
                  closePrediction: event.target.value,
                }))
              }
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Origem da oportunidade"
              value={leadForm.source}
              options={[
                "Indicação",
                "Cliente recorrente",
                "Prospecção ativa",
                "Google",
                "Instagram",
                "Site",
                "Parceiro",
                "Outro",
              ].map((value) => ({ value, label: value }))}
              onChange={(event) =>
                setLeadForm((form) => ({ ...form, source: event.target.value }))
              }
            />
            <Select
              label="Responsável comercial"
              value={leadForm.ownerId}
              options={[
                { value: "", label: "Usar responsável atual" },
                ...systemUsers.map((user) => ({
                  value: user.id,
                  label: `${user.name} (${user.roleName})`,
                })),
              ]}
              onChange={(event) =>
                setLeadForm((form) => ({
                  ...form,
                  ownerId: event.target.value,
                }))
              }
            />
          </div>
          <label className="block">
            <span className="mb-2 block text-xs font-bold text-zinc-600 dark:text-zinc-300">
              Contexto e necessidade do cliente
            </span>
            <textarea
              rows={4}
              value={leadForm.notes}
              onChange={(event) =>
                setLeadForm((form) => ({ ...form, notes: event.target.value }))
              }
              placeholder="Escopo inicial, dores do cliente, concorrência, condições importantes..."
              className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 dark:border-zinc-700 dark:bg-zinc-800"
            />
          </label>
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-zinc-800">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setIsLeadModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={actionLoading}>
              {editingLead ? "Salvar alterações" : "Criar oportunidade"}
            </Button>
          </div>
        </form>
      </Modal>

      <Drawer
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title={
          selectedLead
            ? selectedLead.company || selectedLead.name
            : "Oportunidade"
        }
      >
        {selectedLead && (
          <div className="space-y-5">
            <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#0a1b3d] to-[#1c4aa3] p-5 text-white shadow-lg">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.18em] text-blue-200">
                    Valor potencial
                  </p>
                  <p className="mt-1 text-2xl font-black">
                    {formatCurrency(selectedLead.value)}
                  </p>
                </div>
                {hasPermission("crm.write") && (
                  <button
                    type="button"
                    onClick={() => openEditLead(selectedLead)}
                    className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold ring-1 ring-white/15 hover:bg-white/20"
                  >
                    <Edit3 size={14} /> Editar
                  </button>
                )}
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2 text-[10px]">
                <span className="rounded-xl bg-white/10 px-3 py-2">
                  <strong className="block text-blue-200">Responsável</strong>
                  {selectedLead.ownerName || "Não definido"}
                </span>
                <span className="rounded-xl bg-white/10 px-3 py-2">
                  <strong className="block text-blue-200">Fechamento</strong>
                  {selectedLead.closePrediction
                    ? new Date(selectedLead.closePrediction).toLocaleDateString(
                        "pt-BR",
                      )
                    : "Sem previsão"}
                </span>
              </div>
            </section>
            <section className="grid grid-cols-2 gap-2">
              <a
                href={`tel:${selectedLead.phone}`}
                className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-xs font-bold text-zinc-700 hover:border-blue-300 hover:bg-blue-50 dark:border-zinc-800 dark:text-zinc-200"
              >
                <Phone size={15} className="text-blue-600" />{" "}
                {formatPhone(selectedLead.phone)}
              </a>
              {selectedLead.email ? (
                <a
                  href={`mailto:${selectedLead.email}`}
                  className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 p-3 text-xs font-bold text-zinc-700 hover:border-blue-300 hover:bg-blue-50 dark:border-zinc-800 dark:text-zinc-200"
                >
                  <Mail size={15} className="shrink-0 text-blue-600" />
                  <span className="truncate">{selectedLead.email}</span>
                </a>
              ) : (
                <span className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-xs font-semibold text-zinc-400 dark:border-zinc-800">
                  <Mail size={15} /> Sem e-mail
                </span>
              )}
            </section>
            {selectedLead.notes && (
              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/40">
                <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-zinc-400">
                  <Building2 size={13} /> Contexto comercial
                </p>
                <p className="whitespace-pre-wrap text-xs font-medium leading-relaxed text-zinc-700 dark:text-zinc-300">
                  {selectedLead.notes}
                </p>
              </section>
            )}
            {hasPermission("crm.write") && (
              <>
                {(() => {
                  const stage = pipeline.find((item) =>
                    item.leads.some((lead) => lead.id === selectedLead.id),
                  );
                  return (
                    <Select
                      label="Etapa atual do funil"
                      value={stage?.id || ""}
                      disabled={movingLeadId === selectedLead.id}
                      options={pipeline.map((item) => ({
                        value: item.id,
                        label: item.name,
                      }))}
                      onChange={(event) =>
                        void handleMoveLead(selectedLead.id, event.target.value)
                      }
                    />
                  );
                })()}
                <Button
                  variant="success"
                  className="w-full"
                  onClick={() => void handleConvertToQuote(selectedLead.id)}
                  loading={actionLoading}
                >
                  <CheckCircle2 size={16} /> Gerar cliente e orçamento
                </Button>
              </>
            )}
            <form
              onSubmit={handleAddActivity}
              className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-zinc-800"
            >
              <div>
                <h3 className="text-sm font-black text-zinc-900 dark:text-white">
                  Registrar relacionamento
                </h3>
                <p className="mt-0.5 text-[10px] font-semibold text-zinc-400">
                  Registre o que aconteceu ou agende o próximo passo.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select
                  value={activityForm.type}
                  options={[
                    { value: "LIGACAO", label: "Ligação" },
                    { value: "WHATSAPP", label: "WhatsApp" },
                    { value: "EMAIL", label: "E-mail" },
                    { value: "REUNIAO", label: "Reunião" },
                    { value: "VISITA", label: "Visita" },
                    { value: "NOTA", label: "Nota" },
                  ]}
                  onChange={(event) =>
                    setActivityForm((form) => ({
                      ...form,
                      type: event.target.value,
                    }))
                  }
                />
                <Input
                  type="datetime-local"
                  value={activityForm.date}
                  onChange={(event) =>
                    setActivityForm((form) => ({
                      ...form,
                      date: event.target.value,
                    }))
                  }
                />
              </div>
              <textarea
                rows={3}
                required
                value={activityForm.description}
                onChange={(event) =>
                  setActivityForm((form) => ({
                    ...form,
                    description: event.target.value,
                  }))
                }
                placeholder="Ex.: enviar escopo revisado e confirmar visita..."
                className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-xs outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 dark:border-zinc-700 dark:bg-zinc-800"
              />
              <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-xs font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={!activityForm.done}
                  onChange={(event) =>
                    setActivityForm((form) => ({
                      ...form,
                      done: !event.target.checked,
                    }))
                  }
                  className="h-4 w-4 accent-blue-600"
                />{" "}
                Agendar como próximo passo pendente
              </label>
              <Button
                type="submit"
                variant="secondary"
                loading={actionLoading}
                className="w-full"
              >
                {activityForm.done
                  ? "Registrar interação"
                  : "Agendar próximo passo"}
              </Button>
            </form>
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-black text-zinc-900 dark:text-white">
                  Linha do tempo
                </h3>
                <span className="text-[10px] font-bold text-zinc-400">
                  {selectedLead.activities.length} registro(s)
                </span>
              </div>
              {selectedLead.activities.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-slate-200 py-8 text-center text-xs font-semibold text-zinc-400 dark:border-zinc-800">
                  Nenhuma interação registrada.
                </div>
              ) : (
                <div className="relative space-y-3 before:absolute before:bottom-4 before:left-[17px] before:top-4 before:w-px before:bg-slate-200 dark:before:bg-zinc-800">
                  {selectedLead.activities.map((activity) => {
                    const overdue =
                      !activity.done && new Date(activity.date) < new Date();
                    return (
                      <article
                        key={activity.id}
                        className="relative flex gap-3"
                      >
                        <span
                          className={`z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${activity.done ? "border-emerald-200 bg-emerald-50 text-emerald-600" : overdue ? "border-rose-200 bg-rose-50 text-rose-600" : "border-blue-200 bg-blue-50 text-blue-600"}`}
                        >
                          {activity.done ? (
                            <Check size={14} />
                          ) : (
                            activityIcons[activity.type] || (
                              <FileText size={14} />
                            )
                          )}
                        </span>
                        <div className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-wider text-zinc-400">
                                {activity.type === "ETAPA"
                                  ? "Movimentação do funil"
                                  : activity.type}
                              </p>
                              <p className="mt-1 text-xs font-semibold leading-relaxed text-zinc-700 dark:text-zinc-300">
                                {activity.description}
                              </p>
                            </div>
                            {hasPermission("crm.write") &&
                              activity.type !== "ETAPA" && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleToggleActivity(
                                      activity.id,
                                      !activity.done,
                                    )
                                  }
                                  title={activity.done ? "Reabrir" : "Concluir"}
                                  className={`shrink-0 rounded-lg border p-1.5 ${activity.done ? "border-slate-200 text-zinc-400" : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"}`}
                                >
                                  <CheckCircle2 size={13} />
                                </button>
                              )}
                          </div>
                          <p
                            className={`mt-2 flex items-center gap-1 text-[9px] font-bold ${overdue ? "text-rose-600" : "text-zinc-400"}`}
                          >
                            <CalendarClock size={10} />{" "}
                            {formatDateTime(activity.date)}{" "}
                            {overdue ? "· atrasado" : ""}
                          </p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </Drawer>
    </div>
  );
}
