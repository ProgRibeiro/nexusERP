"use client";

import React, { useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, ClipboardList, Clock3, History, MapPin, Plus, RefreshCw, RotateCcw, Route, UserRoundCheck, Users, Wrench } from "lucide-react";
import { createServiceVisit, requestServiceReturn, scheduleServiceVisit } from "@/app/actions/visitActions";
import { assignFormTemplateToVisit, getPublishedFormTemplates } from "@/app/actions/formActions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { formatDateTime } from "@/lib/utils";

interface TechnicianOption {
  id: string;
  name: string;
  roleName?: string;
}

interface VisitTechnicianView {
  userId: string;
  role: string;
  user: { id: string; name: string; email?: string };
}

interface VisitHistoryView {
  id: string;
  oldStatus: string;
  newStatus: string;
  justification?: string | null;
  changedAt: Date | string;
  changedBy?: { name: string } | null;
}

interface VisitView {
  id: string;
  number: number;
  kind: string;
  status: string;
  scheduledStart?: Date | string | null;
  scheduledEnd?: Date | string | null;
  estimatedDurationMinutes: number;
  result?: string | null;
  returnReason?: string | null;
  notes?: string | null;
  travelStartedAt?: Date | string | null;
  arrivedAt?: Date | string | null;
  startedAt?: Date | string | null;
  completedAt?: Date | string | null;
  technicians: VisitTechnicianView[];
  statusHistory: VisitHistoryView[];
  timeEntries?: Array<{ id: string; startedAt: Date | string; endedAt?: Date | string | null; durationMin?: number | null }>;
  measurementReadings?: Array<{ id: string }>;
  formSubmissions?: Array<{
    id: string;
    status: string;
    version: { version: number; template: { id: string; name: string; category: string } };
  }>;
  _count?: { evidences: number; locationEvents: number };
}

interface FormTemplateOption {
  id: string;
  name: string;
  category: string;
  description?: string | null;
  versions: Array<{ id: string; version: number; _count: { sections: number } }>;
}

interface ServiceVisitsPanelProps {
  serviceOrderId: string;
  visits: VisitView[];
  technicians: TechnicianOption[];
  onChanged: () => Promise<void> | void;
}

const statusLabels: Record<string, string> = {
  NAO_AGENDADA: "Não agendada",
  AGENDADA: "Agendada",
  ACEITA: "Aceita",
  EM_DESLOCAMENTO: "Em deslocamento",
  NO_LOCAL: "No local",
  EM_EXECUCAO: "Em execução",
  PAUSADA: "Pausada",
  IMPEDIDA: "Impedida",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
};

const statusTone: Record<string, string> = {
  NAO_AGENDADA: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-300",
  AGENDADA: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/25 dark:text-blue-300",
  ACEITA: "border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-900/60 dark:bg-cyan-950/25 dark:text-cyan-300",
  EM_DESLOCAMENTO: "border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-900/60 dark:bg-indigo-950/25 dark:text-indigo-300",
  NO_LOCAL: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/25 dark:text-sky-300",
  EM_EXECUCAO: "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900/60 dark:bg-violet-950/25 dark:text-violet-300",
  PAUSADA: "border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  IMPEDIDA: "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900/60 dark:bg-orange-950/25 dark:text-orange-300",
  CONCLUIDA: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/25 dark:text-emerald-300",
  CANCELADA: "border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/25 dark:text-red-300",
};

