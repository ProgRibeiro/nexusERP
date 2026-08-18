"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Table, TableRow, TableCell } from "../ui/Table";
import { Settings, Shield, Sliders, CheckCircle, XCircle, Building, FileSpreadsheet, Download, Upload, ShieldCheck, Lock, Cloud, HardDrive, RefreshCw, Mail, ExternalLink, Copy, Link2, Send, AlertCircle, BookOpen, KeyRound, Server, Unplug, Smartphone, Tablet, Wifi, AppWindow, Share2, Users, UserPlus, Key, Trash2, Edit3, Plus, Search } from "lucide-react";
import { consultarCNPJAction } from "@/app/actions/clientActions";
import { importClientsAction, importServicesAction, importProductsAction, parseImportFileAction, previewImportAction } from "@/app/actions/importActions";
import { getBackupStatusAction, triggerBackupAction } from "@/app/actions/backupActions";
import type { BackupMetadata } from "@/lib/backup";
import { parseDelimitedText } from "@/lib/tabularImport";
import { getCompanyTaxProfile, saveCompanyTaxProfile, getCompanySettingsAction, saveCompanySettingsAction } from "@/app/actions/settingsActions";
import { defaultTaxRate, normalizeTaxRegime } from "@/lib/tax";
import { disconnectGmail, getGmailIntegrationSettings } from "@/app/actions/gmailActions";
import { CompanyRegistrationModal } from "@/components/modals/CompanyRegistrationModal";
import ModuleCatalogSettings from "@/components/ModuleCatalogSettings";
import ErrorReportQueue from "@/components/ErrorReportQueue";
import { getUsers, createUserAction, updateUserAction, deleteUserAction } from "@/app/actions/userActions";
import { AutoUpdateMaintenancePanel } from "@/components/AutoUpdateMaintenancePanel";


type GmailSettings = Awaited<ReturnType<typeof getGmailIntegrationSettings>>;

