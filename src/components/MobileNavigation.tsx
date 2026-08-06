"use client";

import React from "react";
import { CalendarDays, FileText, LayoutDashboard, Receipt, Wrench } from "lucide-react";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export default function MobileNavigation() {
  const { activeTab, openTab } = useWorkspace();
  const activeType = activeTab.type;

  const items = [
    { type: "dashboard", label: "Início", icon: LayoutDashboard, run: () => openTab("dashboard", "Dashboard") },
    { type: "ordens-servico", label: "OS", icon: Wrench, run: () => openTab("ordens-servico", "Ordens de Serviço") },
    { type: "agenda", label: "Agenda", icon: CalendarDays, run: () => openTab("agenda", "Agenda") },
    { type: "orcamentos", label: "Orçamentos", icon: FileText, run: () => openTab("orcamentos", "Orçamentos") },
    { type: "faturamento", label: "Faturamento", icon: Receipt, run: () => openTab("faturamento", "Painel Fiscal") },
  ];

  return (
    <nav className="fixed inset-x-2 bottom-2 z-40 rounded-[22px] border border-white/80 bg-white/90 px-2 pb-[max(.35rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_18px_48px_rgba(15,23,42,.20)] ring-1 ring-slate-950/5 backdrop-blur-2xl dark:border-zinc-800 dark:bg-zinc-950/90 dark:ring-white/5 xl:hidden print:hidden" aria-label="Navegação principal móvel">
      <div className="mx-auto grid max-w-xl grid-cols-5 gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = activeType === item.type;
          return (
            <button
              key={item.type}
              type="button"
              onClick={item.run}
              className={`relative flex min-h-12 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[9px] font-black transition ${active ? "bg-gradient-to-b from-blue-50 to-blue-100/70 text-blue-700 shadow-sm dark:from-blue-950/60 dark:to-blue-950/35 dark:text-blue-300" : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"}`}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={18} strokeWidth={active ? 2.5 : 2} />
              <span>{item.label}</span>
              {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-gradient-to-r from-blue-600 to-cyan-400" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
