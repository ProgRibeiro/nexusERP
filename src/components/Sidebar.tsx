"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
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
  BarChart3,
  Calendar,
  Layers,
  ShieldCheck,
  LogOut,
  Briefcase,
  Network,
  ClipboardCheck
} from "lucide-react";
import { getNavigationIndicators, NavigationIndicators } from "@/app/actions/navigationActions";

interface MenuItem {
  title: string;
  href: string;
  icon: React.ComponentType<any>;
  permission: string;
  indicator?: keyof NavigationIndicators;
}

interface MenuSection {
  name: string;
  items: MenuItem[];
}

export default function Sidebar() {
  const { hasPermission, user, logout } = useAuth();
  const { activeTabId, openTab, sidebarOpen, setSidebarOpen } = useWorkspace();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [indicators, setIndicators] = useState<NavigationIndicators>({ os: 0, faturamento: 0, fiscalErrors: 0, overdue: 0, stock: 0 });

  useEffect(() => {
    const saved = localStorage.getItem("nx_sidebar_collapsed") === "true";
    setIsCollapsed(saved);
    let active = true;
    const load = async () => {
      const data = await getNavigationIndicators();
      if (active) setIndicators(data);
    };
    void load();
    const timer = window.setInterval(load, 60_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const toggleCollapsed = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    localStorage.setItem("nx_sidebar_collapsed", String(next));
  };

  const sections: MenuSection[] = [
    {
      name: "Comercial",
      items: [
        { title: "CRM / Funil", href: "/crm", icon: Flame, permission: "crm.read" },
        { title: "Clientes", href: "/clientes", icon: Users, permission: "clients.read" },
        { title: "Orçamentos", href: "/orcamentos", icon: FileText, permission: "quotes.read" },
        { title: "Propostas Preventivas", href: "/preventivas", icon: ClipboardCheck, permission: "quotes.read" },
      ],
    },
    {
      name: "Operação",
      items: [
        { title: "Ordens de Serviço", href: "/ordens-servico", icon: Wrench, permission: "os.read", indicator: "os" },
        { title: "Agenda", href: "/agenda", icon: Calendar, permission: "os.read" },
        { title: "Área do Técnico", href: "/execucao", icon: Smartphone, permission: "os.execute" },
        { title: "Relatórios", href: "/relatorios", icon: BarChart3, permission: "os.read" },
      ],
    },
    {
      name: "Fiscal",
      items: [
        { title: "Painel Fiscal", href: "/faturamento", icon: Receipt, permission: "faturamento.read", indicator: "faturamento" },
      ],
    },
    {
      name: "Financeiro",
      items: [
        { title: "Financeiro Geral", href: "/financeiro", icon: DollarSign, permission: "financeiro.read", indicator: "overdue" },
      ],
    },
    {
      name: "Gestão",
      items: [
        { title: "Teia de Dados", href: "/teia", icon: Network, permission: "clients.read" },
        { title: "Estoque / Peças", href: "/estoque", icon: Package, permission: "estoque.read", indicator: "stock" },
        { title: "Serviços", href: "/servicos", icon: Briefcase, permission: "estoque.read" },
        { title: "Contratos", href: "/contratos", icon: FileSignature, permission: "contratos.read" },
        { title: "Configurações", href: "/configuracoes", icon: Settings, permission: "admin.all" },
      ],
    },
  ];

  // Match active links with Workspace Active Tab ID
  const isLinkActive = (href: string) => {
    const [basePath, query] = href.split("?");
    const path = basePath.replace("/", "");

    if (path === "" && activeTabId === "dashboard") return true;
    if (!query) {
      return activeTabId === path;
    }
    const params = new URLSearchParams(query);
    const tab = params.get("tab");
    const action = params.get("action");

    if (tab && activeTabId === `${path}?tab=${tab}`) return true;
    if (action && activeTabId === `${path}?action=${action}`) return true;
    return activeTabId.startsWith(path) && !tab && !action;
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
        return "bg-chrome-500/10 text-chrome-500 border border-chrome-500/20";
    }
  };

  return (
    <>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 z-40 xl:hidden animate-in fade-in duration-200"
        />
      )}

      <aside
        className={`fixed xl:sticky left-0 top-0 h-screen bg-chrome-950 text-chrome-200 border-r border-chrome-900 flex flex-col justify-between transition-all duration-300 select-none z-45 shrink-0 ${
          isCollapsed ? "w-20" : "w-64"
        } ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full xl:translate-x-0"
        }`}
      >
      {/* Collapse button */}
      <button
        onClick={toggleCollapsed}
        className="absolute -right-3 top-6 bg-chrome-900 border border-chrome-800 text-chrome-300 hover:text-white rounded-full p-1 cursor-pointer z-10 hidden xl:block"
      >
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      <div className="flex flex-col h-full overflow-hidden">
        {/* Header/Logo */}
        <div className="p-5 border-b border-chrome-900 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="bg-primary p-2 rounded-lg flex items-center justify-center shrink-0">
              <Sparkles size={18} className="text-white" />
            </div>
            {!isCollapsed && (
              <span className="font-bold text-sm tracking-tight text-white truncate">
                NX ERP
              </span>
            )}
          </div>
        </div>

        {/* Simulator Profile Panel */}
        {user && !isCollapsed && (
          <div className="p-4 mx-4 my-3 bg-chrome-900/40 rounded-xl border border-chrome-900/80 flex flex-col gap-1.5 shrink-0 transition-all">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 truncate">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-chrome-700 to-chrome-900 flex items-center justify-center text-xs font-bold text-chrome-150 uppercase border border-chrome-800">
                  {user.name.slice(0, 2)}
                </div>
                <div className="truncate">
                  <p className="font-semibold text-xs text-chrome-100 truncate">{user.name}</p>
                  <p className="text-[10px] text-chrome-500 truncate">{user.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={logout}
                className="p-1.5 text-chrome-500 hover:text-red-400 hover:bg-chrome-800/40 rounded-lg transition-colors cursor-pointer shrink-0"
                title="Sair do Sistema"
              >
                <LogOut size={13} />
              </button>
            </div>
            <div className="mt-1">
              <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${getRoleBadgeColor(user.roleName)}`}>
                {user.roleName}
              </span>
            </div>
          </div>
        )}

        {/* Scrollable Navigation */}
        <nav className="px-3 py-4 flex flex-col gap-1 overflow-y-auto flex-1 scrollbar-none">
          {/* Dashboard Item */}
          {hasPermission("dashboard.view") && (
            <button
              type="button"
              onClick={() => {
                openTab("dashboard", "Dashboard");
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-left text-xs font-bold transition-all duration-150 group ${
                isLinkActive("/")
                  ? "bg-chrome-900 text-white"
                  : "text-chrome-400 hover:bg-chrome-900/60 hover:text-chrome-100"
              }`}
              title="Dashboard"
            >
              <LayoutDashboard
                size={16}
                className={`shrink-0 transition-transform group-hover:scale-105 ${
                  isLinkActive("/") ? "text-white" : "text-chrome-400 group-hover:text-chrome-200"
                }`}
              />
              {!isCollapsed && <span>Dashboard</span>}
            </button>
          )}

          {/* Grouped Sections */}
          {sections.map((section) => {
            const filteredItems = section.items.filter((item) =>
              hasPermission(item.permission)
            );

            if (filteredItems.length === 0) return null;

            return (
              <div key={section.name} className="flex flex-col gap-0.5 mt-4">
                {!isCollapsed ? (
                  <span className="px-3.5 text-[9px] font-bold text-chrome-500 tracking-wider uppercase mb-1.5 block">
                    {section.name}
                  </span>
                ) : (
                  <div className="border-t border-chrome-900/60 my-2" />
                )}

                {filteredItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = isLinkActive(item.href);
                  return (
                    <button
                      type="button"
                      key={item.href}
                      onClick={() => {
                        openTab(item.href.slice(1), item.title);
                        setSidebarOpen(false);
                      }}
                      className={`relative w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-left text-xs font-bold transition-all duration-150 group ${
                        isActive
                          ? "bg-chrome-900 text-white"
                          : "text-chrome-400 hover:bg-chrome-900/60 hover:text-chrome-100"
                      }`}
                      title={item.title}
                    >
                      <Icon
                        size={16}
                        className={`shrink-0 transition-transform group-hover:scale-105 ${
                          isActive ? "text-white" : "text-chrome-400 group-hover:text-chrome-200"
                        }`}
                      />
                      {!isCollapsed && <span className="truncate">{item.title}</span>}
                      {item.indicator && indicators[item.indicator] > 0 && (
                        <span className={`${isCollapsed ? "absolute right-1 top-1" : "ml-auto"} min-w-5 rounded-full bg-orange-500 px-1.5 py-0.5 text-center text-[9px] font-black text-white`}>
                          {indicators[item.indicator] > 99 ? "99+" : indicators[item.indicator]}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </div>

      {!isCollapsed && (
        <div className="p-4 border-t border-chrome-900 text-center shrink-0">
          <p className="text-[9px] text-chrome-650 font-bold uppercase tracking-wider flex items-center justify-center gap-1">
            <ShieldCheck size={11} className="text-chrome-550" />
            NX Climatização
          </p>
        </div>
      )}
      </aside>
    </>
  );
}
