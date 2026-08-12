"use client";

import React, { useState, useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  NotificationDTO,
} from "@/app/actions/notificationActions";
import { searchGlobalAction, SearchResult } from "@/app/actions/searchActions";
import {
  Bell,
  CheckCircle,
  Package,
  DollarSign,
  Wrench,
  Flame,
  Search,
  Plus,
  X,
  Sun,
  Moon,
  Keyboard,
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { CommandPalette } from "./ui/CommandPalette";
import { getSearchResultTarget } from "@/lib/searchNavigation";
import PwaInstallButton from "./PwaInstallButton";

// Badge color shown next to each global search result type.
const SEARCH_RESULT_BADGE: Record<SearchResult["type"], string> = {
  cliente:
    "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-450 border-blue-100 dark:border-blue-900/40",
  lead: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/40",
  equipamento:
    "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-400 border-cyan-100 dark:border-cyan-900/40",
  os: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-450 border-emerald-100 dark:border-emerald-900/40",
  orcamento:
    "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-450 border-amber-100 dark:border-amber-900/40",
  nota: "bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-450 border-purple-100 dark:border-purple-900/40",
  receber:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/40",
  pagar:
    "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-100 dark:border-rose-900/40",
  contrato:
    "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-450 border-indigo-100 dark:border-indigo-900/40",
  produto:
    "bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-450 border-orange-100 dark:border-orange-900/40",
  usuario:
    "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700",
};

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, users, switchUser } = useAuth();
  const {
    darkMode,
    toggleDarkMode,
    openTab,
    activeTab,
    sidebarOpen,
    setSidebarOpen,
  } = useWorkspace();

  const [notifications, setNotifications] = useState<NotificationDTO[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  // Search & Contextual New states
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNewOpen, setIsNewOpen] = useState(false);

  const contextualNewItems = useMemo(() => {
    const requestId = () => String(Date.now());
    if (activeTab?.type === "clientes" && activeTab.params?.id) {
      return [
        {
          label: "Orçamento para este cliente",
          color: "bg-amber-500",
          run: () =>
            openTab("orcamentos", "Novo orçamento", {
              new: "true",
              clientId: activeTab.params.id,
              requestId: requestId(),
            }),
        },
        {
          label: "OS deste cliente",
          color: "bg-emerald-500",
          run: () =>
            openTab("ordens-servico", "OS do cliente", {
              clientId: activeTab.params.id,
            }),
        },
        {
          label: "Cobrança para este cliente",
          color: "bg-cyan-500",
          run: () =>
            openTab("financeiro", "Nova cobrança", {
              tab: "receber",
              new: "true",
              type: "RECEITA",
              clientId: activeTab.params.id,
              requestId: requestId(),
            }),
        },
      ];
    }
    if (activeTab?.type === "ordens-servico" && activeTab.params?.id) {
      return [
        {
          label: "Adicionar material",
          color: "bg-orange-500",
          run: () =>
            openTab("ordens-servico", activeTab.title, {
              id: activeTab.params.id,
              section: "materials",
            }),
        },
        {
          label: "Gerar relatório",
          color: "bg-blue-500",
          run: () =>
            openTab("ordens-servico", activeTab.title, {
              id: activeTab.params.id,
              section: "relatorio",
            }),
        },
        {
          label: "Abrir controle fiscal",
          color: "bg-purple-500",
          run: () => openTab("faturamento", "Painel Fiscal"),
        },
      ];
    }
    if (activeTab?.type === "financeiro") {
      return [
        {
          label: "Nova conta a receber",
          color: "bg-emerald-500",
          run: () =>
            openTab("financeiro", "Nova receita", {
              tab: "receber",
              new: "true",
              type: "RECEITA",
              requestId: requestId(),
            }),
        },
        {
          label: "Nova conta a pagar",
          color: "bg-rose-500",
          run: () =>
            openTab("financeiro", "Nova despesa", {
              tab: "pagar",
              new: "true",
              type: "DESPESA",
              requestId: requestId(),
            }),
        },
      ];
    }
    if (activeTab?.type === "estoque") {
      return [
        {
          label: "Novo produto ou peça",
          color: "bg-orange-500",
          run: () =>
            openTab("estoque", "Estoque", {
              new: "true",
              requestId: requestId(),
            }),
        },
      ];
    }
    if (activeTab?.type === "contratos") {
      return [
        {
          label: "Novo contrato",
          color: "bg-purple-500",
          run: () =>
            openTab("contratos", "Contratos", {
              new: "true",
              requestId: requestId(),
            }),
        },
      ];
    }
    return [];
  }, [activeTab, openTab]);

  // Listen to keyboard shortcut (Ctrl+K or Cmd+K) to open palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Load notifications
  useEffect(() => {
    async function loadNotif() {
      try {
        const data = await getNotifications();
        setNotifications(data);
      } catch (err) {
        console.error(err);
      }
    }
    loadNotif();
    const interval = setInterval(loadNotif, 30000);
    return () => clearInterval(interval);
  }, []);

  // Global search effect
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      try {
        const data = await searchGlobalAction(searchQuery);
        setSearchResults(data);
        setIsSearchOpen(true);
      } catch (err) {
        console.error(err);
      }
    }, 250);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getPageTitle = (path: string) => {
    if (path === "/") return "Dashboard Geral";
    if (path.startsWith("/crm")) return "Pipeline Comercial & CRM";
    if (path.startsWith("/clientes")) return "Gestão de Clientes e Prontuários";
    if (path.startsWith("/orcamentos")) return "Propostas e Orçamentos";
    if (path.startsWith("/ordens-servico"))
      return "Controle de Ordens de Serviço";
    if (path.startsWith("/faturamento"))
      return "Faturamento e Emissão de Notas";
    if (path.startsWith("/financeiro")) return "Financeiro Integrado";
    if (path.startsWith("/estoque")) return "Controle de Estoque & Peças";
    if (path.startsWith("/contratos"))
      return "Gestão de Contratos de Manutenção";
    if (path.startsWith("/configuracoes"))
      return "Configurações & Logs de Auditoria";
    return "NX ERP";
  };

  const getNotifIcon = (type: string) => {
    switch (type) {
      case "ESTOQUE":
        return <Package size={14} className="text-amber-500" />;
      case "FINANCEIRO":
        return <DollarSign size={14} className="text-emerald-500" />;
      case "OPERACIONAL":
        return <Wrench size={14} className="text-blue-500" />;
      case "COMERCIAL":
        return <Flame size={14} className="text-indigo-500" />;
      default:
        return <Bell size={14} className="text-zinc-500" />;
    }
  };

  const handleNotifClick = async (notif: NotificationDTO) => {
    if (!notif.read) {
      await markNotificationAsRead(notif.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n)),
      );
    }
    setIsNotifOpen(false);
    if (notif.link) {
      router.push(notif.link);
    }
  };

  const handleMarkAllAsRead = async () => {
    await markAllNotificationsAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleUserSwitch = async (email: string) => {
    const res = await switchUser(email);
    setIsProfileOpen(false);
    if (!res.success) {
      alert(res.error || "Não foi possível trocar de perfil.");
      return;
    }
    router.refresh();
  };

  const getRoleColorClass = (role: string) => {
    switch (role) {
      case "Administrador":
        return "text-red-500 bg-red-500/10";
      case "Gestor":
        return "text-purple-500 bg-purple-500/10";
      case "Comercial":
        return "text-emerald-500 bg-emerald-500/10";
      case "Operacional":
        return "text-indigo-500 bg-indigo-500/10";
      case "Técnico":
        return "text-blue-500 bg-blue-500/10";
      case "Faturamento":
        return "text-amber-500 bg-amber-500/10";
      case "Financeiro":
        return "text-cyan-500 bg-cyan-500/10";
      default:
        return "text-zinc-500 bg-zinc-500/10";
    }
  };

  return (
    <header className="relative z-30 flex h-[68px] shrink-0 select-none items-center justify-between gap-2 border-b border-[#d9d0bc]/90 bg-[#fffdf7]/86 px-3 shadow-[0_8px_30px_rgba(18,18,18,.06)] backdrop-blur-2xl sm:px-4 lg:h-[76px] lg:px-7 dark:border-[#2d2f35] dark:bg-[#111216]/88">
      {/* Title & Mobile Menu Toggle */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 shadow-sm hover:border-[#d4af37]/45 hover:bg-[#f6ebc8] hover:text-[#6f5614] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-[#d4af37]/50 dark:hover:bg-[#2b250f] xl:hidden"
          title="Menu Lateral"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
        <div className="min-w-0">
          <p className="hidden text-[8px] font-black uppercase tracking-[0.28em] text-[#b3881f] sm:block dark:text-[#d4af37]">
            NX Workspace
          </p>
          <h1 className="max-w-[35vw] truncate text-sm font-black leading-tight tracking-[-0.025em] text-zinc-950 sm:max-w-[42vw] lg:max-w-none lg:text-xl dark:text-white">
            {activeTab?.title || getPageTitle(pathname)}
          </h1>
          <p className="mt-0.5 hidden text-[10px] font-medium text-zinc-500 2xl:block">
            {getPageTitle(pathname)} · operação integrada em tempo real
          </p>
        </div>
      </div>

      {/* Global Search Bar */}
      <div className="relative z-30 mx-6 hidden max-w-2xl flex-1 xl:block 2xl:mx-12">
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400 dark:text-zinc-550">
            <Search size={15} />
          </div>
          <input
            type="text"
            placeholder="Buscar cliente, OS, nota, CPF, CNPJ..."
            value={searchQuery}
            onChange={(e) => {
              const value = e.target.value;
              setSearchQuery(value);
              if (value.trim().length < 2) {
                setSearchResults([]);
                setIsSearchOpen(false);
              }
            }}
            onFocus={() =>
              searchQuery.trim().length >= 2 && setIsSearchOpen(true)
            }
            className="h-11 w-full rounded-2xl border border-[#ded6c2] bg-[#f9f4e7]/85 py-2 pl-10 pr-8 text-xs text-zinc-800 shadow-[inset_0_1px_1px_rgba(15,23,42,.02)] outline-none transition-all duration-200 placeholder:text-zinc-400 hover:border-[#ceb978] focus:border-[#d4af37] focus:bg-white focus:ring-4 focus:ring-[#d4af37]/18 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-100 dark:focus:border-[#d4af37] dark:focus:bg-zinc-900"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                setSearchResults([]);
              }}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-650"
            >
              <X size={14} />
            </button>
          )}

          {/* Search Dropdown Panel */}
          {isSearchOpen && searchResults.length > 0 && (
            <div className="absolute left-0 mt-2 w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg py-2 max-h-96 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="px-4 py-1.5 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider">
                  Resultados da Busca
                </span>
                <button
                  onClick={() => setIsSearchOpen(false)}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 text-xs font-semibold"
                >
                  Fechar
                </button>
              </div>
              {searchResults.map((result) => (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => {
                    setIsSearchOpen(false);
                    setSearchQuery("");
                    // Open in custom tab
                    const { tabType, params } = getSearchResultTarget(
                      result.type,
                      result.id,
                    );
                    openTab(tabType, result.title, params);
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 flex items-start justify-between border-b border-zinc-50 dark:border-zinc-800/40 last:border-0 transition-all cursor-pointer"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-xs text-zinc-800 dark:text-zinc-200 truncate max-w-[280px]">
                      {result.title}
                    </span>
                    <span className="text-[10px] text-zinc-450 truncate max-w-[280px]">
                      {result.subtitle}
                    </span>
                  </div>
                  <span
                    className={`text-[8px] px-2 py-0.5 rounded font-semibold uppercase tracking-wide shrink-0 ml-2 mt-0.5 border ${SEARCH_RESULT_BADGE[result.type]}`}
                  >
                    {result.type}
                  </span>
                </button>
              ))}
            </div>
          )}

          {isSearchOpen &&
            searchResults.length === 0 &&
            searchQuery.trim().length >= 2 && (
              <div className="absolute left-0 mt-2 w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg p-6 text-center text-xs text-zinc-400 dark:text-zinc-500">
                Nenhum resultado encontrado para &quot;{searchQuery}&quot;
              </div>
            )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-3 shrink-0">
        <PwaInstallButton />
        <button
          onClick={() => setIsPaletteOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:border-[#d4af37]/45 hover:bg-[#f6ebc8] hover:text-[#6f5614] dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-[#d4af37]/45 dark:hover:bg-[#2b250f] xl:hidden"
          title="Busca global"
          aria-label="Abrir busca global"
        >
          <Search size={15} />
        </button>
        {/* Command Palette Keyboard Indicator */}
        <button
          onClick={() => setIsPaletteOpen(true)}
          className="hidden h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 text-zinc-500 transition-all hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-800 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-200 xl:flex"
          title="Atalhos rápidos (Ctrl + K)"
        >
          <Keyboard size={15} />
          <span className="text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">
            Ctrl + K
          </span>
        </button>

        {/* Theme Light / Dark Switch */}
        <button
          onClick={toggleDarkMode}
          className="hidden h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 transition-all hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-800 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-200 sm:flex"
          title={darkMode ? "Modo Claro" : "Modo Escuro"}
        >
          {darkMode ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        {/* Button + Novo Contextual Action */}
        <div className="relative">
          <button
            onClick={() => setIsNewOpen(!isNewOpen)}
            className="flex h-10 cursor-pointer items-center gap-1.5 rounded-xl bg-[#d4af37] px-4 text-xs font-black text-[#141519] shadow-[0_10px_20px_rgba(86,64,7,.28)] transition-all hover:-translate-y-0.5 hover:bg-[#c79d28] hover:shadow-[0_14px_28px_rgba(86,64,7,.35)]"
          >
            <Plus size={15} />
            <span className="hidden sm:inline">Novo</span>
          </button>

          {isNewOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg py-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="px-4 py-1.5 border-b border-zinc-100 dark:border-zinc-800 mb-1">
                <p className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                  {contextualNewItems.length
                    ? "Ações nesta tela"
                    : "Criar novo registro"}
                </p>
              </div>
              {contextualNewItems.map((item) => (
                <button
                  key={item.label}
                  onClick={() => {
                    setIsNewOpen(false);
                    item.run();
                  }}
                  className="w-full text-left px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${item.color}`} />
                  {item.label}
                </button>
              ))}
              {contextualNewItems.length > 0 && (
                <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
              )}
              <button
                onClick={() => {
                  setIsNewOpen(false);
                  openTab("crm", "CRM / Funil", {
                    new: "true",
                    requestId: String(Date.now()),
                  });
                }}
                className="w-full text-left px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all flex items-center gap-2 cursor-pointer"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                Novo Lead (CRM)
              </button>
              <button
                onClick={() => {
                  setIsNewOpen(false);
                  openTab("clientes", "Clientes", {
                    new: "true",
                    requestId: String(Date.now()),
                  });
                }}
                className="w-full text-left px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all flex items-center gap-2 cursor-pointer"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                Novo Cliente
              </button>
              <button
                onClick={() => {
                  setIsNewOpen(false);
                  openTab("orcamentos", "Orçamentos", {
                    new: "true",
                    requestId: String(Date.now()),
                  });
                }}
                className="w-full text-left px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all flex items-center gap-2 cursor-pointer"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                Novo Orçamento
              </button>
              <button
                onClick={() => {
                  setIsNewOpen(false);
                  openTab("ordens-servico", "Ordens de Serviço", {
                    new: "true",
                    requestId: String(Date.now()),
                  });
                }}
                className="w-full text-left px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all flex items-center gap-2 cursor-pointer"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Nova Ordem de Serviço
              </button>
              <button
                onClick={() => {
                  setIsNewOpen(false);
                  openTab("financeiro", "Financeiro", {
                    tab: "pagar",
                    new: "true",
                    type: "DESPESA",
                    requestId: String(Date.now()),
                  });
                }}
                className="w-full text-left px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all flex items-center gap-2 cursor-pointer"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                Nova Despesa (Pagar)
              </button>
              <button
                onClick={() => {
                  setIsNewOpen(false);
                  openTab("financeiro", "Nova cobrança", {
                    tab: "receber",
                    new: "true",
                    type: "RECEITA",
                    requestId: String(Date.now()),
                  });
                }}
                className="w-full text-left px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all flex items-center gap-2 cursor-pointer"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Nova Conta a Receber
              </button>
              <button
                onClick={() => {
                  setIsNewOpen(false);
                  openTab("estoque", "Estoque", {
                    new: "true",
                    requestId: String(Date.now()),
                  });
                }}
                className="w-full text-left px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all flex items-center gap-2 cursor-pointer"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                Novo Produto / Peça
              </button>
              <button
                onClick={() => {
                  setIsNewOpen(false);
                  openTab("contratos", "Contratos", {
                    new: "true",
                    requestId: String(Date.now()),
                  });
                }}
                className="w-full text-left px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all flex items-center gap-2 cursor-pointer"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                Novo Contrato
              </button>
            </div>
          )}
        </div>

        {/* User Simulator Dropdown */}
        <div className="relative hidden lg:block">
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-2 px-2 lg:px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-850 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all text-zinc-700 dark:text-zinc-350 cursor-pointer"
          >
            <span className="w-2 h-2 rounded-full bg-success animate-pulse"></span>
            <span className="hidden lg:inline font-bold text-zinc-950 dark:text-zinc-50">
              {user ? user.roleName : "..."}
            </span>
          </button>

          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-72 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg py-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="px-4 py-2 border-b border-zinc-100 dark:border-zinc-800">
                <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                  Escolha um perfil para testar:
                </p>
              </div>
              <div className="max-h-80 overflow-y-auto py-1 scrollbar-none">
                {users.map((u) => (
                  <button
                    key={u.email}
                    onClick={() => handleUserSwitch(u.email)}
                    className={`w-full text-left px-4 py-2.5 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800/80 flex flex-col gap-0.5 transition-all cursor-pointer ${
                      user?.email === u.email
                        ? "bg-zinc-50/50 dark:bg-zinc-800/40"
                        : ""
                    }`}
                  >
                    <div className="flex justify-between items-center w-full">
                      <span className="font-bold text-zinc-800 dark:text-zinc-200 truncate pr-2">
                        {u.name}
                      </span>
                      <span
                        className={`text-[8px] px-2 py-0.5 rounded font-bold uppercase tracking-wide ${getRoleColorClass(
                          u.roleName,
                        )}`}
                      >
                        {u.roleName}
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate">
                      {u.email}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Notifications (Bell) */}
        <div className="relative">
          <button
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-450 hover:text-zinc-850 dark:hover:text-zinc-250 hover:bg-zinc-50 dark:hover:bg-zinc-800 relative transition-all cursor-pointer"
          >
            <Bell size={15} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-danger text-white text-[8px] w-4.5 h-4.5 rounded-full flex items-center justify-center font-bold border-2 border-white dark:border-zinc-900 animate-bounce">
                {unreadCount}
              </span>
            )}
          </button>

          {isNotifOpen && (
            <div className="absolute right-0 z-50 mt-2 flex max-h-[480px] w-[min(24rem,calc(100vw-1rem))] flex-col rounded-xl border border-zinc-200 bg-white py-2 shadow-lg animate-in fade-in slide-in-from-top-1 duration-150 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="px-4 py-2 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <span className="font-bold text-xs text-zinc-800 dark:text-zinc-100">
                  Notificações e Alertas
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-[10px] font-bold text-primary hover:text-primary-hover transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCircle size={12} />
                    Limpar todas
                  </button>
                )}
              </div>

              <div className="overflow-y-auto flex-1 py-1 scrollbar-none">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-zinc-400 flex flex-col items-center gap-2">
                    <Bell
                      size={20}
                      className="text-zinc-300 dark:text-zinc-700"
                    />
                    <p className="text-xs font-semibold">Nenhuma notificação</p>
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <button
                      key={notif.id}
                      onClick={() => handleNotifClick(notif)}
                      className={`w-full text-left px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 flex items-start gap-3 border-b border-zinc-50 dark:border-zinc-800/40 last:border-0 transition-all cursor-pointer ${
                        !notif.read ? "bg-primary/5 dark:bg-primary/5" : ""
                      }`}
                    >
                      <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 shrink-0 mt-0.5">
                        {getNotifIcon(notif.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-1">
                          <p
                            className={`text-xs truncate ${
                              !notif.read
                                ? "font-bold text-zinc-900 dark:text-white"
                                : "text-zinc-650 dark:text-zinc-350"
                            }`}
                          >
                            {notif.title}
                          </p>
                          <span className="text-[9px] text-zinc-400 dark:text-zinc-500 whitespace-nowrap pt-0.5">
                            {formatDateTime(notif.createdAt)}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                          {notif.message}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Command Palette Overlay */}
      <CommandPalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
      />
    </header>
  );
}
