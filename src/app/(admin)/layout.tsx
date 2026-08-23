"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { WorkspaceProvider, useWorkspace, Tab } from "@/contexts/WorkspaceContext";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import GlobalDrawer from "@/components/GlobalDrawer";
import MobileNavigation from "@/components/MobileNavigation";
import { Layers3, Loader2, Minus, X } from "lucide-react";

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
import PrestadoresTab from "@/components/tabs/PrestadoresTab";
import MarketingTab from "@/components/tabs/MarketingTab";
import { ToastProvider } from "@/components/ui/Toast";
import ErrorReporter from "@/components/ErrorReporter";

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
    case "prestadores":
      return <PrestadoresTab />;
    case "marketing":
      return <MarketingTab />;
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

function WorkspaceContainer({ children }: { children: React.ReactNode }) {
  const { activeTab, darkMode, floatingTabs, activeFloatingTabId, activateFloatingTab, closeFloatingTab } = useWorkspace();
  const pathname = usePathname();
  const standalonePage = pathname.startsWith("/orcamentos/") || pathname.startsWith("/orcamentos-obras");
  const activeFloatingTab = floatingTabs.find((tab) => tab.id === activeFloatingTabId);

  return (
    <div className={`app-shell flex h-[100dvh] w-screen overflow-hidden bg-[var(--op-canvas)] font-sans text-[var(--op-text)] antialiased transition-colors duration-200 print:block print:h-auto print:w-auto print:overflow-visible ${darkMode ? "dark" : ""}`}>
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
        <main className="app-workspace relative flex-1 overflow-y-auto overflow-x-hidden p-3 pb-28 sm:p-4 sm:pb-28 lg:p-5 xl:p-7 xl:pb-28 2xl:p-8 2xl:pb-28 print:block print:overflow-visible print:p-0 print:bg-white">
          <div className={`w-full mx-auto min-h-full print:max-w-none print:min-h-0 ${standalonePage || ["preventivas", "orcamentos"].includes(activeTab.type) ? "max-w-[1800px]" : "max-w-7xl"}`}>
            <div key={activeTab.id} className="h-full animate-in fade-in duration-150 print:h-auto">
              {standalonePage ? children : <TabContentRenderer tab={activeTab} />}
            </div>
          </div>
        </main>
      </div>

      {/* Slide-in Drawers */}
      <GlobalDrawer />
      {floatingTabs.length > 0 && (
        <>
          {activeFloatingTab && <div className="fixed inset-0 z-46 bg-black/45 backdrop-blur-[2px] print:hidden" onClick={() => activateFloatingTab(null)} aria-hidden="true" />}
          {activeFloatingTab && <section className="fixed inset-2 z-47 flex flex-col overflow-hidden rounded-[24px] border border-zinc-200 bg-white shadow-[0_35px_100px_rgba(0,0,0,.35)] sm:inset-5 xl:bottom-5 xl:left-[268px] xl:right-5 xl:top-[88px] dark:border-zinc-800 dark:bg-zinc-950 print:hidden" role="dialog" aria-label={activeFloatingTab.title}>
            <header className="flex shrink-0 items-center gap-2 border-b border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto scrollbar-none">
                {floatingTabs.map((tab) => <button key={tab.id} type="button" onClick={() => activateFloatingTab(tab.id)} className={`group flex min-w-[150px] max-w-[240px] items-center gap-2 rounded-xl px-3 py-2 text-left text-[10px] font-bold transition ${tab.id === activeFloatingTabId ? "bg-[#155eef] text-white" : "bg-white text-zinc-600 hover:bg-zinc-100 dark:bg-white/[.04] dark:text-zinc-400 dark:hover:bg-white/[.08] dark:hover:text-white"}`}><Layers3 size={13} className="shrink-0"/><span className="flex-1 truncate">{tab.title}</span><span onClick={(event) => { event.stopPropagation(); closeFloatingTab(tab.id); }} className="rounded-md p-1 opacity-60 hover:bg-black/15 hover:opacity-100" role="button" aria-label={`Fechar ${tab.title}`}><X size={11}/></span></button>)}
              </div>
              <button type="button" onClick={() => activateFloatingTab(null)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white" title="Minimizar"><Minus size={17}/></button>
              <button type="button" onClick={() => closeFloatingTab(activeFloatingTab.id)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:text-zinc-400 dark:hover:bg-red-500/15 dark:hover:text-red-300" title="Fechar"><X size={17}/></button>
            </header>
            <div className="app-workspace min-h-0 flex-1 overflow-y-auto p-3 sm:p-5 xl:p-6">
              {floatingTabs.map((tab) => <div key={tab.id} className={tab.id === activeFloatingTabId ? "mx-auto min-h-full w-full max-w-[1600px] animate-in fade-in duration-150" : "hidden"}><TabContentRenderer tab={tab}/></div>)}
            </div>
          </section>}
          {!activeFloatingTab && <div className="fixed bottom-20 right-4 z-47 flex max-w-[calc(100vw-2rem)] items-center gap-1 overflow-x-auto rounded-2xl border border-[#155eef]/25 bg-[#141519]/95 p-2 shadow-2xl backdrop-blur-md xl:bottom-5 xl:right-5 print:hidden"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#155eef] text-black"><Layers3 size={16}/></span>{floatingTabs.map((tab) => <button key={tab.id} onClick={() => activateFloatingTab(tab.id)} className="max-w-40 truncate rounded-xl px-3 py-2 text-[10px] font-bold text-zinc-300 hover:bg-white/10">{tab.title}</button>)}<button onClick={() => floatingTabs.forEach((tab) => closeFloatingTab(tab.id))} className="rounded-xl p-2 text-zinc-500 hover:text-red-300" title="Fechar todas"><X size={15}/></button></div>}
        </>
      )}
      <MobileNavigation />
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
          Carregando O Prestador...
        </p>
      </div>
    );
  }

  // Authentication check
  if (!user) {
    return (
      <div className="h-screen w-screen bg-zinc-950 flex flex-col items-center justify-center gap-2 text-zinc-100">
        <p className="text-red-500 font-bold">Erro de Autenticação</p>
        <p className="text-sm text-zinc-500">Por favor, faça login no portal O Prestador.</p>
      </div>
    );
  }

  return (
    <WorkspaceProvider>
      <ToastProvider>
        <WorkspaceContainer>{children}</WorkspaceContainer>
        <ErrorReporter />
      </ToastProvider>
    </WorkspaceProvider>
  );
}
