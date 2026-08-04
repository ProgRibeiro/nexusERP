"use client";

import React from "react";
import { CalendarDays, Grid2X2, LayoutDashboard, Users, Wrench } from "lucide-react";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export default function MobileNavigation() {
  const { openTabs, activeTabId, openTab, setSidebarOpen } = useWorkspace();
  const activeType = openTabs.find((tab) => tab.id === activeTabId)?.type || "dashboard";

  const items = [
    { type: "dashboard", label: "Início", icon: LayoutDashboard, run: () => openTab("dashboard", "Dashboard") },
    { type: "ordens-servico", label: "OS", icon: Wrench, run: () => openTab("ordens-servico", "Ordens de Serviço") },
    { type: "agenda", label: "Agenda", icon: CalendarDays, run: () => openTab("agenda", "Agenda") },
    { type: "clientes", label: "Clientes", icon: Users, run: () => openTab("clientes", "Clientes") },
    { type: "more", label: "Mais", icon: Grid2X2, run: () => setSidebarOpen(true) },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200/90 bg-white/95 px-2 pb-[max(.45rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_30px_rgba(15,23,42,.09)] backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/95 xl:hidden print:hidden" aria-label="Navegação principal móvel">
      <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.type !== "more" && activeType === item.type;
          return (
            <button
              key={item.type}
              type="button"
              onClick={item.run}
              className={`relative flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-bold transition ${active ? "bg-blue-50 text-blue-700 dark:bg-blue-950/45 dark:text-blue-300" : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"}`}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={18} strokeWidth={active ? 2.5 : 2} />
              <span>{item.label}</span>
              {active && <span className="absolute top-0 h-0.5 w-7 rounded-full bg-blue-600" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
