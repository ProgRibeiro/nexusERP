"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency } from "@/lib/utils";
import { confirmAndIssueNfseAction } from "@/app/actions/nfseActions";
import { NfsePreview } from "@/lib/nfse/domain/dpsTypes";
import { ShieldCheck, AlertTriangle, FileText, CheckCircle2, DollarSign, Building, User, Info, Lock } from "lucide-react";

interface NfsePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  preview: NfsePreview | null;
  onIssueSuccess?: (result: any) => void;
}

export function NfsePreviewModal({ isOpen, onClose, preview, onIssueSuccess }: NfsePreviewModalProps) {
  const { toast } = useToast();
  const [activeSubTab, setActiveSubTab] = useState<"geral" | "tomador" | "servico" | "tributos">("geral");
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [transmitting, setTransmitting] = useState(false);

  if (!preview) return null;

  const handleConfirmAndIssue = async () => {
    setTransmitting(true);
    try {
      const confirmationToken = `CONFIRM-EMITIR-OS-${preview.serviceOrderId}`;
      const res = await confirmAndIssueNfseAction(preview.serviceOrderId || "", confirmationToken);

      if (res.success) {
        toast(`NFS-e #${res.nfseNumber} emitida com sucesso em Homologação!`, "success");
        setIsConfirmDialogOpen(false);
        onClose();
        if (onIssueSuccess) onIssueSuccess(res);
      } else if ("isResultUncertain" in res && res.isResultUncertain) {
        toast("Timeout de rede: O status ficou como RESULTADO_INCERTO. Você pode reconciliar na tela sem duplicar a nota.", "warning");
        setIsConfirmDialogOpen(false);
        onClose();
        if (onIssueSuccess) onIssueSuccess(res);
      } else {
        toast(res.error || "A Prefeitura recusou a transmissão da NFS-e.", "error");
        setIsConfirmDialogOpen(false);
      }
    } catch (err: any) {
      toast("Erro ao comunicar com o servidor.", "error");
    } finally {
      setTransmitting(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Prévia & Conferência Fiscal da NFS-e — Duque de Caxias / RJ"
        size="lg"
      >
        <div className="space-y-4 py-1 text-zinc-900 dark:text-zinc-100">
          {/* Banner de Controle de Emissão Assistida */}
          <div className="rounded-xl border border-blue-900/40 bg-blue-950/30 p-3.5 text-xs text-blue-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ShieldCheck size={18} className="text-blue-400 shrink-0" />
              <div>
                <strong className="block text-white font-bold">EMISSÃO 100% MANUAL ASSISTIDA</strong>
                <span>Ambiente: <strong className="text-amber-300 uppercase font-mono">{preview.environment === "homologation" ? "Homologação (Testes)" : "Produção (Oficial)"}</strong> · Série DPS: <strong className="font-mono text-white">{preview.dpsSeries}</strong> · DPS Proposta: <strong className="font-mono text-white">#{preview.proposedNps}</strong></span>
              </div>
            </div>
            <span className="rounded-lg bg-blue-500/20 px-2.5 py-1 text-[10px] font-bold text-blue-300 border border-blue-400/30 font-mono">
              Schema v{preview.versaoDados}
            </span>
          </div>

          {/* Erros / Pendências Fiscais (Bloqueantes) */}
          {preview.validationErrors.length > 0 && (
            <div className="rounded-xl border border-rose-900/50 bg-rose-950/30 p-4 text-xs text-rose-200 space-y-1">
              <strong className="block text-rose-100 font-bold flex items-center gap-1.5 text-sm">
                <AlertTriangle size={16} className="text-rose-400" />
                Pendências Fiscais Identificadas — Corrija Antes de Transmitir:
              </strong>
              <ul className="list-disc pl-5 space-y-0.5 pt-1 text-rose-300">
                {preview.validationErrors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Navegação entre Abas da Prévia */}
          <div className="flex border-b border-zinc-200 dark:border-zinc-800 text-xs font-bold gap-1">
            <button
              onClick={() => setActiveSubTab("geral")}
              className={`px-3 py-2 border-b-2 rounded-t-lg transition-all ${activeSubTab === "geral" ? "border-blue-500 text-blue-400 bg-blue-500/10" : "border-transparent text-zinc-400 hover:text-zinc-200"}`}
            >
              <Info size={13} className="inline mr-1" /> Resumo Geral
            </button>
            <button
              onClick={() => setActiveSubTab("tomador")}
              className={`px-3 py-2 border-b-2 rounded-t-lg transition-all ${activeSubTab === "tomador" ? "border-blue-500 text-blue-400 bg-blue-500/10" : "border-transparent text-zinc-400 hover:text-zinc-200"}`}
            >
              <User size={13} className="inline mr-1" /> Tomador (Cliente)
            </button>
            <button
              onClick={() => setActiveSubTab("servico")}
              className={`px-3 py-2 border-b-2 rounded-t-lg transition-all ${activeSubTab === "servico" ? "border-blue-500 text-blue-400 bg-blue-500/10" : "border-transparent text-zinc-400 hover:text-zinc-200"}`}
            >
              <FileText size={13} className="inline mr-1" /> Serviço & Códigos
            </button>
            <button
              onClick={() => setActiveSubTab("tributos")}
              className={`px-3 py-2 border-b-2 rounded-t-lg transition-all ${activeSubTab === "tributos" ? "border-blue-500 text-blue-400 bg-blue-500/10" : "border-transparent text-zinc-400 hover:text-zinc-200"}`}
            >
              <DollarSign size={13} className="inline mr-1" /> Tributos & Retenções
            </button>
          </div>

          {/* Conteúdo da Aba 1: Resumo Geral */}
          {activeSubTab === "geral" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5 space-y-2">
                <h5 className="font-bold text-zinc-300 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                  <Building size={13} className="text-blue-400" /> Emitente (Prestador)
                </h5>
                <p><strong>Razão Social:</strong> {preview.emitente.corporateName}</p>
                <p><strong>CNPJ:</strong> <span className="font-mono">{preview.emitente.cnpj}</span></p>
                <p><strong>Inscrição Municipal:</strong> <span className="font-mono">{preview.emitente.im}</span></p>
                <p><strong>Regime:</strong> {preview.emitente.crt}</p>
                <p><strong>Município Emissor:</strong> Duque de Caxias / RJ (3301702)</p>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5 space-y-2">
                <h5 className="font-bold text-zinc-300 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                  <DollarSign size={13} className="text-emerald-400" /> Valores Fiscais
                </h5>
                <p><strong>Valor Total da Nota:</strong> <span className="font-mono text-base font-extrabold text-emerald-400">{formatCurrency(preview.valores.vServPrest)}</span></p>
                <p><strong>ISSQN Devido:</strong> <span className="font-mono font-bold text-blue-300">{formatCurrency(preview.valores.vIss || 0)} ({preview.valores.pAliq}%)</span></p>
                <p><strong>Retenção de ISSQN:</strong> {preview.valores.issRetido ? "Sim (Retido pelo Tomador)" : "Não (Devido no Município)"}</p>
                <p><strong>Competência:</strong> <span className="font-mono">{preview.competenceDate}</span></p>
              </div>
            </div>
          )}

          {/* Conteúdo da Aba 2: Tomador */}
          {activeSubTab === "tomador" && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-xs space-y-2">
              <p><strong>Razão Social / Nome:</strong> {preview.tomador.name}</p>
              <p><strong>CPF / CNPJ:</strong> <span className="font-mono text-blue-300">{preview.tomador.cpfCnpj}</span></p>
              <p><strong>Email:</strong> {preview.tomador.email || "Não informado"}</p>
              <p><strong>Telefone:</strong> {preview.tomador.phone || "Não informado"}</p>
              <div className="pt-2 border-t border-zinc-800">
                <strong className="block text-zinc-400 mb-1">Endereço da Prestação / Tomador:</strong>
                <p>{preview.tomador.address.street}, {preview.tomador.address.number} — {preview.tomador.address.neighborhood}</p>
                <p>{preview.tomador.address.city} / {preview.tomador.address.state} — CEP: <span className="font-mono">{preview.tomador.address.cep}</span></p>
              </div>
            </div>
          )}

          {/* Conteúdo da Aba 3: Serviço */}
          {activeSubTab === "servico" && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-xs space-y-2">
              <p><strong>Código Tributação Nacional (cTribNac):</strong> <span className="font-mono font-bold text-emerald-300">{preview.servico.cTribNac}</span></p>
              <p><strong>Item LC 116/2003:</strong> <span className="font-mono">{preview.servico.itemLc116}</span></p>
              <p><strong>Código NBS v2:</strong> <span className="font-mono">{preview.servico.cNBS || "Não informado"}</span></p>
              <p><strong>Município da Prestação:</strong> Duque de Caxias / RJ (3301702)</p>
              <div className="pt-2 border-t border-zinc-800">
                <strong className="block text-zinc-400 mb-1">Descrição do Serviço (xDescServ):</strong>
                <p className="rounded-lg bg-zinc-950 p-2.5 font-mono text-[11px] text-zinc-200 border border-zinc-800/80 leading-relaxed">
                  {preview.servico.xDescServ}
                </p>
              </div>
            </div>
          )}

          {/* Conteúdo da Aba 4: Tributos */}
          {activeSubTab === "tributos" && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-xs space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <p><strong>Alíquota ISSQN:</strong> <span className="font-mono">{preview.valores.pAliq}%</span></p>
                <p><strong>Valor ISSQN:</strong> <span className="font-mono">{formatCurrency(preview.valores.vIss || 0)}</span></p>
              </div>
              {preview.hasIbsCbsGroup && (
                <div className="pt-3 border-t border-zinc-800 space-y-1">
                  <strong className="text-amber-300 block font-bold">Grupo IBS/CBS (Reforma Tributária - v1.01):</strong>
                  <p><strong>Indicador da Operação:</strong> <span className="font-mono">050101</span></p>
                  <p><strong>CST IBS/CBS:</strong> <span className="font-mono">01 (Operação Tributada)</span></p>
                </div>
              )}
            </div>
          )}

          {/* Ações do Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-zinc-200 dark:border-zinc-800">
            <Button variant="secondary" onClick={onClose}>
              Fechar Conferência
            </Button>
            <Button
              variant="primary"
              disabled={!preview.isValid}
              onClick={() => setIsConfirmDialogOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
            >
              <CheckCircle2 size={16} /> Ir para 2ª Confirmação de Emissão
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal da 2ª Confirmação Explícita Obrigatória */}
      <Modal
        isOpen={isConfirmDialogOpen}
        onClose={() => setIsConfirmDialogOpen(false)}
        title="2ª Confirmação Explícita de Transmissão Fiscal"
        size="md"
      >
        <div className="space-y-4 py-2 text-xs text-zinc-900 dark:text-zinc-100">
          <div className="rounded-xl border border-amber-900/50 bg-amber-950/30 p-4 text-amber-200 space-y-2">
            <strong className="block text-sm font-bold text-amber-100 flex items-center gap-2">
              <Lock size={16} className="text-amber-400" />
              Confirma a transmissão fiscal definitiva da NFS-e?
            </strong>
            <p>
              Após autorizada pela Prefeitura de Duque de Caxias/RJ, a NFS-e torna-se um documento fiscal imutável e <strong>não poderá ser simplesmente editada</strong>.
            </p>
            <div className="pt-2 border-t border-amber-800/60 font-mono text-zinc-200">
              <p>• <strong>Tomador:</strong> {preview.tomador.name}</p>
              <p>• <strong>Valor Total:</strong> {formatCurrency(preview.valores.vServPrest)}</p>
              <p>• <strong>DPS Proposta:</strong> #{preview.proposedNps} (Série {preview.dpsSeries})</p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setIsConfirmDialogOpen(false)}>
              Voltar e Recompor
            </Button>
            <Button
              variant="primary"
              loading={transmitting}
              onClick={handleConfirmAndIssue}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
            >
              <ShieldCheck size={16} /> Transmitir NFS-e Agora
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