function toLocalInput(value?: Date | string | null) {
  if (!value) return { date: "", time: "08:00" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: "", time: "08:00" };
  const pad = (number: number) => String(number).padStart(2, "0");
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

function elapsedMinutes(visit: VisitView) {
  return (visit.timeEntries || []).reduce((total, entry) => {
    if (entry.durationMin != null) return total + entry.durationMin;
    if (!entry.endedAt) return total;
    return total + Math.max(0, Math.round((new Date(entry.endedAt).getTime() - new Date(entry.startedAt).getTime()) / 60_000));
  }, 0);
}

export default function ServiceVisitsPanel({ serviceOrderId, visits, technicians, onChanged }: ServiceVisitsPanelProps) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [expandedVisitId, setExpandedVisitId] = useState<string | null>(visits[0]?.id || null);
  const [selectedVisit, setSelectedVisit] = useState<VisitView | null>(null);
  const [formTemplates, setFormTemplates] = useState<FormTemplateOption[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [createForm, setCreateForm] = useState({ kind: "ATENDIMENTO", notes: "" });
  const [scheduleForm, setScheduleForm] = useState({ date: "", time: "08:00", duration: 60, techIds: [] as string[], notes: "" });
  const [returnForm, setReturnForm] = useState({ reason: "", date: "", time: "08:00", duration: 60 });

  const totals = useMemo(() => ({
    planned: visits.filter((visit) => ["NAO_AGENDADA", "AGENDADA", "ACEITA"].includes(visit.status)).length,
    active: visits.filter((visit) => ["EM_DESLOCAMENTO", "NO_LOCAL", "EM_EXECUCAO", "PAUSADA", "IMPEDIDA"].includes(visit.status)).length,
    completed: visits.filter((visit) => visit.status === "CONCLUIDA").length,
  }), [visits]);

  const openSchedule = (visit: VisitView) => {
    const dateTime = toLocalInput(visit.scheduledStart);
    setSelectedVisit(visit);
    setScheduleForm({
      date: dateTime.date,
      time: dateTime.time,
      duration: visit.estimatedDurationMinutes || 60,
      techIds: visit.technicians.map((technician) => technician.userId),
      notes: visit.notes || "",
    });
    setScheduleOpen(true);
  };

  const openReturn = (visit: VisitView) => {
    setSelectedVisit(visit);
    setReturnForm({ reason: "", date: "", time: "08:00", duration: visit.estimatedDurationMinutes || 60 });
    setReturnOpen(true);
  };

  const openFormTemplate = async (visit: VisitView) => {
    setSelectedVisit(visit);
    setSelectedTemplateId(visit.formSubmissions?.find((submission) => submission.status === "RASCUNHO")?.version.template.id || visit.formSubmissions?.[0]?.version.template.id || "");
    setFormOpen(true);
    const result = await getPublishedFormTemplates();
    if (!result.success) return toast(result.error || "Erro ao carregar formulários.", "error");
    setFormTemplates(result.templates);
  };

  const assignForm = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedVisit || !selectedTemplateId) return toast("Selecione um modelo de formulário.", "warning");
    setBusy(true);
    const result = await assignFormTemplateToVisit(selectedVisit.id, selectedTemplateId);
    setBusy(false);
    if (!result.success) return toast(result.error || "Erro ao atribuir formulário.", "error");
    setFormOpen(false);
    toast(`Formulário da visita ${selectedVisit.number} atualizado.`, "success");
    await onChanged();
  };

  const createVisit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const result = await createServiceVisit({ serviceOrderId, kind: createForm.kind, notes: createForm.notes });
    setBusy(false);
    if (!result.success) return toast(result.error || "Erro ao criar visita.", "error");
    setCreateOpen(false);
    setCreateForm({ kind: "ATENDIMENTO", notes: "" });
    toast("Nova visita criada sem alterar as anteriores.", "success");
    await onChanged();
  };

  const scheduleVisit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedVisit || !scheduleForm.date || !scheduleForm.techIds.length) return toast("Informe data e equipe técnica.", "warning");
    setBusy(true);
    const result = await scheduleServiceVisit({
      visitId: selectedVisit.id,
      scheduledStart: new Date(`${scheduleForm.date}T${scheduleForm.time || "08:00"}:00`),
      estimatedDurationMinutes: scheduleForm.duration,
      techIds: scheduleForm.techIds,
      notes: scheduleForm.notes,
    });
    setBusy(false);
    if (!result.success) return toast(result.error || "Erro ao agendar visita.", "error");
    setScheduleOpen(false);
    toast(`Visita ${selectedVisit.number} agendada.`, "success");
    await onChanged();
  };

  const createReturn = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedVisit || !returnForm.reason.trim()) return toast("Explique o motivo do retorno.", "warning");
    setBusy(true);
    const proposedStart = returnForm.date ? new Date(`${returnForm.date}T${returnForm.time || "08:00"}:00`) : undefined;
    const result = await requestServiceReturn({ visitId: selectedVisit.id, reason: returnForm.reason, proposedStart, estimatedDurationMinutes: returnForm.duration });
    setBusy(false);
    if (!result.success) return toast(result.error || "Erro ao criar retorno.", "error");
    setReturnOpen(false);
    toast("Retorno criado como nova visita; o atendimento anterior foi preservado.", "success");
    await onChanged();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl bg-gradient-to-r from-slate-950 via-blue-950 to-blue-900 p-5 text-white sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-200/75">Planejamento de campo</p>
          <h3 className="mt-1 text-lg font-black tracking-tight">Visitas de serviço</h3>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-blue-100/70">Cada ida ao cliente possui agenda, equipe, tempo, evidências e resultado próprios.</p>
        </div>
        <Button type="button" onClick={() => setCreateOpen(true)} className="shrink-0 !bg-white !text-blue-950 hover:!bg-blue-50"><Plus size={15} /> Nova visita</Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Planejadas", value: totals.planned, icon: CalendarClock, tone: "text-blue-600 bg-blue-50 dark:bg-blue-950/30" },
          { label: "Em campo", value: totals.active, icon: Route, tone: "text-violet-600 bg-violet-50 dark:bg-violet-950/30" },
          { label: "Concluídas", value: totals.completed, icon: CheckCircle2, tone: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30" },
        ].map((item) => <div key={item.label} className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800"><div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg ${item.tone}`}><item.icon size={15} /></div><strong className="text-xl font-black">{item.value}</strong><p className="text-[9px] font-bold uppercase tracking-wide text-zinc-500">{item.label}</p></div>)}
      </div>

      {!visits.length ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 py-12 text-center dark:border-zinc-700"><Wrench className="mx-auto text-zinc-300" /><p className="mt-2 text-sm font-bold">Nenhuma visita criada</p><p className="text-xs text-zinc-500">Crie a primeira ida ao cliente para planejar o atendimento.</p></div>
      ) : (
        <div className="space-y-3">
          {visits.map((visit) => {
            const expanded = expandedVisitId === visit.id;
            const executionMinutes = elapsedMinutes(visit);
            return (
              <article key={visit.id} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                <button type="button" onClick={() => setExpandedVisitId(expanded ? null : visit.id)} className="flex w-full items-start gap-3 p-4 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-sm font-black text-white dark:bg-blue-600">V{visit.number}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2"><strong className="text-sm">{visit.kind === "RETORNO" ? "Retorno técnico" : visit.kind === "VISTORIA" ? "Vistoria / preventiva" : "Atendimento técnico"}</strong><span className={`rounded-md border px-2 py-1 text-[9px] font-black uppercase tracking-wide ${statusTone[visit.status] || statusTone.PAUSADA}`}>{statusLabels[visit.status] || visit.status}</span></span>
                    <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-semibold text-zinc-500">
                      <span className="flex items-center gap-1"><CalendarClock size={12} />{visit.scheduledStart ? formatDateTime(visit.scheduledStart) : "Aguardando agendamento"}</span>
                      <span className="flex items-center gap-1"><Users size={12} />{visit.technicians.map((technician) => technician.user.name).join(", ") || "Equipe não definida"}</span>
                    </span>
                  </span>
                  <RefreshCw size={15} className={`mt-1 shrink-0 text-zinc-400 transition ${expanded ? "rotate-180" : ""}`} />
                </button>

                {expanded && (
                  <div className="space-y-4 border-t border-zinc-100 bg-zinc-50/45 p-4 dark:border-zinc-800 dark:bg-zinc-950/25">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"><Clock3 size={14} className="text-blue-600" /><strong className="mt-2 block text-sm">{visit.estimatedDurationMinutes} min</strong><span className="text-[9px] text-zinc-500">Duração prevista</span></div>
                      <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"><Route size={14} className="text-violet-600" /><strong className="mt-2 block text-sm">{executionMinutes} min</strong><span className="text-[9px] text-zinc-500">Tempo registrado</span></div>
                      <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"><MapPin size={14} className="text-cyan-600" /><strong className="mt-2 block text-sm">{visit._count?.locationEvents || 0}</strong><span className="text-[9px] text-zinc-500">Eventos de localização</span></div>
                      <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"><CheckCircle2 size={14} className="text-emerald-600" /><strong className="mt-2 block text-sm">{visit._count?.evidences || 0}</strong><span className="text-[9px] text-zinc-500">Evidências</span></div>
                    </div>

                    {(visit.notes || visit.returnReason) && <div className="rounded-xl border border-zinc-200 bg-white p-3 text-xs leading-relaxed text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"><strong className="block text-zinc-900 dark:text-white">Escopo e observações</strong>{visit.returnReason || visit.notes}</div>}

                    <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"><ClipboardList size={16} /></span>
                      <div className="min-w-0 flex-1"><strong className="block truncate text-xs">{visit.formSubmissions?.[0]?.version.template.name || "Formulário ainda não definido"}</strong><span className="text-[9px] font-semibold uppercase text-zinc-500">{visit.formSubmissions?.[0] ? `Versão ${visit.formSubmissions[0].version.version} · ${visit.formSubmissions[0].status}` : "Será escolhido automaticamente"}</span></div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {!CLOSED_VISIT_STATUSES_CLIENT.includes(visit.status) && <Button size="sm" variant="secondary" onClick={() => openSchedule(visit)}><CalendarClock size={14} /> {visit.scheduledStart ? "Reagendar" : "Agendar visita"}</Button>}
                      {!CLOSED_VISIT_STATUSES_CLIENT.includes(visit.status) && <Button size="sm" variant="secondary" onClick={() => void openFormTemplate(visit)}><ClipboardList size={14} /> Formulário de campo</Button>}
                      {!CLOSED_VISIT_STATUSES_CLIENT.includes(visit.status) && <Button size="sm" variant="secondary" onClick={() => openReturn(visit)}><RotateCcw size={14} /> Programar retorno</Button>}
                    </div>

                    <div>
                      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-zinc-500"><History size={13} /> Histórico da visita</p>
                      <div className="space-y-2">
                        {visit.statusHistory.slice(0, 5).map((history) => <div key={history.id} className="flex items-start justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-3 text-[10px] dark:border-zinc-800 dark:bg-zinc-900"><div><p className="font-bold"><span className="text-zinc-400">{statusLabels[history.oldStatus] || history.oldStatus}</span> → <span className="text-blue-600">{statusLabels[history.newStatus] || history.newStatus}</span></p>{history.justification && <p className="mt-1 leading-relaxed text-zinc-500">{history.justification}</p>} {history.changedBy?.name && <p className="mt-1 text-zinc-400">Por {history.changedBy.name}</p>}</div><span className="shrink-0 text-zinc-400">{formatDateTime(history.changedAt)}</span></div>)}
                      </div>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Criar nova visita">
        <form onSubmit={createVisit} className="space-y-4">
          <Select label="Tipo da visita" value={createForm.kind} onChange={(event) => setCreateForm((current) => ({ ...current, kind: event.target.value }))} options={[{ value: "ATENDIMENTO", label: "Atendimento técnico" }, { value: "DIAGNOSTICO", label: "Diagnóstico / levantamento" }, { value: "RETORNO", label: "Retorno técnico" }, { value: "VISTORIA", label: "Vistoria / preventiva" }]} />
          <div><label className="mb-1 block text-xs font-bold text-zinc-500">Escopo ou observações</label><textarea rows={4} value={createForm.notes} onChange={(event) => setCreateForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Explique o objetivo desta ida ao cliente" className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-zinc-800 dark:bg-zinc-900" /></div>
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>Cancelar</Button><Button type="submit" loading={busy}><Plus size={14} /> Criar visita</Button></div>
        </form>
      </Modal>

      <Modal isOpen={scheduleOpen} onClose={() => setScheduleOpen(false)} title={selectedVisit ? `Agendar visita ${selectedVisit.number}` : "Agendar visita"}>
        <form onSubmit={scheduleVisit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3"><Input label="Data *" type="date" required value={scheduleForm.date} onChange={(event) => setScheduleForm((current) => ({ ...current, date: event.target.value }))} /><Input label="Horário *" type="time" required value={scheduleForm.time} onChange={(event) => setScheduleForm((current) => ({ ...current, time: event.target.value }))} /></div>
          <Input label="Duração prevista (minutos)" type="number" min={15} step={15} value={scheduleForm.duration} onChange={(event) => setScheduleForm((current) => ({ ...current, duration: Number(event.target.value) || 60 }))} />
          <div><label className="mb-2 block text-xs font-bold text-zinc-500">Equipe técnica *</label><div className="grid max-h-48 grid-cols-1 gap-2 overflow-y-auto rounded-xl border border-zinc-200 p-3 sm:grid-cols-2 dark:border-zinc-800">{technicians.map((technician) => <label key={technician.id} className="flex cursor-pointer items-center gap-2 rounded-lg p-2 text-xs font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-800"><input type="checkbox" checked={scheduleForm.techIds.includes(technician.id)} onChange={(event) => setScheduleForm((current) => ({ ...current, techIds: event.target.checked ? [...current.techIds, technician.id] : current.techIds.filter((id) => id !== technician.id) }))} className="h-4 w-4 rounded border-zinc-300 text-blue-600" /><UserRoundCheck size={14} className="text-zinc-400" />{technician.name}</label>)}</div></div>
          <div><label className="mb-1 block text-xs font-bold text-zinc-500">Orientações para a equipe</label><textarea rows={3} value={scheduleForm.notes} onChange={(event) => setScheduleForm((current) => ({ ...current, notes: event.target.value }))} className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-sm outline-none focus:border-blue-500 dark:border-zinc-800 dark:bg-zinc-900" /></div>
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setScheduleOpen(false)}>Cancelar</Button><Button type="submit" loading={busy}><CalendarClock size={14} /> Salvar agendamento</Button></div>
        </form>
      </Modal>

      <Modal isOpen={returnOpen} onClose={() => setReturnOpen(false)} title={selectedVisit ? `Retorno da visita ${selectedVisit.number}` : "Programar retorno"}>
        <form onSubmit={createReturn} className="space-y-4">
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-relaxed text-blue-800 dark:border-blue-950 dark:bg-blue-950/25 dark:text-blue-300">A visita atual será encerrada com resultado “retorno necessário” e uma nova visita será criada. Nada do atendimento anterior será apagado.</div>
          <div><label className="mb-1 block text-xs font-bold text-zinc-500">Motivo e necessidade do retorno *</label><textarea required rows={4} value={returnForm.reason} onChange={(event) => setReturnForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Ex.: retornar com compressor, autorização do cliente ou segunda equipe" className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-sm outline-none focus:border-blue-500 dark:border-zinc-800 dark:bg-zinc-900" /></div>
          <div className="grid grid-cols-2 gap-3"><Input label="Data proposta (opcional)" type="date" value={returnForm.date} onChange={(event) => setReturnForm((current) => ({ ...current, date: event.target.value }))} /><Input label="Horário" type="time" disabled={!returnForm.date} value={returnForm.time} onChange={(event) => setReturnForm((current) => ({ ...current, time: event.target.value }))} /></div>
          <Input label="Duração prevista (minutos)" type="number" min={15} step={15} value={returnForm.duration} onChange={(event) => setReturnForm((current) => ({ ...current, duration: Number(event.target.value) || 60 }))} />
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setReturnOpen(false)}>Cancelar</Button><Button type="submit" loading={busy}><RotateCcw size={14} /> Criar retorno</Button></div>
        </form>
      </Modal>

      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title={selectedVisit ? `Formulário da visita ${selectedVisit.number}` : "Formulário de campo"}>
        <form onSubmit={assignForm} className="space-y-4">
          <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-xs leading-relaxed text-indigo-800 dark:border-indigo-950 dark:bg-indigo-950/25 dark:text-indigo-300">O técnico receberá este checklist na execução. A versão usada fica congelada no histórico, mesmo que o modelo seja atualizado futuramente.</div>
          <div className="space-y-2">
            {formTemplates.map((template) => (
              <label key={template.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${selectedTemplateId === template.id ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/10 dark:bg-indigo-950/20" : "border-zinc-200 hover:border-indigo-300 dark:border-zinc-800"}`}>
                <input type="radio" name="template" value={template.id} checked={selectedTemplateId === template.id} onChange={() => setSelectedTemplateId(template.id)} className="mt-1 h-4 w-4 text-indigo-600" />
                <span><strong className="block text-sm">{template.name}</strong><span className="mt-1 block text-[10px] font-semibold uppercase text-zinc-500">{template.category} · versão {template.versions[0]?.version || 1} · {template.versions[0]?._count.sections || 0} seção(ões)</span>{template.description && <span className="mt-1 block text-xs leading-relaxed text-zinc-500">{template.description}</span>}</span>
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>Cancelar</Button><Button type="submit" loading={busy}><ClipboardList size={14} /> Aplicar formulário</Button></div>
        </form>
      </Modal>
    </div>
  );
}

const CLOSED_VISIT_STATUSES_CLIENT = ["CONCLUIDA", "CANCELADA"];
