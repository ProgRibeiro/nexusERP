"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Search, Wrench, FileText, Users, DollarSign, Receipt, Package, Moon, Sparkles, Clock, Loader2, FileSignature, UserCog, Flame, MonitorCog, HandCoins, WalletCards } from "lucide-react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { searchGlobalAction, SearchResult } from "@/app/actions/searchActions";
import { getSearchResultTarget } from "@/lib/searchNavigation";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CommandItem {
  id: string;
  name: string;
  subtitle?: string;
  icon: React.ReactNode;
  /** Permission code required to see this command. Omit for always-visible commands. */
  permission?: string;
  action: () => void;
}

interface CommandGroup {
  category: string;
  items: CommandItem[];
}

const RECENTS_KEY = "erp_command_palette_recents";
const MAX_RECENTS = 5;

function loadRecents(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveRecent(id: string) {
  if (typeof window === "undefined") return;
  const current = loadRecents().filter((r) => r !== id);
  current.unshift(id);
  window.localStorage.setItem(RECENTS_KEY, JSON.stringify(current.slice(0, MAX_RECENTS)));
}

const SEARCH_RESULT_ICON: Record<SearchResult["type"], React.ReactNode> = {
  cliente: <Users size={16} className="text-blue-500" />,
  lead: <Flame size={16} className="text-indigo-500" />,
  equipamento: <MonitorCog size={16} className="text-cyan-500" />,
  os: <Wrench size={16} className="text-emerald-500" />,
  orcamento: <FileText size={16} className="text-amber-500" />,
  nota: <Receipt size={16} className="text-purple-500" />,
  receber: <HandCoins size={16} className="text-emerald-500" />,
  pagar: <WalletCards size={16} className="text-rose-500" />,
  contrato: <FileSignature size={16} className="text-indigo-500" />,
  produto: <Package size={16} className="text-orange-500" />,
  usuario: <UserCog size={16} className="text-zinc-500" />,
};

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const { openTab, toggleDarkMode } = useWorkspace();
  const { hasPermission } = useAuth();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [recents, setRecents] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const runCommand = useCallback(
    (item: CommandItem) => {
      saveRecent(item.id);
      item.action();
      onClose();
    },
    [onClose]
  );

  const staticGroups: CommandGroup[] = useMemo(
    () => [
      {
        category: "Criação Rápida",
        items: [
          {
            id: "create-os",
            name: "Criar Nova Ordem de Serviço (OS)",
            icon: <Wrench size={16} className="text-emerald-500" />,
            permission: "os.read",
            action: () => openTab("ordens-servico", "Ordens de Serviço", { new: "true" }),
          },
          {
            id: "create-orcamento",
            name: "Criar Novo Orçamento",
            icon: <FileText size={16} className="text-amber-500" />,
            permission: "quotes.read",
            action: () => openTab("orcamentos", "Orçamentos", { new: "true" }),
          },
          {
            id: "create-cliente",
            name: "Cadastrar Novo Cliente",
            icon: <Users size={16} className="text-blue-500" />,
            permission: "clients.read",
            action: () => openTab("clientes", "Clientes", { new: "true" }),
          },
          {
            id: "create-despesa",
            name: "Lançar Despesa (Contas a Pagar)",
            icon: <DollarSign size={16} className="text-rose-500" />,
            permission: "financeiro.read",
            action: () => openTab("financeiro", "Financeiro", { tab: "pagar", new: "true" }),
          },
        ],
      },
      {
        category: "Navegação e Módulos",
        items: [
          {
            id: "goto-dashboard",
            name: "Ir para Dashboard",
            icon: <Sparkles size={16} className="text-indigo-500" />,
            permission: "dashboard.view",
            action: () => openTab("dashboard", "Dashboard"),
          },
          {
            id: "goto-clientes",
            name: "Ir para Clientes",
            icon: <Users size={16} className="text-zinc-500" />,
            permission: "clients.read",
            action: () => openTab("clientes", "Clientes"),
          },
          {
            id: "goto-os",
            name: "Ir para Ordens de Serviço (OS)",
            icon: <Wrench size={16} className="text-zinc-500" />,
            permission: "os.read",
            action: () => openTab("ordens-servico", "Ordens de Serviço"),
          },
          {
            id: "goto-financeiro",
            name: "Ir para Financeiro / Contas",
            icon: <DollarSign size={16} className="text-zinc-500" />,
            permission: "financeiro.read",
            action: () => openTab("financeiro", "Financeiro"),
          },
          {
            id: "goto-faturamento",
            name: "Ir para o Painel Fiscal",
            icon: <Receipt size={16} className="text-zinc-500" />,
            permission: "faturamento.read",
            action: () => openTab("faturamento", "Painel Fiscal"),
          },
          {
            id: "goto-estoque",
            name: "Ir para Estoque & Peças",
            icon: <Package size={16} className="text-zinc-500" />,
            permission: "estoque.read",
            action: () => openTab("estoque", "Estoque"),
          },
        ],
      },
      {
        category: "Atalhos Rápidos",
        items: [
          {
            id: "filter-os-atrasada",
            name: "Ver OS Atrasadas / Críticas",
            icon: <Wrench size={16} className="text-danger" />,
            permission: "os.read",
            action: () => openTab("ordens-servico", "Ordens de Serviço", { status: "ATRASADA" }),
          },
          {
            id: "filter-contas-vencidas",
            name: "Ver Contas Vencidas",
            icon: <DollarSign size={16} className="text-danger" />,
            permission: "financeiro.read",
            action: () => openTab("financeiro", "Financeiro", { tab: "receber", status: "VENCIDO" }),
          },
          {
            id: "toggle-theme",
            name: "Alternar Tema Claro / Escuro",
            icon: <Moon size={16} className="text-indigo-500" />,
            action: () => toggleDarkMode(),
          },
        ],
      },
    ],
    [openTab, toggleDarkMode]
  );

  const allStaticItems = useMemo(
    () => staticGroups.flatMap((g) => g.items),
    [staticGroups]
  );

  const visibleStaticGroups = useMemo(
    () =>
      staticGroups
        .map((group) => ({
          ...group,
          items: group.items.filter(
            (item) =>
              (!item.permission || hasPermission(item.permission)) &&
              item.name.toLowerCase().includes(query.toLowerCase())
          ),
        }))
        .filter((group) => group.items.length > 0),
    [staticGroups, hasPermission, query]
  );

  const recentGroup: CommandGroup[] =
    query.trim().length === 0 && recents.length > 0
      ? [
          {
            category: "Recentes",
            items: recents
              .map((id) => allStaticItems.find((item) => item.id === id))
              .filter((item): item is CommandItem => !!item && (!item.permission || hasPermission(item.permission))),
          },
        ].filter((g) => g.items.length > 0)
      : [];

  const searchGroup: CommandGroup[] =
    searchResults.length > 0
      ? [
          {
            category: "Resultados da Busca",
            items: searchResults.map((r) => ({
              id: `search-${r.type}-${r.id}`,
              name: r.title,
              subtitle: r.subtitle,
              icon: SEARCH_RESULT_ICON[r.type],
              action: () => {
                const { tabType, params } = getSearchResultTarget(r.type, r.id);
                openTab(tabType, r.title, params);
              },
            })),
          },
        ]
      : [];

  const filteredCommands = [...recentGroup, ...visibleStaticGroups, ...searchGroup];
  const flatItems = filteredCommands.flatMap((g) => g.items);

  // Focus + reset when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        setRecents(loadRecents());
        setActiveIndex(0);
        inputRef.current?.focus();
        setQuery("");
      }, 100);
    }
  }, [isOpen]);

  // Debounced global search once the query looks like a record lookup, not just a command filter.
  // Also resets keyboard-selection whenever the query (and therefore the list) changes.
  useEffect(() => {
    setActiveIndex(0);
    if (query.trim().length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timeout = setTimeout(async () => {
      try {
        const results = await searchGlobalAction(query);
        setSearchResults(results);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timeout);
  }, [query]);

  // Keyboard: Ctrl/Cmd+K to close (Header owns opening), Escape, Arrow nav, Enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) onClose();
        return;
      }
      if (!isOpen) return;
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, flatItems.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = flatItems[activeIndex];
        if (item) runCommand(item);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, flatItems, activeIndex, runCommand]);

  if (!isOpen) return null;

  let renderedIndex = -1;

  return (
    <div className="fixed inset-0 z-55 flex items-start justify-center pt-[15vh] p-4">
      <div
        className="fixed inset-0 overlay-scrim animate-in fade-in duration-150"
        onClick={onClose}
      />

      <div className="relative w-full max-w-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl flex flex-col z-10 animate-in fade-in slide-in-from-top-2 duration-150 overflow-hidden">
        <div className="p-4 border-b border-zinc-150 dark:border-zinc-800 flex items-center gap-3">
          {searching ? (
            <Loader2 className="text-zinc-400 dark:text-zinc-550 shrink-0 animate-spin" size={18} />
          ) : (
            <Search className="text-zinc-400 dark:text-zinc-550 shrink-0" size={18} />
          )}
          <input
            ref={inputRef}
            type="text"
            placeholder="Digite um comando ou busque um registro (cliente, OS, orçamento...)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent border-0 outline-none focus:ring-0 text-sm text-zinc-800 dark:text-zinc-150 placeholder-zinc-400"
          />
          <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-medium text-zinc-400 dark:text-zinc-550 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded shrink-0 select-none">
            ESC
          </kbd>
        </div>

        <div className="max-h-[360px] overflow-y-auto p-2">
          {filteredCommands.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-400">
              Nenhum comando ou registro encontrado para &quot;{query}&quot;
            </div>
          ) : (
            filteredCommands.map((group, gIdx) => (
              <div key={gIdx} className="mb-2 last:mb-0">
                <h4 className="px-3 py-1 text-[10px] font-medium text-zinc-400 dark:text-zinc-550 uppercase tracking-wide flex items-center gap-1">
                  {group.category === "Recentes" && <Clock size={10} />}
                  {group.category}
                </h4>
                <div className="mt-1 flex flex-col gap-0.5">
                  {group.items.map((item) => {
                    renderedIndex += 1;
                    const isActive = renderedIndex === activeIndex;
                    return (
                      <button
                        key={item.id}
                        onClick={() => runCommand(item)}
                        onMouseEnter={() => setActiveIndex(renderedIndex)}
                        className={`w-full text-left px-3 py-2 text-xs font-medium rounded-lg transition-colors flex items-center gap-3 cursor-pointer ${
                          isActive
                            ? "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-900 dark:text-white"
                            : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                        }`}
                      >
                        <div className="p-1.5 rounded-md bg-zinc-100 dark:bg-zinc-800 shrink-0">
                          {item.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate">{item.name}</div>
                          {item.subtitle && (
                            <div className="truncate text-[10px] text-zinc-400 dark:text-zinc-500 font-normal">
                              {item.subtitle}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
