"use client";

import React from "react";
import { X, Pin, Sparkles, Wrench, Users, DollarSign, Receipt, Package, FileText, Settings, FileSignature } from "lucide-react";
import { useWorkspace, Tab } from "@/contexts/WorkspaceContext";

export default function FloatingTabsBar() {
  const { openTabs, activeTabId, openTab, closeTab, togglePinTab } = useWorkspace();

  const getTabIcon = (type: string) => {
    switch (type) {
      case "dashboard":
        return <Sparkles size={13} className="text-indigo-500" />;
      case "clientes":
        return <Users size={13} className="text-blue-500" />;
      case "ordens-servico":
        return <Wrench size={13} className="text-emerald-500" />;
      case "financeiro":
        return <DollarSign size={13} className="text-teal-500" />;
      case "faturamento":
        return <Receipt size={13} className="text-amber-500" />;
      case "estoque":
        return <Package size={13} className="text-orange-500" />;
      case "contratos":
        return <FileSignature size={13} className="text-purple-500" />;
      case "orcamentos":
        return <FileText size={13} className="text-pink-500" />;
      case "configuracoes":
        return <Settings size={13} className="text-zinc-500" />;
      default:
        return <FileText size={13} className="text-zinc-400" />;
    }
  };

  const getStatusDotColor = (status: Tab["status"]) => {
    switch (status) {
      case "success":
        return "bg-success";
      case "warning":
        return "bg-warning animate-pulse";
      case "error":
        return "bg-danger animate-pulse";
      case "active":
        return "bg-primary";
      default:
        return null;
    }
  };

  return (
    <div className="z-20 hidden w-full shrink-0 select-none items-center gap-1.5 overflow-x-auto border-b border-zinc-200/80 bg-white/80 px-4 py-2 backdrop-blur-lg scrollbar-none sm:flex lg:px-6 dark:border-zinc-800/80 dark:bg-zinc-950/80">
      {openTabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        const statusColor = getStatusDotColor(tab.status);
        const icon = getTabIcon(tab.type);

        return (
          <div
            key={tab.id}
            className={`group relative inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition-all duration-150 ${
              isActive
                ? "border-blue-200 bg-blue-50 text-blue-800 shadow-sm dark:border-blue-900/70 dark:bg-blue-950/35 dark:text-blue-200"
                : "border-transparent bg-transparent text-zinc-500 hover:border-zinc-200 hover:bg-white hover:text-zinc-850 dark:text-zinc-400 dark:hover:border-zinc-800 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            <button
              type="button"
              onClick={() => openTab(tab.type, tab.title, tab.params)}
              className="flex min-w-0 items-center gap-2 cursor-pointer"
              aria-current={isActive ? "page" : undefined}
              aria-label={`Ativar aba ${tab.title}`}
            >
              {statusColor && (
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusColor}`} />
              )}
              <span className="shrink-0">{icon}</span>
              <span className="truncate max-w-[120px]">{tab.title}</span>
              {isActive && <span className="absolute inset-x-3 -bottom-[9px] h-0.5 rounded-full bg-blue-600" />}
            </button>

            {/* Action buttons (Pin/Close) */}
            <div className="flex items-center gap-1 shrink-0 ml-1">
              {/* Pin indicator */}
              {tab.pinned && tab.id !== "dashboard" && (
                <button
                  type="button"
                  aria-label={`Desafixar aba ${tab.title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePinTab(tab.id);
                  }}
                  className="text-zinc-400 hover:text-primary transition-all p-0.5 rounded cursor-pointer"
                >
                  <Pin size={10} className="fill-current rotate-45" />
                </button>
              )}

              {/* Close Button */}
              {!tab.pinned && (
                <button
                  type="button"
                  aria-label={`Fechar aba ${tab.title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className="text-zinc-400 hover:text-danger dark:hover:text-red-400 transition-all p-0.5 rounded opacity-60 hover:opacity-100 hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50 cursor-pointer"
                >
                  <X size={11} />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
