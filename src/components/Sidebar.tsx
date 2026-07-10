"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  Users,
  FileText,
  Wrench,
  Smartphone,
  Receipt,
  DollarSign,
  Package,
  FileSignature,
  Settings,
  Flame,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";

interface MenuItem {
  title: string;
  href: string;
  icon: React.ComponentType<any>;
  permission: string;
}

interface MenuSection {
  name: string;
  items: MenuItem[];
}

export default function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { hasPermission, user } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const currentTab = searchParams.get("tab");
  const currentAction = searchParams.get("action");

  const topItems: MenuItem[] = [
    { title: "Dashboard", href: "/", icon: LayoutDashboard, permission: "dashboard.view" },
  ];

  const sections: MenuSection[] = [
    {
      name: "Comercial",
      items: [
        { title: "CRM / Funil", href: "/crm", icon: Flame, permission: "crm.read" },
        { title: "Clientes", href: "/clientes", icon: Users, permission: "clients.read" },
        { title: "Orçamentos", href: "/orcamentos", icon: FileText, permission: "quotes.read" },
      ],
    },
    {
      name: "Operação",
      items: [
        { title: "Ordens de Serviço", href: "/ordens-servico", icon: Wrench, permission: "os.read" },
        { title: "Área do Técnico", href: "/execucao", icon: Smartphone, permission: "os.execute" },
        { title: "Relatórios", href: "/relatorios", icon: FileText, permission: "os.read" },
      ],
    },
    {
      name: "Fiscal",
      items: [
        { title: "Painel Fiscal", href: "/faturamento", icon: Receipt, permission: "faturamento.read" },
        { title: "Emitir NFS-e", href: "/faturamento?action=emitir", icon: Receipt, permission: "faturamento.write" },
        { title: "Notas Rejeitadas", href: "/faturamento?tab=rejeitadas", icon: Receipt, permission: "faturamento.read" },
      ],
    },
    {
      name: "Financeiro",
      items: [
        { title: "Contas a Receber", href: "/financeiro?tab=receber", icon: DollarSign, permission: "financeiro.read" },
        { title: "Contas a Pagar", href: "/financeiro?tab=pagar", icon: DollarSign, permission: "financeiro.read" },
        { title: "Fluxo de Caixa", href: "/financeiro?tab=extrato", icon: DollarSign, permission: "financeiro.read" },
        { title: "DRE Gerencial", href: "/financeiro?tab=dre", icon: DollarSign, permission: "financeiro.read" },
      ],
    },
    {
      name: "Gestão",
      items: [
        { title: "Estoque / Peças", href: "/estoque", icon: Package, permission: "estoque.read" },
        { title: "Contratos", href: "/contratos", icon: FileSignature, permission: "contratos.read" },
        { title: "Configurações", href: "/configuracoes", icon: Settings, permission: "admin.all" },
      ],
    },
  ];

  // Helper para verificar se a rota com query param está ativa
  const isLinkActive = (href: string) => {
    const [basePath, query] = href.split("?");
    if (pathname !== basePath) return false;
    if (!query) {
      return !currentTab && !currentAction;
    }
    const params = new URLSearchParams(query);
    const tab = params.get("tab");
    const action = params.get("action");
    if (tab && currentTab !== tab) return false;
    if (action && currentAction !== action) return false;
    return true;
  };

  const getRoleBadgeColor = (roleName: string) => {
    switch (roleName) {
      case "Administrador":
        return "bg-red-500/10 text-red-500 border border-red-500/20";
      case "Gestor":
        return "bg-purple-500/10 text-purple-500 border border-purple-500/20";
      case "Comercial":
        return "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20";
      case "Operacional":
        return "bg-indigo-500/10 text-indigo-500 border border-indigo-500/20";
      case "Técnico":
        return "bg-blue-500/10 text-blue-500 border border-blue-500/20";
      case "Faturamento":
        return "bg-amber-500/10 text-amber-500 border border-amber-500/20";
      case "Financeiro":
        return "bg-cyan-500/10 text-cyan-500 border border-cyan-500/20";
      default:
        return "bg-zinc-500/10 text-zinc-500 border border-zinc-500/20";
    }
  };

  return (
    <aside
      className={`h-screen bg-zinc-950 text-zinc-200 border-r border-zinc-900 flex flex-col justify-between transition-all duration-300 relative select-none ${
        isCollapsed ? "w-20" : "w-64"
      }`}
    >
      {/* Botão de recolhimento */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-6 bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white rounded-full p-1 cursor-pointer z-10 hidden md:block"
      >
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      <div className="flex flex-col h-full overflow-hidden">
        {/* Header da Sidebar */}
        <div className="p-5 border-b border-zinc-900 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="bg-gradient-to-tr from-emerald-500 to-indigo-600 p-2.5 rounded-xl shadow-lg shadow-emerald-500/10 flex items-center justify-center shrink-0">
              <Sparkles size={20} className="text-white" />
            </div>
            {!isCollapsed && (
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-zinc-100 to-zinc-400 bg-clip-text text-transparent truncate">
                Antigravity ERP
              </span>
            )}
          </div>
        </div>

        {/* Informações do Usuário Logado */}
        {user && !isCollapsed && (
          <div className="p-4 mx-4 my-3 bg-zinc-900/40 rounded-xl border border-zinc-900/80 flex flex-col gap-1.5 shrink-0 transition-all">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center text-sm font-bold text-zinc-100 uppercase border border-zinc-800">
                {user.name.slice(0, 2)}
              </div>
              <div className="truncate">
                <p className="font-medium text-sm text-zinc-100 truncate">{user.name}</p>
                <p className="text-xs text-zinc-400 truncate">{user.email}</p>
              </div>
            </div>
            <div className="mt-1">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${getRoleBadgeColor(user.roleName)}`}>
                {user.roleName}
              </span>
            </div>
          </div>
        )}

        {/* Menu de Navegação Rolável */}
        <nav className="px-3 py-4 flex flex-col gap-1 overflow-y-auto flex-1">
          {/* Item do Topo (Dashboard) */}
          {topItems
            .filter((item) => hasPermission(item.permission))
            .map((item) => {
              const Icon = item.icon;
              const isActive = isLinkActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${
                    isActive
                      ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/10 font-semibold"
                      : "text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-100"
                  }`}
                  title={item.title}
                >
                  <Icon
                    size={18}
                    className={`shrink-0 transition-transform group-hover:scale-105 ${
                      isActive ? "text-white" : "text-zinc-400 group-hover:text-zinc-200"
                    }`}
                  />
                  {!isCollapsed && <span>{item.title}</span>}
                </Link>
              );
            })}

          {/* Seções Agrupadas */}
          {sections.map((section) => {
            const filteredSectionItems = section.items.filter((item) =>
              hasPermission(item.permission)
            );

            if (filteredSectionItems.length === 0) return null;

            return (
              <div key={section.name} className="flex flex-col gap-0.5 mt-4">
                {/* Título da Seção */}
                {!isCollapsed ? (
                  <span className="px-3.5 text-[10px] font-bold text-zinc-500 tracking-wider uppercase mb-1.5 block">
                    {section.name}
                  </span>
                ) : (
                  <div className="border-t border-zinc-900/60 my-2" />
                )}

                {/* Itens da Seção */}
                {filteredSectionItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = isLinkActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${
                        isActive
                          ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/10 font-semibold"
                          : "text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-100"
                      }`}
                      title={item.title}
                    >
                      <Icon
                        size={18}
                        className={`shrink-0 transition-transform group-hover:scale-105 ${
                          isActive ? "text-white" : "text-zinc-400 group-hover:text-zinc-200"
                        }`}
                      />
                      {!isCollapsed && <span className="truncate">{item.title}</span>}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Footer da Sidebar */}
      {!isCollapsed && (
        <div className="p-4 border-t border-zinc-900 text-center shrink-0">
          <p className="text-[10px] text-zinc-500">v1.0 • Antigravity Clima</p>
        </div>
      )}
    </aside>
  );
}
