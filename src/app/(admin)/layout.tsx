"use client";

import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { WorkspaceProvider, useWorkspace, Tab } from "@/contexts/WorkspaceContext";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import GlobalDrawer from "@/components/GlobalDrawer";
import MobileNavigation from "@/components/MobileNavigation";
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
import PreventiveCentralTab from "@/components/tabs/PreventiveCentralTab";
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
      return <OrdensServicoTab newRecord={tab.params?.new === "true"} requestId={tab.params?.requestId} clientId={tab.params?.clientId} contractId={tab.params?.contractId} addressId={tab.params?.addressId} initialType={tab.params?.type} statusFilter={tab.params?.status} />;
    case "crm":
      return <CrmTab newRecord={tab.params?.new === "true"} requestId={tab.params?.requestId} />;
    case "orcamentos":
      if (tab.params?.tab === "preventiva") {
        return <PreventiveProposalsTab />;
      }
      return <OrcamentosTab newRecord={tab.params?.new === "true"} requestId={tab.params?.requestId} clientId={tab.params?.clientId} quoteId={tab.params?.id} />;
    case "preventivas":
      return <PreventiveCentralTab />;
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
  const { activeTab, darkMode } = useWorkspace();

  return (
    <div className={`app-shell flex h-[100dvh] w-screen overflow-hidden font-sans antialiased print:block print:h-auto print:w-auto print:overflow-visible ${darkMode ? "dark bg-zinc-950 text-zinc-100" : "bg-zinc-50 text-zinc-800"}`}>
      {/* Sidebar Navigation */}
      <div className="print:hidden flex h-full">
        <Sidebar />
      </div>

      {/* Main Container */}
      <div className="min-w-0 flex-1 flex flex-col h-[100dvh] overflow-hidden print:block print:h-auto print:overflow-visible">
        {/* Topbar / Search */}
        <div className="print:hidden">
          <Header />
        </div>

        {/* Viewport principal: a navegação fica exclusivamente na barra lateral. */}
        <main className="app-workspace relative flex-1 overflow-y-auto overflow-x-hidden p-3 pb-28 sm:p-4 sm:pb-28 lg:p-5 xl:p-7 xl:pb-8 2xl:p-8 print:block print:overflow-visible print:p-0 print:bg-white">
          <div className={`w-full mx-auto min-h-full print:max-w-none print:min-h-0 ${["preventivas", "orcamentos"].includes(activeTab.type) ? "max-w-[1800px]" : "max-w-7xl"}`}>
            <div key={activeTab.id} className="h-full animate-in fade-in duration-150 print:h-auto">
              <TabContentRenderer tab={activeTab} />
            </div>
          </div>
        </main>
      </div>

      {/* Slide-in Drawers */}
      <GlobalDrawer />
      <MobileNavigation />
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  void children;
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
