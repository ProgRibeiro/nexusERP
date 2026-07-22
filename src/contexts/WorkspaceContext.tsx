"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export interface Tab {
  id: string;
  type: string;
  title: string;
  params?: any;
  pinned?: boolean;
  status?: "active" | "warning" | "error" | "success" | "none";
}

export interface DrawerState {
  isOpen: boolean;
  type: string;
  title: string;
  data: any;
}

interface WorkspaceContextType {
  openTabs: Tab[];
  activeTabId: string;
  openTab: (type: string, title: string, params?: any, options?: { pin?: boolean; status?: Tab["status"] }) => void;
  closeTab: (id: string) => void;
  togglePinTab: (id: string) => void;
  drawer: DrawerState;
  openDrawer: (type: string, title: string, data?: any) => void;
  closeDrawer: () => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);
const WORKSPACE_STORAGE_KEY = "nx_workspace_v1";

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [openTabs, setOpenTabs] = useState<Tab[]>([
    { id: "dashboard", type: "dashboard", title: "Dashboard", pinned: true }
  ]);
  const [activeTabId, setActiveTabId] = useState("dashboard");
  const [drawer, setDrawer] = useState<DrawerState>({
    isOpen: false,
    type: "",
    title: "",
    data: null
  });
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const workspaceHydrated = useRef(false);

  // Restaura as abas e o contexto de trabalho entre sessões. Dados de tela
  // continuam vindo do servidor; persistimos apenas metadados de navegação.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { tabs?: Tab[]; activeTabId?: string };
        const validTabs = Array.isArray(saved.tabs)
          ? saved.tabs.filter((tab) => tab && typeof tab.id === "string" && typeof tab.type === "string" && typeof tab.title === "string").slice(0, 12)
          : [];
        const dashboard = validTabs.find((tab) => tab.id === "dashboard") || { id: "dashboard", type: "dashboard", title: "Dashboard", pinned: true };
        const restored = [dashboard, ...validTabs.filter((tab) => tab.id !== "dashboard")];
        setOpenTabs(restored);
        if (saved.activeTabId && restored.some((tab) => tab.id === saved.activeTabId)) {
          setActiveTabId(saved.activeTabId);
        }
      }
    } catch {
      localStorage.removeItem(WORKSPACE_STORAGE_KEY);
    } finally {
      workspaceHydrated.current = true;
    }
  }, []);

  useEffect(() => {
    if (!workspaceHydrated.current) return;
    localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify({ tabs: openTabs, activeTabId }));
  }, [openTabs, activeTabId]);

  // Initialize Theme from localStorage
  useEffect(() => {
    const isDark = localStorage.getItem("theme") === "dark";
    setTimeout(() => {
      setDarkMode(isDark);
    }, 0);
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleDarkMode = () => {
    const newDark = !darkMode;
    setDarkMode(newDark);
    localStorage.setItem("theme", newDark ? "dark" : "light");
    if (newDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const openTab = (
    type: string,
    title: string,
    params?: any,
    options?: { pin?: boolean; status?: Tab["status"] }
  ) => {
    // Determine unique tab ID
    let tabId = type;
    if (params && params.id) {
      tabId = `${type}-${params.id}`;
    } else if (params && params.tab) {
      tabId = `${type}?tab=${params.tab}`;
    }

    setOpenTabs((prev) => {
      const exists = prev.find((t) => t.id === tabId);
      if (exists) {
        return prev.map((tab) => tab.id === tabId
          ? {
              ...tab,
              title: title || tab.title,
              params: params ? { ...(tab.params || {}), ...params } : tab.params,
              pinned: options?.pin !== undefined ? options.pin : tab.pinned,
              status: options?.status || tab.status,
            }
          : tab);
      }
      const nextTabs = [
        ...prev,
        {
          id: tabId,
          type,
          title,
          params,
          pinned: options?.pin || false,
          status: options?.status || "none"
        }
      ];

      // Evita que a barra vire uma sequência interminável de abas. Abas
      // fixadas são preservadas; entre as demais ficam as seis mais recentes.
      const pinnedTabs = nextTabs.filter((tab) => tab.pinned);
      const regularTabs = nextTabs.filter((tab) => !tab.pinned);
      return [...pinnedTabs, ...regularTabs.slice(-6)];
    });

    setActiveTabId(tabId);

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
  };

  const closeTab = (id: string) => {
    setOpenTabs((prev) => {
      const index = prev.findIndex((t) => t.id === id);
      if (index === -1) return prev;

      const newTabs = prev.filter((t) => t.id !== id);

      // If we closed the active tab, find a fallback
      if (activeTabId === id) {
        const fallback = newTabs[index - 1] || newTabs[0] || { id: "dashboard" };
        setActiveTabId(fallback.id);

        // Sync URL with fallback
        const fbTab = fallback as Tab;
        if (fbTab.id === "dashboard") {
          router.push("/");
        } else {
          let query = "";
          if (fbTab.params) {
            const urlParams = new URLSearchParams();
            Object.entries(fbTab.params).forEach(([key, val]) => {
              if (val) urlParams.append(key, String(val));
            });
            query = `?${urlParams.toString()}`;
          }
          router.push(`/${fbTab.type}${query}`);
        }
      }

      return newTabs;
    });
  };

  const togglePinTab = (id: string) => {
    setOpenTabs((prev) =>
      prev.map((t) => (t.id === id && t.id !== "dashboard" ? { ...t, pinned: !t.pinned } : t))
    );
  };

  const openDrawer = (type: string, title: string, data?: any) => {
    setDrawer({
      isOpen: true,
      type,
      title,
      data
    });
  };

  const closeDrawer = () => {
    setDrawer((prev) => ({
      ...prev,
      isOpen: false
    }));
  };

  // Sync route changes with open tabs
  useEffect(() => {
    const path = pathname.replace("/", "");
    if (path === "") {
      const dashboardTimer = window.setTimeout(() => {
        setActiveTabId("dashboard");
      }, 0);
      return () => window.clearTimeout(dashboardTimer);
    }

    const type = path;
    const idParam = searchParams.get("id");
    const tabParam = searchParams.get("tab");
    const actionParam = searchParams.get("action");

    let tabId = type;
    let params: any = null;
    let title = type.charAt(0).toUpperCase() + type.slice(1);

    if (type === "clientes") title = "Clientes";
    else if (type === "ordens-servico") title = "Ordens de Serviço";
    else if (type === "crm") title = "CRM / Funil";
    else if (type === "orcamentos") title = "Orçamentos";
    else if (type === "preventivas") title = "Propostas Preventivas";
    else if (type === "faturamento") title = "Painel Fiscal";
    else if (type === "financeiro") title = "Financeiro";
    else if (type === "estoque") title = "Estoque";
    else if (type === "servicos") title = "Serviços";
    else if (type === "teia") title = "Teia de Dados";
    else if (type === "agenda") title = "Agenda";
    else if (type === "contratos") title = "Contratos";
    else if (type === "relatorios") title = "Relatórios";
    else if (type === "configuracoes") title = "Configurações";
    else if (type === "execucao") title = "Área do Técnico";

    if (idParam) {
      tabId = `${type}-${idParam}`;
      params = { id: idParam };
      title = `${type === "clientes" ? "Cliente" : type === "ordens-servico" ? "OS" : type === "orcamentos" ? "Orçamento" : "Registro"} #${idParam.slice(-4)}`;
    } else if (tabParam || actionParam) {
      params = {};
      if (tabParam) params.tab = tabParam;
      if (actionParam) params.action = actionParam;

      const subTitle = tabParam ? ` (${tabParam})` : actionParam ? ` (${actionParam})` : "";
      tabId = `${type}?tab=${tabParam || ""}`;
      title = title + subTitle;
    }

    const syncTimer = window.setTimeout(() => {
      setOpenTabs((prev) => {
        const exists = prev.find((t) => t.id === tabId);
        if (exists) return prev;
        return [
          ...prev,
          {
            id: tabId,
            type,
            title,
            params,
            pinned: false,
            status: "none"
          }
        ];
      });

      setActiveTabId(tabId);
    }, 0);
    return () => window.clearTimeout(syncTimer);
  }, [pathname, searchParams]);

  return (
    <WorkspaceContext.Provider
      value={{
        openTabs,
        activeTabId,
        openTab,
        closeTab,
        togglePinTab,
        drawer,
        openDrawer,
        closeDrawer,
        darkMode,
        toggleDarkMode,
        sidebarOpen,
        setSidebarOpen
      }}
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
