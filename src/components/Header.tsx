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
  Building2,
  LogOut,
  Camera,
  ChevronDown,
  User as UserIcon,
  Laptop,
  BookOpen,
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { CommandPalette } from "./ui/CommandPalette";
import { getSearchResultTarget } from "@/lib/searchNavigation";
import PwaInstallButton from "./PwaInstallButton";
import { CompanyRegistrationModal } from "./modals/CompanyRegistrationModal";
import { DesktopAppLauncherModal } from "./modals/DesktopAppLauncherModal";
import { ERPInteractiveTutorialModal } from "./modals/ERPInteractiveTutorialModal";


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
  const { user, users, switchUser, logout } = useAuth();
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
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [isDesktopModalOpen, setIsDesktopModalOpen] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [tempAvatarUrl, setTempAvatarUrl] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && user?.email) {
      const saved = localStorage.getItem(`user_avatar_${user.email}`);
      if (saved) setAvatarUrl(saved);
      else setAvatarUrl("");
    }
  }, [user?.email]);

  const handleSaveAvatar = (url: string) => {
    setAvatarUrl(url);
    if (user?.email) {
      localStorage.setItem(`user_avatar_${user.email}`, url);
    }
    setIsAvatarModalOpen(false);
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout();
      setIsProfileOpen(false);
      router.replace("/login");
      router.refresh();
    } finally {
      setIsLoggingOut(false);
    }
  };


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
    return "O Prestador";
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
    <header className="erp-topbar relative z-30 flex h-[72px] shrink-0 select-none items-center justify-between gap-2 overflow-visible border-b border-zinc-200 bg-white px-3 shadow-[0_1px_8px_rgba(15,23,42,.045)] transition-colors duration-200 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-[0_1px_10px_rgba(0,0,0,.35)] sm:px-4 lg:px-6">
      {/* Title & Mobile Menu Toggle */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 xl:hidden"
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
        <div className="min-w-0 xl:hidden">
          <p className="hidden text-[8px] font-black uppercase tracking-[0.28em] text-blue-600 sm:block">
            Área de trabalho
          </p>
          <h1 className="max-w-[35vw] truncate text-sm font-black leading-tight tracking-[-0.025em] text-zinc-950 dark:text-white sm:max-w-[28vw] lg:max-w-[220px] lg:text-lg">
            {activeTab?.title || getPageTitle(pathname)}
          </h1>
        </div>
      </div>

      {/* Global Search Bar */}
      <div className="relative z-30 mx-4 hidden max-w-xl flex-1 xl:block 2xl:mx-8">
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
            className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50/70 py-2 pl-10 pr-8 text-xs text-zinc-900 shadow-sm outline-none transition-all duration-200 placeholder:text-zinc-400 hover:border-zinc-300 hover:bg-white focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-600 dark:hover:bg-zinc-900 dark:focus:border-blue-500 dark:focus:bg-zinc-900"
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
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:border-[#155eef]/45 hover:bg-[#eff6ff] hover:text-[#1d4ed8] dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-[#155eef]/45 dark:hover:bg-[#102a50] xl:hidden"
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
            className="flex h-10 cursor-pointer items-center gap-1.5 rounded-xl bg-[#155eef] px-4 text-xs font-black text-white shadow-[0_6px_16px_rgba(37,99,235,.2)] transition-all hover:bg-[#124fd0]"
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

        {/* Botão Guia e Tutorial Interativo */}
        <button
          onClick={() => setIsTutorialOpen(true)}
          className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-900/60 text-xs font-black text-amber-700 dark:text-amber-300 bg-amber-50/80 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-all cursor-pointer shadow-sm"
          title="Guia & Tutorial de Uso Interativo"
        >
          <BookOpen size={15} className="text-amber-600 dark:text-amber-400" />
          <span>Guia & Tutorial</span>
        </button>

        {/* Botão Software Desktop & VPS */}
        <button
          onClick={() => setIsDesktopModalOpen(true)}
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-900 text-xs font-black text-blue-700 dark:text-blue-300 bg-blue-50/80 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all cursor-pointer shadow-sm"
          title="Software Desktop Nativo e Conexão VPS"
        >
          <Laptop size={15} className="text-blue-600 dark:text-blue-400" />
          <span>App Desktop & VPS</span>
        </button>

        {/* Botão Flutuante Minha Empresa */}
        <button
          onClick={() => setIsCompanyModalOpen(true)}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-extrabold text-zinc-800 dark:text-zinc-200 bg-white/90 dark:bg-zinc-900/90 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all cursor-pointer shadow-sm"
          title="Dados e Logotipo da Empresa"
        >
          <Building2 size={15} className="text-primary" />
          <span>Minha Empresa</span>
        </button>

        {/* Top-Right User Profile & Avatar Card */}
        <div className="relative">
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 text-xs font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all text-zinc-800 dark:text-zinc-200 cursor-pointer shadow-sm"
          >
            {/* Foto de perfil ou círculo de iniciais */}
            <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-blue-500/40 bg-gradient-to-br from-blue-600 to-indigo-700 font-black text-white flex items-center justify-center text-xs shadow-md">
              {avatarUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={avatarUrl}
                  alt={user?.name || "Usuário"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>{user?.name ? user.name.slice(0, 2).toUpperCase() : "LU"}</span>
              )}
            </div>

            <div className="hidden sm:flex flex-col text-left">
              <span className="text-xs font-black leading-tight text-zinc-950 dark:text-white truncate max-w-[130px]">
                {user?.name || "Lucas Ribeiro"}
              </span>
              <span className="mt-0.5 text-[9px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                {user?.roleName || "Administrador"}
              </span>
            </div>

            <ChevronDown size={14} className="text-zinc-400" />
          </button>

          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
              {/* Profile Summary Header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30">
                <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border-2 border-blue-500/50 bg-gradient-to-br from-blue-600 to-indigo-700 font-black text-white flex items-center justify-center text-sm shadow-md">
                  {avatarUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={avatarUrl}
                      alt={user?.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span>{user?.name ? user.name.slice(0, 2).toUpperCase() : "LU"}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black text-zinc-900 dark:text-white truncate">
                    {user?.name || "Lucas Ribeiro"}
                  </p>
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate">
                    {user?.email || "lucasribeiro@nexusmax.com"}
                  </p>
                  <span
                    className={`mt-1 inline-block text-[8px] px-2 py-0.5 rounded font-black uppercase tracking-wide ${getRoleColorClass(
                      user?.roleName || "Administrador",
                    )}`}
                  >
                    {user?.roleName || "Administrador"}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-1.5 space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileOpen(false);
                    setTempAvatarUrl(avatarUrl);
                    setIsAvatarModalOpen(true);
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-extrabold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-xl transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Camera size={15} />
                  <span>Alterar Foto de Perfil</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileOpen(false);
                    setIsCompanyModalOpen(true);
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Building2 size={15} className="text-zinc-500" />
                  <span>Dados da Minha Empresa</span>
                </button>
              </div>

              <div className="border-t border-zinc-100 dark:border-zinc-800 my-1" />

              {/* Perfil de Teste (Simulador) */}
              <div className="px-3 py-1.5">
                <p className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">
                  Trocar Usuário (Simulador):
                </p>
                <div className="max-h-40 overflow-y-auto space-y-0.5 scrollbar-none">
                  {users.map((u) => (
                    <button
                      key={u.email}
                      onClick={() => handleUserSwitch(u.email)}
                      className={`w-full text-left px-2.5 py-1.5 text-xs rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 flex justify-between items-center transition-all cursor-pointer ${
                        user?.email === u.email
                          ? "bg-blue-50/60 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold"
                          : "text-zinc-600 dark:text-zinc-400"
                      }`}
                    >
                      <span className="truncate text-[11px]">{u.name}</span>
                      <span className="text-[8px] font-bold uppercase text-zinc-400">
                        {u.roleName}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-zinc-100 p-1.5 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-black text-rose-600 transition-colors hover:bg-rose-50 disabled:cursor-wait disabled:opacity-60 dark:text-rose-400 dark:hover:bg-rose-950/30 cursor-pointer"
                >
                  <LogOut size={14} />
                  {isLoggingOut ? "Saindo..." : "Sair do sistema"}
                </button>
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

      {/* Modal Flutuante de Cadastro da Empresa */}
      {isCompanyModalOpen && (
        <CompanyRegistrationModal
          isOpen={isCompanyModalOpen}
          onClose={() => setIsCompanyModalOpen(false)}
          isFloating={true}
        />
      )}

      {/* Modal de Alteração de Foto de Perfil */}
      {isAvatarModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-black text-zinc-900 dark:text-white flex items-center gap-2">
                <Camera size={18} className="text-blue-600" />
                Alterar Foto de Perfil
              </h3>
              <button
                type="button"
                onClick={() => setIsAvatarModalOpen(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Avatar Preview */}
            <div className="flex flex-col items-center justify-center gap-3 py-2">
              <div className="relative h-24 w-24 overflow-hidden rounded-full border-4 border-blue-500/50 bg-gradient-to-br from-blue-600 to-indigo-700 font-black text-white flex items-center justify-center text-2xl shadow-lg">
                {tempAvatarUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={tempAvatarUrl} alt="Preview" className="h-full w-full object-cover" />
                ) : (
                  <span>{user?.name ? user.name.slice(0, 2).toUpperCase() : "LU"}</span>
                )}
              </div>
              <p className="text-xs font-bold text-zinc-600 dark:text-zinc-400">
                {user?.name || "Lucas Ribeiro"}
              </p>
            </div>

            {/* Upload Options */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  1. Carregar imagem do seu dispositivo:
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (evt) => {
                        if (evt.target?.result) {
                          setTempAvatarUrl(evt.target.result as string);
                        }
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="w-full text-xs text-zinc-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-extrabold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-950/40 dark:file:text-blue-300 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  2. Ou cole a URL da sua foto:
                </label>
                <input
                  type="url"
                  placeholder="https://exemplo.com/sua-foto.jpg"
                  value={tempAvatarUrl.startsWith("data:") ? "" : tempAvatarUrl}
                  onChange={(e) => setTempAvatarUrl(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3.5 py-2 text-xs font-medium text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 border-t border-zinc-100 dark:border-zinc-800 pt-4">
              <button
                type="button"
                onClick={() => setIsAvatarModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleSaveAvatar(tempAvatarUrl)}
                className="px-5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-md hover:bg-blue-700 transition-all cursor-pointer"
              >
                Salvar Foto de Perfil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Software Desktop Nativo & Conexão VPS */}
      {isDesktopModalOpen && (
        <DesktopAppLauncherModal
          isOpen={isDesktopModalOpen}
          onClose={() => setIsDesktopModalOpen(false)}
        />
      )}

      {/* Modal Guia & Tutorial Interativo */}
      {isTutorialOpen && (
        <ERPInteractiveTutorialModal
          isOpen={isTutorialOpen}
          onClose={() => setIsTutorialOpen(false)}
        />
      )}
    </header>
  );
}
