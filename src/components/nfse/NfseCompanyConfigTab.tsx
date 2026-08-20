"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { getCompanyFiscalConfigAction, saveCompanyFiscalConfigAction, saveCertificatePfxAction } from "@/app/actions/nfseActions";
import { ShieldCheck, Key, Upload, CheckCircle2, AlertCircle, Building, HardDrive, RefreshCw } from "lucide-react";

export default function NfseCompanyConfigTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [certUploading, setCertUploading] = useState(false);

  const [fiscalForm, setFiscalForm] = useState({
    cnpj: "12.345.678/0001-99",
    im: "123456",
    corporateName: "NEXUS CLIMATIZACAO E SERVICOS LTDA",
    tradeName: "Nexus Ar Condicionado",
    crt: "SIMPLES_NACIONAL",
    cLocEmi: "3301702",
    dpsSeries: "1",
    environment: "homologation",
    defaultCTribNac: "140101",
    defaultCTribMun: "1401",
    defaultNbs: "104011000",
    issRate: 5.0,
    issRetido: false,
  });

  const [certSummary, setCertSummary] = useState<{
    isConfigured: boolean;
    subject: string;
    validTo: string | null;
    isExpired: boolean;
  }>({
    isConfigured: false,
    subject: "Carregando...",
    validTo: null,
    isExpired: false,
  });

  const [pfxFile, setPfxFile] = useState<File | null>(null);
  const [pfxPassphrase, setPfxPassphrase] = useState("");

  const loadConfig = async () => {
    setLoading(true);
    try {
      const res = await getCompanyFiscalConfigAction();
      if (res.success) {
        setFiscalForm((prev) => ({ ...prev, ...res.config }));
        setCertSummary(res.certSummary);
      } else {
        toast(res.error || "Erro ao carregar parâmetros fiscais.", "error");
      }
    } catch {
      toast("Erro de conexão ao buscar parâmetros fiscais.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadConfig();
  }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await saveCompanyFiscalConfigAction(fiscalForm);
      if (res.success) {
        toast("Parâmetros Fiscais da NFS-e salvos com sucesso!", "success");
      } else {
        toast(res.error || "Erro ao salvar parâmetros.", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  const handlePfxUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pfxFile) {
      toast("Selecione um arquivo de Certificado Digital .pfx ou .p12", "warning");
      return;
    }

    setCertUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        const res = await saveCertificatePfxAction(base64, pfxPassphrase);
        if (res.success) {
          toast(`Certificado A1 gravado com sucesso! Válido até ${res.validTo}`, "success");
          setPfxFile(null);
          setPfxPassphrase("");
          void loadConfig();
        } else {
          toast(res.error || "Não foi possível validar o Certificado PFX.", "error");
        }
        setCertUploading(false);
      };
      reader.onerror = () => {
        toast("Erro ao ler o arquivo PFX.", "error");
        setCertUploading(false);
      };
      reader.readAsDataURL(pfxFile);
    } catch {
      toast("Erro ao processar o certificado.", "error");
      setCertUploading(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-xs text-zinc-400">Carregando parâmetros fiscais...</div>;
  }

  return (
    <div className="space-y-8 max-w-4xl text-xs text-zinc-900 dark:text-zinc-100">
      {/* Banner Superior de Status */}
      <div className="rounded-2xl border border-blue-900/30 bg-blue-950/20 p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck size={24} className="text-blue-400 shrink-0" />
          <div>
            <h4 className="text-sm font-bold text-white">Módulo Fiscal NFS-e — Duque de Caxias / RJ (Padrão Nacional v1.01)</h4>
            <p className="text-xs text-zinc-400">Integração oficial direta via WebService SOAP/XML com certificado digital ICP-Brasil A1.</p>
          </div>
        </div>
        <span className="rounded-xl bg-amber-500/20 border border-amber-400/30 px-3 py-1.5 font-mono text-amber-300 font-bold uppercase">
          {fiscalForm.environment === "homologation" ? "Ambiente de Homologação" : "Ambiente de Produção"}
        </span>
      </div>

      {/* Card de Certificado Digital A1 */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4">
        <h4 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
          <Key size={18} className="text-amber-400" />
          Certificado Digital ICP-Brasil A1 (.pfx / .p12)
        </h4>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="font-bold text-white text-xs">{certSummary.subject}</p>
            {certSummary.validTo && (
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Validade: <strong className="text-emerald-400 font-mono">{certSummary.validTo}</strong>
              </p>
            )}
          </div>
          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${certSummary.isConfigured && !certSummary.isExpired ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-rose-500/20 text-rose-300 border border-rose-500/30"}`}>
            {certSummary.isConfigured ? (certSummary.isExpired ? "Certificado Expirado" : "A1 Configurado & Ativo") : "Certificado Pendente"}
          </span>
        </div>

        <form onSubmit={handlePfxUpload} className="space-y-4 pt-2 border-t border-zinc-800">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1">Selecione o arquivo .pfx / .p12:</label>
              <input
                type="file"
                accept=".pfx,.p12"
                onChange={(e) => setPfxFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-zinc-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer"
              />
            </div>
            <Input
              label="Senha do Certificado PFX"
              type="password"
              value={pfxPassphrase}
              onChange={(e) => setPfxPassphrase(e.target.value)}
              placeholder="Digite a senha..."
            />
          </div>
          <Button variant="secondary" type="submit" loading={certUploading} className="border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20">
            <Upload size={14} /> Carregar e Validar Certificado A1
          </Button>
        </form>
      </div>

      {/* Formulário de Parâmetros Fiscais da Empresa */}
      <form onSubmit={handleSaveConfig} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-6">
        <h4 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
          <Building size={18} className="text-blue-400" />
          Parâmetros Fiscais da Empresa Emissora
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            label="Inscrição Municipal (Duque de Caxias)"
            value={fiscalForm.im}
            onChange={(e) => setFiscalForm((prev) => ({ ...prev, im: e.target.value }))}
          />
          <Input
            label="Série Padrão da DPS"
            value={fiscalForm.dpsSeries}
            onChange={(e) => setFiscalForm((prev) => ({ ...prev, dpsSeries: e.target.value }))}
          />
          <Select
            label="Ambiente Fiscal"
            value={fiscalForm.environment}
            onChange={(e) => setFiscalForm((prev) => ({ ...prev, environment: e.target.value }))}
            options={[
              { value: "homologation", label: "Homologação (Testes)" },
              { value: "production", label: "Produção (Oficial)" },
            ]}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            label="Código Tributação Nacional (cTribNac)"
            value={fiscalForm.defaultCTribNac}
            onChange={(e) => setFiscalForm((prev) => ({ ...prev, defaultCTribNac: e.target.value }))}
            placeholder="Ex: 140101"
          />
          <Input
            label="Código Tributação Municipal (cTribMun)"
            value={fiscalForm.defaultCTribMun}
            onChange={(e) => setFiscalForm((prev) => ({ ...prev, defaultCTribMun: e.target.value }))}
            placeholder="Ex: 1401"
          />
          <Input
            label="Código NBS v2 Padrão"
            value={fiscalForm.defaultNbs}
            onChange={(e) => setFiscalForm((prev) => ({ ...prev, defaultNbs: e.target.value }))}
            placeholder="Ex: 104011000"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Alíquota Padrão do ISSQN (%)"
            type="number"
            step="0.1"
            value={fiscalForm.issRate}
            onChange={(e) => setFiscalForm((prev) => ({ ...prev, issRate: parseFloat(e.target.value) || 0 }))}
          />
          <Select
            label="Regime Tributário (CRT)"
            value={fiscalForm.crt}
            onChange={(e) => setFiscalForm((prev) => ({ ...prev, crt: e.target.value as any }))}
            options={[
              { value: "SIMPLES_NACIONAL", label: "Simples Nacional" },
              { value: "MEI", label: "Microempreendedor Individual (MEI)" },
              { value: "REGIME_NORMAL", label: "Regime Normal (Lucro Presumido/Real)" },
            ]}
          />
        </div>

        <div className="pt-4 border-t border-zinc-800">
          <Button variant="primary" type="submit" loading={saving}>
            <CheckCircle2 size={15} /> Salvar Parâmetros Fiscais
          </Button>
        </div>
      </form>
    </div>
  );
}
