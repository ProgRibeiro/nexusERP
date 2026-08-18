"use client";

import React, { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  getMaintenanceStatusAction,
  toggleMaintenanceModeAction,
  saveScheduledMajorUpdateAction,
  triggerAutoUpdateCheckAction,
} from "@/app/actions/maintenanceActions";
import type { MaintenanceStatus, ScheduledUpdateInfo } from "@/lib/maintenance";
import { Clock, RefreshCw, Wrench, Calendar, CheckCircle2, ShieldAlert } from "lucide-react";

export function AutoUpdateMaintenancePanel() {
  const { toast } = useToast();
  const [status, setStatus] = useState<MaintenanceStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Form states for major update scheduling
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTitle, setScheduledTitle] = useState("");
  const [scheduledDescription, setScheduledDescription] = useState("");
  const [maintenanceRequired, setMaintenanceRequired] = useState(true);
  const [durationMinutes, setDurationMinutes] = useState(15);

  const loadStatus = async () => {
    setLoading(true);
    const res = await getMaintenanceStatusAction();
    setStatus(res);
    if (res.scheduledUpdate) {
      setScheduledDate(res.scheduledUpdate.scheduledAt ? res.scheduledUpdate.scheduledAt.slice(0, 16) : "");
      setScheduledTitle(res.scheduledUpdate.title || "");
      setScheduledDescription(res.scheduledUpdate.description || "");
      setMaintenanceRequired(res.scheduledUpdate.isMaintenanceRequired ?? true);
      setDurationMinutes(res.scheduledUpdate.estimatedDurationMinutes || 15);
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  const handleToggleMaintenance = async () => {
    if (!status) return;
    setActionLoading(true);
    const newMode = !status.isMaintenanceActive;
    const res = await toggleMaintenanceModeAction(
      newMode,
      newMode ? "Manutenção preventiva iniciada manualmente pelo administrador." : undefined
    );
    if (res.success) {
      toast(
        newMode ? "Modo de manutenção ATIVADO no sistema." : "Modo de manutenção DESATIVADO. Sistema liberado.",
        newMode ? "warning" : "success"
      );
      await loadStatus();
    } else {
      toast(res.error || "Erro ao alterar modo de manutenção.", "error");
    }
    setActionLoading(false);
  };

  const handleSaveScheduledUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduledDate || !scheduledTitle) {
      toast("Preencha a data e o título do update grande.", "warning");
      return;
    }

    setActionLoading(true);
    const payload: ScheduledUpdateInfo = {
      scheduledAt: new Date(scheduledDate).toISOString(),
      title: scheduledTitle,
      description: scheduledDescription,
      isMaintenanceRequired: maintenanceRequired,
      estimatedDurationMinutes: Number(durationMinutes) || 15,
    };

    const res = await saveScheduledMajorUpdateAction(payload);
    if (res.success) {
      toast("Data de update grande e parada agendada com sucesso!", "success");
      await loadStatus();
    } else {
      toast(res.error || "Erro ao agendar atualização.", "error");
    }
    setActionLoading(false);
  };

  const handleClearScheduledUpdate = async () => {
    setActionLoading(true);
    const res = await saveScheduledMajorUpdateAction(null);
    if (res.success) {
      toast("Agendamento de update grande removido.", "success");
      setScheduledDate("");
      setScheduledTitle("");
      setScheduledDescription("");
      await loadStatus();
    } else {
      toast(res.error || "Erro ao remover agendamento.", "error");
    }
    setActionLoading(false);
  };

  const handleTriggerCheckNow = async () => {
    setActionLoading(true);
    const res = await triggerAutoUpdateCheckAction();
    if (res.success) {
      toast("Verificação autônoma iniciada! Sincronização de 3h registrada.", "success");
      await loadStatus();
    } else {
      toast(res.error || "Erro ao executar verificação.", "error");
    }
    setActionLoading(false);
  };

  if (loading && !status) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-zinc-500">
        <RefreshCw className="h-4 w-4 animate-spin mr-2" /> Carregando parâmetros de atualização autônoma...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cards de Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Ciclo de 3 Horas */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Update Autônomo Git</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3 w-3" /> A cada 3 Horas
            </span>
          </div>
          <p className="mt-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">Zero-Downtime Blue/Green</p>
          <p className="mt-1 text-xs text-zinc-500">
            Última verificação registrado:{" "}
            {status?.lastAutoUpdateCheck
              ? new Date(status.lastAutoUpdateCheck).toLocaleString("pt-BR")
              : "Verificação pendente ou contínua"}
          </p>
          <div className="mt-4">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleTriggerCheckNow}
              loading={actionLoading}
              className="w-full text-xs"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Verificar Git Agora (3h Check)
            </Button>
          </div>
        </div>

        {/* Card 2: Modo de Manutenção */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Modo de Manutenção</span>
            <Wrench className={`h-4 w-4 ${status?.isMaintenanceActive ? "text-amber-500 animate-pulse" : "text-zinc-400"}`} />
          </div>
          <p className="mt-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">
            {status?.isMaintenanceActive ? "ATIVADO (Em Manutenção)" : "DESATIVADO (Normal)"}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {status?.isMaintenanceActive
              ? "Usuários recebem o banner/overlay de parada de manutenção."
              : "Sistema operando normalmente sem interrupções."}
          </p>
          <div className="mt-4">
            <Button
              variant={status?.isMaintenanceActive ? "primary" : "secondary"}
              size="sm"
              onClick={handleToggleMaintenance}
              loading={actionLoading}
              className="w-full text-xs"
            >
              <Wrench className="h-3.5 w-3.5 mr-1.5" />
              {status?.isMaintenanceActive ? "Desativar Modo de Manutenção" : "Ativar Manutenção Manual"}
            </Button>
          </div>
        </div>

        {/* Card 3: Próximo Update Grande Agendado */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Update Grande Programado</span>
            <Calendar className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 text-base font-bold text-zinc-900 dark:text-zinc-100 truncate">
            {status?.scheduledUpdate?.title || "Nenhum agendado"}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {status?.scheduledUpdate?.scheduledAt
              ? `Data: ${new Date(status.scheduledUpdate.scheduledAt).toLocaleString("pt-BR")} (${status.scheduledUpdate.estimatedDurationMinutes} min)`
              : "Sem parada grande agendada para os próximos dias."}
          </p>
          {status?.scheduledUpdate && (
            <div className="mt-4">
              <Button
                variant="danger"
                size="sm"
                onClick={handleClearScheduledUpdate}
                loading={actionLoading}
                className="w-full text-xs"
              >
                Cancelar Agendamento Grande
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Formulário de Agendamento de Updates Grandes */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 bg-white dark:bg-zinc-950 space-y-4">
        <div className="flex items-center gap-2 border-b border-zinc-150 dark:border-zinc-800 pb-3">
          <ShieldAlert className="h-5 w-5 text-amber-500" />
          <div>
            <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Agendar Data de Update Grande & Parada Programada</h4>
            <p className="text-xs text-zinc-500">
              Notifique a equipe antecipadamente através do banner de aviso do sistema antes de aplicar grandes atualizações ou migrations de banco.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveScheduledUpdate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Data e Hora do Update Grande"
              type="datetime-local"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              required
            />
            <Input
              label="Duração Estimada da Parada (minutos)"
              type="number"
              min="5"
              max="240"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 15)}
              required
            />
          </div>

          <Input
            label="Título da Atualização / Versão (ex: Versão 2.4 - Módulo Fiscal Novo)"
            type="text"
            value={scheduledTitle}
            onChange={(e) => setScheduledTitle(e.target.value)}
            placeholder="Ex: Atualização Major com expansão de banco de dados"
            required
          />

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Descrição / Avisos para Usuários
            </label>
            <textarea
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary"
              rows={2}
              value={scheduledDescription}
              onChange={(e) => setScheduledDescription(e.target.value)}
              placeholder="Descreva brevemente as novidades ou impactos previstos durante o update..."
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="maintReq"
              checked={maintenanceRequired}
              onChange={(e) => setMaintenanceRequired(e.target.checked)}
              className="rounded border-zinc-300 text-primary focus:ring-primary"
            />
            <label htmlFor="maintReq" className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Exibir banner destacado no topo de todas as telas informando a data da parada
            </label>
          </div>

          <div className="pt-2">
            <Button variant="primary" type="submit" loading={actionLoading}>
              <Clock className="h-4 w-4 mr-2" /> Salvar Agendamento de Update Grande
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
