"use client";

import React, { useEffect, useState } from "react";
import { getMaintenanceStatusAction } from "@/app/actions/maintenanceActions";
import type { MaintenanceStatus } from "@/lib/maintenance";
import { AlertTriangle, Clock, Wrench, X } from "lucide-react";

export function MaintenanceBanner() {
  const [status, setStatus] = useState<MaintenanceStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let mounted = true;
    getMaintenanceStatusAction().then((res) => {
      if (mounted) setStatus(res);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (dismissed || !status) return null;

  // Se o modo de manutenção estiver ativado, a tela cheia de manutenção é exibida.
  if (status.isMaintenanceActive) {
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
          <div className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-slate-900/80 p-3 text-xs text-amber-300 border border-amber-500/20">
            <Clock className="h-4 w-4" />
            <span>Atualização autônoma de 3h em andamento. Volte em instantes.</span>
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
