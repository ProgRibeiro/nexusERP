"use client";

import React, { useEffect, useState } from "react";
import { getMaintenanceStatusAction } from "@/app/actions/maintenanceActions";
import type { MaintenanceStatus } from "@/lib/maintenance";
import { AlertTriangle, Clock, Wrench, X } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { toggleMaintenanceModeAction } from "@/app/actions/maintenanceActions";

export function MaintenanceBanner() {
  const { user, hasPermission, loading } = useAuth();
  const [status, setStatus] = useState<MaintenanceStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  const isAdmin = user?.roleName === "Administrador" || hasPermission("admin.all");

  useEffect(() => {
    let mounted = true;
    getMaintenanceStatusAction().then((res) => {
      if (mounted) setStatus(res);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Se a autenticação ainda está carregando no cliente, não bloqueia a tela precocemente
  if (dismissed || !status || loading) return null;

  const handleUnlock = async () => {
    setUnlocking(true);
    try {
      await toggleMaintenanceModeAction(false);
      setStatus((prev) => (prev ? { ...prev, isMaintenanceActive: false } : null));
    } catch {
      // Ignora falha de permissão para forçar reload local
      window.location.reload();
    } finally {
      setUnlocking(false);
    }
  };

  // Se o modo de manutenção estiver ativado:
  if (status.isMaintenanceActive) {
    // Para Administradores: Exibe apenas barra de aviso amarela no topo sem bloquear navegação no ERP
    if (isAdmin) {
      return (
        <div className="relative bg-amber-600 px-4 py-2 text-white shadow-md z-[999]">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 text-xs font-medium">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 shrink-0 text-amber-200 animate-pulse" />
              <span>
                <strong>Modo de Manutenção Ativo:</strong> O sistema está bloqueado para usuários comuns. Como Administrador, você possui acesso irrestrito para configurações e inspeções.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleUnlock}
                disabled={unlocking}
                className="rounded bg-white/20 px-2.5 py-1 text-xs font-bold hover:bg-white/30 transition disabled:opacity-50"
              >
                {unlocking ? "Desativando..." : "Desativar Manutenção"}
              </button>
              <button
                onClick={() => setDismissed(true)}
                className="rounded p-1 hover:bg-white/20 transition-colors"
                title="Fechar aviso"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Para usuários comuns ou tela inicial: Exibe a tela de bloqueio com botão de liberação direta
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950/95 p-6 text-white backdrop-blur-md">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 ring-8 ring-amber-500/10">
            <Wrench className="h-10 w-10 animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Sistema em Manutenção Programada</h2>
          <p className="mt-2 text-sm text-slate-300">
            {status.maintenanceReason || "Estamos aplicando atualizações importantes para melhorar a estabilidade e segurança do sistema."}
          </p>
          <div className="mt-6 flex flex-col items-center gap-3">
            <div className="flex items-center justify-center gap-2 rounded-xl bg-slate-900/80 p-3 text-xs text-amber-300 border border-amber-500/20">
              <Clock className="h-4 w-4" />
              <span>Atualização em andamento. Volte em instantes.</span>
            </div>
            <button
              onClick={handleUnlock}
              disabled={unlocking}
              className="mt-2 text-xs font-semibold text-zinc-400 underline hover:text-white transition"
            >
              {unlocking ? "Desativando..." : "Sou Administrador — Desativar Manutenção Agora"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Se houver um update grande agendado para o futuro
  if (status.scheduledUpdate && status.scheduledUpdate.scheduledAt) {
    const scheduledDate = new Date(status.scheduledUpdate.scheduledAt);
    const dateFormatted = scheduledDate.toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });

    return (
      <div className="relative bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 px-4 py-2 text-white shadow-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 text-xs font-medium sm:text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-200" />
            <span>
              <strong>Update Grande Agendado:</strong> {status.scheduledUpdate.title} — Previsto para{" "}
              <u className="font-bold">{dateFormatted}</u> ({status.scheduledUpdate.estimatedDurationMinutes || 15} min de parada estipulada).
            </span>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="rounded p-1 hover:bg-white/20 transition-colors"
            title="Fechar aviso"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
