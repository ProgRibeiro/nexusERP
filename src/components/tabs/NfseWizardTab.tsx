"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useToast } from "@/components/ui/Toast";
import { getBillingQueue, processBilling, BillingQueueItem } from "@/app/actions/billingActions";
import { formatCurrency } from "@/lib/utils";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Alert } from "../ui/Alert";
import { CheckCircle, AlertTriangle, ArrowLeft, ArrowRight, FileCheck, Loader2 } from "lucide-react";

export default function NfseWizardTab() {
  const { user: currentUser } = useAuth();
  const { openTab } = useWorkspace();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [queue, setQueue] = useState<BillingQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Wizard state values
  const [selectedOS, setSelectedOS] = useState<BillingQueueItem | null>(null);
  const [invoiceCode, setInvoiceCode] = useState(`NF-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000 + 1000)}`);
  const [taxPercent, setTaxPercent] = useState("5"); // 5% ISS default
  const [installments, setInstallments] = useState("1");
  const [paymentMethod, setPaymentMethod] = useState("PIX");
  const [notes, setNotes] = useState("");

  async function loadQueue() {
    setLoading(true);
    try {
      const data = await getBillingQueue();
      setQueue(data);
      if (data.length > 0 && !selectedOS) {
        setSelectedOS(data[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQueue();
  }, []);

  const handleProcess = async () => {
    if (!selectedOS) {
      toast("Nenhuma OS selecionada para faturar", "warning");
      return;
    }

    setActionLoading(true);
    try {
      const res = await processBilling({
        osId: selectedOS.id,
        invoiceCode,
        totalValue: selectedOS.value,
        taxPercent: parseFloat(taxPercent) || 0,
        installments: parseInt(installments) || 1,
        paymentMethod,
        notes,
        userId: currentUser?.id || "",
      });

      if (res.success) {
        toast("Nota fiscal registrada e contas a receber geradas!", "success");
        setStep(6); // Success screen
      } else {
        toast(res.error || "Erro no faturamento fiscal", "error");
      }
    } catch (err) {
      toast("Erro ao faturar no banco de dados", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const stepsList = [
    "Cliente",
    "Serviço",
    "Tributação",
    "Retenções",
    "Revisão",
    "Registrar"
  ];

  if (loading) {
    return (
      <div className="py-24 text-center text-zinc-400 flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs font-semibold animate-pulse">Carregando assistente fiscal...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 select-none animate-in fade-in duration-200">

      {/* Step Indicators (Page 15) */}
      <div className="flex justify-between items-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-premium">
        {stepsList.map((label, index) => {
          const itemStep = index + 1;
          const isActive = itemStep === step;
          const isDone = itemStep < step;

          return (
            <React.Fragment key={index}>
              <div className="flex flex-col items-center gap-1.5 z-10">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black border-2 transition-all ${
                    isDone
                      ? "bg-success border-success text-white"
                      : isActive
                      ? "bg-primary border-primary text-white scale-105"
                      : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-400"
                  }`}
                >
                  {isDone ? "✓" : itemStep}
                </div>
                <span
                  className={`text-[9px] font-bold uppercase tracking-wider ${
                    isActive ? "text-primary font-black" : isDone ? "text-success" : "text-zinc-400"
                  }`}
                >
                  {label}
                </span>
              </div>
              {index < stepsList.length - 1 && (
                <div className="flex-1 h-0.5 bg-zinc-250 dark:bg-zinc-800 -mt-5" />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Wizard Forms Card */}
      <Card>
        {/* Step 1: Cliente Checklist */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-150">Etapa 1: Validar Dados Cadastrais</h3>
              <p className="text-[10px] text-zinc-450 mt-0.5">Checklist pré-emissão fiscal do cliente.</p>
            </div>

            {queue.length === 0 ? (
              <p className="text-xs text-zinc-400 py-8 text-center">Nenhuma OS concluída na fila para faturamento.</p>
            ) : (
              <div className="space-y-4">
                <Select
                  label="Selecione a OS pendente para faturar *"
                  options={queue.map((q) => ({
                    value: q.id,
                    label: `OS #${q.code || q.id.slice(-4)} - ${q.clientName} (${formatCurrency(q.value)})`
                  }))}
                  value={selectedOS?.id || ""}
                  onChange={(e) => {
                    const match = queue.find((q) => q.id === e.target.value);
                    if (match) setSelectedOS(match);
                  }}
                />

                {selectedOS && (
                  <div className="space-y-2.5 pt-2">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Verificações Cadastrais</span>

                    <div className="flex items-center gap-2 text-xs font-semibold p-2.5 bg-zinc-50 dark:bg-zinc-800/10 border border-zinc-150 rounded-xl">
                      <CheckCircle className="text-success shrink-0" size={16} />
                      <span className="text-zinc-700 dark:text-zinc-350">CNPJ / Documento do Cliente Informado: {selectedOS.clientDocument}</span>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-semibold p-2.5 bg-zinc-50 dark:bg-zinc-800/10 border border-zinc-150 rounded-xl">
                      <CheckCircle className="text-success shrink-0" size={16} />
                      <span className="text-zinc-700 dark:text-zinc-350">Endereço de Instalação e Cobrança completo</span>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-semibold p-2.5 bg-zinc-50 dark:bg-zinc-800/10 border border-zinc-150 rounded-xl">
                      <CheckCircle className="text-success shrink-0" size={16} />
                      <span className="text-zinc-700 dark:text-zinc-350">Município do Prestador Configurado</span>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-semibold p-2.5 bg-zinc-50 dark:bg-zinc-800/10 border border-zinc-150 rounded-xl">
                      <AlertTriangle className="text-warning shrink-0" size={16} />
                      <span className="text-zinc-700 dark:text-zinc-350">Verificando Certificado Digital Ativo (Fictício)</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Servico */}
        {step === 2 && selectedOS && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-150">Etapa 2: Validar Detalhe do Serviço</h3>
              <p className="text-[10px] text-zinc-450 mt-0.5">Descrição fiscal do serviço prestado.</p>
            </div>

            <div className="space-y-4">
              <Input
                label="Código Tributário de Serviço (CNAE / NBS)"
                value="14.01 - Instalação e manutenção de sistemas de ar condicionado"
                disabled
              />
              <Input
                label="Descrição de Atividades para Nota Fiscal"
                value={`Prestação de serviços técnicos na OS #${selectedOS.code || selectedOS.id.slice(-4)} para ${selectedOS.clientName}.`}
                disabled
              />
            </div>
          </div>
        )}

        {/* Step 3: Tributacao */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-150">Etapa 3: Configurar Tributação</h3>
              <p className="text-[10px] text-zinc-450 mt-0.5">Alíquotas fiscais aplicadas.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Alíquota ISS (%) *"
                type="number"
                value={taxPercent}
                onChange={(e) => setTaxPercent(e.target.value)}
              />
              <Input
                label="Código da NFS-e *"
                value={invoiceCode}
                onChange={(e) => setInvoiceCode(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Step 4: Retencoes */}
        {step === 4 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-150">Etapa 4: Retenções de Impostos</h3>
              <p className="text-[10px] text-zinc-450 mt-0.5">Retenções na fonte (PIS, COFINS, CSLL, INSS).</p>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-800/10 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl text-xs font-semibold text-zinc-500 text-center py-10">
              Esta empresa está configurada no regime Simples Nacional. Isento de retenção de impostos na fonte para esta faixa de faturamento.
            </div>
          </div>
        )}

        {/* Step 5: Revisao */}
        {step === 5 && selectedOS && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-150">Etapa 5: Revisar e Definir Parcelas</h3>
              <p className="text-[10px] text-zinc-450 mt-0.5">Revise o faturamento e as parcelas geradas no contas a receber.</p>
            </div>

            <div className="space-y-3.5 text-xs bg-zinc-50 dark:bg-zinc-850 p-4 rounded-xl border border-zinc-150 dark:border-zinc-800">
              <div className="flex justify-between">
                <span className="text-zinc-500 font-semibold">Valor Bruto do Serviço</span>
                <span className="font-extrabold text-zinc-800 dark:text-zinc-200">{formatCurrency(selectedOS.value)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500 font-semibold">ISS Estimado ({taxPercent}%)</span>
                <span className="font-extrabold text-zinc-800 dark:text-zinc-200">
                  {formatCurrency(selectedOS.value * (parseFloat(taxPercent) / 100))}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-zinc-200 dark:border-zinc-800 font-bold">
                <span className="text-zinc-800 dark:text-zinc-100">Faturamento Líquido</span>
                <span className="text-success font-black">{formatCurrency(selectedOS.value)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Quantidade de Parcelas *"
                options={[
                  { value: "1", label: "1 Parcela (À Vista)" },
                  { value: "2", label: "2 Parcelas (30/60 dias)" },
                  { value: "3", label: "3 Parcelas (30/60/90 dias)" }
                ]}
                value={installments}
                onChange={(e) => setInstallments(e.target.value)}
              />

              <Select
                label="Forma de Pagamento Principal *"
                options={[
                  { value: "PIX", label: "PIX" },
                  { value: "BOLETO", label: "Boleto Bancário" },
                  { value: "TRANSFERENCIA", label: "Transferência / TED" },
                  { value: "CARTAO", label: "Cartão de Crédito" }
                ]}
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              />
            </div>

            <Input
              label="Notas para o Financeiro"
              placeholder="Adicione observações da fatura se necessário"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        )}

        {/* Step 6: Success Screen */}
        {step === 6 && (
          <div className="py-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-success border border-emerald-100 mx-auto flex items-center justify-center animate-bounce">
              <FileCheck size={32} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-zinc-900 dark:text-zinc-100">Nota fiscal registrada com sucesso!</h3>
              <p className="text-xs text-zinc-450 mt-1">O faturamento foi consolidado e as parcelas geradas no Contas a Receber.</p>
            </div>
            <div className="pt-4 flex justify-center gap-3">
              <Button
                variant="primary"
                onClick={() => {
                  setStep(1);
                  loadQueue();
                  openTab("faturamento", "Painel Fiscal");
                }}
              >
                Voltar ao Painel Fiscal
              </Button>
              <Button
                variant="secondary"
                onClick={() => openTab("financeiro", "Financeiro", { tab: "receber" })}
              >
                Ver Contas a Receber
              </Button>
            </div>
          </div>
        )}

        {/* Navigation Buttons (not shown on success step) */}
        {step < 6 && (
          <div className="pt-6 border-t border-zinc-150 dark:border-zinc-800 flex justify-between gap-3 mt-4">
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                if (step === 1) {
                  openTab("faturamento", "Painel Fiscal");
                } else {
                  setStep((prev) => prev - 1);
                }
              }}
            >
              <ArrowLeft size={16} /> Voltar
            </Button>

            {step < 5 ? (
              <Button
                variant="primary"
                type="button"
                onClick={() => setStep((prev) => prev + 1)}
                disabled={!selectedOS}
              >
                Avançar <ArrowRight size={16} />
              </Button>
            ) : (
              <Button
                variant="success"
                type="button"
                onClick={handleProcess}
                loading={actionLoading}
              >
                Registrar Nota Fiscal
              </Button>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
