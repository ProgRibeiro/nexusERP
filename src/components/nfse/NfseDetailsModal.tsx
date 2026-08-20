"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency } from "@/lib/utils";
import { cancelNfseAction, reconcileNfseAction } from "@/app/actions/nfseActions";
import { FileText, Download, ExternalLink, RefreshCw, XCircle, CheckCircle2, ShieldCheck, AlertTriangle } from "lucide-react";

interface NfseDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  nfseRecord: any;
  onRefresh?: () => void;
}

export function NfseDetailsModal({ isOpen, onClose, nfseRecord, onRefresh }: NfseDetailsModalProps) {
  const { toast } = useToast();
  const [reconciling, setReconciling] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelCode, setCancelCode] = useState("1");
  const [cancelDesc, setCancelDesc] = useState("");

  if (!nfseRecord) return null;

  const handleReconcile = async () => {
    setReconciling(true);
    try {
      const res = await reconcileNfseAction(nfseRecord.id);
      if (res.success && "message" in res) {
        toast(res.message, "success");
        if (onRefresh) onRefresh();
      } else {
        toast("error" in res ? res.error : "Não foi possível atualizar a situação da NFS-e.", "warning");
      }
    } catch {
      toast("Erro de comunicação ao reconciliar com a Prefeitura.", "error");
    } finally {
      setReconciling(false);
    }
  };

  const handleDownloadXml = () => {
    const xml = nfseRecord.authorizedXml || nfseRecord.requestXml || "";
    if (!xml) {
      toast("Conteúdo XML não localizado para este registro.", "warning");
      return;
    }
    const blob = new Blob([xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `NFSe_${nfseRecord.nfseNumber || nfseRecord.dpsNumber}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleConfirmCancel = async () => {
    if (cancelDesc.trim().length < 15) {
      toast("Digite uma justificativa detalhada para o cancelamento (mínimo 15 caracteres).", "warning");
      return;
    }
    setCancelling(true);
    try {
      const res = await cancelNfseAction(nfseRecord.id, cancelCode, cancelDesc);
      if (res.success) {
        toast("NFS-e cancelada com sucesso na Prefeitura!", "success");
        setIsCancelModalOpen(false);
        onClose();
        if (onRefresh) onRefresh();
      } else {
        toast(res.error || "Não foi possível cancelar a NFS-e.", "error");
      }
    } catch {
      toast("Erro ao cancelar NFS-e.", "error");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`NFS-e #${nfseRecord.nfseNumber || nfseRecord.dpsNumber} — Duque de Caxias / RJ`}
        size="md"
      >
        <div className="space-y-4 py-1 text-xs text-zinc-900 dark:text-zinc-100">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-zinc-400">Status Fiscal:</span>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${nfseRecord.status === "AUTORIZADA" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : nfseRecord.status === "CANCELADA" ? "bg-rose-500/20 text-rose-300 border border-rose-500/30" : "bg-amber-500/20 text-amber-300 border border-amber-500/30"}`}>
                {nfseRecord.status}
              </span>
            </div>
            <p><strong>Chave de Acesso Nacional:</strong> <span className="font-mono text-[11px] text-blue-300 break-all">{nfseRecord.accessKey || "Pendente"}</span></p>
            <p><strong>DPS:</strong> <span className="font-mono">#{nfseRecord.dpsNumber} (Série {nfseRecord.dpsSeries})</span></p>
            <p><strong>Valor do Serviço:</strong> <span className="font-mono text-base font-extrabold text-emerald-400">{formatCurrency(Number(nfseRecord.serviceValue))}</span></p>
            <p><strong>Ambiente:</strong> <span className="font-mono uppercase">{nfseRecord.environment}</span></p>
          </div>

          {/* Ações disponíveis */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
            {nfseRecord.visualizationUrl && (
              <a
                href={nfseRecord.visualizationUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all"
              >
                <ExternalLink size={14} /> Visualizar no Portal
              </a>
            )}
            <Button variant="secondary" onClick={handleDownloadXml} className="w-full">
              <Download size={14} /> Baixar XML Autorizado
            </Button>
            <Button variant="secondary" onClick={handleReconcile} loading={reconciling} className="w-full">
              <RefreshCw size={14} /> Reconciliar com Prefeitura
            </Button>
            {nfseRecord.status === "AUTORIZADA" && (
              <Button variant="danger" onClick={() => setIsCancelModalOpen(true)} className="w-full">
                <XCircle size={14} /> Cancelar NFS-e
              </Button>
            )}
          </div>
        </div>
      </Modal>

      {/* Modal de Confirmação de Cancelamento Manual */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title="Cancelar NFS-e Autorizada"
        size="md"
      >
        <div className="space-y-4 py-2 text-xs text-zinc-900 dark:text-zinc-100">
          <div className="rounded-xl border border-rose-900/50 bg-rose-950/30 p-4 text-rose-200">
            <strong className="block text-sm font-bold text-rose-100 mb-1">Confirmação de Cancelamento Fiscal</strong>
            <p>Você está prestes a transmitir o pedido de cancelamento da <strong>NFS-e #{nfseRecord.nfseNumber}</strong> para a Prefeitura de Duque de Caxias/RJ.</p>
          </div>

          <div className="space-y-2">
            <label className="block font-bold text-zinc-300">Justificativa do Cancelamento (mínimo 15 caracteres):</label>
            <Input
              value={cancelDesc}
              onChange={(e) => setCancelDesc(e.target.value)}
              placeholder="Ex: Cancelamento solicitado pelo tomador devido a erro no valor total da OS..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setIsCancelModalOpen(false)}>
              Voltar
            </Button>
            <Button variant="danger" loading={cancelling} onClick={handleConfirmCancel}>
              <XCircle size={14} /> Transmitir Cancelamento
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
