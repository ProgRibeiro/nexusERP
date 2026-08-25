"use client";

import React, { useState, useEffect } from "react";
import {
  FileSpreadsheet,
  Link,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Sparkles,
  ArrowRight,
  Database,
  Users,
  FileCheck,
  DollarSign,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import {
  importGoogleSpreadsheetAction,
  parseTsvAndImportNexusOne,
  getGoogleSheetSyncConfigAction,
  saveGoogleSheetSyncConfigAction,
  NexusOneImportResult,
} from "@/app/actions/nexusOneImportActions";

interface NexusOneImporterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function downloadStandardTemplateCSV() {
  const headers = [
    "NOME",
    "PRECO_CUSTO",
    "PRECO_VENDA",
    "ESTOQUE_PRESENTE",
    "ESTOQUE_FUTURO",
    "QUANTIDADE_ESTOQUE",
    "ESTOQUE_MINIMO",
    "UNIDADE",
    "ESTOQUE",
    "CODIGO_PRODUTO",
    "CATEGORIA",
    "MARCA_FABRICANTE",
    "CLIENTE",
    "CNPJ_CLIENTE",
    "CODIGO_OS",
    "DESCRICAO_SERVICO",
    "VALOR_SERVICO",
    "STATUS_PAGAMENTO",
    "OBSERVACOES"
  ];

  const sampleRows = [
    [
      "Ar-condicionado 9.000 BTU/h TCL T-Pro 2.0 Hi-Wall Frio",
      "1775,55",
      "1775,55",
      "0",
      "10",
      "0",
      "2",
      "UN",
      "Estoque futuro",
      "AC-TCL-9K",
      "Refrigeração",
      "TCL",
      "Espaço Hering Salvador",
      "12.345.678/0001-90",
      "NX-1001",
      "Instalação de Ar Condicionado 9K BTU",
      "1775,55",
      "ABERTO",
      "Equipamento a comprar para a obra (Estoque Futuro)."
    ],
    [
      "Ar-condicionado 12.000 BTU/h Elgin Eco III Wi-Fi Hi-Wall Frio",
      "2041,55",
      "2041,55",
      "5",
      "0",
      "5",
      "1",
      "UN",
      "Estoque presente",
      "AC-ELGIN-12K",
      "Refrigeração",
      "Elgin",
      "Shopping Barra Rj",
      "98.765.432/0001-10",
      "NX-1002",
      "Manutenção Preventiva de Climatização",
      "2041,55",
      "PAGO",
      "Disponível no almoxarifado em pronta entrega (Estoque Presente)."
    ],
    [
      "Par de tubos de cobre 1/4 + 3/8 para 9.000 BTU/h (Metro)",
      "55,00",
      "55,00",
      "15",
      "30",
      "15",
      "5",
      "M",
      "Estoque presente e futuro",
      "TUB-COP-9K",
      "Insumos",
      "Eluma",
      "Espaço Hering Salvador",
      "12.345.678/0001-90",
      "NX-1001",
      "Insumos de Tubulação de Cobre",
      "55,00",
      "ABERTO",
      "15m em estoque físico + 30m previstos para cotação futura."
    ]
  ];

  const csvContent =
    "\uFEFF" +
    [headers.join(";"), ...sampleRows.map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(";"))].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "Modelo_Padrao_Importacao_Nexus_ERP.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function NexusOneImporterModal({
  isOpen,
  onClose,
  onSuccess,
}: NexusOneImporterModalProps) {
  const { toast } = useToast();
  const [importTab, setImportTab] = useState<"file" | "paste" | "link">("file");
  const [googleUrl, setGoogleUrl] = useState(
    "https://docs.google.com/spreadsheets/d/16HxM9rw8P_xApUgRbv53Mof6USS1VV7Uo8OQ8zgHhJU/edit?gid=1888996763#gid=1888996763"
  );
  const [autoSync, setAutoSync] = useState(true);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [result, setResult] = useState<NexusOneImportResult | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    getGoogleSheetSyncConfigAction().then((cfg) => {
      if (cfg.url) setGoogleUrl(cfg.url);
      setAutoSync(cfg.autoSync);
      setLastSync(cfg.lastSync);
    });
  }, [isOpen]);

  const handleFileUpload = (file: File) => {
    if (!file) return;
    setLoading(true);
    setResult(null);
    setSelectedFileName(file.name);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text || text.trim().length === 0) {
        toast("O arquivo selecionado está vazio.", "warning");
        setLoading(false);
        return;
      }
      setPastedText(text);
      try {
        const res = await parseTsvAndImportNexusOne(text);
        setResult(res);
        if (res.success) {
          toast(
            `Arquivo "${file.name}" lido com sucesso! ${res.productsCreated + res.productsUpdated} produto(s) e ${res.ordersCreated + res.ordersUpdated} OS sincronizados.`,
            "success"
          );
          if (onSuccess) onSuccess();
        } else {
          toast(`Arquivo "${file.name}" processado com avisos.`, "warning");
        }
      } catch {
        toast(`Erro ao processar o arquivo "${file.name}".`, "error");
      } finally {
        setLoading(false);
      }
    };

    reader.onerror = () => {
      toast(`Erro ao carregar o arquivo "${file.name}".`, "error");
      setLoading(false);
    };

    reader.readAsText(file, "UTF-8");
  };

  const handleSaveConfig = async (newUrl: string, newAuto: boolean) => {
    try {
      await saveGoogleSheetSyncConfigAction(newUrl, newAuto);
      toast(
        newAuto
          ? "Sincronização automática em segundo plano ativada!"
          : "Configuração da planilha salva.",
        "success"
      );
    } catch {
      toast("Erro ao salvar configuração.", "error");
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      if (!navigator.clipboard) {
        toast("Cole os dados na caixa abaixo usando Ctrl+V ou Cmd+V.", "info");
        return;
      }
      const text = await navigator.clipboard.readText();
      if (!text || text.trim().length === 0) {
        toast("A área de transferência está vazia. Copie as linhas da planilha primeiro.", "warning");
        return;
      }
      setPastedText(text);
      setLoading(true);
      setResult(null);
      const res = await parseTsvAndImportNexusOne(text);
      setResult(res);
      if (res.success) {
        toast(
          `Atualizado instantaneamente! ${res.ordersCreated + res.ordersUpdated} OS e ${res.clientsCreated} clientes sincronizados no ERP.`,
          "success"
        );
        if (onSuccess) onSuccess();
      } else {
        toast(`Processado com avisos.`, "warning");
      }
    } catch {
      toast("Para colar automaticamente, permita o acesso ou use o atalho Ctrl+V / Cmd+V.", "info");
    } finally {
      setLoading(false);
    }
  };

  const handleImportByLink = async () => {
    if (!googleUrl.trim()) {
      toast("Informe o link da planilha do Google.", "warning");
      return;
    }

    try {
      setLoading(true);
      setResult(null);
      await saveGoogleSheetSyncConfigAction(googleUrl, autoSync);
      const res = await importGoogleSpreadsheetAction(googleUrl);
      setResult(res);
      if (res.success) {
        toast(
          `Importação concluída com sucesso! ${res.ordersCreated + res.ordersUpdated} OS e ${res.clientsCreated} clientes sincronizados.`,
          "success"
        );
        if (onSuccess) onSuccess();
      } else if (res.errors.length > 0) {
        toast(`Importação concluída com alguns avisos.`, "warning");
      }
    } catch {
      toast("Erro ao conectar à planilha do Google.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleImportByText = async (textToUse?: string) => {
    const raw = textToUse || pastedText;
    if (!raw.trim()) {
      toast("Cole os dados da planilha na caixa de texto.", "warning");
      return;
    }

    try {
      setLoading(true);
      setResult(null);
      const res = await parseTsvAndImportNexusOne(raw);
      setResult(res);
      if (res.success) {
        toast(
          `Importação concluída! ${res.ordersCreated + res.ordersUpdated} OS e ${res.clientsCreated} clientes processados.`,
          "success"
        );
        if (onSuccess) onSuccess();
      } else if (res.errors.length > 0) {
        toast(`Importação concluída com avisos.`, "warning");
      }
    } catch {
      toast("Erro ao processar o texto da planilha.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Importador NEXUS ONE — Base Central de Serviços & Estoque"
    >
      <div className="space-y-5 text-xs font-medium">
        
        {/* Banner de Modelo Padrão Completo */}
        <div className="flex items-center justify-between rounded-xl border border-dashed border-emerald-300 bg-emerald-50/70 p-3.5 dark:border-emerald-900/50 dark:bg-emerald-950/30">
          <div className="space-y-0.5">
            <p className="font-extrabold text-xs text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5">
              <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Planilha Modelo Padrão ERP (Com Colunas ESTOQUE_PRESENTE e ESTOQUE_FUTURO)
            </p>
            <p className="text-[11px] text-emerald-800 dark:text-emerald-300">
              Colunas: <code className="bg-emerald-200/60 font-mono text-[10px] px-1 py-0.5 rounded text-emerald-900">ESTOQUE_PRESENTE</code> (Físico/Pronta entrega) | <code className="bg-emerald-200/60 font-mono text-[10px] px-1 py-0.5 rounded text-emerald-900">ESTOQUE_FUTURO</code> (A Comprar/Obra) | <code className="bg-emerald-200/60 font-mono text-[10px] px-1 py-0.5 rounded text-emerald-900">PRECO_CUSTO</code> | <code className="bg-emerald-200/60 font-mono text-[10px] px-1 py-0.5 rounded text-emerald-900">PRECO_VENDA</code>.
            </p>
          </div>
          <Button
            type="button"
            variant="primary"
            onClick={downloadStandardTemplateCSV}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 shrink-0 shadow-sm"
          >
            <Upload size={14} className="rotate-180 mr-1" /> Baixar Planilha Modelo (.csv)
          </Button>
        </div>

        {/* Banner de Instruções */}
        <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200">
          <div className="flex items-start gap-2.5">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
            <div>
              <p className="font-bold text-xs uppercase tracking-wider">
                Leitura Automática de Arquivos de Planilha
              </p>
              <p className="mt-1 leading-relaxed text-[11px]">
                Selecione ou arraste seu arquivo <strong>.CSV, .TSV ou .TXT</strong>. O ERP lê o arquivo imediatamente e sincroniza <strong>Estoque Presente/Futuro, Preços de Custo e Venda, Clientes e OSs</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* Abas de método de importação */}
        <div className="flex border-b border-zinc-200 font-bold dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setImportTab("file")}
            className={`flex items-center gap-1.5 px-4 py-2.5 transition border-b-2 ${
              importTab === "file"
                ? "border-blue-600 text-blue-600 font-black"
                : "border-transparent text-zinc-500 hover:text-zinc-800"
            }`}
          >
            <Upload size={15} /> 📁 Selecionar Arquivo do Computador
          </button>
          <button
            type="button"
            onClick={() => setImportTab("paste")}
            className={`flex items-center gap-1.5 px-4 py-2.5 transition border-b-2 ${
              importTab === "paste"
                ? "border-blue-600 text-blue-600 font-black"
                : "border-transparent text-zinc-500 hover:text-zinc-800"
            }`}
          >
            <FileSpreadsheet size={15} /> 📋 Copiar e Colar Tabela
          </button>
          <button
            type="button"
            onClick={() => setImportTab("link")}
            className={`flex items-center gap-1.5 px-4 py-2.5 transition border-b-2 ${
              importTab === "link"
                ? "border-blue-600 text-blue-600 font-black"
                : "border-transparent text-zinc-500 hover:text-zinc-800"
            }`}
          >
            <Link size={15} /> 🔗 Link do Google Sheets
          </button>
        </div>

        {/* MÉTODOS */}
        {importTab === "file" ? (
          <div className="space-y-4">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFileUpload(e.dataTransfer.files[0]);
                }
              }}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition ${
                isDragging
                  ? "border-blue-500 bg-blue-50/80 dark:bg-blue-950/40"
                  : "border-zinc-300 bg-zinc-50 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900"
              }`}
            >
              <input
                type="file"
                accept=".csv,.tsv,.txt,.xlsx,.xls"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
                className="hidden"
                id="file-upload-input"
              />
              <label htmlFor="file-upload-input" className="cursor-pointer block space-y-3">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300">
                  <FileSpreadsheet size={32} />
                </div>
                <div>
                  <p className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100">
                    Clique aqui para selecionar seu arquivo ou arraste o arquivo da planilha
                  </p>
                  <p className="text-xs text-zinc-500 mt-1">
                    Suporta arquivos <strong>.CSV, .TSV, .TXT e planilhas Excel</strong>
                  </p>
                </div>
                {selectedFileName && (
                  <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                    <CheckCircle2 size={14} /> Arquivo lido: {selectedFileName}
                  </div>
                )}
                <div className="pt-1">
                  <span className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-blue-700">
                    <Upload size={15} /> Selecionar Arquivo do Computador
                  </span>
                </div>
              </label>
            </div>
          </div>
        ) : importTab === "link" ? (
          <div className="space-y-3">
            <label className="block font-bold text-zinc-900 dark:text-zinc-100">
              URL da Planilha do Google (Google Spreadsheets)
            </label>
            <input
              type="text"
              value={googleUrl}
              onChange={(e) => setGoogleUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/.../edit"
              className="w-full rounded-xl border border-zinc-300 bg-white p-3 font-mono text-xs font-semibold text-zinc-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <p className="text-[11px] text-zinc-500">
              Certifique-se de que a planilha do Google está configurada como <em>&quot;Qualquer pessoa com o link pode ver&quot;</em>.
            </p>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 dark:border-emerald-900/40 dark:bg-emerald-950/20 flex items-center justify-between">
              <div>
                <span className="font-bold text-zinc-900 dark:text-zinc-100 block text-xs">
                  Sincronização Automática em Segundo Plano
                </span>
                <span className="text-[11px] text-zinc-500 block mt-0.5">
                  {lastSync ? `Última atualização: ${new Date(lastSync).toLocaleString("pt-BR")}` : "Sincroniza automaticamente as alterações da planilha no ERP."}
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSync}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setAutoSync(next);
                    void handleSaveConfig(googleUrl, next);
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-zinc-600 peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            <div className="pt-2">
              <Button
                variant="primary"
                onClick={handleImportByLink}
                loading={loading}
                className="w-full bg-blue-600 py-3 font-bold text-white shadow-md hover:bg-blue-700"
              >
                <Upload size={16} className="mr-2" /> Importar Planilha do Google
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <label className="block font-bold text-zinc-900 dark:text-zinc-100">
                Cole abaixo as linhas da tabela (incluindo o cabeçalho)
              </label>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handlePasteFromClipboard}
                className="border-blue-300 bg-blue-50 font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-300 shrink-0"
              >
                📋 Colar e Atualizar Instantaneamente
              </Button>
            </div>
            <textarea
              rows={8}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              onPaste={(e) => {
                const text = e.clipboardData.getData("text");
                if (text && text.trim().length > 0) {
                  setPastedText(text);
                  void handleImportByText(text);
                }
              }}
              placeholder="Cole aqui o conteúdo copiado da planilha (nome, preco custo, preco venda, quantidade estoque, estoque minimo, unidade, Estoque...)"
              className="w-full rounded-xl border border-zinc-300 bg-white p-3 font-mono text-[11px] text-zinc-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />

            <div className="pt-2 flex gap-2">
              <Button
                variant="primary"
                onClick={() => void handleImportByText()}
                loading={loading}
                className="w-full bg-blue-600 py-3 font-bold text-white shadow-md hover:bg-blue-700"
              >
                <Upload size={16} className="mr-2" /> Processar e Importar Dados Colados
              </Button>
            </div>
          </div>
        )}

        {/* PAINEL DE RESULTADOS */}
        {result && (
          <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 space-y-3 dark:border-zinc-800 dark:bg-zinc-900/80">
            <h4 className="font-black text-zinc-900 dark:text-white text-xs uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-500" />
              Resultado da Importação
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <div className="rounded-xl border border-zinc-200 bg-white p-3 text-center dark:border-zinc-700 dark:bg-zinc-800">
                <span className="text-[9px] font-bold text-zinc-500 block uppercase">Linhas</span>
                <span className="text-lg font-black text-zinc-900 dark:text-white">{result.totalRows}</span>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-3 text-center dark:border-zinc-700 dark:bg-zinc-800">
                <span className="text-[9px] font-bold text-zinc-500 block uppercase">Produtos / Peças</span>
                <span className="text-lg font-black text-purple-600 font-mono">{(result.productsCreated || 0) + (result.productsUpdated || 0)}</span>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-3 text-center dark:border-zinc-700 dark:bg-zinc-800">
                <span className="text-[9px] font-bold text-zinc-500 block uppercase">Clientes</span>
                <span className="text-lg font-black text-blue-600 font-mono">{result.clientsCreated}</span>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-3 text-center dark:border-zinc-700 dark:bg-zinc-800">
                <span className="text-[9px] font-bold text-zinc-500 block uppercase">OS Criadas</span>
                <span className="text-lg font-black text-emerald-600 font-mono">{result.ordersCreated + result.ordersUpdated}</span>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-3 text-center dark:border-zinc-700 dark:bg-zinc-800">
                <span className="text-[9px] font-bold text-zinc-500 block uppercase">Financeiro</span>
                <span className="text-lg font-black text-teal-600 font-mono">{result.financesCreated}</span>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200 space-y-1 max-h-36 overflow-y-auto">
                <p className="font-bold">Alertas ({result.errors.length}):</p>
                {result.errors.map((err, i) => (
                  <p key={i}>• {err}</p>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-zinc-200 dark:border-zinc-800">
          <Button variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
