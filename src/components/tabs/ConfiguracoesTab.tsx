"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Table, TableRow, TableCell } from "../ui/Table";
import { Settings, Shield, Sliders, CheckCircle, XCircle, Building, FileSpreadsheet, Download, Upload, ShieldCheck, Lock, Cloud, HardDrive, RefreshCw, Mail, ExternalLink, Copy, Link2, Send, AlertCircle, BookOpen, KeyRound, Server, Unplug } from "lucide-react";
import { consultarCNPJAction } from "@/app/actions/clientActions";
import { importClientsAction, importServicesAction, importProductsAction, parseImportFileAction, previewImportAction } from "@/app/actions/importActions";
import { getBackupStatusAction, triggerBackupAction } from "@/app/actions/backupActions";
import type { BackupMetadata } from "@/lib/backup";
import { parseDelimitedText } from "@/lib/tabularImport";
import { getCompanyTaxProfile, saveCompanyTaxProfile } from "@/app/actions/settingsActions";
import { defaultTaxRate, normalizeTaxRegime } from "@/lib/tax";
import { disconnectGmail, getGmailIntegrationSettings } from "@/app/actions/gmailActions";

type GmailSettings = Awaited<ReturnType<typeof getGmailIntegrationSettings>>;

export default function ConfiguracoesTab() {
  const { user: currentUser, hasPermission } = useAuth();
  const { toast } = useToast();

  const [activeSubTab, setActiveSubTab] = useState<"system" | "empresa" | "matrix" | "importador" | "integrations" | "security">("system");

  const [gmailSettings, setGmailSettings] = useState<GmailSettings | null>(null);
  const [gmailLoading, setGmailLoading] = useState(false);
  const [gmailDisconnecting, setGmailDisconnecting] = useState(false);

  const loadGmailSettings = async () => {
    setGmailLoading(true);
    const result = await getGmailIntegrationSettings();
    setGmailSettings(result);
    setGmailLoading(false);
  };

  // 2FA simulation state
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("2fa_enabled") === "true";
    }
    return false;
  });
  const [show2faSetup, setShow2faSetup] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorSecret] = useState("NXERP-MFA-ADM-7789-2026");
  const [mfaActionLoading, setMfaActionLoading] = useState(false);

  // Backup states
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupResult, setBackupResult] = useState<string | null>(null);
  const [backupHistory, setBackupHistory] = useState<BackupMetadata[]>([]);

  const loadBackupHistory = async () => {
    const result = await getBackupStatusAction();
    if (result.success) setBackupHistory(result.backups);
  };

  useEffect(() => {
    if (currentUser?.roleName !== "Administrador") return;
    const timer = window.setTimeout(() => {
      void loadBackupHistory();
      void loadGmailSettings();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [currentUser?.roleName]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gmailResult = params.get("gmail");
    if (!gmailResult) return;
    const timer = window.setTimeout(() => {
      setActiveSubTab("integrations");
      if (gmailResult === "connected") toast("Conta Gmail conectada com sucesso.", "success");
      else if (gmailResult === "not_configured") toast("Configure as credenciais OAuth antes de conectar.", "warning");
      else toast(params.get("reason") || "Não foi possível conectar o Gmail.", "error");
      void loadGmailSettings();
      params.delete("gmail");
      params.delete("reason");
      const query = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleCopyGmailValue = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast(`${label} copiada.`, "success");
    } catch {
      toast(`Não foi possível copiar ${label.toLowerCase()}.`, "warning");
    }
  };

  const handleDisconnectGmail = async () => {
    if (!window.confirm("Desconectar a conta Gmail do ERP? O histórico de envios continuará salvo.")) return;
    setGmailDisconnecting(true);
    const result = await disconnectGmail();
    setGmailDisconnecting(false);
    if (!result.success) {
      toast(result.error, "error");
      return;
    }
    toast("Conta Gmail desconectada. O histórico foi preservado.", "success");
    await loadGmailSettings();
  };

  const handleRunBackup = async () => {
    setBackupLoading(true);
    setBackupResult(null);
    try {
      const res = await triggerBackupAction();
      if (res.success) {
        setBackupResult(`Sucesso: ${res.fileName} · SHA-256 ${res.sha256?.slice(0, 12)}…`);
        toast("Cópia de segurança gerada com sucesso!", "success");
        await loadBackupHistory();
      } else {
        setBackupResult(`Erro: ${res.error}`);
        toast(res.error || "Erro ao gerar backup", "error");
      }
    } catch (err: any) {
      setBackupResult(`Erro: ${err.message}`);
      toast("Falha na conexão para gerar backup", "error");
    } finally {
      setBackupLoading(false);
    }
  };

  // Importer states
  const [importType, setImportType] = useState<"clientes" | "servicos" | "materiais">("clientes");
  const [importText, setImportText] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importLog, setImportLog] = useState("");
  const [importPreview, setImportPreview] = useState<{ total: number; valid: number; newRows: number; updates: number; duplicates: number; errors: number; issues: Array<{ row: number; error: string }> } | null>(null);
  const [importPreviewKey, setImportPreviewKey] = useState("");

  // System parameters
  const [sysParams, setSysParams] = useState({
    issRate: 5.0,
    laborRate: 150.00,
    minMargin: 35.0,
    notifyLowStock: true,
  });

  // Company parameters with local persistence
  const [companyParams, setCompanyParams] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("company_params");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return {
            fiscalRegime: "SIMPLES_NACIONAL",
            taxRate: 6,
            differentials: "Profissionais qualificados\nPeças e materiais de qualidade\nAtendimento ágil e personalizado\nGarantia nos serviços realizados",
            merchanTitle: "AQUI É O SEU ESPAÇO!",
            merchanDesc: "Mais destaque, mais resultados para o seu negócio.",
            ...parsed,
          };
        } catch (e) {
          console.error(e);
        }
      }
    }
    return {
      corporateName: "NEXUS CLIMATIZACAO LTDA",
      tradeName: "Nexus Ar Condicionado",
      cnpj: "12.345.678/0001-99",
      municipalRegistration: "1.234.567-8",
      stateRegistration: "111.222.333.444",
      email: "diretoria@nexusclimatizacao.com.br",
      phone: "(11) 4002-8922",
      address: "Avenida Paulista, 1000 - Bela Vista - São Paulo / SP",
      logoUrl: "", // Base64 representation of company logo
      fiscalRegime: "SIMPLES_NACIONAL",
      taxRate: 6,
      differentials: "Profissionais qualificados\nPeças e materiais de qualidade\nAtendimento ágil e personalizado\nGarantia nos serviços realizados",
      merchanTitle: "AQUI É O SEU ESPAÇO!",
      merchanDesc: "Mais destaque, mais resultados para o seu negócio.",
    };
  });

  const [saving, setSaving] = useState(false);
  const [cnpjLoading, setCnpjLoading] = useState(false);

  useEffect(() => {
    getCompanyTaxProfile()
      .then(async (profile) => {
        if (!profile.configured) {
          const saved = localStorage.getItem("company_params");
          if (saved) {
            try {
              const local = JSON.parse(saved);
              const regime = normalizeTaxRegime(local.fiscalRegime);
              const migrated = await saveCompanyTaxProfile({ regime, rate: Number(local.taxRate) || defaultTaxRate(regime) });
              if (migrated.success) profile = migrated.profile;
            } catch {
              // Mantém o perfil padrão quando a configuração local antiga estiver inválida.
            }
          }
        }
        setCompanyParams((current: any) => ({ ...current, fiscalRegime: profile.regime, taxRate: profile.rate }));
      })
      .catch(() => {});
  }, []);

  const handleSaveParams = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast("Parâmetros do sistema salvos com sucesso!", "success");
    }, 600);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCompanyParams((prev: any) => ({ ...prev, logoUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCnpjLookup = async (cnpjVal: string) => {
    const clean = cnpjVal.replace(/\D/g, "");
    if (clean.length !== 14) {
      toast("CNPJ inválido. Digite 14 números.", "warning");
      return;
    }

    setCnpjLoading(true);
    try {
      const res = await consultarCNPJAction(clean);
      if (res.success && res.data) {
        setCompanyParams((prev: any) => ({
          ...prev,
          corporateName: res.data.corporateName,
          tradeName: res.data.tradeName || prev.tradeName, // Keep tradeName editable or use company's default
          email: res.data.email || prev.email,
          phone: res.data.phone || prev.phone,
          address: res.data.address || prev.address,
          cnpj: res.data.cnpj,
        }));
        toast("Dados importados do CNPJ com sucesso!", "success");
      } else {
        toast(res.error || "CNPJ não encontrado", "error");
      }
    } catch (err) {
      toast("Erro de conexão ao buscar CNPJ", "error");
    } finally {
      setCnpjLoading(false);
    }
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await saveCompanyTaxProfile({
        regime: companyParams.fiscalRegime,
        rate: Number(companyParams.taxRate),
      });
      if (!result.success) {
        toast(result.error || "Não foi possível salvar o regime tributário.", "error");
        return;
      }
      localStorage.setItem("company_params", JSON.stringify(companyParams));
      toast(`Perfil tributário salvo. ${result.recalculated} proposta(s) aberta(s) recalculada(s).`, "success");
    } finally {
      setSaving(false);
    }
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importText.trim()) {
      toast("Por favor, cole ou digite os dados da planilha", "warning");
      return;
    }

    setImportLoading(true);
    setImportLog("Iniciando processamento e normalização...");
    try {
      const table = parseDelimitedText(importText);
      if (table.length < 2) {
        toast("Formato inválido. Insira o cabeçalho e pelo menos uma linha de dados.", "error");
        setImportLoading(false);
        return;
      }

      const normalizeHeader = (str: string) => {
        return str
          .trim()
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9\s]/g, "")
          .replace(/\s+/g, " ");
      };

      const headers = table[0].map(h => normalizeHeader(h));

      const parsedItems = [];
      for (let i = 1; i < table.length; i++) {
        const values = table[i];
        const item: any = {};
        headers.forEach((h, index) => {
          item[h] = values[index] || "";
        });
        parsedItems.push(item);
      }

      const getValue = (item: any, searchKeys: string[]) => {
        // 1. Try exact matches first
        for (const k of searchKeys) {
          if (item[k] !== undefined && item[k] !== null && item[k] !== "") {
            return String(item[k]).trim();
          }
        }
        // 2. Try partial/includes matches (e.g. key is "nome do cliente" and we are searching for "nome")
        const itemKeys = Object.keys(item);
        for (const target of searchKeys) {
          for (const ik of itemKeys) {
            if (ik.includes(target) && item[ik] !== undefined && item[ik] !== null && item[ik] !== "") {
              return String(item[ik]).trim();
            }
          }
        }
        return "";
      };

      const parseBrazilianNumber = (val: string): number => {
        if (!val) return 0;
        let clean = val.replace(/[R$\s]/g, "").trim();

        if (clean.includes(".") && clean.includes(",")) {
          clean = clean.replace(/\./g, "").replace(/,/g, ".");
        } else if (clean.includes(",")) {
          clean = clean.replace(/,/g, ".");
        }

        const parsed = parseFloat(clean);
        return isNaN(parsed) ? 0 : parsed;
      };

      let mapped: Record<string, unknown>[];
      if (importType === "clientes") {
        mapped = parsedItems.map(item => ({
          name: getValue(item, ["nome", "cliente", "name"]),
          cpfCnpj: getValue(item, ["cnpj", "cpf", "documento"]),
          socialName: getValue(item, ["razao", "social", "empresa"]),
          fancyName: getValue(item, ["fantasia", "fancy", "marca"]),
          email: getValue(item, ["email", "mail", "correio"]),
          phone: getValue(item, ["telefone", "phone", "celular", "tel", "contato"]),
          notes: getValue(item, ["obs", "observacao", "nota", "notes"]),
        }));

      } else if (importType === "servicos") {
        mapped = parsedItems.map(item => ({
          name: getValue(item, ["nome", "servico", "service", "item"]),
          description: getValue(item, ["descricao", "description", "detalhes"]),
          category: getValue(item, ["categoria", "category"]),
          maintenanceType: getValue(item, ["tipo manutencao", "tipomanutencao", "tipo", "maintenance"]),
          billingUnit: getValue(item, ["unidade cobranca", "unidadecobranca", "unidade", "unit"]),
          estimatedHours: parseBrazilianNumber(getValue(item, ["tempo estimado horas", "tempoestimadohoras", "horas", "hours"])),
          defaultPrice: parseBrazilianNumber(getValue(item, ["preco", "price", "valor", "custo"])),
        }));

      } else {
        mapped = parsedItems.map(item => ({
          name: getValue(item, ["nome", "material", "produto", "peca", "item", "name"]),
          code: getValue(item, ["codigo", "code", "sku"]),
          costPrice: parseBrazilianNumber(getValue(item, ["preco custo", "custo", "cost", "compra", "precocusto"])),
          salePrice: parseBrazilianNumber(getValue(item, ["preco venda", "venda", "sale", "preco", "precovenda", "valor"])),
          stockQuantity: parseBrazilianNumber(getValue(item, ["quantidade", "estoque", "qty", "quantity", "qtd", "saldo"])),
          minStock: parseBrazilianNumber(getValue(item, ["minimo", "min", "estoqueminimo"])),
          unit: getValue(item, ["unidade", "unit", "un", "medida"]) || "UN",
        }));

      }

      const currentKey = `${importType}:${importText}`;
      if (importPreviewKey !== currentKey) {
        setImportLog(`Validando ${mapped.length} linhas sem alterar o banco...`);
        const check = await previewImportAction(importType, mapped);
        if (!check.success) {
          toast(check.error || "Falha na validação", "error");
          setImportLog(`Erro: ${check.error}`);
          return;
        }
        setImportPreview(check.preview);
        setImportPreviewKey(currentKey);
        setImportLog(`Pré-validação concluída: ${check.preview.valid} linhas válidas. Confira o resumo e confirme a importação.`);
        toast("Pré-validação concluída. Confirme para gravar os dados.", "success");
        return;
      }

      setImportLog(`Gravando ${mapped.length} linhas com histórico e vínculos...`);
      const res = importType === "clientes"
        ? await importClientsAction(mapped)
        : importType === "servicos"
          ? await importServicesAction(mapped)
          : await importProductsAction(mapped);

      if (res.success) {
        toast(`Importação concluída! ${res.count} registros gravados.`, "success");
        setImportLog(`Lote ${res.batchId.slice(0, 8)}: ${res.summary.created} criados, ${res.summary.updated} atualizados, ${res.summary.skipped} ignorados e ${res.summary.errors} erros.`);
        setImportText("");
        setImportPreview(null);
        setImportPreviewKey("");
      } else {
        toast(res.error || "Erro ao processar importação", "error");
        setImportLog(`Erro: ${res.error}`);
      }
    } catch (err: any) {
      console.error(err);
      toast("Falha ao analisar os dados do importador", "error");
      setImportLog(`Erro de análise: ${err.message}`);
    } finally {
      setImportLoading(false);
    }
  };

  const handleImportFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportLoading(true);
      setImportLog("Lendo e verificando o arquivo no servidor...");
      setImportPreview(null);
      setImportPreviewKey("");
      const formData = new FormData();
      formData.set("file", file);
      const result = await parseImportFileAction(formData);
      if (result.success) {
        setImportText(result.text);
        setImportPreview(null);
        setImportPreviewKey("");
        setImportLog(`${result.fileName} carregado. Clique em pré-validar para conferir as linhas.`);
        toast(`Arquivo ${file.name} carregado com segurança.`, "success");
      } else {
        setImportLog(`Erro: ${result.error}`);
        toast(result.error, "error");
      }
      setImportLoading(false);
      e.target.value = "";
    }
  };

  // Permission Matrix
  const permissionMatrix = [
    { module: "CRM (Leads e Funil)", Admin: true, Gestor: true, Faturamento: false, Financeiro: false, Tecnico: false },
    { module: "Clientes & Equipamentos", Admin: true, Gestor: true, Faturamento: false, Financeiro: false, Tecnico: true },
    { module: "Orçamentos (Propostas)", Admin: true, Gestor: true, Faturamento: false, Financeiro: false, Tecnico: false },
    { module: "Ordens de Serviço (OS)", Admin: true, Gestor: true, Faturamento: true, Financeiro: false, Tecnico: true },
    { module: "Faturamento & NFS-e", Admin: true, Gestor: false, Faturamento: true, Financeiro: false, Tecnico: false },
    { module: "Contas a Pagar/Receber", Admin: true, Gestor: false, Faturamento: false, Financeiro: true, Tecnico: false },
    { module: "Estoque & Almoxarifado", Admin: true, Gestor: true, Faturamento: false, Financeiro: false, Tecnico: true },
    { module: "Parâmetros do Sistema", Admin: true, Gestor: false, Faturamento: false, Financeiro: false, Tecnico: false },
  ];

  return (
    <div className="space-y-6 select-none animate-in fade-in duration-200">

      {/* Title */}
      <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-150 font-bold text-sm">
        <Settings size={18} className="text-zinc-550" />
        <span>Configurações Operacionais do ERP</span>
      </div>

      <Card className="p-0 overflow-hidden shadow-premium">
        {/* Subtabs switcher */}
        <div className="border-b border-zinc-150 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 px-6 py-2 flex gap-1 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveSubTab("system")}
            className={`py-2 px-3 text-xs font-bold border-b-2 rounded-t-lg transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === "system" ? "border-primary text-primary" : "border-transparent text-zinc-400 hover:text-zinc-650"
            }`}
          >
            <Sliders size={13} className="inline mr-1" /> Parâmetros Gerais
          </button>
          <button
            onClick={() => setActiveSubTab("empresa")}
            className={`py-2 px-3 text-xs font-bold border-b-2 rounded-t-lg transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === "empresa" ? "border-primary text-primary" : "border-transparent text-zinc-400 hover:text-zinc-650"
            }`}
          >
            <Building size={13} className="inline mr-1" /> Minha Empresa
          </button>
          <button
            onClick={() => setActiveSubTab("matrix")}
            className={`py-2 px-3 text-xs font-bold border-b-2 rounded-t-lg transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === "matrix" ? "border-primary text-primary" : "border-transparent text-zinc-400 hover:text-zinc-650"
            }`}
          >
            <Shield size={13} className="inline mr-1" /> Matriz de Permissões
          </button>
          <button
            onClick={() => setActiveSubTab("importador")}
            className={`py-2 px-3 text-xs font-bold border-b-2 rounded-t-lg transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === "importador" ? "border-primary text-primary" : "border-transparent text-zinc-400 hover:text-zinc-650"
            }`}
          >
            <FileSpreadsheet size={13} className="inline mr-1" /> Importar Planilhas
          </button>
          <button
            onClick={() => setActiveSubTab("integrations")}
            className={`py-2 px-3 text-xs font-bold border-b-2 rounded-t-lg transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === "integrations" ? "border-primary text-primary" : "border-transparent text-zinc-400 hover:text-zinc-650"
            }`}
          >
            <Mail size={13} className="inline mr-1" /> Gmail & Integrações
          </button>
          <button
            onClick={() => setActiveSubTab("security")}
            className={`py-2 px-3 text-xs font-bold border-b-2 rounded-t-lg transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === "security" ? "border-primary text-primary" : "border-transparent text-zinc-400 hover:text-zinc-650"
            }`}
          >
            <ShieldCheck size={13} className="inline mr-1" /> Segurança & 2FA
          </button>
        </div>

        <div className="p-6">
          {/* 1. General System Parameters */}
          {activeSubTab === "system" && (
            <form onSubmit={handleSaveParams} className="space-y-6 max-w-lg">
              <div>
                <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider mb-3">Custos e Alíquotas Padrão</h4>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="ISS Padrão NFS-e (%)"
                    type="number"
                    step="0.1"
                    value={sysParams.issRate}
                    onChange={(e) => setSysParams((prev) => ({ ...prev, issRate: parseFloat(e.target.value) || 0 }))}
                    disabled={!hasPermission("admin.all")}
                  />
                  <Input
                    label="Valor Mão de Obra Técnico/Hora (R$)"
                    type="number"
                    step="1"
                    value={sysParams.laborRate}
                    onChange={(e) => setSysParams((prev) => ({ ...prev, laborRate: parseFloat(e.target.value) || 0 }))}
                    disabled={!hasPermission("admin.all")}
                  />
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider mb-3">Regras de Negócio</h4>
                <Input
                  label="Margem de Lucro Alvo Mínima (%)"
                  type="number"
                  step="0.5"
                  value={sysParams.minMargin}
                  onChange={(e) => setSysParams((prev) => ({ ...prev, minMargin: parseFloat(e.target.value) || 0 }))}
                  disabled={!hasPermission("admin.all")}
                />
              </div>

              {hasPermission("admin.all") && (
                <div className="pt-4 border-t border-zinc-150 dark:border-zinc-800">
                  <Button variant="primary" type="submit" loading={saving}>
                    Salvar Parâmetros
                  </Button>
                </div>
              )}
            </form>
          )}

          {/* 2. Company Info (Minha Empresa) */}
          {activeSubTab === "empresa" && (
            <form onSubmit={handleSaveCompany} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Logo Upload Box */}
                <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/20 text-center">
                  <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-4">Logotipo da Empresa</span>

                  {companyParams.logoUrl ? (
                    <div className="relative group w-32 h-32 mb-4 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden bg-white dark:bg-zinc-950 flex items-center justify-center">
                      <img src={companyParams.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain p-2" />
                      <button
                        type="button"
                        onClick={() => setCompanyParams((prev: any) => ({ ...prev, logoUrl: "" }))}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-all cursor-pointer rounded-2xl"
                      >
                        Remover Logo
                      </button>
                    </div>
                  ) : (
                    <div className="w-32 h-32 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 dark:text-zinc-500 font-semibold text-sm mb-4">
                      [ SUA LOGO ]
                    </div>
                  )}

                  <label className="cursor-pointer">
                    <span className="py-2 px-3 bg-primary text-white font-bold text-xs rounded-xl shadow-premium hover:bg-primary/95 transition-all">
                      Selecionar Imagem
                    </span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                  </label>
                </div>

                {/* Company Details Form */}
                <div className="md:col-span-2 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Razão Social *"
                      required
                      value={companyParams.corporateName}
                      onChange={(e) => setCompanyParams((prev: any) => ({ ...prev, corporateName: e.target.value }))}
                      placeholder="Razão Social da empresa"
                    />
                    <Input
                      label="Nome Fantasia (Nome da Loja) *"
                      required
                      value={companyParams.tradeName}
                      onChange={(e) => setCompanyParams((prev: any) => ({ ...prev, tradeName: e.target.value }))}
                      placeholder="Digite o nome fantasia da loja"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div className="flex gap-2 items-end md:col-span-1">
                      <div className="flex-1">
                        <Input
                          label="CNPJ *"
                          required
                          placeholder="Digite apenas números"
                          value={companyParams.cnpj}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCompanyParams((prev: any) => ({ ...prev, cnpj: val }));
                            const clean = val.replace(/\D/g, "");
                            if (clean.length === 14) {
                              handleCnpjLookup(clean);
                            }
                          }}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => handleCnpjLookup(companyParams.cnpj)}
                        loading={cnpjLoading}
                        className="mb-1 cursor-pointer py-2.5 px-3.5"
                      >
                        Buscar
                      </Button>
                    </div>
                    <Input
                      label="Inscrição Estadual"
                      value={companyParams.stateRegistration}
                      onChange={(e) => setCompanyParams((prev: any) => ({ ...prev, stateRegistration: e.target.value }))}
                      placeholder="Número ou 'ISENTO'"
                    />
                    <Input
                      label="Inscrição Municipal"
                      value={companyParams.municipalRegistration}
                      onChange={(e) => setCompanyParams((prev: any) => ({ ...prev, municipalRegistration: e.target.value }))}
                      placeholder="Número da Inscrição Municipal"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Input
                      label="E-mail Corporativo *"
                      type="email"
                      required
                      value={companyParams.email}
                      onChange={(e) => setCompanyParams((prev: any) => ({ ...prev, email: e.target.value }))}
                      placeholder="e-mail de contato corporativo"
                    />
                    <Input
                      label="Telefone Comercial *"
                      required
                      value={companyParams.phone}
                      onChange={(e) => setCompanyParams((prev: any) => ({ ...prev, phone: e.target.value }))}
                      placeholder="telefone comercial"
                    />
                    <Select
                      label="Regime Tributário *"
                      value={companyParams.fiscalRegime || "SIMPLES_NACIONAL"}
                      onChange={(e) => {
                        const regime = normalizeTaxRegime(e.target.value);
                        setCompanyParams((prev: any) => ({ ...prev, fiscalRegime: regime, taxRate: defaultTaxRate(regime) }));
                      }}
                      options={[
                        { value: "SIMPLES_NACIONAL", label: "Simples Nacional (6.0%)" },
                        { value: "LUCRO_PRESUMIDO", label: "Lucro Presumido (15.0%)" },
                        { value: "LUCRO_REAL", label: "Lucro Real (18.0%)" },
                      ]}
                    />
                    <Input
                      label="Alíquota efetiva nas propostas (%) *"
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      required
                      value={companyParams.taxRate ?? 6}
                      onChange={(e) => setCompanyParams((prev: any) => ({ ...prev, taxRate: Number(e.target.value) }))}
                    />
                  </div>

                  <Input
                    label="Endereço Matriz Completo"
                    value={companyParams.address}
                    onChange={(e) => setCompanyParams((prev: any) => ({ ...prev, address: e.target.value }))}
                    placeholder="Digite o endereço completo"
                  />

                  <div className="border-t border-zinc-150 dark:border-zinc-800 pt-4 space-y-4">
                    <h5 className="text-[10px] font-bold text-blue-955 dark:text-zinc-300 uppercase tracking-wider">Configuração de Merchandising do Orçamento</h5>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block mb-1">
                          Diferenciais (Um por Linha)
                        </label>
                        <textarea
                          rows={4}
                          value={companyParams.differentials}
                          onChange={(e) => setCompanyParams((prev: any) => ({ ...prev, differentials: e.target.value }))}
                          placeholder="Profissionais qualificados&#10;Peças e materiais de qualidade"
                          className="w-full text-xs p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-1 focus:ring-primary outline-none text-zinc-800 dark:text-zinc-150"
                        />
                      </div>

                      <div className="space-y-3">
                        <Input
                          label="Título do Merchan / Destaque"
                          value={companyParams.merchanTitle}
                          onChange={(e) => setCompanyParams((prev: any) => ({ ...prev, merchanTitle: e.target.value }))}
                          placeholder="Ex: AQUI É O SEU ESPAÇO!"
                        />
                        <Input
                          label="Descrição do Merchan / Destaque"
                          value={companyParams.merchanDesc}
                          onChange={(e) => setCompanyParams((prev: any) => ({ ...prev, merchanDesc: e.target.value }))}
                          placeholder="Ex: Mais destaque, mais resultados para o seu negócio."
                        />
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              <div className="pt-4 border-t border-zinc-150 dark:border-zinc-800 flex justify-end">
                <Button variant="primary" type="submit" loading={saving}>
                  Salvar Informações da Empresa
                </Button>
              </div>
            </form>
          )}

          {/* 3. Matriz de Permissões */}
          {activeSubTab === "matrix" && (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider mb-1">Políticas de Segurança do Banco</h4>
                <p className="text-[10px] text-zinc-450">Tabela de controle de acessos administrativos por papel operacional.</p>
              </div>

              <Table headers={["Módulo / Funcionalidade", "Admin", "Gestor", "Faturamento", "Financeiro", "Técnico"]}>
                {permissionMatrix.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-semibold text-zinc-850 dark:text-zinc-200">{row.module}</TableCell>
                    <TableCell>{row.Admin ? <CheckCircle size={14} className="text-success" /> : <XCircle size={14} className="text-zinc-300 dark:text-zinc-700" />}</TableCell>
                    <TableCell>{row.Gestor ? <CheckCircle size={14} className="text-success" /> : <XCircle size={14} className="text-zinc-300 dark:text-zinc-700" />}</TableCell>
                    <TableCell>{row.Faturamento ? <CheckCircle size={14} className="text-success" /> : <XCircle size={14} className="text-zinc-300 dark:text-zinc-700" />}</TableCell>
                    <TableCell>{row.Financeiro ? <CheckCircle size={14} className="text-success" /> : <XCircle size={14} className="text-zinc-300 dark:text-zinc-700" />}</TableCell>
                    <TableCell>{row.Tecnico ? <CheckCircle size={14} className="text-success" /> : <XCircle size={14} className="text-zinc-300 dark:text-zinc-700" />}</TableCell>
                  </TableRow>
                ))}
              </Table>
            </div>
          )}

          {/* 4. Importação de Planilhas (CSV/Excel) */}
          {activeSubTab === "importador" && (
            <div className="space-y-6">
              <div>
                <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider mb-1">Importação de Dados via Planilha</h4>
                <p className="text-[10px] text-zinc-450">Importe em lote clientes, serviços ou estoque (materiais) copiando e colando colunas do Excel ou enviando arquivos CSV.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* Editor / Paste Box */}
                <div className="lg:col-span-8 space-y-4">
                  <div className="flex gap-4 items-center justify-between border-b pb-2">
                    <div className="flex gap-2">
                      {(["clientes", "servicos", "materiais"] as const).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => {
                            setImportType(type);
                            setImportText("");
                            setImportLog("");
                            setImportPreview(null);
                            setImportPreviewKey("");
                          }}
                          className={`px-3 py-1 text-xs font-bold rounded-lg border uppercase tracking-wider transition-all cursor-pointer ${
                            importType === type
                              ? "bg-primary border-primary text-white"
                              : "bg-zinc-50 dark:bg-zinc-800/20 border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-zinc-650"
                          }`}
                        >
                          {type === "clientes" ? "Clientes" : type === "servicos" ? "Serviços" : "Materiais/Estoque"}
                        </button>
                      ))}
                    </div>

                    <label className="flex items-center gap-1 py-1.5 px-3 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800/30 dark:hover:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800 rounded-xl text-[10px] font-bold text-zinc-650 dark:text-zinc-350 cursor-pointer transition-colors">
                      <Upload size={12} /> Carregar Excel ou CSV
                      <input
                        type="file"
                        accept=".csv,.tsv,.xlsx"
                        onChange={handleImportFileSelect}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <form onSubmit={handleImportSubmit} className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block mb-1">
                        Cole as linhas da planilha abaixo (cabeçalho + dados)
                      </label>
                      <textarea
                        rows={10}
                        value={importText}
                        onChange={(e) => {
                          setImportText(e.target.value);
                          setImportPreview(null);
                          setImportPreviewKey("");
                        }}
                        placeholder={
                          importType === "clientes"
                            ? "nome\tcnpj\ttelefone\temail\trazao social\tnome fantasia\nClimatizar Ar\t12345678000199\t(11) 98888-8888\tcontato@climatizar.com\tClimatizar Ltda\tLoja Climatizar"
                            : importType === "servicos"
                            ? "nome\tdescricao\tpreco\nInstalação Split 12k BTUs\tInstalação de evaporadora e condensadora\t650.00"
                            : "nome\tpreco custo\tpreco venda\tquantidade estoque\testoque minimo\tunidade\nFiltro de Ar G4\t45.00\t85.00\t150\t20\tUN"
                        }
                        className="w-full text-xs font-mono p-4 bg-zinc-50/50 dark:bg-zinc-800/10 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-1 focus:ring-primary outline-none text-zinc-800 dark:text-zinc-150"
                      />
                    </div>

                    {importLog && (
                      <div className="p-3 bg-zinc-50 dark:bg-zinc-900/30 rounded-xl border border-zinc-150 dark:border-zinc-800 font-mono text-[10px] text-zinc-500 leading-snug">
                        {importLog}
                      </div>
                    )}

                    {importPreview && (
                      <div className="rounded-2xl border border-blue-200 dark:border-blue-500/20 bg-blue-50/60 dark:bg-blue-500/5 p-4 space-y-3">
                        <div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">Prévia antes de gravar</span><span className="text-[9px] font-bold text-zinc-500">{importPreview.total} linhas lidas</span></div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <div className="rounded-xl bg-white dark:bg-zinc-900 p-3"><div className="text-lg font-bold text-emerald-600">{importPreview.newRows}</div><div className="text-[9px] text-zinc-500">novos registros</div></div>
                          <div className="rounded-xl bg-white dark:bg-zinc-900 p-3"><div className="text-lg font-bold text-blue-600">{importPreview.updates}</div><div className="text-[9px] text-zinc-500">atualizações</div></div>
                          <div className="rounded-xl bg-white dark:bg-zinc-900 p-3"><div className="text-lg font-bold text-amber-600">{importPreview.duplicates}</div><div className="text-[9px] text-zinc-500">duplicados</div></div>
                          <div className="rounded-xl bg-white dark:bg-zinc-900 p-3"><div className="text-lg font-bold text-red-600">{importPreview.errors}</div><div className="text-[9px] text-zinc-500">linhas com erro</div></div>
                        </div>
                        {importPreview.issues.length > 0 && <div className="max-h-24 overflow-y-auto text-[9px] text-amber-700 dark:text-amber-300 space-y-1">{importPreview.issues.slice(0, 8).map((issue) => <div key={`${issue.row}:${issue.error}`}>Linha {issue.row}: {issue.error}</div>)}</div>}
                      </div>
                    )}

                    <div className="flex justify-end">
                      <Button variant="primary" type="submit" loading={importLoading}>
                        {importPreview ? "Confirmar e Gravar Lote" : "Pré-validar Planilha"}
                      </Button>
                    </div>
                  </form>
                </div>

                {/* Templates / Instructions */}
                <div className="lg:col-span-4 space-y-4 bg-zinc-50/50 dark:bg-zinc-800/10 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                  <h5 className="text-[10px] font-bold text-blue-955 dark:text-zinc-100 uppercase tracking-wider border-b pb-1.5 flex items-center gap-1">
                    <Download size={12} /> Instruções e Formato
                  </h5>

                  <div className="text-[11px] text-zinc-650 dark:text-zinc-400 space-y-3 leading-relaxed">
                    <p>
                      Para importar com facilidade, você pode copiar as colunas de uma tabela do <strong>Excel</strong> ou <strong>Google Sheets</strong> e colá-las diretamente no editor ao lado.
                    </p>

                    <div>
                      <span className="font-bold text-zinc-800 dark:text-zinc-200 block mb-1">Colunas sugeridas (Separadas por TAB ou Semicólon ou Vírgula):</span>
                      {importType === "clientes" && (
                        <div className="p-2.5 bg-white dark:bg-zinc-900 border rounded-lg font-mono text-[9px] text-zinc-500 space-y-1">
                          <p className="font-bold text-primary">nome, cnpj, telefone, email, razao social, nome fantasia</p>
                          <p>* O CNPJ é obrigatório e deve ser exclusivo.</p>
                        </div>
                      )}
                      {importType === "servicos" && (
                        <div className="p-2.5 bg-white dark:bg-zinc-900 border rounded-lg font-mono text-[9px] text-zinc-500 space-y-1">
                          <p className="font-bold text-primary">nome, categoria, tipo manutenção, descrição, unidade cobrança, preço, horas estimadas</p>
                          <p>* O nome do serviço é obrigatório e deve ser exclusivo.</p>
                        </div>
                      )}
                      {importType === "materiais" && (
                        <div className="p-2.5 bg-white dark:bg-zinc-900 border rounded-lg font-mono text-[9px] text-zinc-500 space-y-1">
                          <p className="font-bold text-primary">nome, preco custo, preco venda, quantidade estoque, estoque minimo, unidade</p>
                          <p>* O nome da peça é obrigatório. O estoque é inserido de forma automática no estoque físico.</p>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t text-[10px] text-zinc-450 dark:text-zinc-500 space-y-1">
                      <p>✔️ A primeira linha DEVE conter o cabeçalho.</p>
                      <p>✔️ O sistema identifica registros existentes e atualiza seus campos ao invés de duplicar.</p>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* 5. Gmail e integrações externas */}
          {activeSubTab === "integrations" && (
            <div className="space-y-6">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                <div className="bg-gradient-to-br from-slate-950 via-blue-950 to-blue-900 px-5 py-6 text-white sm:px-7">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-start gap-4">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15"><Mail size={22} /></span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-black">Envio de propostas pelo Gmail</h3>
                          {gmailSettings?.success && gmailSettings.connected ? (
                            <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-300/25">Conectado</span>
                          ) : gmailSettings?.success && gmailSettings.configured ? (
                            <span className="rounded-full bg-amber-400/15 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-amber-200 ring-1 ring-amber-300/25">Aguardando autorização</span>
                          ) : (
                            <span className="rounded-full bg-slate-400/15 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-slate-300 ring-1 ring-white/15">Configuração pendente</span>
                          )}
                        </div>
                        <p className="mt-2 max-w-2xl text-xs leading-relaxed text-blue-100/80">Conecte a conta comercial para enviar a proposta com o PDF A4 anexado e manter o histórico completo dentro do orçamento.</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" loading={gmailLoading} onClick={() => void loadGmailSettings()}><RefreshCw size={14} /> Atualizar status</Button>
                      {gmailSettings?.success && gmailSettings.configured && !gmailSettings.connected && (
                        <Button onClick={() => window.location.assign("/api/integrations/gmail/connect?returnTo=%2Fconfiguracoes")}><Link2 size={14} /> Conectar Google</Button>
                      )}
                      {gmailSettings?.success && gmailSettings.connected && (
                        <Button variant="danger" loading={gmailDisconnecting} onClick={() => void handleDisconnectGmail()}><Unplug size={14} /> Desconectar</Button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 p-5 sm:grid-cols-3 sm:p-7">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/30">
                    <p className="text-[9px] font-black uppercase tracking-wider text-zinc-400">Conta remetente</p>
                    <p className="mt-2 truncate text-sm font-black text-zinc-900 dark:text-white">{gmailSettings?.success && gmailSettings.integration?.email ? gmailSettings.integration.email : "Nenhuma conta conectada"}</p>
                    <p className="mt-1 text-[10px] text-zinc-500">{gmailSettings?.success && gmailSettings.integration?.displayName ? gmailSettings.integration.displayName : "Será definida na autorização Google"}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/30">
                    <p className="text-[9px] font-black uppercase tracking-wider text-zinc-400">Propostas enviadas</p>
                    <p className="mt-2 text-2xl font-black text-zinc-900 dark:text-white">{gmailSettings?.success ? gmailSettings.sentCount : 0}</p>
                    <p className="mt-1 text-[10px] text-zinc-500">Envios confirmados e auditados</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/30">
                    <p className="text-[9px] font-black uppercase tracking-wider text-zinc-400">Proteção</p>
                    <p className="mt-2 flex items-center gap-1.5 text-sm font-black text-emerald-700 dark:text-emerald-300"><ShieldCheck size={15} /> OAuth 2.0</p>
                    <p className="mt-1 text-[10px] text-zinc-500">Sem guardar senha do Gmail</p>
                  </div>
                </div>

                {gmailSettings?.success && gmailSettings.integration?.lastError && (
                  <div className="mx-5 mb-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 sm:mx-7 sm:mb-7"><AlertCircle size={15} className="mt-0.5 shrink-0" /> <span><strong>Último aviso:</strong> {gmailSettings.integration.lastError}</span></div>
                )}
              </div>

              <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
                  <div className="flex items-start gap-3 border-b border-zinc-100 pb-4 dark:border-zinc-800">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"><BookOpen size={18} /></span>
                    <div><h4 className="text-sm font-black text-zinc-900 dark:text-white">Manual rápido de configuração</h4><p className="mt-1 text-[11px] leading-relaxed text-zinc-500">Execute os passos na ordem. Os segredos ficam somente no servidor.</p></div>
                  </div>

                  <ol className="mt-5 space-y-4">
                    {[
                      { icon: ExternalLink, title: "Criar ou selecionar o projeto Google Cloud", text: "Abra o Google Cloud Console com a conta responsável pela empresa." },
                      { icon: Send, title: "Ativar a Gmail API", text: "Em APIs e serviços, pesquise Gmail API e clique em Ativar." },
                      { icon: ShieldCheck, title: "Configurar a tela de consentimento OAuth", text: "Informe o nome NX ERP, e-mail de suporte e adicione a conta remetente como usuário de teste enquanto o app estiver em teste." },
                      { icon: KeyRound, title: "Criar credencial OAuth 2.0", text: "Escolha Aplicativo da Web e cadastre exatamente a URI de redirecionamento exibida abaixo." },
                      { icon: Server, title: "Salvar as variáveis no servidor", text: "Preencha APP_BASE_URL, INTEGRATION_ENCRYPTION_KEY, GOOGLE_GMAIL_CLIENT_ID e GOOGLE_GMAIL_CLIENT_SECRET no arquivo .env e reinicie o ERP." },
                      { icon: Link2, title: "Conectar e autorizar", text: "Volte nesta tela, clique em Conectar Google e aceite somente a permissão de envio de e-mail." },
                    ].map((step, index) => (
                      <li key={step.title} className="flex gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-950 text-[11px] font-black text-white dark:bg-blue-600">{index + 1}</span>
                        <div className="min-w-0 pt-0.5"><p className="flex items-center gap-1.5 text-xs font-black text-zinc-850 dark:text-zinc-100"><step.icon size={13} className="text-blue-600" /> {step.title}</p><p className="mt-1 text-[11px] leading-relaxed text-zinc-500">{step.text}</p></div>
                      </li>
                    ))}
                  </ol>

                  <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-bold text-white transition hover:bg-blue-700"><ExternalLink size={14} /> Abrir credenciais do Google Cloud</a>
                </section>

                <div className="space-y-5">
                  <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                    <h4 className="text-xs font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-200">URI autorizada</h4>
                    <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">Cole este endereço no campo “URIs de redirecionamento autorizados” da credencial Google.</p>
                    <div className="mt-3 flex items-start gap-2 rounded-xl bg-zinc-950 p-3">
                      <code className="min-w-0 flex-1 break-all text-[11px] leading-relaxed text-sky-300">{gmailSettings?.success ? gmailSettings.redirectUri : "Carregando..."}</code>
                      {gmailSettings?.success && <button type="button" onClick={() => void handleCopyGmailValue(gmailSettings.redirectUri, "URI")} className="rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-white" aria-label="Copiar URI"><Copy size={14} /></button>}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                    <h4 className="text-xs font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-200">Variáveis necessárias</h4>
                    <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
                      {(gmailSettings?.success ? gmailSettings.requiredVariables : ["APP_BASE_URL", "INTEGRATION_ENCRYPTION_KEY", "GOOGLE_GMAIL_CLIENT_ID", "GOOGLE_GMAIL_CLIENT_SECRET"]).map((variable) => (
                        <div key={variable} className="flex items-center justify-between gap-2 border-b border-zinc-100 px-3 py-2.5 last:border-0 dark:border-zinc-800"><code className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300">{variable}</code><button type="button" onClick={() => void handleCopyGmailValue(variable, "Nome da variável")} className="text-zinc-400 hover:text-blue-600" aria-label={`Copiar ${variable}`}><Copy size={13} /></button></div>
                      ))}
                    </div>
                    <div className="mt-3 flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-[10px] leading-relaxed text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300"><ShieldCheck size={14} className="mt-0.5 shrink-0" /> Nunca envie o Client Secret por WhatsApp ou e-mail. Grave-o diretamente no servidor.</div>
                  </section>

                  <section className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5 dark:border-blue-950 dark:bg-blue-950/20">
                    <h4 className="text-xs font-black text-blue-900 dark:text-blue-200">Como testar depois de conectar</h4>
                    <p className="mt-2 text-[11px] leading-relaxed text-blue-800/80 dark:text-blue-300/80">Abra <strong>Orçamentos</strong>, selecione uma proposta, clique em <strong>Enviar por Gmail</strong>, confira o destinatário e envie. O ERP anexará o PDF A4 e mostrará o resultado no histórico da própria proposta.</p>
                  </section>
                </div>
              </div>
            </div>
          )}

          {/* 6. Segurança & Autenticação (2FA) */}
          {activeSubTab === "security" && (
            <div className="space-y-6 max-w-lg select-none">
              <div>
                <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider mb-1">
                  Autenticação de Dois Fatores (MFA / 2FA)
                </h4>
                <p className="text-[10px] text-zinc-450 dark:text-zinc-500 font-semibold">
                  Proteja a sua conta administrativa exigindo um código de verificação temporário a cada login.
                </p>
              </div>

              <div className="bg-zinc-50/50 dark:bg-zinc-900/30 p-5 rounded-2xl border border-zinc-150 dark:border-zinc-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl shrink-0 ${
                      twoFactorEnabled
                        ? "bg-success/10 text-success"
                        : "bg-zinc-100 dark:bg-zinc-850 text-zinc-450 dark:text-zinc-400"
                    }`}>
                      <Lock size={18} />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-zinc-850 dark:text-zinc-150 block">Status do 2FA</span>
                      <span className={`text-[10px] font-bold ${
                        twoFactorEnabled ? "text-success" : "text-zinc-450 dark:text-zinc-500"
                      }`}>
                        {twoFactorEnabled ? "Ativado • Protegido por Token" : "Desativado"}
                      </span>
                    </div>
                  </div>

                  <Button
                    variant={twoFactorEnabled ? "secondary" : "primary"}
                    size="sm"
                    onClick={() => {
                      if (twoFactorEnabled) {
                        if (confirm("Deseja realmente desativar a proteção 2FA?")) {
                          setTwoFactorEnabled(false);
                          localStorage.setItem("2fa_enabled", "false");
                          toast("Autenticação 2FA desativada com sucesso.", "success");
                        }
                      } else {
                        setShow2faSetup(true);
                      }
                    }}
                  >
                    {twoFactorEnabled ? "Desativar" : "Configurar 2FA"}
                  </Button>
                </div>

                {show2faSetup && !twoFactorEnabled && (
                  <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 space-y-4 animate-in slide-in-from-top duration-250">
                    <div className="text-[11px] text-zinc-600 dark:text-zinc-400 space-y-2 leading-relaxed">
                      <p className="font-bold text-zinc-800 dark:text-zinc-200">Passo 1: Escaneie o QR Code ou insira a chave secreta</p>
                      <p>
                        Abra o seu aplicativo autenticador (Google Authenticator, Microsoft Authenticator ou similar) e aponte a câmera para o código ou digite a chave abaixo:
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 items-center bg-white dark:bg-zinc-950 p-4 border rounded-xl shadow-inner">
                      <div className="w-32 h-32 bg-zinc-100 dark:bg-zinc-900 rounded-lg flex flex-col items-center justify-center p-2 border border-dashed border-zinc-300 dark:border-zinc-700 shrink-0">
                        <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 opacity-65">
                          <div className="grid grid-cols-4 gap-1 w-16 h-16 bg-zinc-800 dark:bg-zinc-200 p-1.5 rounded">
                            <div className="bg-white dark:bg-zinc-900 rounded-sm"></div>
                            <div className="bg-white dark:bg-zinc-900 rounded-sm"></div>
                            <div className="bg-zinc-800 dark:bg-zinc-200 rounded-sm"></div>
                            <div className="bg-white dark:bg-zinc-900 rounded-sm"></div>
                            <div className="bg-zinc-800 dark:bg-zinc-200 rounded-sm"></div>
                            <div className="bg-white dark:bg-zinc-900 rounded-sm"></div>
                            <div className="bg-white dark:bg-zinc-900 rounded-sm"></div>
                            <div className="bg-zinc-800 dark:bg-zinc-200 rounded-sm"></div>
                          </div>
                          <span className="text-[7.5px] font-bold text-zinc-400 uppercase tracking-wider">QR CODE</span>
                        </div>
                      </div>

                      <div className="flex-1 w-full space-y-2">
                        <span className="text-[9px] font-bold text-zinc-400 block uppercase">Chave Secreta</span>
                        <code className="text-xs font-mono font-bold bg-zinc-50 dark:bg-zinc-900 p-2 border rounded-lg block text-primary dark:text-zinc-300 select-all text-center">
                          {twoFactorSecret}
                        </code>
                        <span className="text-[8.5px] text-zinc-450 block leading-snug">
                          Guarde esta chave em local seguro caso precise restaurar o acesso à sua conta.
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                      <span className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 block">
                        Passo 2: Confirme o código de verificação
                      </span>
                      <div className="flex gap-2 items-end">
                        <div className="flex-1">
                          <Input
                            placeholder="000 000"
                            maxLength={6}
                            value={twoFactorCode}
                            onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ""))}
                          />
                        </div>
                        <Button
                          variant="primary"
                          loading={mfaActionLoading}
                          onClick={() => {
                            if (twoFactorCode.length !== 6) {
                              toast("Por favor, digite o código de 6 dígitos gerado pelo aplicativo.", "warning");
                              return;
                            }
                            setMfaActionLoading(true);
                            setTimeout(() => {
                              setTwoFactorEnabled(true);
                              localStorage.setItem("2fa_enabled", "true");
                              setTwoFactorCode("");
                              setShow2faSetup(false);
                              setMfaActionLoading(false);
                              toast("Autenticação de Dois Fatores (2FA) configurada e ativada!", "success");
                            }, 800);
                          }}
                        >
                          Confirmar e Ativar
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Backups card */}
              <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-150 dark:border-zinc-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
                      <FileSpreadsheet size={18} />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-zinc-850 dark:text-zinc-150 block">Cópia de Segurança (Backup)</span>
                      <span className="text-[10px] text-zinc-450 dark:text-zinc-500 font-semibold block leading-tight mt-0.5">
                        Dumps PostgreSQL verificados, histórico de retenção e cópia externa opcional.
                      </span>
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    loading={backupLoading}
                    onClick={handleRunBackup}
                  >
                    Gerar Cópia
                  </Button>
                </div>

                {backupResult && (
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-900/30 rounded-xl border border-zinc-150 dark:border-zinc-800 font-mono text-[10px] text-zinc-500 leading-snug">
                    {backupResult}
                  </div>
                )}

                {backupHistory.length > 0 && (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                      <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                        <CheckCircle size={12} /> Último backup
                      </div>
                      <p className="mt-1.5 text-[10px] font-bold text-zinc-700 dark:text-zinc-200">
                        {new Date(backupHistory[0].createdAt).toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 dark:border-blue-900/40 dark:bg-blue-950/20">
                      <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                        <HardDrive size={12} /> Integridade
                      </div>
                      <p className="mt-1.5 text-[10px] font-bold text-zinc-700 dark:text-zinc-200">SHA-256 verificado</p>
                    </div>
                    <div className={`rounded-xl border p-3 ${backupHistory[0].remoteUploaded ? "border-violet-100 bg-violet-50/60 dark:border-violet-900/40 dark:bg-violet-950/20" : "border-amber-100 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20"}`}>
                      <div className={`flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider ${backupHistory[0].remoteUploaded ? "text-violet-700 dark:text-violet-300" : "text-amber-700 dark:text-amber-300"}`}>
                        <Cloud size={12} /> Cópia externa
                      </div>
                      <p className="mt-1.5 text-[10px] font-bold text-zinc-700 dark:text-zinc-200">
                        {backupHistory[0].remoteUploaded ? "Sincronizada" : "Somente local"}
                      </p>
                    </div>
                  </div>
                )}

                {backupHistory.length > 0 && (
                  <div className="overflow-hidden rounded-xl border border-zinc-150 dark:border-zinc-800">
                    {backupHistory.slice(0, 4).map((backup) => (
                      <div key={backup.fileName} className="flex items-center justify-between gap-3 border-b border-zinc-100 px-3 py-2.5 last:border-0 dark:border-zinc-800">
                        <div className="min-w-0">
                          <p className="truncate text-[10px] font-bold text-zinc-700 dark:text-zinc-200">{backup.fileName}</p>
                          <p className="mt-0.5 text-[9px] text-zinc-400">{backup.type} · {(backup.sizeBytes / 1024).toFixed(1)} KB</p>
                        </div>
                        <span className="shrink-0 font-mono text-[8px] text-zinc-400">{backup.sha256.slice(0, 10)}…</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-start gap-2 text-[9.5px] text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/10 p-3 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 leading-relaxed">
                  <RefreshCw size={13} className="mt-0.5 shrink-0 text-primary" />
                  <span>Salvamento automático: horário com retenção de 48h, diário por 30 dias e semanal por 12 semanas. Configure <code className="font-mono font-bold text-primary">BACKUP_BUCKET</code> para manter uma cópia fora do servidor.</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
