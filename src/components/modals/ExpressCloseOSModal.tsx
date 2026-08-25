"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { expressCloseServiceOrderAction } from "@/app/actions/osActions";
import { Zap, Camera, CheckCircle2, FileText, Upload, Image as ImageIcon } from "lucide-react";

interface ExpressCloseOSModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceOrder: {
    id: string;
    code: string;
    clientName?: string;
    problemReported?: string;
    status: string;
  } | null;
  onSuccess?: () => void;
}

export function ExpressCloseOSModal({
  isOpen,
  onClose,
  serviceOrder,
  onSuccess,
}: ExpressCloseOSModalProps) {
  const { toast } = useToast();
  const [targetStatus, setTargetStatus] = useState<
    "CONCLUIDA" | "RELATORIO_ENVIADO" | "FATURAMENTO" | "FATURADA"
  >("CONCLUIDA");
  const [solutionNotes, setSolutionNotes] = useState("");
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [newPhotoUrl, setNewPhotoUrl] = useState("");
  const [loading, setLoading] = useState(false);

  if (!serviceOrder) return null;

  const handleAddPhotoUrl = () => {
    if (!newPhotoUrl.trim()) return;
    setPhotoUrls((prev) => [...prev, newPhotoUrl.trim()]);
    setNewPhotoUrl("");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          setPhotoUrls((prev) => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const res = await expressCloseServiceOrderAction({
        serviceOrderId: serviceOrder.id,
        targetStatus,
        solutionNotes: solutionNotes.trim() || undefined,
        photos: photoUrls.map((url) => ({
          step: "EVIDENCIA",
          url,
          caption: "Evidência do atendimento expresso",
        })),
      });

      if (res.success) {
        toast(`OS ${serviceOrder.code} atualizada para ${targetStatus} com sucesso!`, "success");
        if (onSuccess) onSuccess();
        onClose();
      } else {
        toast(res.error || "Erro ao concluir a OS.", "error");
      }
    } catch {
      toast("Erro de conexão ao dar baixa na OS.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`⚡ Baixa Rápida de OS (${serviceOrder.code})`}
    >
      <div className="space-y-4 pt-1">
        {/* Info do Chamado */}
        <div className="rounded-2xl border border-blue-200/80 bg-blue-50/50 p-3.5 dark:border-blue-900/30 dark:bg-blue-950/20">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 block">
            Cliente / Atendimento
          </span>
          <p className="font-extrabold text-sm text-zinc-900 dark:text-white mt-0.5">
            {serviceOrder.clientName || "Cliente"}
          </p>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 line-clamp-2">
            {serviceOrder.problemReported || "Sem descrição"}
          </p>
        </div>

        {/* Escolha do Status Final */}
        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-2">
            Selecione o Status de Destino
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTargetStatus("CONCLUIDA")}
              className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                targetStatus === "CONCLUIDA"
                  ? "border-emerald-500 bg-emerald-50 text-emerald-900 font-black dark:bg-emerald-950/40 dark:text-emerald-200"
                  : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-bold">🟢 Concluída</span>
                {targetStatus === "CONCLUIDA" && <CheckCircle2 size={14} className="text-emerald-600" />}
              </div>
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1">Serviço entregue no local</span>
            </button>

            <button
              type="button"
              onClick={() => setTargetStatus("FATURAMENTO")}
              className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                targetStatus === "FATURAMENTO"
                  ? "border-blue-500 bg-blue-50 text-blue-900 font-black dark:bg-blue-950/40 dark:text-blue-200"
                  : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-bold">📋 Faturamento</span>
                {targetStatus === "FATURAMENTO" && <CheckCircle2 size={14} className="text-blue-600" />}
              </div>
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1">Aguardando emissão de NF</span>
            </button>

            <button
              type="button"
              onClick={() => setTargetStatus("FATURADA")}
              className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                targetStatus === "FATURADA"
                  ? "border-purple-500 bg-purple-50 text-purple-900 font-black dark:bg-purple-950/40 dark:text-purple-200"
                  : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-bold">💰 Faturada</span>
                {targetStatus === "FATURADA" && <CheckCircle2 size={14} className="text-purple-600" />}
              </div>
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1">NF emitida / Contas a Receber</span>
            </button>

            <button
              type="button"
              onClick={() => setTargetStatus("RELATORIO_ENVIADO")}
              className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                targetStatus === "RELATORIO_ENVIADO"
                  ? "border-teal-500 bg-teal-50 text-teal-900 font-black dark:bg-teal-950/40 dark:text-teal-200"
                  : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-bold">📄 Relatório Enviado</span>
                {targetStatus === "RELATORIO_ENVIADO" && <CheckCircle2 size={14} className="text-teal-600" />}
              </div>
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1">Enviado para o cliente</span>
            </button>
          </div>
        </div>

        {/* Resumo do Serviço / Solução Técnica */}
        <div>
          <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
            Resumo Rápido da Execução / Solução Técnica
          </label>
          <Textarea
            rows={3}
            value={solutionNotes}
            onChange={(e) => setSolutionNotes(e.target.value)}
            placeholder="Ex: Atendimento realizado com sucesso, disjuntor substituído e testes efetuados no local."
            className="w-full text-xs"
          />
        </div>

        {/* Fotos / Evidências */}
        <div>
          <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center justify-between">
            <span>Fotos & Evidências Rápidas</span>
            <span className="text-[10px] font-normal text-zinc-500">{photoUrls.length} foto(s) anexada(s)</span>
          </label>

          <div className="flex items-center gap-2">
            <label className="flex-1 cursor-pointer rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-3 text-center text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <span className="flex items-center justify-center gap-2">
                <Camera size={16} className="text-blue-600" />
                Anexar Fotos do Celular / Computador
              </span>
            </label>
          </div>

          {/* Grid de Fotos Anexadas */}
          {photoUrls.length > 0 && (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {photoUrls.map((url, idx) => (
                <div key={idx} className="relative group rounded-xl overflow-hidden border border-zinc-200 h-20 bg-zinc-100 dark:border-zinc-700">
                  <img src={url} alt={`Evidência ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotoUrls((prev) => prev.filter((_, i) => i !== idx))}
                    className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 text-[10px] font-black flex items-center justify-center opacity-90 group-hover:opacity-100"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Botão de Ação Principal */}
        <div className="pt-3 flex gap-2">
          <Button variant="secondary" onClick={onClose} className="w-1/3">
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={loading}
            className="w-2/3 bg-amber-500 hover:bg-amber-600 font-black text-white shadow-md flex items-center justify-center gap-2"
          >
            <Zap size={16} className="fill-white" /> Baixar OS Agora
          </Button>
        </div>
      </div>
    </Modal>
  );
}
