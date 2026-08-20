"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getDevSystemHealthAction,
  getDevLicensingAction,
  saveDevLicensingAction,
  triggerDevBackupAction,
  getDevLogsAndErrorsAction,
  getDevEnvVarsAction,
  runDevDiagnosticCheckAction,
  triggerDevServerRestartAction,
} from "@/app/actions/devActions";
import {
  Terminal,
  Activity,
  Building2,
  HardDrive,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  Plus,
  CheckCircle2,
  XCircle,
  Database,
  Users,
  FileText,
  DollarSign,
  Download,
  LogOut,
  Sliders,
  Cpu,
  Server,
} from "lucide-react";

export default function DevConsolePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"health" | "tenants" | "backups" | "logs" | "server">("health");

  const [healthData, setHealthData] = useState<any>(null);
  const [tenants, setTenants] = useState<any[]>([]);
  const [logsData, setLogsData] = useState<{ auditLogs: any[]; errorReports: any[] }>({ auditLogs: [], errorReports: [] });
  const [envVars, setEnvVars] = useState<any[]>([]);
  const [diagnosticReport, setDiagnosticReport] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Form para nova licença
  const [showTenantModal, setShowTenantModal] = useState(false);
  const [tenantForm, setTenantForm] = useState({
    cnpj: "",
    companyName: "",
    plan: "ENTERPRISE",
    maxUsers: 50,
    expiresAt: "2030-12-31",
  });

  const loadAllDevData = async () => {
    setLoading(true);
    try {
      const [healthRes, licensingRes, logsRes, envRes] = await Promise.all([
        getDevSystemHealthAction(),
        getDevLicensingAction(),
        getDevLogsAndErrorsAction(),
        getDevEnvVarsAction(),
      ]);

      if (!healthRes.success) {
        router.push("/dev/login");
        return;
      }

      setHealthData(healthRes.health);
      if (licensingRes.success) setTenants(licensingRes.tenants);
      if (logsRes.success) setLogsData({ auditLogs: logsRes.auditLogs, errorReports: logsRes.errorReports });
      if (envRes.success) setEnvVars(envRes.vars);
    } catch {
      router.push("/dev/login");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAllDevData();
  }, []);

  const handleRunDiagnostics = async () => {
    setActionLoading(true);
    try {
      const res = await runDevDiagnosticCheckAction();
      if (res.success) {
        setDiagnosticReport(res.report);
        setMessage(`Diagnóstico executado com sucesso: Ping DB em ${res.report.pingMs}ms.`);
      } else {
        setMessage(`Erro ao executar diagnóstico: ${res.error}`);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestartServer = async () => {
    const confirmation = window.prompt("Para confirmar a solicitação, digite REINICIAR_SERVIDOR");
    if (!confirmation) return;
    setActionLoading(true);
    try {
      const res = await triggerDevServerRestartAction(confirmation);
      if (res.success) {
        setMessage(res.message);
      } else {
        setMessage(`Erro ao solicitar reinício: ${res.error}`);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleTriggerBackup = async () => {
    setActionLoading(true);
    try {
      const res = await triggerDevBackupAction();
      if (res.success) {
        setMessage(`Backup instantâneo salvo com sucesso: ${res.backup?.fileName}`);
        void loadAllDevData();
      } else {
        setMessage(`Erro ao gerar backup: ${res.error}`);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const newTenant = {
        id: `tenant-${Date.now()}`,
        ...tenantForm,
        status: "ATIVO",
        createdAt: new Date().toISOString().split("T")[0],
      };
      const updated = [...tenants, newTenant];
      const res = await saveDevLicensingAction(updated);
      if (res.success) {
        setTenants(updated);
        setShowTenantModal(false);
        setTenantForm({ cnpj: "", companyName: "", plan: "ENTERPRISE", maxUsers: 50, expiresAt: "2030-12-31" });
        setMessage("Novo licenciado do ERP cadastrado com sucesso!");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const toggleTenantStatus = async (tenantId: string) => {
    const updated = tenants.map((t) => (t.id === tenantId ? { ...t, status: t.status === "ATIVO" ? "SUSPENSO" : "ATIVO" } : t));
    setTenants(updated);
    await saveDevLicensingAction(updated);
    setMessage("Status do licenciado atualizado.");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-mono text-xs">
        <div className="flex items-center gap-3">
          <RefreshCw size={18} className="animate-spin text-amber-400" />
          <span>Carregando Console do Desenvolvedor...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans select-none pb-12">
      {/* Top Console Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-50 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <Terminal size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-black tracking-tight text-white">NEXUS ERP</h1>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase">
                PLATFORM CONSOLE v23.4
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Portal de Engenharia & Multi-Tenant Management</p>
          </div>
        </div>

        {/* Telemetry quick indicators */}
        <div className="hidden lg:flex items-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <Database size={14} className="text-emerald-400" />
            <span className="text-slate-400">Latência DB:</span>
            <strong className="font-mono text-emerald-400">{healthData?.dbLatencyMs}ms</strong>
          </div>
          <div className="flex items-center gap-2">
            <Cpu size={14} className="text-blue-400" />
            <span className="text-slate-400">Ambiente:</span>
            <strong className="font-mono text-white uppercase">{healthData?.environment}</strong>
          </div>
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-800 text-slate-300 transition text-xs font-bold"
          >
            <LogOut size={13} /> Ir para o ERP
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 pt-6 space-y-6">
        {/* Flash Message */}
        {message && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-300 flex items-center justify-between">
            <span>{message}</span>
            <button onClick={() => setMessage(null)} className="text-amber-400 hover:text-white font-bold">×</button>
          </div>
        )}

        {/* Subtabs Navigation */}
        <div className="flex border-b border-slate-800 gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab("health")}
            className={`px-4 py-2.5 font-bold text-xs border-b-2 rounded-t-xl transition-all flex items-center gap-2 ${activeTab === "health" ? "border-amber-400 text-amber-400 bg-amber-400/10" : "border-transparent text-slate-400 hover:text-slate-200"}`}
          >
            <Activity size={15} /> Saúde & Telemetria
          </button>
          <button
            onClick={() => setActiveTab("tenants")}
            className={`px-4 py-2.5 font-bold text-xs border-b-2 rounded-t-xl transition-all flex items-center gap-2 ${activeTab === "tenants" ? "border-amber-400 text-amber-400 bg-amber-400/10" : "border-transparent text-slate-400 hover:text-slate-200"}`}
          >
            <Building2 size={15} /> Licenciados ERP ({tenants.length})
          </button>
          <button
            onClick={() => setActiveTab("backups")}
            className={`px-4 py-2.5 font-bold text-xs border-b-2 rounded-t-xl transition-all flex items-center gap-2 ${activeTab === "backups" ? "border-amber-400 text-amber-400 bg-amber-400/10" : "border-transparent text-slate-400 hover:text-slate-200"}`}
          >
            <HardDrive size={15} /> Central de Backups
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`px-4 py-2.5 font-bold text-xs border-b-2 rounded-t-xl transition-all flex items-center gap-2 ${activeTab === "logs" ? "border-amber-400 text-amber-400 bg-amber-400/10" : "border-transparent text-slate-400 hover:text-slate-200"}`}
          >
            <FileText size={15} /> Auditoria & Erros
          </button>
          <button
            onClick={() => setActiveTab("server")}
            className={`px-4 py-2.5 font-bold text-xs border-b-2 rounded-t-xl transition-all flex items-center gap-2 ${activeTab === "server" ? "border-amber-400 text-amber-400 bg-amber-400/10" : "border-transparent text-slate-400 hover:text-slate-200"}`}
          >
            <Server size={15} /> Controle do Servidor
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href="/dev/tenants" className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-slate-200 hover:bg-slate-800">
            Abrir módulo Tenants
          </a>
          <a href="/dev/monitoramento" className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-slate-200 hover:bg-slate-800">
            Abrir módulo Monitoramento
          </a>
          <a href="/dev/logs" className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-slate-200 hover:bg-slate-800">
            Abrir módulo Logs
          </a>
          <a href="/dev/backups" className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-slate-200 hover:bg-slate-800">
            Abrir módulo Backups
          </a>
        </div>

        {/* Tab 1: Saúde & Telemetria */}
        {activeTab === "health" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Users size={14} className="text-blue-400" /> Usuários Cadastrados
                </span>
                <p className="text-2xl font-black font-mono text-white">{healthData?.userCount}</p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 size={14} className="text-amber-400" /> Clientes na Base
                </span>
                <p className="text-2xl font-black font-mono text-white">{healthData?.clientCount}</p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText size={14} className="text-emerald-400" /> Ordens de Serviço
                </span>
                <p className="text-2xl font-black font-mono text-white">{healthData?.osCount}</p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign size={14} className="text-purple-400" /> Faturamentos & NFS-e
                </span>
                <p className="text-2xl font-black font-mono text-white">{healthData?.invoiceCount}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Activity size={18} className="text-amber-400" /> Diagnóstico de Conectividade do Banco
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 space-y-1">
                  <span className="text-slate-400">PostgreSQL Status:</span>
                  <p className="font-bold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 size={14} /> Conectado & Responsivo
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 space-y-1">
                  <span className="text-slate-400">Tempo de Resposta:</span>
                  <p className="font-mono font-bold text-amber-300">{healthData?.dbLatencyMs} milissegundos</p>
                </div>
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 space-y-1">
                  <span className="text-slate-400">Node Runtime:</span>
                  <p className="font-mono font-bold text-white">{healthData?.nodeVersion}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Licenciados ERP */}
        {activeTab === "tenants" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Empresas Licenciadas do Nexus ERP</h3>
                <p className="text-xs text-slate-400">Gerenciamento multi-tenant de clientes contratantes do sistema.</p>
              </div>
              <button
                onClick={() => setShowTenantModal(true)}
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <Plus size={15} /> Cadastrar Nova Empresa
              </button>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-4">Empresa / Razão Social</th>
                    <th className="p-4">CNPJ</th>
                    <th className="p-4">Plano</th>
                    <th className="p-4">Limite Usuários</th>
                    <th className="p-4">Expiração</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {tenants.map((tenant) => (
                    <tr key={tenant.id} className="hover:bg-slate-800/30">
                      <td className="p-4 font-bold text-white">{tenant.companyName}</td>
                      <td className="p-4 font-mono text-slate-300">{tenant.cnpj}</td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 font-mono font-bold text-[10px] border border-purple-500/30">
                          {tenant.plan}
                        </span>
                      </td>
                      <td className="p-4 font-mono">{tenant.maxUsers} usuários</td>
                      <td className="p-4 font-mono text-slate-300">{tenant.expiresAt}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] uppercase ${tenant.status === "ATIVO" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-rose-500/20 text-rose-300 border border-rose-500/30"}`}>
                          {tenant.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => toggleTenantStatus(tenant.id)}
                          className="px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold"
                        >
                          {tenant.status === "ATIVO" ? "Suspender" : "Ativar"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Backups */}
        {activeTab === "backups" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Central de Snapshots e Backups Físicos</h3>
                <p className="text-xs text-slate-400">Disparo e conferência dos arquivos .dump de segurança.</p>
              </div>
              <button
                onClick={handleTriggerBackup}
                disabled={actionLoading}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-xs flex items-center gap-2 shadow-lg transition cursor-pointer disabled:opacity-50"
              >
                <HardDrive size={15} /> {actionLoading ? "Gerando Snapshot..." : "Gerar Backup Agora"}
              </button>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Histórico de Snapshots</h4>
              <p className="text-xs text-slate-400">Os backups são armazenados na pasta isolada <code className="font-mono text-amber-300">backups/</code> do servidor com chave de integridade SHA256.</p>
            </div>
          </div>
        )}

        {/* Tab 4: Auditoria & Erros */}
        {activeTab === "logs" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText size={18} className="text-amber-400" /> Logs Recentes de Auditoria
              </h3>
              <div className="space-y-2 max-h-96 overflow-y-auto font-mono text-[11px]">
                {logsData.auditLogs.map((log) => (
                  <div key={log.id} className="p-3 rounded-xl border border-slate-800 bg-slate-950 flex items-center justify-between">
                    <div>
                      <span className="text-amber-400 font-bold">[{log.action}]</span> <span className="text-white">{log.entity} (#{log.entityId})</span>
                      <p className="text-slate-400 text-[10px] mt-0.5">Por: {log.user?.name || log.userId} · {new Date(log.timestamp || log.createdAt).toLocaleString("pt-BR")}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Controle do Servidor */}
        {activeTab === "server" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Server size={18} className="text-amber-400" /> Ações do Servidor & Processos
                  </h3>
                  <p className="text-xs text-slate-400">Gerenciamento de reinicializações e diagnósticos profundos.</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleRunDiagnostics}
                    disabled={actionLoading}
                    className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 transition"
                  >
                    <Activity size={14} /> Rodar Diagnóstico
                  </button>
                  <button
                    onClick={handleRestartServer}
                    disabled={actionLoading}
                    className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition"
                  >
                    <RefreshCw size={14} /> Solicitar Reinício
                  </button>
                </div>
              </div>

              {diagnosticReport && (
                <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-950/20 text-xs space-y-2 font-mono">
                  <span className="text-purple-300 font-bold block">Relatório do Último Diagnóstico ({diagnosticReport.timestamp}):</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-300">
                    <p>Ping DB: <strong className="text-emerald-400">{diagnosticReport.pingMs}ms</strong></p>
                    <p>Uptime: <strong className="text-amber-300">{diagnosticReport.uptimeSeconds}s</strong></p>
                    <p>Usuários: <strong>{diagnosticReport.userCount}</strong></p>
                    <p>OS Totais: <strong>{diagnosticReport.osCount}</strong></p>
                  </div>
                </div>
              )}
            </div>

            {/* Variáveis de Ambiente (.env) */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sliders size={18} className="text-blue-400" /> Variáveis de Ambiente (.env do Servidor)
              </h3>
              <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden font-mono text-xs">
                <div className="p-3 border-b border-slate-800 bg-slate-900 text-slate-400 text-[10px] font-bold uppercase tracking-wider flex justify-between">
                  <span>Chave da Variável</span>
                  <span>Valor Mascarado</span>
                </div>
                <div className="divide-y divide-slate-800/60">
                  {envVars.map((env) => (
                    <div key={env.key} className="p-3 flex items-center justify-between">
                      <span className="text-amber-400 font-bold">{env.key}</span>
                      <span className="text-slate-300 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">{env.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal Novo Licenciado */}
      {showTenantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
            <h3 className="text-sm font-bold text-white">Cadastrar Empresa Licenciada do ERP</h3>
            <form onSubmit={handleAddTenant} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">Razão Social / Nome Fantasia *</label>
                <input
                  required
                  value={tenantForm.companyName}
                  onChange={(e) => setTenantForm((prev) => ({ ...prev, companyName: e.target.value }))}
                  placeholder="Ex: Climatização Rio Ltda"
                  className="w-full p-2.5 rounded-xl border border-slate-800 bg-slate-950 text-white outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">CNPJ *</label>
                <input
                  required
                  value={tenantForm.cnpj}
                  onChange={(e) => setTenantForm((prev) => ({ ...prev, cnpj: e.target.value }))}
                  placeholder="00.000.000/0001-00"
                  className="w-full p-2.5 rounded-xl border border-slate-800 bg-slate-950 text-white outline-none focus:border-amber-400 font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Plano</label>
                  <select
                    value={tenantForm.plan}
                    onChange={(e) => setTenantForm((prev) => ({ ...prev, plan: e.target.value }))}
                    className="w-full p-2.5 rounded-xl border border-slate-800 bg-slate-950 text-white outline-none focus:border-amber-400"
                  >
                    <option value="ENTERPRISE">Enterprise</option>
                    <option value="PRO">Pro</option>
                    <option value="STANDARD">Standard</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Max Usuários</label>
                  <input
                    type="number"
                    value={tenantForm.maxUsers}
                    onChange={(e) => setTenantForm((prev) => ({ ...prev, maxUsers: parseInt(e.target.value) || 10 }))}
                    className="w-full p-2.5 rounded-xl border border-slate-800 bg-slate-950 text-white outline-none focus:border-amber-400 font-mono"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowTenantModal(false)}
                  className="px-3 py-2 rounded-xl border border-slate-800 text-slate-300 font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold"
                >
                  Salvar Licenciado
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
