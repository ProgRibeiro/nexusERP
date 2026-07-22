"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  GripVertical,
  Loader2,
  Plus,
  Search,
  UserRound,
  Wrench,
  X,
} from "lucide-react";
import { getServiceOrders, scheduleServiceOrder } from "@/app/actions/osActions";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";

interface ScheduleTechnician {
  id: string;
  userId: string;
  name: string;
  technician?: { name: string };
}

interface ScheduleOrder {
  id: string;
  code: string;
  client?: { id: string; name: string; email: string };
  clientName: string;
  status: string;
  priority: string;
  type: string;
  problemReported?: string | null;
  scheduledDate: Date | string | null;
  scheduledTime: string | null;
  technicians: ScheduleTechnician[];
  totalValue: number;
}

const WEEK_DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const CLOSED_STATUSES = ["CONCLUIDA", "FATURADA", "CANCELADA"];

const priorityStyles: Record<string, string> = {
  URGENTE: "border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
  ALTA: "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300",
  MEDIA: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-300",
  BAIXA: "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

function dateKey(date: Date | string) {
  const value = new Date(date);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromKey(key: string, time = "08:00") {
  return new Date(`${key}T${time}:00`);
}

function calendarDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

export default function AgendaTab() {
  const { users, user } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<ScheduleOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [movingOrderId, setMovingOrderId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState(() => dateKey(new Date()));
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<ScheduleOrder | null>(null);
  const [scheduleForm, setScheduleForm] = useState({
    scheduledDate: dateKey(new Date()),
    scheduledTime: "08:00",
    techIds: [] as string[],
    priority: "MEDIA",
  });

  const technicians = useMemo(
    () => users.filter((item) => ["Técnico", "Gestor", "Administrador"].includes(item.roleName)),
    [users]
  );

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = (await getServiceOrders()) as ScheduleOrder[];
      setOrders(data);
    } catch {
      toast("Não foi possível carregar o cronograma.", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const pendingOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    return orders.filter((order) => {
      if (order.scheduledDate || CLOSED_STATUSES.includes(order.status)) return false;
      return !query || order.code.toLowerCase().includes(query) || order.clientName.toLowerCase().includes(query);
    });
  }, [orders, search]);

  const scheduledByDay = useMemo(() => {
    const grouped = new Map<string, ScheduleOrder[]>();
    orders.forEach((order) => {
      if (!order.scheduledDate || order.status === "CANCELADA") return;
      const key = dateKey(order.scheduledDate);
      const current = grouped.get(key) || [];
      current.push(order);
      grouped.set(key, current);
    });
    grouped.forEach((items) =>
      items.sort((a, b) => (a.scheduledTime || "23:59").localeCompare(b.scheduledTime || "23:59"))
    );
    return grouped;
  }, [orders]);

  const days = useMemo(() => calendarDays(visibleMonth), [visibleMonth]);
  const todayKey = dateKey(new Date());
  const selectedDayLabel = dateFromKey(selectedDay).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  function openScheduler(order: ScheduleOrder, targetDay?: string) {
    const scheduledKey = order.scheduledDate ? dateKey(order.scheduledDate) : selectedDay;
    setSelectedOrder(order);
    setScheduleForm({
      scheduledDate: targetDay || scheduledKey,
      scheduledTime: order.scheduledTime || "08:00",
      techIds: order.technicians.map((item) => item.userId),
      priority: order.priority || "MEDIA",
    });
  }

  async function persistSchedule(order: ScheduleOrder, targetDay: string, openWhenMissingTeam = true) {
    const techIds = order.technicians.map((item) => item.userId);
    if (techIds.length === 0 && openWhenMissingTeam) {
      openScheduler(order, targetDay);
      toast("Escolha a equipe antes de confirmar o agendamento.", "warning");
      return;
    }

    setMovingOrderId(order.id);
    try {
      const time = order.scheduledTime || "08:00";
      const result = await scheduleServiceOrder(
        order.id,
        {
          scheduledDate: dateFromKey(targetDay, time),
          scheduledTime: time,
          techIds,
          priority: order.priority || "MEDIA",
        },
        user?.id || ""
      );
      if (!result.success) throw new Error(result.error);
      setSelectedDay(targetDay);
      toast(`${order.code} movida para ${dateFromKey(targetDay).toLocaleDateString("pt-BR")}.`, "success");
      await loadOrders();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Erro ao mover a OS.", "error");
    } finally {
      setMovingOrderId(null);
    }
  }

  function startDrag(event: React.DragEvent, orderId: string) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", orderId);
  }

  async function dropOnDay(event: React.DragEvent, targetDay: string) {
    event.preventDefault();
    setDragOverDay(null);
    const order = orders.find((item) => item.id === event.dataTransfer.getData("text/plain"));
    if (!order) return;
    if (order.scheduledDate && dateKey(order.scheduledDate) === targetDay) return;
    await persistSchedule(order, targetDay);
  }

  async function submitSchedule(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedOrder) return;
    if (!scheduleForm.scheduledDate || !scheduleForm.scheduledTime) {
      toast("Informe data e horário.", "warning");
      return;
    }
    if (scheduleForm.techIds.length === 0) {
      toast("Selecione pelo menos um técnico.", "warning");
      return;
    }

    setSaving(true);
    try {
      const result = await scheduleServiceOrder(
        selectedOrder.id,
        {
          scheduledDate: dateFromKey(scheduleForm.scheduledDate, scheduleForm.scheduledTime),
          scheduledTime: scheduleForm.scheduledTime,
          techIds: scheduleForm.techIds,
          priority: scheduleForm.priority,
        },
        user?.id || ""
      );
      if (!result.success) throw new Error(result.error);
      setSelectedDay(scheduleForm.scheduledDate);
      setVisibleMonth(dateFromKey(scheduleForm.scheduledDate));
      setSelectedOrder(null);
      toast("Agendamento salvo no calendário.", "success");
      await loadOrders();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Erro ao salvar agendamento.", "error");
    } finally {
      setSaving(false);
    }
  }

  const scheduledCount = orders.filter((order) => order.scheduledDate && !CLOSED_STATUSES.includes(order.status)).length;
  const todayCount = scheduledByDay.get(todayKey)?.length || 0;

  return (
    <div className="min-h-full space-y-5 pb-8 animate-in fade-in duration-200">
      <header className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between lg:p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white">
              <CalendarDays size={23} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-zinc-950 dark:text-white">Calendário operacional</h1>
              <p className="mt-1 text-xs font-medium text-zinc-500">
                Arraste uma OS para o dia desejado ou selecione uma data e escolha a OS na lateral.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:flex">
            {[
              { label: "Sem data", value: pendingOrders.length, tone: "text-amber-600" },
              { label: "Agendadas", value: scheduledCount, tone: "text-blue-600" },
              { label: "Hoje", value: todayCount, tone: "text-emerald-600" },
            ].map((stat) => (
              <div key={stat.label} className="min-w-24 rounded-2xl border border-zinc-200 px-4 py-2.5 text-center dark:border-zinc-800">
                <div className={`text-lg font-bold ${stat.tone}`}>{stat.value}</div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </header>

      <div className="grid items-start gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 xl:sticky xl:top-0">
          <div className="border-b border-zinc-100 p-4 dark:border-zinc-800">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white">OS sem agendamento</h2>
                <p className="mt-0.5 text-[10px] font-medium text-zinc-400">Arraste para qualquer dia</p>
              </div>
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                {pendingOrders.length}
              </span>
            </div>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar OS ou cliente"
              icon={<Search size={14} />}
            />
          </div>

          <div className="border-b border-blue-100 bg-blue-50/70 px-4 py-3 dark:border-blue-900/40 dark:bg-blue-950/20">
            <div className="flex items-start gap-2 text-[10px] font-semibold text-blue-700 dark:text-blue-300">
              <CalendarDays size={14} className="mt-0.5 shrink-0" />
              <span>
                Data selecionada: <strong className="capitalize">{selectedDayLabel}</strong>. Clique em uma OS para colocá-la nessa data.
              </span>
            </div>
          </div>

          <div className="max-h-[calc(100vh-350px)] min-h-56 space-y-2 overflow-y-auto p-3">
            {loading ? (
              <div className="flex h-48 flex-col items-center justify-center gap-2 text-zinc-400">
                <Loader2 className="animate-spin text-blue-600" size={22} />
                <span className="text-xs font-bold">Carregando ordens...</span>
              </div>
            ) : pendingOrders.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center px-6 text-center">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30">
                  <Check size={20} />
                </div>
                <p className="text-xs font-bold text-zinc-700 dark:text-zinc-200">Nenhuma OS aguardando</p>
                <p className="mt-1 text-[10px] text-zinc-400">Todos os serviços já têm uma data.</p>
              </div>
            ) : (
              pendingOrders.map((order) => (
                <button
                  type="button"
                  draggable
                  key={order.id}
                  onDragStart={(event) => startDrag(event, order.id)}
                  onClick={() => openScheduler(order, selectedDay)}
                  className="group w-full cursor-grab rounded-2xl border border-zinc-200 bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md active:cursor-grabbing dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-blue-700"
                >
                  <div className="flex items-start gap-2.5">
                    <GripVertical size={15} className="mt-0.5 shrink-0 text-zinc-300 group-hover:text-blue-500" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300">{order.code}</span>
                        <span className={`rounded-md border px-1.5 py-0.5 text-[8px] font-bold ${priorityStyles[order.priority] || priorityStyles.MEDIA}`}>
                          {order.priority}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs font-semibold text-zinc-800 dark:text-zinc-100">{order.clientName}</p>
                      <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-zinc-400">
                        {order.problemReported || order.type.replaceAll("_", " ")}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-col gap-3 border-b border-zinc-100 p-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 text-zinc-500 transition hover:bg-zinc-50 hover:text-blue-600 dark:border-zinc-700 dark:hover:bg-zinc-800"
                aria-label="Mês anterior"
              >
                <ChevronLeft size={17} />
              </button>
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  setVisibleMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                  setSelectedDay(dateKey(now));
                }}
                className="h-9 rounded-xl border border-zinc-200 px-3 text-[10px] font-bold uppercase tracking-wider text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 text-zinc-500 transition hover:bg-zinc-50 hover:text-blue-600 dark:border-zinc-700 dark:hover:bg-zinc-800"
                aria-label="Próximo mês"
              >
                <ChevronRight size={17} />
              </button>
            </div>
            <h2 className="text-base font-bold capitalize text-zinc-900 dark:text-white sm:absolute sm:left-1/2 sm:-translate-x-1/2">
              {visibleMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
            </h2>
            <div className="flex items-center gap-2 text-[10px] font-semibold text-zinc-400">
              <GripVertical size={13} /> Arraste para reagendar
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-zinc-100 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-950/30">
            {WEEK_DAYS.map((day, index) => (
              <div key={day} className={`px-2 py-2.5 text-center text-[9px] font-bold uppercase tracking-widest ${index === 0 || index === 6 ? "text-blue-500" : "text-zinc-400"}`}>
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {days.map((day) => {
              const key = dateKey(day);
              const dayOrders = scheduledByDay.get(key) || [];
              const isCurrentMonth = day.getMonth() === visibleMonth.getMonth();
              const isToday = key === todayKey;
              const isSelected = key === selectedDay;
              const isDragTarget = key === dragOverDay;
              return (
                <div
                  key={key}
                  onClick={() => setSelectedDay(key)}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    setDragOverDay(key);
                  }}
                  onDragLeave={() => setDragOverDay((current) => (current === key ? null : current))}
                  onDrop={(event) => void dropOnDay(event, key)}
                  className={`group/day relative min-h-28 border-b border-r border-zinc-100 p-1.5 transition sm:min-h-32 sm:p-2 dark:border-zinc-800/80 ${
                    isCurrentMonth ? "bg-white dark:bg-zinc-900" : "bg-zinc-50/60 dark:bg-zinc-950/35"
                  } ${isSelected ? "ring-2 ring-inset ring-blue-500" : ""} ${isDragTarget ? "bg-blue-50 ring-2 ring-inset ring-blue-500 dark:bg-blue-950/30" : "hover:bg-blue-50/30 dark:hover:bg-blue-950/10"}`}
                >
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                      isToday
                        ? "bg-blue-600 text-white shadow-sm"
                        : isCurrentMonth
                          ? "text-zinc-700 dark:text-zinc-200"
                          : "text-zinc-300 dark:text-zinc-700"
                    }`}>
                      {day.getDate()}
                    </span>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedDay(key);
                      }}
                      className="hidden h-6 w-6 items-center justify-center rounded-lg text-zinc-300 transition hover:bg-blue-100 hover:text-blue-600 group-hover/day:flex dark:hover:bg-blue-950"
                      title="Selecionar esta data"
                    >
                      <Plus size={13} />
                    </button>
                  </div>

                  <div className="space-y-1">
                    {dayOrders.slice(0, 3).map((order) => (
                      <button
                        type="button"
                        draggable
                        key={order.id}
                        onDragStart={(event) => {
                          event.stopPropagation();
                          startDrag(event, order.id);
                        }}
                        onClick={(event) => {
                          event.stopPropagation();
                          openScheduler(order, key);
                        }}
                        className={`w-full cursor-grab rounded-lg border px-1.5 py-1 text-left transition hover:shadow-sm active:cursor-grabbing sm:px-2 ${priorityStyles[order.priority] || priorityStyles.MEDIA}`}
                      >
                        <div className="flex items-center gap-1">
                          {movingOrderId === order.id ? <Loader2 size={9} className="shrink-0 animate-spin" /> : <Clock3 size={9} className="hidden shrink-0 sm:block" />}
                          <span className="truncate text-[8px] font-bold sm:text-[9px]">{order.scheduledTime || "08:00"} · {order.code}</span>
                        </div>
                        <p className="mt-0.5 hidden truncate text-[8px] font-semibold opacity-75 sm:block">{order.clientName}</p>
                      </button>
                    ))}
                    {dayOrders.length > 3 && (
                      <div className="px-1 text-[8px] font-bold text-zinc-400">+ {dayOrders.length - 3} outras OS</div>
                    )}
                  </div>

                  {isDragTarget && (
                    <div className="pointer-events-none absolute inset-1 flex items-center justify-center rounded-xl border-2 border-dashed border-blue-500 bg-blue-50/90 text-center text-[9px] font-bold text-blue-700 dark:bg-blue-950/90 dark:text-blue-200">
                      Soltar neste dia
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <Modal
        isOpen={Boolean(selectedOrder)}
        onClose={() => !saving && setSelectedOrder(null)}
        title={selectedOrder ? `Agendar ${selectedOrder.code}` : "Agendar ordem de serviço"}
      >
        {selectedOrder && (
          <form onSubmit={submitSchedule} className="space-y-5">
            <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
                  <Wrench size={16} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-zinc-900 dark:text-white">{selectedOrder.clientName}</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">{selectedOrder.problemReported || selectedOrder.type.replaceAll("_", " ")}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Data"
                type="date"
                required
                value={scheduleForm.scheduledDate}
                onChange={(event) => setScheduleForm((current) => ({ ...current, scheduledDate: event.target.value }))}
              />
              <Input
                label="Horário"
                type="time"
                required
                value={scheduleForm.scheduledTime}
                onChange={(event) => setScheduleForm((current) => ({ ...current, scheduledTime: event.target.value }))}
              />
            </div>

            <Select
              label="Prioridade"
              value={scheduleForm.priority}
              onChange={(event) => setScheduleForm((current) => ({ ...current, priority: event.target.value }))}
              options={[
                { value: "BAIXA", label: "Baixa" },
                { value: "MEDIA", label: "Média" },
                { value: "ALTA", label: "Alta" },
                { value: "URGENTE", label: "Urgente" },
              ]}
            />

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Equipe técnica</label>
                <span className="text-[10px] font-bold text-zinc-400">{scheduleForm.techIds.length} selecionado(s)</span>
              </div>
              <div className="grid max-h-48 grid-cols-1 gap-2 overflow-y-auto rounded-2xl border border-zinc-200 p-3 sm:grid-cols-2 dark:border-zinc-700">
                {technicians.map((tech) => {
                  const checked = scheduleForm.techIds.includes(tech.id);
                  return (
                    <button
                      type="button"
                      key={tech.id}
                      onClick={() =>
                        setScheduleForm((current) => ({
                          ...current,
                          techIds: checked
                            ? current.techIds.filter((id) => id !== tech.id)
                            : [...current.techIds, tech.id],
                        }))
                      }
                      className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition ${
                        checked
                          ? "border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-950/30 dark:text-blue-200"
                          : "border-zinc-200 text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${checked ? "border-blue-600 bg-blue-600 text-white" : "border-zinc-300 dark:border-zinc-600"}`}>
                        {checked && <Check size={12} />}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[11px] font-bold">{tech.name}</span>
                        <span className="block text-[9px] font-semibold opacity-60">{tech.roleName}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {technicians.length === 0 && (
                <div className="mt-2 flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                  <AlertTriangle size={14} /> Cadastre um usuário técnico antes de agendar.
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
              <Button type="button" variant="secondary" onClick={() => setSelectedOrder(null)} disabled={saving}>
                <X size={14} /> Cancelar
              </Button>
              <Button type="submit" loading={saving}>
                <CalendarDays size={14} /> Salvar no calendário
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
