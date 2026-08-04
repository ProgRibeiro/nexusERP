"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
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
  BarChart3,
  Calendar,
  ShieldCheck,
  LogOut,
  Briefcase,
  Network,
  ClipboardCheck,
  X,
} from "lucide-react";
import { getNavigationIndicators, NavigationIndicators } from "@/app/actions/navigationActions";

interface MenuItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
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
    const restoreTimer = window.setTimeout(() => setIsCollapsed(saved), 0);
    let active = true;
    const load = async () => {
      const data = await getNavigationIndicators();
      if (active) setIndicators(data);
    };
    void load();
    const timer = window.setInterval(load, 60_000);
    return () => { active = false; window.clearTimeout(restoreTimer); window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (!sidebarOpen || window.innerWidth >= 1280) return;
    const expandTimer = window.setTimeout(() => setIsCollapsed(false), 0);
    return () => window.clearTimeout(expandTimer);
  }, [sidebarOpen]);

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
        { title: "Propostas Preventivas", href: "/orcamentos?tab=preventiva", icon: FileSignature, permission: "quotes.write" },
        { title: "Central de Preventivas", href: "/preventivas", icon: ClipboardCheck, permission: "quotes.read" },
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
          className="fixed inset-0 z-40 bg-slate-950/65 backdrop-blur-sm xl:hidden animate-in fade-in duration-200"
        />
      )}

      <aside
        className={`fixed xl:sticky left-0 top-0 h-[100dvh] overflow-visible bg-[linear-gradient(180deg,#071328_0%,#0a1934_52%,#07101f_100%)] text-chrome-200 border-r border-white/8 flex flex-col justify-between transition-all duration-300 select-none z-45 shrink-0 shadow-[12px_0_32px_rgba(2,8,23,.12)] ${
          isCollapsed ? "w-[286px] xl:w-[76px]" : "w-[286px] xl:w-[272px]"
        } ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full xl:translate-x-0"
        }`}
      >
      {/* Collapse button */}
      <button
        onClick={toggleCollapsed}
        className="absolute -right-3.5 top-7 z-10 hidden h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-300 shadow-md transition hover:border-blue-500 hover:bg-blue-600 hover:text-white xl:flex"
      >
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      <div className="flex flex-col h-full overflow-hidden">
        {/* Header/Logo */}
        <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-white/8 px-4">
          <div className="flex items-center gap-3 overflow-hidden">
            <Image src="/icons/icon-192.png" width={38} height={38} alt="NX ERP" className="h-[38px] w-[38px] shrink-0 rounded-xl shadow-lg shadow-blue-950/40 ring-1 ring-white/15" priority />
            {!isCollapsed && (
              <div className="min-w-0">
                <span className="block truncate text-sm font-black tracking-tight text-white">NX ERP</span>
                <span className="block truncate text-[9px] font-bold uppercase tracking-[0.18em] text-blue-300/70">Gestão integrada</span>
              </div>
            )}
          </div>
          <button type="button" onClick={() => setSidebarOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white xl:hidden" aria-label="Fechar menu">
            <X size={17} />
          </button>
        </div>

        {/* Simulator Profile Panel */}
        {user && !isCollapsed && (
          <div className="mx-3 my-3 flex shrink-0 flex-col gap-2 rounded-2xl border border-white/8 bg-white/[0.045] p-3.5 transition-all">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 truncate">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-400/15 bg-blue-500/10 text-xs font-black uppercase text-blue-200">
                  {user.name.slice(0, 2)}
                </div>
                <div className="truncate">
                  <p className="truncate text-xs font-bold text-slate-100">{user.name}</p>
                  <p className="truncate text-[10px] text-slate-500">{user.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={logout}
                className="shrink-0 cursor-pointer rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
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
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-4 pt-2 scrollbar-none">
          {/* Dashboard Item */}
          {hasPermission("dashboard.view") && (
            <button
              type="button"
              onClick={() => {
                openTab("dashboard", "Dashboard");
                setSidebarOpen(false);
              }}
              className={`group relative flex min-h-10 w-full items-center gap-3 rounded-xl px-3.5 py-2 text-left text-xs font-bold transition-all duration-150 ${
                isLinkActive("/")
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-950/30"
                  : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
              }`}
              title="Dashboard"
            >
              <LayoutDashboard
                size={16}
                className={`shrink-0 transition-transform group-hover:scale-105 ${
                  isLinkActive("/") ? "text-white" : "text-slate-400 group-hover:text-blue-200"
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
                  <span className="mb-1.5 block px-3.5 text-[9px] font-black uppercase tracking-[0.18em] text-slate-600">
                    {section.name}
                  </span>
                ) : (
                  <div className="my-2 border-t border-white/8" />
                )}

                {filteredItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = isLinkActive(item.href);
                  return (
                    <button
                      type="button"
                      key={item.href}
                      onClick={() => {
                        const [path, query] = item.href.slice(1).split("?");
                        const params = query ? Object.fromEntries(new URLSearchParams(query)) : undefined;
                        openTab(path, item.title, params);
                        setSidebarOpen(false);
                      }}
                      className={`group relative flex min-h-10 w-full items-center gap-3 rounded-xl px-3.5 py-2 text-left text-xs font-bold transition-all duration-150 ${
                        isActive
                          ? "bg-blue-600 text-white shadow-lg shadow-blue-950/30"
                          : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
                      }`}
                      title={item.title}
                    >
                      <Icon
                        size={16}
                        className={`shrink-0 transition-transform group-hover:scale-105 ${
                          isActive ? "text-white" : "text-slate-400 group-hover:text-blue-200"
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
        <div className="shrink-0 border-t border-white/8 p-4">
          <div className="flex items-center justify-center gap-2 rounded-xl border border-emerald-400/10 bg-emerald-400/[0.05] px-3 py-2.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,.10)]" />
            <p className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-slate-400">
              <ShieldCheck size={11} className="text-emerald-400" /> Sistema conectado
            </p>
          </div>
        </div>
      )}
      </aside>
    </>
  );
}
