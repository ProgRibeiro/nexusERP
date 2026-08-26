"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency } from "@/lib/utils";
import { parseSingleNfXmlAction, SingleNfParseResult } from "@/app/actions/xmlBatchImportActions";
import { createReceivable, createPayable } from "@/app/actions/financialActions";
import { useAuth } from "@/contexts/AuthContext";
import {
  FileText,
  Upload,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Building,
  DollarSign,
  Calendar,
  FileCheck,
} from "lucide-react";

interface SmartNfReaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: any[];
  onSuccess: () => void;
}

export function SmartNfReaderModal({
  isOpen,
  onClose,
  clients,
  onSuccess,
}: SmartNfReaderModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [parsedData, setParsedData] = useState<SingleNfParseResult | null>(null);
  const [rawXmlContent, setRawXmlContent] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");

  // Editable Form populated by scanner
  const [entryType, setEntryType] = useState<"RECEITA" | "DESPESA">("RECEITA");
  const [clientId, setClientId] = useState<string>("");
  const [providerName, setProviderName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [value, setValue] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [category, setCategory] = useState<string>("RECEITA_SERVICO");

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setLoading(true);
    setParsedData(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      setRawXmlContent(text);
      try {
        const result = await parseSingleNfXmlAction(text);
        setParsedData(result);
        if (result.success) {
          setValue(String(result.vNF || 0));
          setDescription(result.description || `NF nº ${result.nNF}`);
          setDueDate(result.issueDate || new Date().toISOString().slice(0, 10));
          if (result.matchedClientId) {
            setClientId(result.matchedClientId);
          } else if (clients.length > 0) {
            // Find client by CNPJ match
            const match = clients.find((c) => result.clientDoc && c.cpfCnpj?.includes(result.clientDoc));
            if (match) setClientId(match.id);
            else setClientId(clients[0].id);
          }
          setProviderName(result.clientName || "Fornecedor da NF");
          toast(`Nota Fiscal nº ${result.nNF || "lida"} processada com sucesso!`, "success");
        } else {
          toast(result.error || "Não foi possível ler o arquivo XML da NF.", "error");
        }
      } catch (err: any) {
        toast("Erro ao ler arquivo XML.", "error");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
  };

  const handleSaveEntry = async () => {
    if (!parsedData) {
      toast("Por favor, selecione primeiro um arquivo de Nota Fiscal.", "warning");
      return;
    }

    setSaving(true);
    try {
      if (entryType === "RECEITA") {
        if (!clientId) {
          toast("Selecione o cliente da receita.", "warning");
          setSaving(false);
          return;
        }
        const res = await createReceivable(
          {
            clientId,
            totalValue: parseFloat(value) || parsedData.vNF || 0,
            dueDate: new Date(dueDate || Date.now()),
            category: category || "RECEITA_SERVICO",
            costCenter: "GERAL",
            notes: `[ANEXO_XML: NF ${parsedData.nNF || fileName}] - ${description} (Chave: ${parsedData.accessKey || "N/A"})`,
          },
          user?.id || ""
        );

        if (res.success) {
          toast(`Receita referente à NF nº ${parsedData.nNF} lançada com sucesso!`, "success");
          onSuccess();
          onClose();
        } else {
          toast(res.error || "Erro ao criar lançamento.", "error");
        }
      } else {
        if (!providerName) {
          toast("Informe o fornecedor da despesa.", "warning");
          setSaving(false);
          return;
        }
        const res = await createPayable(
          {
            providerName: providerName || parsedData.clientName || "Fornecedor NF",
            description: `[ANEXO_XML: NF ${parsedData.nNF || fileName}] - ${description}`,
            category: "PECA",
            costCenter: "GERAL",
            value: parseFloat(value) || parsedData.vNF || 0,
            dueDate: new Date(dueDate || Date.now()),
          },
          user?.id || ""
        );

        if (res.success) {
          toast(`Despesa referente à NF nº ${parsedData.nNF} lançada com sucesso!`, "success");
          onSuccess();
          onClose();
        } else {
          toast(res.error || "Erro ao criar lançamento.", "error");
        }
      }
    } catch (err: any) {
      toast("Erro de conexão ao salvar lançamento da NF.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="⚡ Leitor Inteligente de Nota Fiscal (XML/NF-e)" size="xl">
      <div className="space-y-5 p-1">
        {/* Upload Zone */}
        <div className="rounded-2xl border-2 border-dashed border-teal-500/40 bg-teal-500/5 p-6 text-center transition-all hover:border-teal-500 hover:bg-teal-500/10">
          <input
            type="file"
            accept=".xml"
            onChange={handleFileUpload}
            className="hidden"
            id="smart-nf-upload-input"
          />
          <label htmlFor="smart-nf-upload-input" className="cursor-pointer flex flex-col items-center gap-2">
            <div className="p-3 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400">
              {loading ? <Loader2 className="h-8 w-8 animate-spin" /> : <Upload className="h-8 w-8" />}
            </div>
            <div>
              <span className="font-bold text-sm text-zinc-800 dark:text-zinc-100 block">
                {fileName ? `Arquivo: ${fileName}` : "Arraste ou selecione a Nota Fiscal (.XML)"}
              </span>
              <span className="text-xs text-zinc-500 block mt-0.5">
                Extração automática de Número, Valor, Cliente/CNPJ, Data e Chave de Acesso.
              </span>
            </div>
          </label>
        </div>

        {/* Parsed Output Card */}
        {parsedData && parsedData.success && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
              <span className="text-xs font-black uppercase text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <Sparkles size={16} /> Dados Extraídos da Nota Fiscal
              </span>
              <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300">
                NF nº {parsedData.nNF || "Sem Número"}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase block">Valor Total</span>
                <span className="font-black text-sm text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(parsedData.vNF)}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase block">Data de Emissão</span>
                <span className="font-semibold text-zinc-700 dark:text-zinc-200">{parsedData.issueDate}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase block">Tomador/Emitente</span>
                <span className="font-semibold text-zinc-700 dark:text-zinc-200 truncate block">
                  {parsedData.clientName || "—"} ({parsedData.clientDoc || "Sem Doc"})
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase block">Vínculo OS</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">
                  {parsedData.matchedOsCode ? `OS #${parsedData.matchedOsCode}` : "Indireto"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Auto-filled Launch Form */}
        {parsedData && parsedData.success && (
          <div className="space-y-4 border-t border-zinc-200 dark:border-zinc-800 pt-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              Confirmar Lançamento Financeiro
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Select
                  label="Tipo de Lançamento"
                  value={entryType}
                  onChange={(e) => setEntryType(e.target.value as any)}
                  options={[
                    { value: "RECEITA", label: "Receita a Receber (Cliente)" },
                    { value: "DESPESA", label: "Despesa a Pagar (Fornecedor)" },
                  ]}
                />
              </div>

              {entryType === "RECEITA" ? (
                <div>
                  <Select
                    label="Cliente do Lançamento"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    options={clients.map((c) => ({
                      value: c.id,
                      label: `${c.name} ${c.cpfCnpj ? `(${c.cpfCnpj})` : ""}`,
                    }))}
                  />
                </div>
              ) : (
                <div>
                  <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 block mb-1">
                    Fornecedor / Credor
                  </label>
                  <Input
                    value={providerName}
                    onChange={(e) => setProviderName(e.target.value)}
                    placeholder="Nome do fornecedor"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 block mb-1">
                  Valor da Parcela (R$)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 block mb-1">
                  Data de Vencimento
                </label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 block mb-1">
                Descrição da Fatura / Observações
              </label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <Button variant="secondary" onClick={onClose}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={handleSaveEntry} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileCheck size={16} className="mr-1" />}
                Confirmar e Lançar com NF
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
