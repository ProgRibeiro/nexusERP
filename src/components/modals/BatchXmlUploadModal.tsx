"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency } from "@/lib/utils";
import { attachBatchXmlAction, XmlBatchImportSummary } from "@/app/actions/xmlBatchImportActions";
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FileCheck,
  Package,
} from "lucide-react";

interface BatchXmlUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function BatchXmlUploadModal({
  isOpen,
  onClose,
  onSuccess,
}: BatchXmlUploadModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<XmlBatchImportSummary | null>(null);
  const [selectedFilesCount, setSelectedFilesCount] = useState(0);

  const handleFilesSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setSelectedFilesCount(files.length);
    setLoading(true);
    setSummary(null);

    const filePayloads: { name: string; base64OrText: string }[] = [];

    const filePromises = Array.from(files).map((file) => {
      return new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const text = event.target?.result as string;
          filePayloads.push({ name: file.name, base64OrText: text });
          resolve();
        };
        reader.readAsText(file);
      });
    });

    await Promise.all(filePromises);

    try {
      const res = await attachBatchXmlAction(filePayloads);
      setSummary(res);
      toast(`Processamento de ${res.totalProcessed} XMLs concluído com sucesso!`, "success");
      onSuccess();
    } catch (err: any) {
      toast("Falha ao processar lote de arquivos XML.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="📑 Anexo e Leitura em Lote de XMLs (NF-e/NFS-e)" size="xl">
      <div className="space-y-5 p-1">
        {/* Upload Zone */}
        <div className="rounded-2xl border-2 border-dashed border-indigo-500/40 bg-indigo-500/5 p-6 text-center transition-all hover:border-indigo-500 hover:bg-indigo-500/10">
          <input
            type="file"
            accept=".xml"
            multiple
            onChange={handleFilesSelect}
            className="hidden"
            id="batch-xml-upload-input"
          />
          <label htmlFor="batch-xml-upload-input" className="cursor-pointer flex flex-col items-center gap-2">
            <div className="p-3 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              {loading ? <Loader2 className="h-8 w-8 animate-spin" /> : <Upload className="h-8 w-8" />}
            </div>
            <div>
              <span className="font-bold text-sm text-zinc-800 dark:text-zinc-100 block">
                {selectedFilesCount > 0 ? `${selectedFilesCount} arquivo(s) selecionado(s)` : "Selecione múltiplos arquivos XML (.XML)"}
              </span>
              <span className="text-xs text-zinc-500 block mt-0.5">
                Vincule Notas Fiscais diretamente às Ordens de Serviço, Contas a Receber e Faturas em lote.
              </span>
            </div>
          </label>
        </div>

        {/* Live Processing Results Table */}
        {summary && (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-2">
                <span className="text-zinc-400 block text-[10px] uppercase font-bold">Processados</span>
                <span className="font-bold text-sm text-zinc-800 dark:text-zinc-100">{summary.totalProcessed}</span>
              </div>
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-2">
                <span className="text-emerald-600 dark:text-emerald-400 block text-[10px] uppercase font-bold">Vinculados</span>
                <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400">{summary.matchedCount}</span>
              </div>
              <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-2">
                <span className="text-blue-600 dark:text-blue-400 block text-[10px] uppercase font-bold">Criados Novos</span>
                <span className="font-bold text-sm text-blue-600 dark:text-blue-400">{summary.createdCount}</span>
              </div>
              <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-2">
                <span className="text-red-600 dark:text-red-400 block text-[10px] uppercase font-bold">Erros</span>
                <span className="font-bold text-sm text-red-600 dark:text-red-400">{summary.errorCount}</span>
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800">
              {summary.results.map((r, i) => (
                <div key={i} className="p-3 text-xs flex items-center justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="font-bold text-zinc-800 dark:text-zinc-200">
                      {r.xmlName} — NF nº {r.invoiceCode}
                    </span>
                    <span className="text-[10px] text-zinc-500">{r.message}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                      {formatCurrency(r.totalValue)}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        r.status === "VINCULADO"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          : r.status === "CRIADO_NOVO"
                          ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                          : "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="primary" onClick={onClose}>
                Concluir
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
