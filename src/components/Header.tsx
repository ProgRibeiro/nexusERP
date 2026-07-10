"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
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
  FileSignature,
  Settings,
  Menu,
  Search,
  Plus,
  X,
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, users, switchUser } = useAuth();

  const [notifications, setNotifications] = useState<NotificationDTO[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Estados do Redesign
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNewOpen, setIsNewOpen] = useState(false);

  // Carregar notificações ao montar e em intervalos (simulando polling a cada 30 segundos)
  useEffect(() => {
    async function loadNotif() {
      const data = await getNotifications();
      setNotifications(data);
    }
    loadNotif();

    const interval = setInterval(loadNotif, 30000);
    return () => clearInterval(interval);
  }, []);

  // Efeito de Busca Global
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setIsSearchOpen(false);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      const data = await searchGlobalAction(searchQuery);
      setSearchResults(data);
      setIsSearchOpen(true);
    }, 250);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getPageTitle = (path: string) => {
    if (path === "/") return "Dashboard Geral";
    if (path.startsWith("/crm")) return "Pipeline Comercial & CRM";
    if (path.startsWith("/clientes")) return "Gestão de Clientes e Prontuários";
    if (path.startsWith("/orcamentos")) return "Propostas e Orçamentos";
    if (path.startsWith("/ordens-servico")) return "Controle de Ordens de Serviço";
    if (path.startsWith("/faturamento")) return "Faturamento e Emissão de Notas";
    if (path.startsWith("/financeiro")) return "Financeiro Integrado";
    if (path.startsWith("/estoque")) return "Controle de Estoque & Peças";
    if (path.startsWith("/contratos")) return "Gestão de Contratos de Manutenção";
    if (path.startsWith("/configuracoes")) return "Configurações & Logs de Auditoria";
    return "ERP Antigravity";
  };

  const getNotifIcon = (type: string) => {
    switch (type) {
      case "ESTOQUE":
        return <Package size={16} className="text-amber-500" />;
      case "FINANCEIRO":
        return <DollarSign size={16} className="text-emerald-500" />;
      case "OPERACIONAL":
        return <Wrench size={16} className="text-blue-500" />;
      case "COMERCIAL":
        return <Flame size={16} className="text-indigo-500" />;
      default:
        return <Bell size={16} className="text-zinc-500" />;
    }
  };

  const handleNotifClick = async (notif: NotificationDTO) => {
    if (!notif.read) {
      await markNotificationAsRead(notif.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
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
    await switchUser(email);
    setIsProfileOpen(false);
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
    <header className="h-16 border-b border-zinc-200 bg-white flex items-center justify-between px-6 z-20">
      <div className="flex items-center gap-4 shrink-0">
        {/* Título da tela */}
        <h1 className="text-xl font-semibold text-zinc-900 leading-tight">
          {getPageTitle(pathname)}
        </h1>
      </div>

      {/* Busca Global Centralizada */}
      <div className="flex-1 max-w-md mx-8 relative hidden md:block">
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
            <Search size={16} />
          </div>
          <input
            type="text"
            placeholder="Buscar cliente, OS, orçamento, nota..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => searchQuery.trim().length >= 2 && setIsSearchOpen(true)}
            className="w-full pl-9 pr-8 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-sm placeholder-zinc-400 text-zinc-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                setSearchResults([]);
              }}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-600"
            >
              <X size={14} />
            </button>
          )}

          {/* Popover de Resultados da Busca */}
          {isSearchOpen && searchResults.length > 0 && (
            <div className="absolute left-0 mt-2 w-full rounded-xl border border-zinc-200 bg-white shadow-xl py-2 z-50 max-h-96 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="px-4 py-1.5 border-b border-zinc-50 flex justify-between items-center">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  Resultados da Busca
                </span>
                <button
                  onClick={() => setIsSearchOpen(false)}
                  className="text-zinc-400 hover:text-zinc-600 text-xs"
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
                    router.push(result.link);
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-zinc-50 flex items-start justify-between border-b border-zinc-50 last:border-0 transition-all cursor-pointer"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-xs text-zinc-850 truncate max-w-[280px]">
                      {result.title}
                    </span>
                    <span className="text-[11px] text-zinc-400 truncate max-w-[280px]">
                      {result.subtitle}
                    </span>
                  </div>
                  <span
                    className={`text-[8px] px-2 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 ml-2 mt-0.5 ${
                      result.type === "cliente"
                        ? "bg-blue-50 text-blue-600 border border-blue-100"
                        : result.type === "os"
                        ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                        : result.type === "orcamento"
                        ? "bg-amber-50 text-amber-600 border border-amber-100"
                        : "bg-purple-50 text-purple-600 border border-purple-100"
                    }`}
                  >
                    {result.type}
                  </span>
                </button>
              ))}
            </div>
          )}

          {isSearchOpen && searchResults.length === 0 && searchQuery.trim().length >= 2 && (
            <div className="absolute left-0 mt-2 w-full rounded-xl border border-zinc-200 bg-white shadow-xl p-6 text-center text-xs text-zinc-400 z-50">
              Nenhum resultado encontrado para &quot;{searchQuery}&quot;
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {/* Botão + Novo Ação Rápida */}
        <div className="relative">
          <button
            onClick={() => setIsNewOpen(!isNewOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-all cursor-pointer shadow-md shadow-emerald-500/10"
          >
            <Plus size={16} />
            <span>Novo</span>
          </button>

          {isNewOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-zinc-200 bg-white shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="px-4 py-1.5 border-b border-zinc-100 mb-1">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  Criar Novo Registro
                </p>
              </div>
              <button
                onClick={() => {
                  setIsNewOpen(false);
                  router.push("/crm?new=true");
                }}
                className="w-full text-left px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 transition-all flex items-center gap-2 cursor-pointer"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                Novo Lead (CRM)
              </button>
              <button
                onClick={() => {
                  setIsNewOpen(false);
                  router.push("/clientes?new=true");
                }}
                className="w-full text-left px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 transition-all flex items-center gap-2 cursor-pointer"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                Novo Cliente
              </button>
              <button
                onClick={() => {
                  setIsNewOpen(false);
                  router.push("/orcamentos?new=true");
                }}
                className="w-full text-left px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 transition-all flex items-center gap-2 cursor-pointer"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                Novo Orçamento
              </button>
              <button
                onClick={() => {
                  setIsNewOpen(false);
                  router.push("/ordens-servico?new=true");
                }}
                className="w-full text-left px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 transition-all flex items-center gap-2 cursor-pointer"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Nova Ordem de Serviço
              </button>
              <button
                onClick={() => {
                  setIsNewOpen(false);
                  router.push("/financeiro?tab=pagar&new=true");
                }}
                className="w-full text-left px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 transition-all flex items-center gap-2 cursor-pointer"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                Nova Despesa (Pagar)
              </button>
            </div>
          )}
        </div>

        {/* Seletor de Perfil (Simulação de Multiperfil) */}
        <div className="relative">
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-200 text-xs font-medium hover:bg-zinc-50 hover:border-zinc-300 transition-all text-zinc-700 cursor-pointer"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-bold text-zinc-950">
              {user ? user.roleName : "..."}
            </span>
          </button>

          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-72 rounded-xl border border-zinc-200 bg-white shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="px-4 py-2 border-b border-zinc-100">
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Escolha um perfil para testar:
                </p>
              </div>
              <div className="max-h-80 overflow-y-auto py-1">
                {users.map((u) => (
                  <button
                    key={u.email}
                    onClick={() => handleUserSwitch(u.email)}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-zinc-50 flex flex-col gap-0.5 transition-all cursor-pointer ${
                      user?.email === u.email ? "bg-zinc-50/50" : ""
                    }`}
                  >
                    <div className="flex justify-between items-center w-full">
                      <span className="font-medium text-zinc-800 truncate pr-2">
                        {u.name}
                      </span>
                      <span
                        className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wide ${getRoleColorClass(
                          u.roleName
                        )}`}
                      >
                        {u.roleName}
                      </span>
                    </div>
                    <span className="text-xs text-zinc-400 truncate">{u.email}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Notificações (Sino) */}
        <div className="relative">
          <button
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className="p-2 rounded-lg border border-zinc-200 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50 relative transition-all cursor-pointer animate-in duration-100"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] w-4.5 h-4.5 rounded-full flex items-center justify-center font-bold border-2 border-white animate-bounce">
                {unreadCount}
              </span>
            )}
          </button>

          {isNotifOpen && (
            <div className="absolute right-0 mt-2 w-96 rounded-xl border border-zinc-200 bg-white shadow-xl py-2 z-50 flex flex-col max-h-[480px] animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="px-4 py-2 border-b border-zinc-100 flex items-center justify-between">
                <span className="font-bold text-sm text-zinc-800">
                  Notificações e Alertas
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCircle size={12} />
                    Limpar todas
                  </button>
                )}
              </div>

              <div className="overflow-y-auto flex-1 py-1">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-zinc-400 flex flex-col items-center gap-2">
                    <Bell size={24} className="text-zinc-300" />
                    <p className="text-sm font-medium">Nenhuma notificação</p>
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <button
                      key={notif.id}
                      onClick={() => handleNotifClick(notif)}
                      className={`w-full text-left px-4 py-3 hover:bg-zinc-50 flex items-start gap-3 border-b border-zinc-50 last:border-0 transition-all cursor-pointer ${
                        !notif.read ? "bg-emerald-50/20" : ""
                      }`}
                    >
                      <div className="p-2 rounded-lg bg-zinc-100 shrink-0 mt-0.5">
                        {getNotifIcon(notif.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-1">
                          <p
                            className={`text-sm truncate ${
                              !notif.read ? "font-semibold text-zinc-900" : "text-zinc-700"
                            }`}
                          >
                            {notif.title}
                          </p>
                          <span className="text-[10px] text-zinc-400 whitespace-nowrap pt-0.5">
                            {formatDateTime(notif.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500 mt-1 line-clamp-2">
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
    </header>
  );
}
