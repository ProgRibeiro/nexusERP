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
  ChevronDown,
  BarChart3,
  Calendar,
  ShieldCheck,
  LogOut,
  Briefcase,
  Network,
  ClipboardCheck,
  HardHat,
  Megaphone,
  X,
  Building2,
  Code2,
} from "lucide-react";
import {
  getNavigationIndicators,
  NavigationIndicators,
} from "@/app/actions/navigationActions";
import { getModuleFlags } from "@/app/actions/moduleActions";
import { getCompanySettingsAction } from "@/app/actions/settingsActions";

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
  const [moreOpen, setMoreOpen] = useState(false);
  const [moduleFlags,setModuleFlags] = useState<Record<string,boolean>>({});
  const [indicators, setIndicators] = useState<NavigationIndicators>({
    os: 0,
    faturamento: 0,
    fiscalErrors: 0,
    overdue: 0,
    stock: 0,
  });

  const [companyInfo, setCompanyInfo] = useState({
    tradeName: "NX ERP",
    logoUrl: "",
  });

  const loadCompanyData = async () => {
    try {
      const data = await getCompanySettingsAction();
      if (data) {
        setCompanyInfo({
          tradeName: data.tradeName || data.corporateName || "NX ERP",
          logoUrl: data.logoUrl || "",
        });
      }
    } catch {
      // Usa fallback padrão em caso de erro
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem("nx_sidebar_collapsed") === "true";
    const restoreTimer = window.setTimeout(() => setIsCollapsed(saved), 0);
    let active = true;
    const load = async () => {
      const data = await getNavigationIndicators();
      if (active) setIndicators(data);
    };
    void load();
    void loadCompanyData();
    void getModuleFlags().then(setModuleFlags).catch(()=>{});
    const timer = window.setInterval(load, 60_000);

    const handleCompanyUpdate = () => {
      void loadCompanyData();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("company-updated", handleCompanyUpdate);
    }

    return () => {
      active = false;
      window.clearTimeout(restoreTimer);
      window.clearInterval(timer);
      if (typeof window !== "undefined") {
        window.removeEventListener("company-updated", handleCompanyUpdate);
      }
    };
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

  const primaryItems: MenuItem[] = [
    { title: "Clientes", href: "/clientes", icon: Users, permission: "clients.read" },
    { title: "Orçamentos", href: "/orcamentos", icon: FileText, permission: "quotes.read" },
    { title: "Serviços", href: "/ordens-servico", icon: Wrench, permission: "os.read", indicator: "os" },
    { title: "Agenda", href: "/agenda", icon: Calendar, permission: "os.read" },
    { title: "Financeiro", href: "/financeiro", icon: DollarSign, permission: "financeiro.read", indicator: "overdue" },
  ];

  const sections: MenuSection[] = [
    {
      name: "Vendas e relacionamento",
      items: [
        {
          title: "CRM / Funil",
          href: "/crm",
          icon: Flame,
          permission: "crm.read",
        },
        {
          title: "Propostas Preventivas",
          href: "/orcamentos?tab=preventiva",
          icon: FileSignature,
          permission: "quotes.write",
        },
        {
          title: "Central de Preventivas",
          href: "/preventivas",
          icon: ClipboardCheck,
          permission: "quotes.read",
        },
        {
          title: "Marketing",
          href: "/marketing",
          icon: Megaphone,
          permission: "clients.read",
        },
      ],
    },
    {
      name: "Operação avançada",
      items: [
        {
          title: "Prestadores",
          href: "/prestadores",
          icon: HardHat,
          permission: "os.read",
        },
        {
          title: "Área do Técnico",
          href: "/execucao",
          icon: Smartphone,
          permission: "os.execute",
        },
        {
          title: "Relatórios",
          href: "/relatorios",
          icon: BarChart3,
          permission: "os.read",
        },
      ],
    },
    {
      name: "Fiscal",
      items: [
        {
          title: "Painel Fiscal",
          href: "/faturamento",
          icon: Receipt,
          permission: "faturamento.read",
          indicator: "faturamento",
        },
      ],
    },
    {
      name: "Gestão",
      items: [
        {
          title: "Teia de Dados",
          href: "/teia",
          icon: Network,
          permission: "clients.read",
        },
        {
          title: "Estoque / Peças",
          href: "/estoque",
          icon: Package,
          permission: "estoque.read",
          indicator: "stock",
        },
        {
          title: "Serviços",
          href: "/servicos",
          icon: Briefcase,
          permission: "estoque.read",
        },
        {
          title: "Contratos",
          href: "/contratos",
          icon: FileSignature,
          permission: "contratos.read",
        },
        {
          title: "Configurações",
          href: "/configuracoes",
          icon: Settings,
          permission: "admin.all",
        },
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
        className={`fixed xl:sticky left-0 top-0 h-[100dvh] overflow-visible bg-[radial-gradient(circle_at_8%_-10%,rgba(212,175,55,.26),transparent_18rem),radial-gradient(circle_at_92%_10%,rgba(255,255,255,.05),transparent_22rem),linear-gradient(180deg,#111216_0%,#14161b_54%,#0c0d10_100%)] text-chrome-200 border-r border-[#d4af37]/20 flex flex-col justify-between transition-all duration-300 select-none z-45 shrink-0 shadow-[16px_0_45px_rgba(0,0,0,.26)] ${
          isCollapsed ? "w-[286px] xl:w-[76px]" : "w-[286px] xl:w-[272px]"
        } ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full xl:translate-x-0"
        }`}
      >
        {/* Collapse button */}
        <button
          onClick={toggleCollapsed}
          className="absolute -right-3.5 top-7 z-10 hidden h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-[#d4af37]/35 bg-[#15161a] text-[#d4af37] shadow-md transition hover:border-[#d4af37] hover:bg-[#d4af37] hover:text-[#101113] xl:flex"
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        <div className="flex flex-col h-full overflow-hidden">
          {/* Header/Logo da Empresa */}
          <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-white/8 px-4">
            <div className="flex items-center gap-3 overflow-hidden">
              {companyInfo.logoUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={companyInfo.logoUrl}
                  alt={companyInfo.tradeName}
                  className="h-[38px] w-[38px] shrink-0 rounded-xl object-cover shadow-lg shadow-black/45 ring-1 ring-[#d4af37]/35 bg-zinc-900"
                />
              ) : (
                <Image
                  src="/icons/icon-192.png"
                  width={38}
                  height={38}
                  alt={companyInfo.tradeName}
                  className="h-[38px] w-[38px] shrink-0 rounded-xl shadow-lg shadow-black/45 ring-1 ring-[#d4af37]/35"
                  priority
                />
              )}
              {!isCollapsed && (
                <div className="min-w-0">
                  <span className="block truncate text-sm font-black tracking-tight text-white">
                    {companyInfo.tradeName}
                  </span>
                  <span className="block truncate text-[9px] font-bold uppercase tracking-[0.18em] text-[#e5c35e]/80">
                    Gestão integrada
                  </span>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white xl:hidden"
              aria-label="Fechar menu"
            >
              <X size={17} />
            </button>
          </div>

          {/* Simulator Profile Panel */}
          {user && !isCollapsed && (
            <div className="mx-3 my-3 flex shrink-0 flex-col gap-2 rounded-2xl border border-white/8 bg-white/[0.045] p-3.5 transition-all">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 truncate">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#d4af37]/35 bg-[#d4af37]/15 text-xs font-black uppercase text-[#f0cd62]">
                    {user.name.slice(0, 2)}
                  </div>
                  <div className="truncate">
                    <p className="truncate text-xs font-bold text-slate-100">
                      {user.name}
                    </p>
                    <p className="truncate text-[10px] text-slate-500">
                      {user.email}
                    </p>
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
                <span
                  className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${getRoleBadgeColor(user.roleName)}`}
                >
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
                    ? "bg-[#d4af37] text-[#111216] shadow-[0_12px_26px_rgba(0,0,0,.33)] ring-1 ring-[#f0d37f]/25"
                    : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
                }`}
                title="Início"
              >
                <LayoutDashboard
                  size={16}
                  className={`shrink-0 transition-transform group-hover:scale-105 ${
                    isLinkActive("/")
                      ? "text-[#111216]"
                      : "text-slate-400 group-hover:text-[#f0cd62]"
                  }`}
                />
                {!isCollapsed && <span>Início</span>}
              </button>
            )}

            {!isCollapsed && <span className="mb-1 mt-4 block px-3.5 text-[9px] font-black uppercase tracking-[0.18em] text-slate-600">Dia a dia</span>}
            {primaryItems.filter((item) => hasPermission(item.permission)).map((item) => {
              const Icon = item.icon;
              const isActive = isLinkActive(item.href);
              return <button type="button" key={item.href} onClick={() => {
                const [path, query] = item.href.slice(1).split("?");
                const params = query ? Object.fromEntries(new URLSearchParams(query)) : undefined;
                openTab(path, item.title, params); setSidebarOpen(false);
              }} className={`group relative flex min-h-10 w-full items-center gap-3 rounded-xl px-3.5 py-2 text-left text-xs font-bold transition-all duration-150 ${isActive ? "bg-[#d4af37] text-[#111216] shadow-[0_12px_26px_rgba(0,0,0,.33)] ring-1 ring-[#f0d37f]/25" : "text-slate-300 hover:bg-white/[0.06] hover:text-white"}`} title={item.title}>
                <Icon size={16} className={`shrink-0 ${isActive ? "text-[#111216]" : "text-slate-400 group-hover:text-[#f0cd62]"}`}/>
                {!isCollapsed && <span className="truncate">{item.title}</span>}
                {item.indicator && indicators[item.indicator] > 0 && <span className={`${isCollapsed ? "absolute right-1 top-1" : "ml-auto"} min-w-5 rounded-full bg-orange-500 px-1.5 py-0.5 text-center text-[9px] font-black text-white`}>{indicators[item.indicator] > 99 ? "99+" : indicators[item.indicator]}</span>}
              </button>;
            })}

            {!isCollapsed && <button type="button" onClick={() => setMoreOpen((value) => !value)} className="mt-4 flex min-h-10 w-full items-center gap-3 rounded-xl border border-white/[.06] bg-white/[.025] px-3.5 py-2 text-left text-xs font-bold text-slate-400 transition hover:bg-white/[.06] hover:text-white" aria-expanded={moreOpen}>
              <Settings size={16}/><span>Mais ferramentas</span><ChevronDown size={14} className={`ml-auto transition-transform ${moreOpen ? "rotate-180" : ""}`}/>
            </button>}

            {/* Recursos menos frequentes continuam disponíveis sem poluir o fluxo principal. */}
            {(isCollapsed || moreOpen || sections.some((section) => section.items.some((item) => isLinkActive(item.href)))) && sections.map((section) => {
              const filteredItems = section.items.filter((item) => {
                const moduleId=item.href.split("?")[0].replace("/","");
                return hasPermission(item.permission) && moduleFlags[moduleId] !== false;
              });

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
                          const params = query
                            ? Object.fromEntries(new URLSearchParams(query))
                            : undefined;
                          openTab(path, item.title, params);
                          setSidebarOpen(false);
                        }}
                        className={`group relative flex min-h-10 w-full items-center gap-3 rounded-xl px-3.5 py-2 text-left text-xs font-bold transition-all duration-150 ${
                          isActive
                            ? "bg-[#d4af37] text-[#111216] shadow-[0_12px_26px_rgba(0,0,0,.33)] ring-1 ring-[#f0d37f]/25"
                            : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
                        }`}
                        title={item.title}
                      >
                        <Icon
                          size={16}
                          className={`shrink-0 transition-transform group-hover:scale-105 ${
                            isActive
                              ? "text-[#111216]"
                              : "text-slate-400 group-hover:text-[#f0cd62]"
                          }`}
                        />
                        {!isCollapsed && (
                          <span className="truncate">{item.title}</span>
                        )}
                        {item.indicator && indicators[item.indicator] > 0 && (
                          <span
                            className={`${isCollapsed ? "absolute right-1 top-1" : "ml-auto"} min-w-5 rounded-full bg-orange-500 px-1.5 py-0.5 text-center text-[9px] font-black text-white`}
                          >
                            {indicators[item.indicator] > 99
                              ? "99+"
                              : indicators[item.indicator]}
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
          <div className="shrink-0 border-t border-white/8 p-3.5 space-y-2 text-center">
            <div className="flex items-center justify-center gap-2 rounded-xl border border-emerald-400/10 bg-emerald-400/[0.05] px-3 py-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,.10)]" />
              <p className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-slate-400">
                <ShieldCheck size={11} className="text-emerald-400" /> Sistema conectado
              </p>
            </div>

            <div className="pt-1 text-[9px] font-semibold text-zinc-400 space-y-0.5">
              <p>© 2026 Nexus ERP · Direitos Reservados</p>
              <p className="flex items-center justify-center gap-1 text-[#d4af37]/90 font-bold">
                <Code2 size={10} /> Desenvolvido por Lucas Ribeiro / ProgRibeiro
              </p>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
