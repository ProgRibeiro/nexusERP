"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getAuditLogs, AuditLogDTO } from "@/app/actions/auditActions";
import { formatDateTime } from "@/lib/utils";
import {
  Settings,
  Shield,
  History,
  Lock,
  User,
  Clock,
  Eye,
  Sliders,
  DollarSign,
  Percent,
  Search,
  CheckCircle,
  XCircle,
  FileText,
  AlertTriangle,
  Loader2,
} from "lucide-react";

export default function ConfiguracoesPage() {
  const { user: currentUser, hasPermission } = useAuth();

  const [activeTab, setActiveTab] = useState<"system" | "matrix" | "audit">("system");
  const [auditLogs, setAuditLogs] = useState<AuditLogDTO[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Estados dos parâmetros (Simulado localmente)
  const [sysParams, setSysParams] = useState({
    issRate: 5.0,
    laborRate: 150.00,
    minMargin: 35.0,
    notifyLowStock: true,
  });

  const [savingParams, setSavingParams] = useState(false);

  // Carregar dados de auditoria
  async function loadLogs() {
    setLoading(true);
    const logs = await getAuditLogs();
    setAuditLogs(logs);
    setLoading(false);
  }

  useEffect(() => {
    loadLogs();
  }, []);

  const handleSaveParams = (e: React.FormEvent) => {
    e.preventDefault();
    setSavingParams(true);
    setTimeout(() => {
      setSavingParams(false);
      alert("Parâmetros do sistema salvos com sucesso!");
    }, 600);
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case "CRIACAO":
        return "bg-emerald-50 text-emerald-600 border border-emerald-100";
      case "EDICAO":
        return "bg-blue-50 text-blue-600 border border-blue-100";
      case "EXCLUSAO":
        return "bg-red-50 text-red-600 border border-red-100";
      case "APROVACAO":
        return "bg-purple-50 text-purple-600 border border-purple-100 font-bold";
      case "CANCELAMENTO":
        return "bg-orange-50 text-orange-600 border border-orange-100";
      default:
        return "bg-zinc-100 text-zinc-600 border border-zinc-200";
    }
  };

  // Matriz de permissões explicativa
  const permissionMatrix = [
    {
      module: "CRM (Leads e Funil)",
      Admin: true,
      Gestor: true,
      Faturamento: false,
      Financeiro: false,
      Tecnico: false,
    },
    {
      module: "Clientes & Equipamentos",
      Admin: true,
      Gestor: true,
      Faturamento: false,
      Financeiro: false,
      Tecnico: true, // apenas leitura do prontuário
    },
    {
      module: "Orçamentos (Emissão/Margem)",
      Admin: true,
      Gestor: true,
      Faturamento: false,
      Financeiro: false,
      Tecnico: false,
    },
    {
      module: "Ordens de Serviço (Agendamento)",
      Admin: true,
      Gestor: true,
      Faturamento: false,
      Financeiro: false,
      Tecnico: false,
    },
    {
      module: "Execução Técnica de Campo",
      Admin: true,
      Gestor: false,
      Faturamento: false,
      Financeiro: false,
      Tecnico: true,
    },
    {
      module: "Faturamento (NF/Boletos)",
      Admin: true,
      Gestor: false,
      Faturamento: true,
      Financeiro: true,
      Tecnico: false,
    },
    {
      module: "Contas a Receber/Pagar (Baixas)",
      Admin: true,
      Gestor: false,
      Faturamento: false,
      Financeiro: true,
      Tecnico: false,
    },
    {
      module: "Estoque & Almoxarifado",
      Admin: true,
      Gestor: true,
      Faturamento: false,
      Financeiro: false,
      Tecnico: true, // apenas uso de peças na OS
    },
    {
      module: "Contratos Recorrentes",
      Admin: true,
      Gestor: true,
      Faturamento: false,
      Financeiro: false,
      Tecnico: false,
    },
  ];

  // Filtrar logs de auditoria
  const filteredLogs = auditLogs.filter(
    (log) =>
      log.userName.toLowerCase().includes(search.toLowerCase()) ||
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.entity.toLowerCase().includes(search.toLowerCase()) ||
      log.changesJson.toLowerCase().includes(search.toLowerCase())
  );

  // Prettify Changes JSON
  const formatChanges = (jsonStr: string) => {
    try {
      const obj = JSON.parse(jsonStr);
      return Object.entries(obj)
        .map(([key, val]) => {
          if (typeof val === "object") return null;
          return `${key}: ${val}`;
        })
        .filter(Boolean)
        .join(" | ");
    } catch {
      return jsonStr;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
      {/* Header Abas */}
      <div className="border-b border-zinc-100 flex justify-between items-center px-6 bg-zinc-50/50 flex-wrap gap-2 py-2">
        <div className="flex">
          <button
            onClick={() => setActiveTab("system")}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 flex items-center gap-2 cursor-pointer transition-all ${
              activeTab === "system"
                ? "border-emerald-600 text-emerald-600"
                : "border-transparent text-zinc-400 hover:text-zinc-600"
            }`}
          >
            <Sliders size={14} /> Parâmetros de Cálculo
          </button>
          <button
            onClick={() => setActiveTab("matrix")}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 flex items-center gap-2 cursor-pointer transition-all ${
              activeTab === "matrix"
                ? "border-emerald-600 text-emerald-600"
                : "border-transparent text-zinc-400 hover:text-zinc-600"
            }`}
          >
            <Shield size={14} /> Matriz de Perfis & Acessos
          </button>
          <button
            onClick={() => setActiveTab("audit")}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 flex items-center gap-2 cursor-pointer transition-all ${
              activeTab === "audit"
                ? "border-emerald-600 text-emerald-600"
                : "border-transparent text-zinc-400 hover:text-zinc-600"
            }`}
          >
            <History size={14} /> Trilha de Auditoria Geral
          </button>
        </div>

        <div className="text-xs text-zinc-400 font-medium">
          Configuração de Parâmetros Gerais do ERP
        </div>
      </div>

      {/* Conteúdo */}
      <div className="p-6 flex-1">
        {/* ABA 1: Parâmetros */}
        {activeTab === "system" && (
          <form onSubmit={handleSaveParams} className="max-w-2xl space-y-6 text-xs font-semibold">
            <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200">
              <h4 className="font-bold text-zinc-800 text-sm mb-1 flex items-center gap-2">
                <Settings size={16} className="text-zinc-500" /> Parâmetros Operacionais e Margem
              </h4>
              <p className="text-zinc-400 font-normal">Estes coeficientes controlam as auditorias visuais de rentabilidade nos orçamentos e OS.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-zinc-500 block mb-1">Margem de Contribuição Mínima Alvo (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={sysParams.minMargin}
                    onChange={(e) => setSysParams({ ...sysParams, minMargin: parseFloat(e.target.value) || 0 })}
                    className="w-full border border-zinc-200 rounded p-2 pl-8 focus:outline-none"
                  />
                  <Percent size={14} className="absolute left-2.5 top-2.5 text-zinc-400" />
                </div>
                <span className="text-[10px] text-zinc-400 font-normal block mt-1">
                  Alertas em vermelho aparecem no orçamento se a margem calculada ficar abaixo desse limite.
                </span>
              </div>

              <div className="space-y-1">
                <label className="text-zinc-500 block mb-1">Preço Padrão da Hora Técnica Operacional (R$)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={sysParams.laborRate}
                    onChange={(e) => setSysParams({ ...sysParams, laborRate: parseFloat(e.target.value) || 0 })}
                    className="w-full border border-zinc-200 rounded p-2 pl-8 focus:outline-none"
                  />
                  <DollarSign size={14} className="absolute left-2.5 top-2.5 text-zinc-400" />
                </div>
                <span className="text-[10px] text-zinc-400 font-normal block mt-1">
                  Usado para computar o custo estimado de mão de obra alocada nas Ordens de Serviço.
                </span>
              </div>

              <div className="space-y-1">
                <label className="text-zinc-500 block mb-1">Alíquota Padrão de ISSQN Municipal (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={sysParams.issRate}
                    onChange={(e) => setSysParams({ ...sysParams, issRate: parseFloat(e.target.value) || 0 })}
                    className="w-full border border-zinc-200 rounded p-2 pl-8 focus:outline-none"
                  />
                  <Percent size={14} className="absolute left-2.5 top-2.5 text-zinc-400" />
                </div>
                <span className="text-[10px] text-zinc-400 font-normal block mt-1">
                  Percentual padrão de imposto retido sobre prestação de serviços no faturamento.
                </span>
              </div>

              <div className="space-y-1">
                <label className="text-zinc-500 block mb-1">Alertas de Reposição Crítica</label>
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    checked={sysParams.notifyLowStock}
                    onChange={(e) => setSysParams({ ...sysParams, notifyLowStock: e.target.checked })}
                    className="rounded border-zinc-300 accent-emerald-600 h-4 w-4 cursor-pointer"
                  />
                  <span className="text-zinc-600 font-medium">Notificar gestores quando saldo atingir estoque mínimo.</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-100 flex justify-end">
              <button
                type="submit"
                disabled={savingParams}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-md shadow-emerald-600/10 cursor-pointer disabled:opacity-50"
              >
                {savingParams ? "Salvando..." : "Salvar Configurações"}
              </button>
            </div>
          </form>
        )}

        {/* ABA 2: Matriz Perfis */}
        {activeTab === "matrix" && (
          <div className="space-y-4">
            <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 text-xs">
              <h4 className="font-bold text-zinc-800 text-sm mb-1 flex items-center gap-2">
                <Lock size={16} className="text-zinc-500" /> Matriz de Permissão de Acesso do ERP
              </h4>
              <p className="text-zinc-400 font-normal">Permissões de telas e ações vinculadas aos perfis simulados. Mude de perfil na barra superior para validar as restrições.</p>
            </div>

            <div className="border border-zinc-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-400 font-bold uppercase text-[9px]">
                    <th className="p-3">Módulos do ERP</th>
                    <th className="p-3 text-center">Administrador</th>
                    <th className="p-3 text-center">Gestor Comercial</th>
                    <th className="p-3 text-center">Faturamento</th>
                    <th className="p-3 text-center">Financeiro</th>
                    <th className="p-3 text-center">Técnico em Campo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 font-semibold text-zinc-700">
                  {permissionMatrix.map((row, idx) => (
                    <tr key={idx} className="hover:bg-zinc-50/20">
                      <td className="p-3 text-zinc-800 font-black">{row.module}</td>
                      <td className="p-3 text-center">
                        {row.Admin ? <CheckCircle size={15} className="text-emerald-600 mx-auto" /> : <XCircle size={15} className="text-zinc-200 mx-auto" />}
                      </td>
                      <td className="p-3 text-center">
                        {row.Gestor ? <CheckCircle size={15} className="text-emerald-600 mx-auto" /> : <XCircle size={15} className="text-zinc-200 mx-auto" />}
                      </td>
                      <td className="p-3 text-center">
                        {row.Faturamento ? <CheckCircle size={15} className="text-emerald-600 mx-auto" /> : <XCircle size={15} className="text-zinc-200 mx-auto" />}
                      </td>
                      <td className="p-3 text-center">
                        {row.Financeiro ? <CheckCircle size={15} className="text-emerald-600 mx-auto" /> : <XCircle size={15} className="text-zinc-200 mx-auto" />}
                      </td>
                      <td className="p-3 text-center">
                        {row.Tecnico ? <CheckCircle size={15} className="text-emerald-600 mx-auto" /> : <XCircle size={15} className="text-zinc-200 mx-auto" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ABA 3: Auditoria */}
        {activeTab === "audit" && (
          <div className="space-y-4 flex flex-col h-[55vh]">
            <div className="flex justify-between items-center gap-4 flex-wrap">
              <div className="relative w-72">
                <Search className="absolute left-2.5 top-2 text-zinc-400" size={14} />
                <input
                  type="text"
                  placeholder="Pesquisar logs de auditoria..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 pr-4 py-1.5 border border-zinc-200 rounded-lg text-xs focus:outline-none focus:border-emerald-500 bg-white w-full"
                />
              </div>
              <button
                onClick={loadLogs}
                className="px-3 py-1.5 border border-zinc-200 hover:bg-zinc-50 text-zinc-600 rounded-lg text-xs font-bold cursor-pointer"
              >
                Atualizar Logs
              </button>
            </div>

            <div className="border border-zinc-200 rounded-xl overflow-y-auto flex-1 text-xs">
              <table className="w-full text-left border-collapse">
                <tbody className="divide-y divide-zinc-100 font-medium">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-zinc-400 flex flex-col items-center justify-center gap-1">
                        <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
                        <span>Buscando trilha...</span>
                      </td>
                    </tr>
                  ) : filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-zinc-400 italic">Nenhum log de auditoria encontrado.</td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-zinc-50/50">
                        <td className="p-3 text-zinc-400 whitespace-nowrap">{formatDateTime(log.timestamp)}</td>
                        <td className="p-3 text-zinc-800 font-bold flex flex-col">
                          <span>{log.userName}</span>
                          <span className="text-[9px] text-zinc-400 font-normal">{log.userEmail}</span>
                        </td>
                        <td className="p-3 text-zinc-500 font-semibold">{log.roleName}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-bold ${getActionBadge(log.action)}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="p-3 text-zinc-500 font-semibold">{log.entity}</td>
                        <td className="p-3 text-zinc-600 max-w-sm truncate italic" title={log.changesJson}>
                          {formatChanges(log.changesJson)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
