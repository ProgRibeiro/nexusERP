"use client";

import React, { useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  Wrench,
  DollarSign,
  FileSpreadsheet,
  Laptop,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Play,
  ShieldCheck,
  Building2,
  HelpCircle,
  Download,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface ERPInteractiveTutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab?: (tabId: string, title: string) => void;
}

export function ERPInteractiveTutorialModal({
  isOpen,
  onClose,
  onNavigateTab,
}: ERPInteractiveTutorialModalProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: "1. Bem-vindo ao Nexus ERP — Visão Geral",
      badge: "Início Rápido",
      icon: Sparkles,
      color: "from-blue-600 to-indigo-700",
      content: (
        <div className="space-y-3 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
          <p className="font-semibold text-sm text-zinc-900 dark:text-white">
            O ERP que conecta Operação, Preventivas, Vendas e Financeiro em um único painel.
          </p>
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <CheckCircle2 size={16} className="text-blue-500 shrink-0 mt-0.5" />
              <span><strong>Abas Inteligentes:</strong> Alterne entre telas sem perder formulários incompletos ou rascunhos.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 size={16} className="text-blue-500 shrink-0 mt-0.5" />
              <span><strong>Pesquisa Global (Ctrl+K):</strong> Digite o nome de qualquer cliente, código de OS ou peça para abrir instantaneamente.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 size={16} className="text-blue-500 shrink-0 mt-0.5" />
              <span><strong>Multitenant & Filiais:</strong> Alterne entre unidades e lojas da sua empresa com facilidade.</span>
            </li>
          </ul>
        </div>
      ),
      actionTab: "dashboard",
      actionTitle: "Ver Dashboard",
    },
    {
      title: "2. Ordens de Serviço & Preventiva das Lojas",
      badge: "Operacional",
      icon: Wrench,
      color: "from-emerald-600 to-teal-700",
      content: (
        <div className="space-y-3 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
          <p className="font-semibold text-sm text-zinc-900 dark:text-white">
            Gerencie atendimentos rápidos, relatórios com fotos e manutenção preventiva.
          </p>
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
              <span><strong>Baixa Rápida de OS:</strong> Conclua ordens de serviço sem burocracia anexando fotos do atendimento efetuado.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
              <span><strong>Central de Preventivas Real:</strong> Cadastre lojas, acompanhe prazos de visita semestral/mensal e checklists técnicos.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
              <span><strong>Estorno de Status:</strong> Errou o status de uma OS? Clique no botão <code>[ ↩️ Reverter Status ]</code> para retornar ao atendimento.</span>
            </li>
          </ul>
        </div>
      ),
      actionTab: "ordens-servico",
      actionTitle: "Ir para Ordens de Serviço",
    },
    {
      title: "3. Financeiro, Contas & Estorno com 1-Clique",
      badge: "Gestão Financeira",
      icon: DollarSign,
      color: "from-purple-600 to-indigo-700",
      content: (
        <div className="space-y-3 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
          <p className="font-semibold text-sm text-zinc-900 dark:text-white">
            Controle total de Contas a Receber, Contas a Pagar, Cartões e Rateios.
          </p>
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <CheckCircle2 size={16} className="text-purple-500 shrink-0 mt-0.5" />
              <span><strong>Baixa Direta com Banco Padrão:</strong> Ao liquidar uma fatura sem conta pré-selecionada, o sistema provisiona automaticamente o Caixa Geral.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 size={16} className="text-purple-500 shrink-0 mt-0.5" />
              <span><strong>Estorno Total:</strong> Botão <code>[ ↩️ Estornar ]</code> em contas pagas e recebidas para reverter lançamentos com recálculo automático do saldo.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 size={16} className="text-purple-500 shrink-0 mt-0.5" />
              <span><strong>Receita Entrada em Verde:</strong> Recebimentos confirmados são destacados em verde positivo (<code>+ R$</code>).</span>
            </li>
          </ul>
        </div>
      ),
      actionTab: "financeiro",
      actionTitle: "Abrir Painel Financeiro",
    },
    {
      title: "4. Importador NEXUS ONE & Planilha Modelo Padrão",
      badge: "Importação & Dados",
      icon: FileSpreadsheet,
      color: "from-amber-600 to-orange-700",
      content: (
        <div className="space-y-3 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
          <p className="font-semibold text-sm text-zinc-900 dark:text-white">
            Importe milhares de registros de uma só vez com o Modelo Padrão em Excel.
          </p>
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <CheckCircle2 size={16} className="text-amber-500 shrink-0 mt-0.5" />
              <span><strong>Baixe o Modelo em CSV/Excel:</strong> Clique no botão <code>[ 📥 Baixar Planilha Modelo ]</code> no importador para obter a planilha com todas as 24 colunas oficiais.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 size={16} className="text-amber-500 shrink-0 mt-0.5" />
              <span><strong>Sincronização Completa:</strong> Importa Preços de Custo, Venda, Margem %, Link do Site, URL da Foto, Estoque, Clientes e OSs.</span>
            </li>
          </ul>
        </div>
      ),
      actionTab: "ordens-servico",
      actionTitle: "Abrir Importador NEXUS",
    },
    {
      title: "5. Software Desktop Nativo & Conexão VPS",
      badge: "Software Desktop",
      icon: Laptop,
      color: "from-slate-800 to-slate-950",
      content: (
        <div className="space-y-3 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
          <p className="font-semibold text-sm text-zinc-900 dark:text-white">
            Use o ERP como programa nativo de computador conectando-se à VPS.
          </p>
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <CheckCircle2 size={16} className="text-blue-400 shrink-0 mt-0.5" />
              <span><strong>App Desktop Nativo em Python / C / Java:</strong> Baixe o executável para rodar direto no Windows/Mac/Linux sem abas de navegador.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 size={16} className="text-blue-400 shrink-0 mt-0.5" />
              <span><strong>Seletor de VPS com Teste de Ping:</strong> Digite o endereço da sua VPS Hostinger e meça a latência em tempo real.</span>
            </li>
          </ul>
        </div>
      ),
      actionTab: "desktop",
      actionTitle: "Ver Software Desktop & VPS",
    },
  ];

  const current = steps[currentStep];
  const StepIcon = current.icon;

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((c) => c + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((c) => c - 1);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="📖 Guia e Tutorial Interativo — Nexus ERP"
      size="lg"
    >
      <div className="space-y-6 text-xs select-none">
        {/* Banner do Passo Atual */}
        <div className={`rounded-2xl bg-gradient-to-r ${current.color} p-5 text-white shadow-lg transition-all duration-300`}>
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white backdrop-blur-xs">
              {current.badge} • Passo {currentStep + 1} de {steps.length}
            </span>
            <div className="flex gap-1.5">
              {steps.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentStep(idx)}
                  className={`h-2 rounded-full transition-all cursor-pointer ${
                    idx === currentStep ? "w-6 bg-white" : "w-2 bg-white/40 hover:bg-white/70"
                  }`}
                  title={`Passo ${idx + 1}`}
                />
              ))}
            </div>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">
              <StepIcon size={24} />
            </div>
            <h3 className="text-base font-black tracking-tight text-white">
              {current.title}
            </h3>
          </div>
        </div>

        {/* Conteúdo do Passo */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 min-h-[160px]">
          {current.content}
        </div>

        {/* Controles de Navegação */}
        <div className="flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800 pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={handlePrev}
            disabled={currentStep === 0}
            className="px-4 font-bold border-zinc-300 dark:border-zinc-700"
          >
            <ArrowLeft size={14} className="mr-1" /> Anterior
          </Button>

          <div className="flex items-center gap-2">
            {onNavigateTab && current.actionTab && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  onClose();
                  onNavigateTab(current.actionTab, current.actionTitle);
                }}
                className="px-4 font-bold text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/40"
              >
                <Play size={13} className="mr-1 fill-current" /> {current.actionTitle}
              </Button>
            )}

            <Button
              type="button"
              variant="primary"
              onClick={handleNext}
              className="px-5 font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
            >
              {currentStep === steps.length - 1 ? (
                "Concluir Tutorial"
              ) : (
                <>
                  Próximo Passo <ArrowRight size={14} className="ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
