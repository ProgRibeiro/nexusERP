"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export interface Tab {
  id: string;
  type: string;
  title: string;
  params?: any;
}

export interface DrawerState {
  isOpen: boolean;
  type: string;
  title: string;
  data: any;
}

interface WorkspaceContextType {
  activeTab: Tab;
  activeTabId: string;
  openTab: (type: string, title: string, params?: any) => void;
  floatingTabs: Tab[];
  activeFloatingTabId: string | null;
  activateFloatingTab: (id: string | null) => void;
  closeFloatingTab: (id: string) => void;
  drawer: DrawerState;
  openDrawer: (type: string, title: string, data?: any) => void;
  closeDrawer: () => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<Tab>({
    id: "dashboard",
    type: "dashboard",
    title: "Dashboard",
  });
  const activeTabId = activeTab.id;
  const [floatingTabs, setFloatingTabs] = useState<Tab[]>([]);
  const [activeFloatingTabId, setActiveFloatingTabId] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<DrawerState>({
    isOpen: false,
    type: "",
    title: "",
    data: null
  });
  // O ERP abre no tema claro por padrão. Uma escolha explícita do usuário
  // continua sendo respeitada nas próximas sessões.
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Initialize Theme from localStorage
  useEffect(() => {
    // Remove definitivamente o histórico da antiga barra de abas.
    localStorage.removeItem("nx_workspace_v1");
    const savedTheme = localStorage.getItem("theme");
    const isDark = savedTheme === "dark";
    setTimeout(() => {
      setDarkMode(isDark);
    }, 0);
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleDarkMode = useCallback(() => {
    setDarkMode((current) => {
      const newDark = !current;
      localStorage.setItem("theme", newDark ? "dark" : "light");
      document.documentElement.classList.toggle("dark", newDark);
      return newDark;
    });
  }, []);

  const openTab = useCallback((
    type: string,
    title: string,
    params?: any,
  ) => {
    let tabId = type;
    if (params && params.id) {
      tabId = `${type}-${params.id}`;
    } else if (params && params.tab) {
      tabId = `${type}?tab=${params.tab}`;
    } else if (params && params.action) {
      tabId = `${type}?action=${params.action}`;
    }

    // Orçamentos possuem um fluxo extenso e devem ocupar a página principal.
    // Outros cadastros rápidos continuam podendo usar a janela flutuante.
    const shouldFloat = type !== "orcamentos" && Boolean(params?.id || params?.new === "true" || params?.action);
    if (shouldFloat) {
      if (params?.new === "true") tabId = `${type}-new-${params.requestId || "form"}`;
      const floatingTab = { id: tabId, type, title, params: params ? { ...params } : undefined };
      setFloatingTabs((current) => current.some((tab) => tab.id === tabId)
        ? current.map((tab) => tab.id === tabId ? floatingTab : tab)
        : [...current, floatingTab]);
      setActiveFloatingTabId(tabId);
      return;
    }

    if (type === "orcamentos") setActiveFloatingTabId(null);
    setActiveTab({ id: tabId, type, title, params: params ? { ...params } : undefined });

    // Sync browser URL if applicable
    if (type === "dashboard") {
      router.push("/");
    } else {
      let query = "";
      if (params) {
        const urlParams = new URLSearchParams();
        Object.entries(params).forEach(([key, val]) => {
          if (val) urlParams.append(key, String(val));
        });
        query = `?${urlParams.toString()}`;
      }
      router.push(`/${type}${query}`);
    }
  }, [router]);

  const activateFloatingTab = useCallback((id: string | null) => setActiveFloatingTabId(id), []);
  const closeFloatingTab = useCallback((id: string) => {
    setFloatingTabs((current) => {
      const index = current.findIndex((tab) => tab.id === id);
      const next = current.filter((tab) => tab.id !== id);
      setActiveFloatingTabId((active) => active === id ? (next[Math.max(0, index - 1)]?.id || next[0]?.id || null) : active);
      return next;
    });
  }, []);

  const openDrawer = useCallback((type: string, title: string, data?: any) => {
    setDrawer({
      isOpen: true,
      type,
      title,
      data
    });
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawer((prev) => ({
      ...prev,
      isOpen: false
    }));
  }, []);

  const workspaceValue = useMemo(() => ({
    activeTab,
    activeTabId,
    openTab,
    floatingTabs,
    activeFloatingTabId,
    activateFloatingTab,
    closeFloatingTab,
    drawer,
    openDrawer,
    closeDrawer,
    darkMode,
    toggleDarkMode,
    sidebarOpen,
    setSidebarOpen,
  }), [activeFloatingTabId, activeTab, activeTabId, activateFloatingTab, closeDrawer, closeFloatingTab, darkMode, drawer, floatingTabs, openDrawer, openTab, sidebarOpen, toggleDarkMode]);

  // Sync route changes with open tabs
  useEffect(() => {
    const path = pathname.replace("/", "");
    if (path === "") {
      const dashboardTimer = window.setTimeout(() => {
        setActiveTab({ id: "dashboard", type: "dashboard", title: "Dashboard" });
      }, 0);
      return () => window.clearTimeout(dashboardTimer);
    }

    const type = path;
    const idParam = searchParams.get("id");
    const tabParam = searchParams.get("tab");
    const actionParam = searchParams.get("action");

    let tabId = type;
    const routeParams = Object.fromEntries(searchParams.entries());
    const params: any = Object.keys(routeParams).length ? routeParams : undefined;
    let title = type.charAt(0).toUpperCase() + type.slice(1);

    if (type === "clientes") title = "Clientes";
    else if (type === "ordens-servico") title = "Ordens de Serviço";
    else if (type === "crm") title = "CRM / Funil";
    else if (type === "orcamentos") title = "Orçamentos";
    else if (type === "preventivas") title = "Central de Preventivas";
    else if (type === "faturamento") title = "Painel Fiscal";
    else if (type === "financeiro") title = "Financeiro";
    else if (type === "estoque") title = "Estoque";
    else if (type === "servicos") title = "Serviços";
    else if (type === "prestadores") title = "Prestadores";
    else if (type === "teia") title = "Teia de Dados";
    else if (type === "agenda") title = "Agenda";
    else if (type === "contratos") title = "Contratos";
    else if (type === "relatorios") title = "Relatórios";
    else if (type === "configuracoes") title = "Configurações";
    else if (type === "execucao") title = "Área do Técnico";
    else if (type === "marketing") title = "Central de Marketing";

    if (idParam) {
      tabId = `${type}-${idParam}`;
      title = `${type === "clientes" ? "Cliente" : type === "ordens-servico" ? "OS" : type === "orcamentos" ? "Orçamento" : "Registro"} #${idParam.slice(-4)}`;
    } else if (tabParam || actionParam) {
      const subTitle = tabParam ? ` (${tabParam})` : actionParam ? ` (${actionParam})` : "";
      tabId = tabParam ? `${type}?tab=${tabParam}` : `${type}?action=${actionParam}`;
      title = type === "orcamentos" && tabParam === "preventiva"
        ? "Propostas Preventivas"
        : title + subTitle;
    }

    const syncTimer = window.setTimeout(() => {
      setActiveTab((current) => ({
        id: tabId,
        type,
        title: current.id === tabId ? current.title : title,
        params,
      }));
    }, 0);
    return () => window.clearTimeout(syncTimer);
  }, [pathname, searchParams]);

  return (
    <WorkspaceContext.Provider
      value={workspaceValue}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error("useWorkspace deve ser usado dentro de um WorkspaceProvider");
  }
  return context;
}
