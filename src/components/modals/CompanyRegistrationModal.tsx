"use client";

import React, { useState, useEffect } from "react";
import {
  Building2,
  Upload,
  Search,
  CheckCircle2,
  Sparkles,
  Save,
  X,
  FileText,
  Mail,
  Phone,
  MapPin,
  ShieldCheck,
  Receipt,
  Award,
  Globe,
  Trash2,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { consultarCNPJAction } from "@/app/actions/clientActions";
import { saveCompanyTaxProfile } from "@/app/actions/settingsActions";
import { defaultTaxRate, normalizeTaxRegime } from "@/lib/tax";
import { useToast } from "@/components/ui/Toast";

export interface CompanyData {
  corporateName: string;
  tradeName: string;
  cnpj: string;
  stateRegistration: string;
  municipalRegistration: string;
  foundationDate?: string;
  email: string;
  phone: string;
  whatsapp: string;
  website: string;
  cep: string;
  address: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  logoUrl: string;
  fiscalRegime: string;
  taxRate: number;
  cnae?: string;
  differentials: string;
  merchanTitle: string;
  merchanDesc: string;
  terms: string;
  technicalResponsible: string;
}

const DEFAULT_COMPANY_DATA: CompanyData = {
  corporateName: "NEXUS CLIMATIZACAO E SERVICOS LTDA",
  tradeName: "Nexus Ar Condicionado",
  cnpj: "12.345.678/0001-99",
  stateRegistration: "111.222.333.444",
  municipalRegistration: "1.234.567-8",
  foundationDate: "2020-01-15",
  email: "contato@nexusmanutencao.com",
  phone: "(11) 4002-8922",
  whatsapp: "(11) 99999-8888",
  website: "https://nexusmanutencao.com",
  cep: "01310-100",
  address: "Avenida Paulista",
  number: "1000",
  neighborhood: "Bela Vista",
  city: "São Paulo",
  state: "SP",
  logoUrl: "",
  fiscalRegime: "SIMPLES_NACIONAL",
  taxRate: 6.0,
  cnae: "43.22-3-02 - Instalação e manutenção de sistemas centrais de ar condicionado",
  differentials:
    "Equipe técnica especializada e certificada\nAtendimento 24/7 com suporte prioritário\nGarantia estendida de 12 meses nos serviços\nPeças e componentes de alta performance com selo de fábrica",
  merchanTitle: "NEXUS MANUTENÇÃO & ENGENHARIA",
  merchanDesc: "Soluções completas e inteligência em climatização corporativa e industrial.",
  terms:
    "Validade desta proposta: 15 dias. Pagamento via Boleto Faturado ou PIX. Serviços com garantia de 90 dias após conclusão.",
  technicalResponsible: "Eng. Lucas Ribeiro - CREA 5069827341",
};

interface CompanyRegistrationModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  isFloating?: boolean;
}