export default function ConfiguracoesTab() {
  const { user: currentUser, hasPermission } = useAuth();
  const { toast } = useToast();

  const [activeSubTab, setActiveSubTab] = useState<"system" | "empresa" | "users" | "matrix" | "importador" | "mobile" | "integrations" | "security" | "updates">("system");

  // User management states
  const [usersList, setUsersList] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [userFormData, setUserFormData] = useState({ name: "", email: "", roleName: "Técnico de Campo", password: "" });
  const [userFormLoading, setUserFormLoading] = useState(false);

  const loadUsersList = async () => {
    setUsersLoading(true);
    const data = await getUsers();
    setUsersList(data);
    setUsersLoading(false);
  };

  useEffect(() => {
    if (activeSubTab === "users") {
      void loadUsersList();
    }
  }, [activeSubTab]);

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
    let mounted = true;
    getCompanySettingsAction().then((dbCompany) => {
      if (mounted && dbCompany) {
        setCompanyParams((prev: any) => ({ ...prev, ...dbCompany }));
        if (typeof window !== "undefined") {
          localStorage.setItem("company_params", JSON.stringify(dbCompany));
        }
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

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
      const result = await saveCompanySettingsAction(companyParams);
      if (!result.success) {
        toast(result.error || "Não foi possível salvar os dados da empresa no banco de dados.", "error");
        return;
      }
      if (typeof window !== "undefined") {
        localStorage.setItem("company_params", JSON.stringify(result.data));
      }
      toast("Dados da Empresa salvos no banco de dados com sucesso!", "success");
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
            onClick={() => setActiveSubTab("users")}
            className={`py-2 px-3 text-xs font-bold border-b-2 rounded-t-lg transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === "users" ? "border-primary text-primary" : "border-transparent text-zinc-400 hover:text-zinc-650"
            }`}
          >
            <Users size={13} className="inline mr-1" /> Equipe & Usuários
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
            onClick={() => setActiveSubTab("mobile")}
            className={`py-2 px-3 text-xs font-bold border-b-2 rounded-t-lg transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === "mobile" ? "border-primary text-primary" : "border-transparent text-zinc-400 hover:text-zinc-650"
            }`}
          >
            <Smartphone size={13} className="inline mr-1" /> Aplicativo móvel
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
          <button
            onClick={() => setActiveSubTab("updates")}
            className={`py-2 px-3 text-xs font-bold border-b-2 rounded-t-lg transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === "updates" ? "border-primary text-primary" : "border-transparent text-zinc-400 hover:text-zinc-650"
            }`}
          >
            <RefreshCw size={13} className="inline mr-1" /> Auto-Update 3h & Manutenção
          </button>
        </div>

        <div className="p-6">
          {/* Subaba Auto-Update & Manutenção */}
          {activeSubTab === "updates" && <AutoUpdateMaintenancePanel />}

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
            <div className="py-2">
              <CompanyRegistrationModal isFloating={false} />
            </div>
          )}

          {/* 2.5. Gestão de Equipe & Usuários */}
          {activeSubTab === "users" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-150 dark:border-zinc-800 pb-4">
                <div>
                  <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <Users size={18} className="text-primary" /> Gestão de Usuários & Operadores da Equipe
                  </h4>
                  <p className="text-xs text-zinc-400 mt-1">
                    Crie contas de acesso para técnicos, gestores, equipe financeira e administradores com perfis de permissão específicos.
                  </p>
                </div>
                <Button
                  variant="primary"
                  onClick={() => {
                    setEditingUser(null);
                    setUserFormData({ name: "", email: "", roleName: "Técnico de Campo", password: "123" });
                    setShowUserModal(true);
                  }}
                  className="flex items-center gap-1.5 shrink-0"
                >
                  <UserPlus size={15} /> Criar Novo Usuário
                </Button>
              </div>

              {usersLoading ? (
                <div className="p-8 text-center text-xs text-zinc-400">Carregando usuários da equipe...</div>
              ) : usersList.length === 0 ? (
                <div className="p-8 text-center border border-dashed rounded-2xl text-xs text-zinc-400">
                  Nenhum usuário encontrado. Clique em "Criar Novo Usuário" para cadastrar o primeiro operador.
                </div>
              ) : (
                <Table headers={["Nome do Usuário", "E-mail de Login", "Perfil de Acesso", "Ações"]}>
                  {usersList.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-bold text-zinc-850 dark:text-zinc-150">
                        {u.name}
                        {u.email === currentUser?.email && (
                          <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-bold">Você</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-zinc-600 dark:text-zinc-400">{u.email}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          u.roleName === "Administrador"
                            ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
                            : u.roleName.includes("Gestor")
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                            : u.roleName.includes("Técnico")
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                            : u.roleName.includes("Financeiro")
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                            : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                        }`}>
                          {u.roleName}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingUser(u);
                              setUserFormData({ name: u.name, email: u.email, roleName: u.roleName, password: "" });
                              setShowUserModal(true);
                            }}
                            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-primary transition-colors"
                            title="Editar / Redefinir Senha"
                          >
                            <Edit3 size={14} />
                          </button>
                          {u.email !== currentUser?.email && (
                            <button
                              type="button"
                              onClick={async () => {
                                if (confirm(`Tem certeza que deseja excluir o acesso de ${u.name}?`)) {
                                  const res = await deleteUserAction(u.id);
                                  if (res.success) {
                                    toast(`Usuário ${u.name} removido com sucesso.`, "success");
                                    void loadUsersList();
                                  } else {
                                    toast(res.error || "Erro ao excluir usuário.", "error");
                                  }
                                }
                              }}
                              className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg text-zinc-400 hover:text-red-600 transition-colors"
                              title="Excluir Usuário"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </Table>
              )}

              {/* Modal de Criação / Edição de Usuário */}
              {showUserModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5">
                    <div className="flex items-center justify-between border-b pb-3">
                      <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        <UserPlus size={16} className="text-primary" />
                        {editingUser ? `Editar Usuário: ${editingUser.name}` : "Criar Novo Usuário da Equipe"}
                      </h3>
                      <button
                        onClick={() => setShowUserModal(false)}
                        className="text-zinc-400 hover:text-zinc-600 text-sm font-bold"
                      >
                        ✕
                      </button>
                    </div>

                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!userFormData.name.trim() || !userFormData.email.trim()) {
                          toast("Preencha o nome e e-mail do usuário.", "warning");
                          return;
                        }

                        setUserFormLoading(true);
                        try {
                          if (editingUser) {
                            const res = await updateUserAction({
                              id: editingUser.id,
                              name: userFormData.name,
                              email: userFormData.email,
                              roleName: userFormData.roleName,
                              password: userFormData.password.trim() || undefined,
                            });
                            if (res.success) {
                              toast("Usuário atualizado com sucesso!", "success");
                              setShowUserModal(false);
                              void loadUsersList();
                            } else {
                              toast(res.error || "Erro ao atualizar usuário.", "error");
                            }
                          } else {
                            const res = await createUserAction({
                              name: userFormData.name,
                              email: userFormData.email,
                              roleName: userFormData.roleName,
                              password: userFormData.password.trim() || "123",
                            });
                            if (res.success) {
                              toast(`Usuário ${res.user?.name} criado com sucesso!`, "success");
                              setShowUserModal(false);
                              void loadUsersList();
                            } else {
                              toast(res.error || "Erro ao criar usuário.", "error");
                            }
                          }
                        } catch (err: any) {
                          toast(err.message || "Falha ao salvar usuário.", "error");
                        } finally {
                          setUserFormLoading(false);
                        }
                      }}
                      className="space-y-4"
                    >
                      <Input
                        label="Nome Completo *"
                        value={userFormData.name}
                        onChange={(e) => setUserFormData((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder="Ex: Carlos Oliveira"
                        required
                      />

                      <Input
                        label="E-mail de Login *"
                        type="email"
                        value={userFormData.email}
                        onChange={(e) => setUserFormData((prev) => ({ ...prev, email: e.target.value }))}
                        placeholder="Ex: carlos@empresa.com.br"
                        required
                      />

                      <Select
                        label="Perfil / Papel de Acesso *"
                        value={userFormData.roleName}
                        onChange={(e) => setUserFormData((prev) => ({ ...prev, roleName: e.target.value }))}
                        options={[
                          { value: "Administrador", label: "Administrador (Acesso Total)" },
                          { value: "Gestor Operacional", label: "Gestor Operacional (CRM, OS, Estoque)" },
                          { value: "Técnico de Campo", label: "Técnico de Campo (Execução Mobile de OS)" },
                          { value: "Financeiro", label: "Financeiro (Contas a Pagar/Receber, NFS-e)" },
                          { value: "Operador", label: "Operador (Acesso Padrão de Leitura)" },
                        ]}
                      />

                      <Input
                        label={editingUser ? "Nova Senha (deixe em branco para manter a atual)" : "Senha Inicial (Padrão: 123)"}
                        type="password"
                        value={userFormData.password}
                        onChange={(e) => setUserFormData((prev) => ({ ...prev, password: e.target.value }))}
                        placeholder={editingUser ? "••••••••" : "Digite uma senha ou use 123"}
                      />

                      <div className="flex justify-end gap-2 pt-3 border-t">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => setShowUserModal(false)}
                        >
                          Cancelar
                        </Button>
                        <Button
                          type="submit"
                          variant="primary"
                          loading={userFormLoading}
                        >
                          {editingUser ? "Salvar Alterações" : "Criar Usuário"}
                        </Button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
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

          {/* 5. Instalação móvel */}
          {activeSubTab === "mobile" && (
            <div className="space-y-6">
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                <div className="bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-900 px-5 py-7 text-white sm:px-7">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-start gap-4">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15"><AppWindow size={23} /></span>
                      <div><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-black">NX ERP para Android e Apple</h3><span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-300/25">PWA preparada</span></div><p className="mt-2 max-w-2xl text-xs leading-relaxed text-blue-100/80">Instale o ERP na tela inicial, use em tela cheia e receba novas versões sem baixar arquivos novamente.</p></div>
                    </div>
                    <div className="rounded-xl bg-white/10 px-4 py-3 text-[11px] leading-relaxed text-blue-100 ring-1 ring-white/15"><strong className="block text-white">Onde instalar?</strong>Use o botão <strong>Instalar aplicativo</strong> na barra superior.</div>
                  </div>
                </div>

                <div className="grid gap-4 p-5 sm:p-7 lg:grid-cols-3">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900 dark:bg-emerald-950/20"><CheckCircle size={18} className="text-emerald-600" /><p className="mt-3 text-xs font-black text-zinc-900 dark:text-white">Instalação pronta</p><p className="mt-1 text-[11px] leading-relaxed text-zinc-500">Manifesto, ícones Android/Apple e execução em tela cheia configurados.</p></div>
                  <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900 dark:bg-blue-950/20"><RefreshCw size={18} className="text-blue-600" /><p className="mt-3 text-xs font-black text-zinc-900 dark:text-white">Atualização automática</p><p className="mt-1 text-[11px] leading-relaxed text-zinc-500">O aparelho detecta a nova versão e apresenta um botão seguro para atualizar.</p></div>
                  <div className="rounded-2xl border border-violet-200 bg-violet-50/70 p-4 dark:border-violet-900 dark:bg-violet-950/20"><ShieldCheck size={18} className="text-violet-600" /><p className="mt-3 text-xs font-black text-zinc-900 dark:text-white">Dados protegidos</p><p className="mt-1 text-[11px] leading-relaxed text-zinc-500">Telas autenticadas não ficam gravadas no cache compartilhado do aparelho.</p></div>
                </div>
              </section>

              <div className="grid gap-5 lg:grid-cols-2">
                <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
                  <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"><Smartphone size={19} /></span><div><h4 className="text-sm font-black text-zinc-900 dark:text-white">Instalar no Android</h4><p className="mt-1 text-[10px] text-zinc-500">Chrome, Samsung Internet ou navegador compatível.</p></div></div>
                  <ol className="mt-5 space-y-3 text-[11px] text-zinc-600 dark:text-zinc-300">
                    <li className="flex gap-3"><strong className="text-blue-600">1.</strong><span>Abra o endereço HTTPS do NX ERP no Chrome.</span></li>
                    <li className="flex gap-3"><strong className="text-blue-600">2.</strong><span>Entre normalmente com seu usuário.</span></li>
                    <li className="flex gap-3"><strong className="text-blue-600">3.</strong><span>Toque em <strong>⋮</strong> e escolha <strong>Instalar aplicativo</strong>. Se a opção não aparecer, use <strong>Adicionar à tela inicial</strong>.</span></li>
                    <li className="flex gap-3"><strong className="text-blue-600">4.</strong><span>Confirme a instalação e abra o ícone <strong>NX ERP</strong>.</span></li>
                  </ol>
                </section>

                <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
                  <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300"><Tablet size={19} /></span><div><h4 className="text-sm font-black text-zinc-900 dark:text-white">Instalar no iPhone ou iPad</h4><p className="mt-1 text-[10px] text-zinc-500">Faça o primeiro acesso pelo Safari.</p></div></div>
                  <ol className="mt-5 space-y-3 text-[11px] text-zinc-600 dark:text-zinc-300">
                    <li className="flex gap-3"><strong className="text-blue-600">1.</strong><span>Abra o endereço HTTPS do NX ERP no <strong>Safari</strong>.</span></li>
                    <li className="flex gap-3"><strong className="text-blue-600">2.</strong><span>Toque no botão <Share2 size={13} className="mx-1 inline text-blue-600" /> <strong>Compartilhar</strong>.</span></li>
                    <li className="flex gap-3"><strong className="text-blue-600">3.</strong><span>Role as opções e toque em <strong>Adicionar à Tela de Início</strong>.</span></li>
                    <li className="flex gap-3"><strong className="text-blue-600">4.</strong><span>Confirme em <strong>Adicionar</strong>. O aplicativo abrirá em tela cheia.</span></li>
                  </ol>
                </section>
              </div>

              <section className="grid gap-4 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-5 dark:border-zinc-800 dark:bg-zinc-950/30 sm:grid-cols-3 sm:p-6">
                <div className="flex gap-3"><Wifi size={17} className="mt-0.5 shrink-0 text-blue-600" /><div><p className="text-xs font-black text-zinc-850 dark:text-zinc-100">Servidor acessível</p><p className="mt-1 text-[10px] leading-relaxed text-zinc-500">O celular precisa alcançar o servidor Linux pela rede ou internet.</p></div></div>
                <div className="flex gap-3"><Lock size={17} className="mt-0.5 shrink-0 text-blue-600" /><div><p className="text-xs font-black text-zinc-850 dark:text-zinc-100">HTTPS obrigatório</p><p className="mt-1 text-[10px] leading-relaxed text-zinc-500">A instalação móvel e o funcionamento seguro exigem certificado válido.</p></div></div>
                <div className="flex gap-3"><Cloud size={17} className="mt-0.5 shrink-0 text-blue-600" /><div><p className="text-xs font-black text-zinc-850 dark:text-zinc-100">Uma única base</p><p className="mt-1 text-[10px] leading-relaxed text-zinc-500">Android, Apple e computadores usam os mesmos cadastros em tempo real.</p></div></div>
              </section>

              <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-[11px] leading-relaxed text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200"><AlertCircle size={17} className="mt-0.5 shrink-0" /><span><strong>Modo offline:</strong> a execução de campo conserva rascunhos e fotos pendentes no aparelho. Cadastros administrativos e dados financeiros continuam exigindo conexão com o servidor para evitar informações desatualizadas.</span></div>
            </div>
          )}

          {/* 6. Gmail e integrações externas */}
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

          {/* 7. Segurança & Autenticação (2FA) */}
          {activeSubTab === "security" && (
            <div className="space-y-6 max-w-4xl select-none">
              <ModuleCatalogSettings />
              <ErrorReportQueue />
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
