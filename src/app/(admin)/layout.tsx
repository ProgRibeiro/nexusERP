"use client";

import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { WorkspaceProvider, useWorkspace, Tab } from "@/contexts/WorkspaceContext";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import FloatingTabsBar from "@/components/FloatingTabsBar";
import GlobalDrawer from "@/components/GlobalDrawer";
import { Loader2 } from "lucide-react";

// Tab views imports (dynamically mapped in TabContent wrapper)
import DashboardTab from "@/components/tabs/DashboardTab";
import ClientesTab from "@/components/tabs/ClientesTab";
import ClienteDetailTab from "@/components/tabs/ClienteDetailTab";
import OrdensServicoTab from "@/components/tabs/OrdensServicoTab";
import OrdemServicoDetailTab from "@/components/tabs/OrdemServicoDetailTab";
import CrmTab from "@/components/tabs/CrmTab";
import OrcamentosTab from "@/components/tabs/OrcamentosTab";
import FaturamentoTab from "@/components/tabs/FaturamentoTab";
import FinanceiroTab from "@/components/tabs/FinanceiroTab";
import EstoqueTab from "@/components/tabs/EstoqueTab";
import ContratosTab from "@/components/tabs/ContratosTab";
import RelatoriosTab from "@/components/tabs/RelatoriosTab";
import ConfiguracoesTab from "@/components/tabs/ConfiguracoesTab";
import AgendaTab from "@/components/tabs/AgendaTab";
import ServicosTab from "@/components/tabs/ServicosTab";
import DataGraphTab from "@/components/tabs/DataGraphTab";
import PreventiveProposalsTab from "@/components/tabs/PreventiveProposalsTab";
import { ToastProvider } from "@/components/ui/Toast";

function TabContentRenderer({ tab }: { tab: Tab }) {
  switch (tab.type) {
    case "dashboard":
      return <DashboardTab />;
    case "clientes":
      if (tab.params?.id) {
        return <ClienteDetailTab id={tab.params.id} />;
      }
      return <ClientesTab newRecord={tab.params?.new === "true"} requestId={tab.params?.requestId} />;
    case "ordens-servico":
      if (tab.params?.id) {
        return <OrdemServicoDetailTab id={tab.params.id} initialSection={tab.params?.section} />;
      }
      return <OrdensServicoTab newRecord={tab.params?.new === "true"} requestId={tab.params?.requestId} clientId={tab.params?.clientId} statusFilter={tab.params?.status} />;
    case "crm":
      return <CrmTab newRecord={tab.params?.new === "true"} requestId={tab.params?.requestId} />;
    case "orcamentos":
      return <OrcamentosTab newRecord={tab.params?.new === "true"} requestId={tab.params?.requestId} clientId={tab.params?.clientId} quoteId={tab.params?.id} />;
    case "preventivas":
      return <PreventiveProposalsTab />;
    case "agenda":
      return <AgendaTab />;
    case "faturamento":
      return <FaturamentoTab />;
    case "financeiro":
      return <FinanceiroTab defaultTab={tab.params?.tab} newRecord={tab.params?.new === "true"} newType={tab.params?.type} requestId={tab.params?.requestId} clientId={tab.params?.clientId} statusFilter={tab.params?.status} />;
    case "estoque":
      return <EstoqueTab newRecord={tab.params?.new === "true"} requestId={tab.params?.requestId} />;
    case "servicos":
      return <ServicosTab />;
    case "teia":
      return <DataGraphTab />;
    case "contratos":
      return <ContratosTab newRecord={tab.params?.new === "true"} requestId={tab.params?.requestId} />;
    case "relatorios":
      return <RelatoriosTab />;
    case "configuracoes":
      return <ConfiguracoesTab />;
    default:
      return (
        <div className="p-12 text-center text-zinc-400">
          Aba em desenvolvimento: <span className="font-mono text-zinc-650">{tab.type}</span>
        </div>
      );
  }
}

function WorkspaceContainer() {
  const { openTabs, activeTabId, darkMode } = useWorkspace();

  return (
    <div className={`flex h-screen w-screen overflow-hidden font-sans antialiased ${darkMode ? "dark bg-zinc-950 text-zinc-100" : "bg-zinc-50 text-zinc-800"}`}>
      {/* Sidebar Navigation */}
      <div className="print:hidden flex h-full">
        <Sidebar />
      </div>

      {/* Main Container */}
      <div className="min-w-0 flex-1 flex flex-col h-screen overflow-hidden">
        {/* Topbar / Search */}
        <div className="print:hidden">
          <Header />
        </div>

        {/* Floating Tabs Bar */}
        <div className="print:hidden">
          <FloatingTabsBar />
        </div>

        {/* Tab Viewport - only renders the active tab to maximize speed and minimize memory/queries */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 lg:p-6 bg-zinc-50 dark:bg-zinc-950 relative print:p-0 print:bg-white">
          <div className="w-full max-w-7xl mx-auto min-h-full print:max-w-none">
            {openTabs.map((tab) => {
              const isActive = tab.id === activeTabId;
              if (!isActive) return null;
              return (
                <div
                  key={tab.id}
                  className="h-full animate-in fade-in duration-150"
                >
                  <TabContentRenderer tab={tab} />
                </div>
              );
            })}
          </div>
        </main>
      </div>

      {/* Slide-in Drawers */}
      <GlobalDrawer />
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading, user } = useAuth();

  // Premium loading state
  if (loading) {
    return (
      <div className="h-screen w-screen bg-zinc-950 flex flex-col items-center justify-center gap-4 text-zinc-100">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm font-semibold text-zinc-500 tracking-wide animate-pulse">
          Carregando NX ERP...
        </p>
      </div>
    );
  }

  // Authentication check
  if (!user) {
    return (
      <div className="h-screen w-screen bg-zinc-950 flex flex-col items-center justify-center gap-2 text-zinc-100">
        <p className="text-red-500 font-bold">Erro de Autenticação</p>
        <p className="text-sm text-zinc-500">Por favor, faça login no portal NX ERP.</p>
      </div>
    );
  }

  return (
    <WorkspaceProvider>
      <ToastProvider>
        <WorkspaceContainer />
      </ToastProvider>
    </WorkspaceProvider>
  );
}