export function CompanyRegistrationModal({
  isOpen = true,
  onClose,
  isFloating = true,
}: CompanyRegistrationModalProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"geral" | "contato" | "fiscal" | "documentos">("geral");

  const [company, setCompany] = useState<CompanyData>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("company_params");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return {
            ...DEFAULT_COMPANY_DATA,
            ...parsed,
          };
        } catch (e) {
          console.error("Erro ao carregar dados salvos da empresa:", e);
        }
      }
    }
    return DEFAULT_COMPANY_DATA;
  });

  const [saving, setSaving] = useState(false);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

  // Manipular alteração da Logo
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      toast("A imagem deve ter no máximo 3MB.", "warning");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCompany((prev) => ({ ...prev, logoUrl: reader.result as string }));
      toast("Logotipo carregado com sucesso!", "success");
    };
    reader.readAsDataURL(file);
  };

  // Remover Logo
  const handleRemoveLogo = () => {
    setCompany((prev) => ({ ...prev, logoUrl: "" }));
    toast("Logotipo removido.", "info");
  };

  // Buscar CNPJ via Receita Federal
  const handleCnpjLookup = async () => {
    const cleanCnpj = company.cnpj.replace(/\D/g, "");
    if (cleanCnpj.length !== 14) {
      toast("Digite um CNPJ válido com 14 dígitos.", "warning");
      return;
    }

    setCnpjLoading(true);
    try {
      const res = await consultarCNPJAction(cleanCnpj);
      if (res && res.success && res.data) {
        const d = res.data;
        const addr = d.addressDetails;
        setCompany((prev) => ({
          ...prev,
          corporateName: d.corporateName || (d as any).razao_social || prev.corporateName,
          tradeName: d.tradeName || (d as any).nome_fantasia || (d as any).razao_social || prev.tradeName,
          email: d.email || (d as any).email || prev.email,
          phone: d.phone || (d as any).telefone || prev.phone,
          cep: addr?.cep || (d as any).cep || prev.cep,
          address: addr?.street || (d as any).logradouro || prev.address,
          number: addr?.number || (d as any).numero || prev.number,
          neighborhood: addr?.neighborhood || (d as any).bairro || prev.neighborhood,
          city: addr?.city || (d as any).municipio || prev.city,
          state: addr?.state || (d as any).uf || prev.state,
          cnae: (d as any).cnae_fiscal_descricao ? `${(d as any).cnae_fiscal} - ${(d as any).cnae_fiscal_descricao}` : prev.cnae,
        }));
        toast("Dados do CNPJ preenchidos automaticamente!", "success");
      } else {
        toast(res?.error || "CNPJ não encontrado na consulta automática.", "error");
      }

    } catch (err) {
      console.error(err);
      toast("Erro ao consultar CNPJ.", "error");
    } finally {
      setCnpjLoading(false);
    }
  };

  // Buscar CEP via ViaCEP
  const handleCepLookup = async () => {
    const cleanCep = company.cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;

    setCepLoading(true);
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await resp.json();
      if (!data.erro) {
        setCompany((prev) => ({
          ...prev,
          address: data.logradouro || prev.address,
          neighborhood: data.bairro || prev.neighborhood,
          city: data.localidade || prev.city,
          state: data.uf || prev.state,
        }));
        toast("Endereço preenchido via CEP!", "success");
      }
    } catch (e) {
      console.error("Erro busca CEP:", e);
    } finally {
      setCepLoading(false);
    }
  };

  // Preencher Dados Demonstrativos Rápidos
  const handleFillDemoData = () => {
    setCompany(DEFAULT_COMPANY_DATA);
    toast("Dados demonstrativos carregados no formulário.", "info");
  };

  // Salvar Dados da Empresa
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!company.corporateName.trim()) {
      toast("Preencha a Razão Social da empresa.", "warning");
      return;
    }
    if (!company.tradeName.trim()) {
      toast("Preencha o Nome Fantasia da empresa.", "warning");
      return;
    }

    setSaving(true);
    try {
      // 1. Salvar no localStorage localmente
      localStorage.setItem("company_params", JSON.stringify(company));

      // 2. Tentar persistir o perfil tributário no servidor (se logado como admin)
      try {
        await saveCompanyTaxProfile({
          regime: company.fiscalRegime,
          rate: Number(company.taxRate),
        });
      } catch (err) {
        console.warn("Aviso ao salvar perfil tributário no BD:", err);
      }

      // 3. Disparar evento global para atualizar a UI em tempo real
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("company-updated"));
      }

      toast("Informações da Empresa salvas com sucesso!", "success");

      if (isFloating && onClose) {
        setTimeout(onClose, 600);
      }
    } catch (err: any) {
      console.error("Erro ao salvar dados da empresa:", err);
      toast("Erro ao salvar informações da empresa.", "error");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!isFloating || !isOpen || !onClose) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFloating, isOpen, onClose]);

  if (isFloating && !isOpen) return null;

  const content = (
    <div className="flex flex-col h-full flex-1 min-h-0 overflow-hidden text-zinc-900 dark:text-zinc-100 font-sans">

      {/* Header Superior */}
      <div className="relative p-6 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-t-3xl border-b border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-xl overflow-hidden shrink-0">
            {company.logoUrl ? (
              <img src={company.logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
            ) : (
              <Building2 className="w-7 h-7 text-cyan-300" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-white">
                {company.tradeName || "Dados da Empresa"}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Ativa & Verificada
              </span>
            </div>
            <p className="text-xs text-blue-200/80 mt-0.5">
              {company.corporateName || "Cadastre e personalize a identidade da sua empresa no Nexus ERP"}
            </p>
          </div>
        </div>

        {/* Botões Superiores */}
        <div className="flex items-center gap-2 self-end md:self-auto">
          <button
            type="button"
            onClick={handleFillDemoData}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-md border border-white/15 transition-all flex items-center gap-1.5"
            title="Preencher dados de demonstração"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Dados Demo</span>
          </button>

          {isFloating && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Navegação por Abas Internas */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/60 px-6 pt-3 gap-2 overflow-x-auto shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab("geral")}
          className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === "geral"
              ? "border-primary text-primary dark:text-cyan-400"
              : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Identificação & Logo</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("contato")}
          className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === "contato"
              ? "border-primary text-primary dark:text-cyan-400"
              : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>Contato & Endereço</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("fiscal")}
          className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === "fiscal"
              ? "border-primary text-primary dark:text-cyan-400"
              : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Regime Tributário & Impostos</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("documentos")}
          className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === "documentos"
              ? "border-primary text-primary dark:text-cyan-400"
              : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Orçamentos & PDFs</span>
        </button>
      </div>

      {/* Formulário Principal */}
      <form onSubmit={handleSave} className="flex flex-col min-h-0 flex-1 overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* ABA 1: IDENTIFICAÇÃO E LOGO */}
          {activeTab === "geral" && (

          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Box da Logotipo */}
              <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/50 dark:bg-zinc-950/40 text-center relative group">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-3">
                  Logotipo Oficial da Empresa
                </span>

                {company.logoUrl ? (
                  <div className="relative w-36 h-36 mb-4 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden bg-white dark:bg-zinc-900 p-2 flex items-center justify-center shadow-sm">
                    <img src={company.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="absolute inset-0 bg-red-950/80 text-white opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer rounded-2xl text-xs font-bold"
                    >
                      <Trash2 className="w-5 h-5 text-red-300" />
                      <span>Remover Logo</span>
                    </button>
                  </div>
                ) : (
                  <div className="w-36 h-36 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-500 font-semibold text-xs mb-4 gap-2">
                    <Building2 className="w-10 h-10 stroke-1 opacity-60" />
                    <span>[ SEM LOGOTIPO ]</span>
                  </div>
                )}

                <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white font-bold text-xs rounded-xl shadow-md transition-all">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{company.logoUrl ? "Alterar Logotipo" : "Upload da Imagem"}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                </label>
                <span className="text-[10px] text-zinc-400 mt-2">Suporta PNG, JPG ou WEBP (máx. 3MB)</span>
              </div>

              {/* Campos Principais */}
              <div className="md:col-span-2 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                      Razão Social *
                    </label>
                    <input
                      type="text"
                      required
                      value={company.corporateName}
                      onChange={(e) => setCompany({ ...company, corporateName: e.target.value })}
                      placeholder="Razão Social da empresa"
                      className="w-full text-xs p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                      Nome Fantasia (Nome Comercial) *
                    </label>
                    <input
                      type="text"
                      required
                      value={company.tradeName}
                      onChange={(e) => setCompany({ ...company, tradeName: e.target.value })}
                      placeholder="Nome Fantasia exibido nos orçamentos"
                      className="w-full text-xs p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div className="md:col-span-1">
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">CNPJ *</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        value={company.cnpj}
                        onChange={(e) => setCompany({ ...company, cnpj: e.target.value })}
                        placeholder="00.000.000/0001-00"
                        className="w-full text-xs p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleCnpjLookup}
                        disabled={cnpjLoading}
                        className="px-3 py-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-bold rounded-xl transition-all flex items-center justify-center shrink-0 cursor-pointer"
                        title="Buscar dados do CNPJ na Receita Federal"
                      >
                        {cnpjLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        ) : (
                          <Search className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                      Inscrição Estadual (IE)
                    </label>
                    <input
                      type="text"
                      value={company.stateRegistration}
                      onChange={(e) => setCompany({ ...company, stateRegistration: e.target.value })}
                      placeholder="Número ou ISENTO"
                      className="w-full text-xs p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                      Inscrição Municipal (IM)
                    </label>
                    <input
                      type="text"
                      value={company.municipalRegistration}
                      onChange={(e) => setCompany({ ...company, municipalRegistration: e.target.value })}
                      placeholder="Número da IM"
                      className="w-full text-xs p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                      Data de Fundação / Abertura
                    </label>
                    <input
                      type="date"
                      value={company.foundationDate || ""}
                      onChange={(e) => setCompany({ ...company, foundationDate: e.target.value })}
                      className="w-full text-xs p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                      CNAE Principal
                    </label>
                    <input
                      type="text"
                      value={company.cnae || ""}
                      onChange={(e) => setCompany({ ...company, cnae: e.target.value })}
                      placeholder="Código CNAE e Atividade"
                      className="w-full text-xs p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ABA 2: CONTATO E ENDEREÇO */}
        {activeTab === "contato" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  E-mail Corporativo *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-3.5 text-zinc-400" />
                  <input
                    type="email"
                    required
                    value={company.email}
                    onChange={(e) => setCompany({ ...company, email: e.target.value })}
                    placeholder="contato@empresa.com.br"
                    className="w-full text-xs pl-9 p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Telefone Comercial *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-3.5 text-zinc-400" />
                  <input
                    type="text"
                    required
                    value={company.phone}
                    onChange={(e) => setCompany({ ...company, phone: e.target.value })}
                    placeholder="(00) 0000-0000"
                    className="w-full text-xs pl-9 p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  WhatsApp de Suporte
                </label>
                <input
                  type="text"
                  value={company.whatsapp}
                  onChange={(e) => setCompany({ ...company, whatsapp: e.target.value })}
                  placeholder="(00) 90000-0000"
                  className="w-full text-xs p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Website / Portal
                </label>
                <div className="relative">
                  <Globe className="w-4 h-4 absolute left-3 top-3.5 text-zinc-400" />
                  <input
                    type="url"
                    value={company.website}
                    onChange={(e) => setCompany({ ...company, website: e.target.value })}
                    placeholder="https://empresa.com.br"
                    className="w-full text-xs pl-9 p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 space-y-4">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Endereço da Sede / Matriz
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">CEP</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={company.cep}
                      onChange={(e) => setCompany({ ...company, cep: e.target.value })}
                      onBlur={handleCepLookup}
                      placeholder="00000-000"
                      className="w-full text-xs p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleCepLookup}
                      disabled={cepLoading}
                      className="px-3 bg-zinc-100 dark:bg-zinc-800 text-xs font-bold rounded-xl hover:bg-zinc-200 transition-all flex items-center justify-center shrink-0 cursor-pointer"
                    >
                      {cepLoading ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <Search className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Logradouro / Avenida</label>
                  <input
                    type="text"
                    value={company.address}
                    onChange={(e) => setCompany({ ...company, address: e.target.value })}
                    placeholder="Ex: Avenida Paulista"
                    className="w-full text-xs p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Número</label>
                  <input
                    type="text"
                    value={company.number}
                    onChange={(e) => setCompany({ ...company, number: e.target.value })}
                    placeholder="1000"
                    className="w-full text-xs p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Bairro</label>
                  <input
                    type="text"
                    value={company.neighborhood}
                    onChange={(e) => setCompany({ ...company, neighborhood: e.target.value })}
                    placeholder="Bairro"
                    className="w-full text-xs p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Cidade</label>
                  <input
                    type="text"
                    value={company.city}
                    onChange={(e) => setCompany({ ...company, city: e.target.value })}
                    placeholder="Cidade"
                    className="w-full text-xs p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Estado (UF)</label>
                  <input
                    type="text"
                    maxLength={2}
                    value={company.state}
                    onChange={(e) => setCompany({ ...company, state: e.target.value.toUpperCase() })}
                    placeholder="SP"
                    className="w-full text-xs p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-primary outline-none uppercase"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ABA 3: REGIME TRIBUTÁRIO */}
        {activeTab === "fiscal" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Regime Tributário *
                </label>
                <select
                  value={company.fiscalRegime}
                  onChange={(e) => {
                    const regime = normalizeTaxRegime(e.target.value);
                    setCompany({ ...company, fiscalRegime: regime, taxRate: defaultTaxRate(regime) });
                  }}
                  className="w-full text-xs p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                >
                  <option value="SIMPLES_NACIONAL">Simples Nacional (Padrão 6.0%)</option>
                  <option value="LUCRO_PRESUMIDO">Lucro Presumido (Padrão 15.0%)</option>
                  <option value="LUCRO_REAL">Lucro Real (Padrão 18.0%)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Alíquota Efetiva nas Propostas (%) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  required
                  value={company.taxRate}
                  onChange={(e) => setCompany({ ...company, taxRate: Number(e.target.value) })}
                  className="w-full text-xs p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                />
                <p className="text-[11px] text-zinc-400 mt-1">
                  Esta alíquota será utilizada no cálculo automático de margem e impostos em novos orçamentos.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ABA 4: ORÇAMENTOS E DOCUMENTOS */}
        {activeTab === "documentos" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Título de Destaque no Orçamento
                </label>
                <input
                  type="text"
                  value={company.merchanTitle}
                  onChange={(e) => setCompany({ ...company, merchanTitle: e.target.value })}
                  placeholder="Ex: AQUI É O SEU ESPAÇO!"
                  className="w-full text-xs p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Slogan / Subtítulo no PDF
                </label>
                <input
                  type="text"
                  value={company.merchanDesc}
                  onChange={(e) => setCompany({ ...company, merchanDesc: e.target.value })}
                  placeholder="Ex: Soluções inteligentes para seu negócio"
                  className="w-full text-xs p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                Diferenciais da Empresa (Um por linha)
              </label>
              <textarea
                rows={4}
                value={company.differentials}
                onChange={(e) => setCompany({ ...company, differentials: e.target.value })}
                placeholder="Profissionais qualificados&#10;Garantia nos serviços&#10;Atendimento 24/7"
                className="w-full text-xs p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-primary outline-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Termos Padrão / Condições Globais
                </label>
                <textarea
                  rows={3}
                  value={company.terms}
                  onChange={(e) => setCompany({ ...company, terms: e.target.value })}
                  placeholder="Instruções de pagamento e garantia padrão"
                  className="w-full text-xs p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Responsável Técnico / Diretor (Assinatura PDF)
                </label>
                <input
                  type="text"
                  value={company.technicalResponsible}
                  onChange={(e) => setCompany({ ...company, technicalResponsible: e.target.value })}
                  placeholder="Nome, cargo e registro profissional"
                  className="w-full text-xs p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
            </div>
          </div>
        )}
        </div>

        {/* Rodapé Fixo com Botão de Salvar */}
        <div className="p-4 sm:px-6 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <span className="text-xs text-zinc-400">
            Nexus ERP · Atualização Instantânea de Identidade
          </span>

          <div className="flex items-center gap-3">
            {isFloating && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all cursor-pointer"
              >
                Cancelar
              </button>
            )}

            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-xs shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Salvar Dados da Empresa</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );

  if (isFloating) {
    return (
      <div
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-4xl h-[85vh] max-h-[85vh] flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 my-auto shrink-0"
        >
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-xl overflow-hidden">
      {content}
    </div>
  );
}

