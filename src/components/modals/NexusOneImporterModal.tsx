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
    "CODIGO_PRODUTO",
    "NOME_PRODUTO",
    "CATEGORIA",
    "UNIDADE",
    "PRECO_CUSTO",
    "PRECO_VENDA",
    "MARGEM_LUCRO_PCT",
    "ESTOQUE_ATUAL",
    "ESTOQUE_MINIMO",
    "MARCA_FABRICANTE",
    "CODIGO_BARRAS_EAN",
    "LINK_SITE",
    "FOTO_URL",
    "CLIENTE",
    "CNPJ_CLIENTE",
    "CODIGO_OS",
    "DESCRICAO_SERVICO",
    "STATUS_OS",
    "VALOR_SERVICO",
    "DATA_AGENDAMENTO",
    "TECNICO",
    "STATUS_PAGAMENTO",
    "VALOR_PAGO",
    "OBSERVACOES"
  ];

  const sampleRows = [
    [
      "PECA-001",
      "Lâmpada LED 18W Bivolt 6500K",
      "Elétrica",
      "UN",
      "15,00",
      "35,00",
      "133.33",
      "50",
      "10",
      "Elgin",
      "7891234567890",
      "https://nexusma.com.br/pecas/lampada-led-18w",
      "https://nexusma.com.br/fotos/lampada-led.jpg",
      "Espaço Hering Salvador",
      "12.345.678/0001-90",
      "NX-1001",
      "Substituição de Lâmpadas do Salão de Vendas",
      "CONCLUIDA",
      "640,00",
      "25/08/2026",
      "Carlos Santos",
      "PAGO",
      "640,00",
      "Serviço preventivo mensal efetuado com sucesso."
    ],
    [
      "PECA-002",
      "Disjuntor Bipolar 32A Curva C",
      "Elétrica",
      "UN",
      "42,50",
      "85,00",
      "100.00",
      "20",
      "5",
      "Schneider",
      "7899876543210",
      "https://nexusma.com.br/pecas/disjuntor-32a",
      "https://nexusma.com.br/fotos/disjuntor.jpg",
      "Shopping Barra - Rj",
      "98.765.432/0001-10",
      "NX-1002",
      "Manutenção do Quadro Elétrico Geral QD-01",
      "FATURAMENTO",
      "410,00",
      "26/08/2026",
      "João Silva",
      "ABERTO",
      "0,00",
      "Aguardando emissão da Nota Fiscal."
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
  const [importTab, setImportTab] = useState<"paste" | "link">("paste");
  const [googleUrl, setGoogleUrl] = useState(
    "https://docs.google.com/spreadsheets/d/16HxM9rw8P_xApUgRbv53Mof6USS1VV7Uo8OQ8zgHhJU/edit?gid=1888996763#gid=1888996763"
  );
  const [autoSync, setAutoSync] = useState(true);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NexusOneImportResult | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    getGoogleSheetSyncConfigAction().then((cfg) => {
      if (cfg.url) setGoogleUrl(cfg.url);
      setAutoSync(cfg.autoSync);
      setLastSync(cfg.lastSync);
    });
  }, [isOpen]);

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
      title="Importador NEXUS ONE — Base Central de Serviços"
    >
      <div className="space-y-5 text-xs font-medium">
        
        {/* Banner de Modelo Padrão Completo */}
        <div className="flex items-center justify-between rounded-xl border border-dashed border-emerald-300 bg-emerald-50/70 p-3.5 dark:border-emerald-900/50 dark:bg-emerald-950/30">
          <div className="space-y-0.5">
            <p className="font-extrabold text-xs text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5">
              <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Planilha Modelo Padrão ERP (Completa)
            </p>
            <p className="text-[11px] text-emerald-800 dark:text-emerald-300">
              Preencha com Preços de Custo, Venda, Margem %, Site, Fotos, Estoque, Clientes e OSs.
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
                Importação Automática de Dados Integrados
              </p>
              <p className="mt-1 leading-relaxed text-[11px]">
                Sincroniza automaticamente <strong>Produtos (Custo, Venda, Margem, Estoque), Clientes, Ordens de Serviço (OS), CNAE e Títulos Financeiros</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* Abas de método de importação */}
        <div className="flex border-b border-zinc-200 font-bold dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setImportTab("link")}
            className={`flex items-center gap-1.5 px-4 py-2.5 transition border-b-2 ${
              importTab === "link"
                ? "border-blue-600 text-blue-600 font-black"
                : "border-transparent text-zinc-500 hover:text-zinc-800"
            }`}
          >
            <Link size={15} /> Link Público do Google Sheets
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
            <FileSpreadsheet size={15} /> Copiar e Colar Tabela (TSV)
          </button>
        </div>

        {/* MÉTODOS */}
        {importTab === "link" ? (
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
              placeholder="Cole aqui o conteúdo copiado da planilha (ID, Cliente, Descricao do Servico, Pedido de Compra...)"
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
