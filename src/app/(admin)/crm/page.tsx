"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getCrmPipeline,
  createLead,
  moveLead,
  addCrmActivity,
  convertLeadToQuote,
  PipelineStageDTO,
  LeadDTO,
} from "@/app/actions/crmActions";
import { formatCurrency, formatPhone } from "@/lib/utils";
import {
  Plus,
  ArrowRight,
  Flame,
  CheckCircle,
  Phone,
  MessageSquare,
  Users,
  Calendar,
  AlertCircle,
  Clock,
  Eye,
  FileText,
  DollarSign,
  User,
  Activity,
  Tag,
  Loader2,
  Check,
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function CrmPage() {
  const router = useRouter();
  const { user: currentUser, users: systemUsers, hasPermission } = useAuth();

  const [pipeline, setPipeline] = useState<PipelineStageDTO[]>([]);
  const [loading, setLoading] = useState(true);

  // Modais
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadDTO | null>(null);

  // Formulário de Novo Lead
  const [newLeadForm, setNewLeadForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    value: "",
    source: "Google Search",
    ownerId: "",
    notes: "",
  });

  // Formulário de Nova Atividade
  const [newActivityForm, setNewActivityForm] = useState({
    type: "LIGACAO",
    description: "",
    date: new Date().toISOString().slice(0, 16), // Data e hora local
    done: true,
  });

  const [actionLoading, setActionLoading] = useState(false);

  // Carregar dados do pipeline
  async function loadPipeline() {
    setLoading(true);
    const data = await getCrmPipeline();
    setPipeline(data);
    setLoading(false);
  }

  useEffect(() => {
    loadPipeline();
  }, []);

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeadForm.name || !newLeadForm.phone) return;

    setActionLoading(true);
    const res = await createLead({
      name: newLeadForm.name,
      email: newLeadForm.email,
      phone: newLeadForm.phone,
      company: newLeadForm.company,
      value: parseFloat(newLeadForm.value) || 0,
      source: newLeadForm.source,
      ownerId: newLeadForm.ownerId || currentUser?.id || undefined,
      notes: newLeadForm.notes,
    });

    if (res.success) {
      setIsAddModalOpen(false);
      setNewLeadForm({
        name: "",
        email: "",
        phone: "",
        company: "",
        value: "",
        source: "Google Search",
        ownerId: "",
        notes: "",
      });
      await loadPipeline();
    } else {
      alert("Erro ao criar lead: " + res.error);
    }
    setActionLoading(false);
  };

  const handleMoveLead = async (leadId: string, stageId: string) => {
    setActionLoading(true);
    const res = await moveLead(leadId, stageId);
    if (res.success) {
      await loadPipeline();
      // Se o modal de detalhes estiver aberto e o lead for o mesmo, atualizar os detalhes
      if (selectedLead?.id === leadId) {
        const updatedLead = res.lead as any;
        setSelectedLead((prev) => prev ? { ...prev, status: updatedLead.status, pipelineStageId: stageId } : null);
      }
    } else {
      alert("Erro ao mover lead: " + res.error);
    }
    setActionLoading(false);
  };

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead || !newActivityForm.description || !currentUser) return;

    setActionLoading(true);
    const res = await addCrmActivity({
      leadId: selectedLead.id,
      userId: currentUser.id,
      type: newActivityForm.type,
      description: newActivityForm.description,
      date: new Date(newActivityForm.date),
      done: newActivityForm.done,
    });

    if (res.success) {
      // Atualizar dados localmente e no modal
      const refreshedPipeline = await getCrmPipeline();
      setPipeline(refreshedPipeline);

      // Encontrar lead atualizado
      const updated = refreshedPipeline
        .flatMap((s) => s.leads)
        .find((l) => l.id === selectedLead.id);

      if (updated) {
        setSelectedLead(updated);
      }

      setNewActivityForm({
        type: "LIGACAO",
        description: "",
        date: new Date().toISOString().slice(0, 16),
        done: true,
      });
    } else {
      alert("Erro ao salvar atividade: " + res.error);
    }
    setActionLoading(false);
  };

  const handleConvertLead = async (leadId: string) => {
    if (!currentUser) return;
    if (!confirm("Deseja converter este lead em cliente e gerar um orçamento automaticamente?")) return;

    setActionLoading(true);
    const res = await convertLeadToQuote(leadId);
    if (res.success) {
      alert("Lead convertido com sucesso! Redirecionando para a listagem de Orçamentos...");
      setIsDetailModalOpen(false);
      router.push("/orcamentos");
    } else {
      alert("Erro ao converter lead: " + res.error);
    }
    setActionLoading(false);
  };

  const openLeadDetails = (lead: LeadDTO) => {
    setSelectedLead(lead);
    setIsDetailModalOpen(true);
  };

  // Cores de coluna com base nas etapas do pipeline
  const getStageHeaderColor = (stageName: string) => {
    switch (stageName) {
      case "Novo lead":
        return "border-t-4 border-zinc-400";
      case "Contato realizado":
        return "border-t-4 border-cyan-500";
      case "Diagnóstico feito":
        return "border-t-4 border-indigo-500";
      case "Visita técnica agendada":
        return "border-t-4 border-blue-500";
      case "Orçamento em criação":
        return "border-t-4 border-amber-500";
      case "Orçamento enviado":
        return "border-t-4 border-purple-500";
      case "Negociação":
        return "border-t-4 border-orange-500";
      case "Aprovado":
        return "border-t-4 border-emerald-500 bg-emerald-50/20";
      case "Perdido":
        return "border-t-4 border-rose-500 bg-rose-50/20";
      default:
        return "border-t-4 border-zinc-200";
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "LIGACAO":
        return <Phone size={14} className="text-blue-500" />;
      case "WHATSAPP":
        return <MessageSquare size={14} className="text-emerald-500" />;
      case "REUNIAO":
        return <Users size={14} className="text-purple-500" />;
      case "VISITA":
        return <Calendar size={14} className="text-amber-500" />;
      default:
        return <FileText size={14} className="text-zinc-500" />;
    }
  };

  if (loading) {
    return (
      <div className="h-[60vh] w-full flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        <p className="text-sm font-semibold text-zinc-500">Carregando funil CRM...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Ações e Filtro de CRM */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
        <div>
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            Visão de Pipeline
          </span>
          <h2 className="text-lg font-bold text-zinc-950 mt-0.5">Funil de Leads</h2>
        </div>
        {hasPermission("crm.write") && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold shadow-md shadow-emerald-600/10 transition-all cursor-pointer"
          >
            <Plus size={16} /> Novo Lead
          </button>
        )}
      </div>

      {/* Grid de Colunas (Kanban) */}
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin select-none">
        {pipeline.map((stage) => (
          <div
            key={stage.id}
            className={`w-72 shrink-0 bg-zinc-100/70 p-3 rounded-2xl border border-zinc-200 flex flex-col max-h-[70vh] ${getStageHeaderColor(
              stage.name
            )}`}
          >
            {/* Título da coluna */}
            <div className="flex justify-between items-center mb-3 px-1">
              <span className="font-bold text-sm text-zinc-800 truncate">{stage.name}</span>
              <span className="text-xs bg-zinc-200 text-zinc-500 font-bold px-2.5 py-0.5 rounded-full">
                {stage.leads.length}
              </span>
            </div>

            {/* Lista de Cards de Leads */}
            <div className="flex-1 overflow-y-auto space-y-3 min-h-[250px] pr-1">
              {stage.leads.length === 0 ? (
                <div className="border border-dashed border-zinc-300 rounded-xl py-8 text-center text-zinc-400 text-xs">
                  Sem leads nesta etapa
                </div>
              ) : (
                stage.leads.map((lead) => {
                  const pendingFollowUps = lead.activities.filter((a) => !a.done).length;

                  return (
                    <div
                      key={lead.id}
                      className="bg-white p-3.5 rounded-xl border border-zinc-200 shadow-sm hover:border-zinc-300 transition-all cursor-pointer group relative flex flex-col justify-between min-h-[130px]"
                      onClick={() => openLeadDetails(lead)}
                    >
                      <div>
                        <div className="flex justify-between items-start gap-1">
                          <span className="font-bold text-sm text-zinc-800 group-hover:text-emerald-600 transition-all truncate">
                            {lead.name}
                          </span>
                        </div>
                        {lead.company && (
                          <p className="text-xs text-zinc-400 font-medium truncate mt-0.5">
                            {lead.company}
                          </p>
                        )}
                        <p className="font-bold text-sm text-zinc-700 mt-2">
                          {formatCurrency(lead.value)}
                        </p>
                      </div>

                      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-zinc-100">
                        {/* Indicadores rápidos */}
                        <div className="flex gap-2">
                          {lead.source && (
                            <span
                              className="text-[9px] font-semibold bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded flex items-center gap-1"
                              title={`Origem: ${lead.source}`}
                            >
                              <Tag size={8} /> {lead.source.slice(0, 10)}
                            </span>
                          )}
                          {pendingFollowUps > 0 && (
                            <span
                              className="text-[9px] font-bold bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded flex items-center gap-1 animate-pulse"
                              title={`${pendingFollowUps} follow-ups planejados`}
                            >
                              <Clock size={8} /> {pendingFollowUps}
                            </span>
                          )}
                        </div>

                        {/* Movimentador rápido de coluna (evita arrastar em mobile) */}
                        <select
                          onClick={(e) => e.stopPropagation()} // impede abrir detalhes
                          onChange={(e) => handleMoveLead(lead.id, e.target.value)}
                          value={stage.id}
                          className="text-[10px] border border-zinc-200 rounded px-1.5 py-0.5 text-zinc-500 bg-white font-medium hover:border-zinc-300 focus:outline-none"
                        >
                          {pipeline.map((s) => (
                            <option key={s.id} value={s.id}>
                              Mover para... {s.name.slice(0, 12)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>

      {/* MODAL 1: Novo Lead */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-zinc-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-zinc-200 shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="font-bold text-zinc-800 text-base">Cadastrar Novo Lead</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-500 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">
                    Nome Completo do Lead *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Carlos Oliveira"
                    value={newLeadForm.name}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, name: e.target.value })}
                    className="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">
                    Telefone/WhatsApp *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: (11) 98888-7777"
                    value={newLeadForm.phone}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, phone: e.target.value })}
                    className="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">
                    E-mail
                  </label>
                  <input
                    type="email"
                    placeholder="carlos@exemplo.com"
                    value={newLeadForm.email}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, email: e.target.value })}
                    className="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">
                    Empresa / Condomínio
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Edifício Splendor"
                    value={newLeadForm.company}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, company: e.target.value })}
                    className="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">
                    Valor Estimado (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Ex: 1200.00"
                    value={newLeadForm.value}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, value: e.target.value })}
                    className="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">
                    Origem do Lead
                  </label>
                  <select
                    value={newLeadForm.source}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, source: e.target.value })}
                    className="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="Google Search">Busca do Google</option>
                    <option value="Google Ads">Google Ads</option>
                    <option value="Indicação">Indicação de Cliente</option>
                    <option value="Site/Contato">Formulário do Site</option>
                    <option value="Instagram">Instagram/Redes Sociais</option>
                    <option value="WhatsApp">Contato WhatsApp</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">
                    Responsável Comercial
                  </label>
                  <select
                    value={newLeadForm.ownerId}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, ownerId: e.target.value })}
                    className="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">Atribuir a mim mesmo</option>
                    {systemUsers
                      .filter((u) => u.roleName === "Comercial" || u.roleName === "Administrador")
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-500 block mb-1">
                  Observações de Interesse / Escopo
                </label>
                <textarea
                  rows={3}
                  placeholder="Cliente reclama que o ar condicionado do quarto faz muito barulho..."
                  value={newLeadForm.notes}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, notes: e.target.value })}
                  className="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-zinc-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-zinc-200 text-zinc-500 text-sm font-semibold rounded-lg hover:bg-zinc-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {actionLoading && <Loader2 size={14} className="animate-spin" />}
                  Salvar Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Detalhes do Lead & Follow-ups */}
      {isDetailModalOpen && selectedLead && (
        <div className="fixed inset-0 bg-zinc-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full border border-zinc-200 shadow-xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-zinc-200 text-zinc-600 px-2 py-0.5 rounded-full">
                  Status: {selectedLead.status}
                </span>
                <h3 className="font-bold text-zinc-800 text-lg mt-1">{selectedLead.name}</h3>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-500 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Conteúdo */}
            <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Informações Gerais */}
              <div className="space-y-4">
                <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200/60 space-y-2.5 text-sm">
                  <h4 className="font-bold text-zinc-800 flex items-center gap-1.5">
                    <User size={16} className="text-zinc-500" /> Detalhes do Lead
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <span className="text-zinc-400">Telefone:</span>
                    <span className="font-medium text-zinc-800">
                      {formatPhone(selectedLead.phone)}
                    </span>

                    <span className="text-zinc-400">E-mail:</span>
                    <span className="font-medium text-zinc-800 truncate">
                      {selectedLead.email || "-"}
                    </span>

                    <span className="text-zinc-400">Empresa:</span>
                    <span className="font-medium text-zinc-800">
                      {selectedLead.company || "-"}
                    </span>

                    <span className="text-zinc-400">Valor Estimado:</span>
                    <span className="font-bold text-emerald-600">
                      {formatCurrency(selectedLead.value)}
                    </span>

                    <span className="text-zinc-400">Origem:</span>
                    <span className="font-medium text-zinc-800">{selectedLead.source || "-"}</span>

                    <span className="text-zinc-400">Responsável:</span>
                    <span className="font-medium text-zinc-800">
                      {selectedLead.ownerName || "Não atribuído"}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <h4 className="font-bold text-xs text-zinc-400 uppercase tracking-wider">
                    Observações de Interesse
                  </h4>
                  <p className="text-sm bg-zinc-50 p-3 rounded-lg border border-zinc-100 text-zinc-700 min-h-[60px] whitespace-pre-line">
                    {selectedLead.notes || "Nenhuma observação cadastrada."}
                  </p>
                </div>

                {/* Conversão em Orçamento */}
                {selectedLead.status !== "CONVERTIDO" && hasPermission("quotes.write") && (
                  <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 flex flex-col gap-2.5">
                    <p className="text-xs font-semibold text-emerald-800 flex items-center gap-1">
                      <CheckCircle size={14} /> Qualificação e Conversão
                    </p>
                    <p className="text-xs text-emerald-600 leading-relaxed">
                      O lead demonstrou interesse real e aceitou receber uma proposta comercial? Transforme-o em cliente e crie o orçamento inicial automaticamente.
                    </p>
                    <button
                      onClick={() => handleConvertLead(selectedLead.id)}
                      disabled={actionLoading}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-md shadow-emerald-600/10 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {actionLoading ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <FileText size={14} />
                      )}
                      Gerar Proposta Comercial
                    </button>
                  </div>
                )}
              </div>

              {/* Registro de Atividades e Histórico */}
              <div className="space-y-4 border-l border-zinc-100 pl-0 md:pl-6">
                <h4 className="font-bold text-zinc-800 flex items-center gap-1.5 text-sm">
                  <Activity size={16} className="text-zinc-500" /> Relacionamento & Atividades
                </h4>

                {/* Formulário para registrar atividade */}
                <form onSubmit={handleAddActivity} className="p-3 bg-zinc-50 rounded-xl border border-zinc-200/80 space-y-3">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase">
                        Tipo de Contato
                      </label>
                      <select
                        value={newActivityForm.type}
                        onChange={(e) =>
                          setNewActivityForm({ ...newActivityForm, type: e.target.value })
                        }
                        className="w-full border border-zinc-200 rounded p-1 text-xs bg-white focus:outline-none"
                      >
                        <option value="LIGACAO">Ligação Telefônica</option>
                        <option value="WHATSAPP">WhatsApp</option>
                        <option value="REUNIAO">Reunião Presencial</option>
                        <option value="VISITA">Visita de Diagnóstico</option>
                        <option value="NOTA">Nota Interna</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase">
                        Data e Hora
                      </label>
                      <input
                        type="datetime-local"
                        value={newActivityForm.date}
                        onChange={(e) =>
                          setNewActivityForm({ ...newActivityForm, date: e.target.value })
                        }
                        className="w-full border border-zinc-200 rounded p-1 text-xs bg-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase">
                      Descrição do que foi tratado
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Liguei, mas chamou e caiu na caixa..."
                      value={newActivityForm.description}
                      onChange={(e) =>
                        setNewActivityForm({ ...newActivityForm, description: e.target.value })
                      }
                      className="w-full border border-zinc-200 rounded p-1.5 text-xs bg-white focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={newActivityForm.done}
                        onChange={(e) =>
                          setNewActivityForm({ ...newActivityForm, done: e.target.checked })
                        }
                        className="rounded border-zinc-300 accent-emerald-600"
                      />
                      Já realizado (histórico)
                    </label>
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="px-3 py-1 bg-zinc-950 text-white rounded font-bold text-xs hover:bg-zinc-800 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      {actionLoading && <Loader2 size={10} className="animate-spin" />}
                      Salvar
                    </button>
                  </div>
                </form>

                {/* Linha do Tempo de Atividades */}
                <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                    Histórico de contatos realizados:
                  </p>
                  {selectedLead.activities.length === 0 ? (
                    <p className="text-xs text-zinc-400 italic">Nenhum contato registrado ainda.</p>
                  ) : (
                    selectedLead.activities.map((act) => (
                      <div
                        key={act.id}
                        className={`p-2.5 rounded-lg border text-xs relative flex items-start gap-2.5 ${
                          act.done
                            ? "bg-zinc-50 border-zinc-200 text-zinc-600"
                            : "bg-amber-50/40 border-amber-200 text-amber-800"
                        }`}
                      >
                        <div className="mt-0.5">{getActivityIcon(act.type)}</div>
                        <div className="flex-1">
                          <div className="flex justify-between font-bold text-[10px] text-zinc-400 mb-0.5">
                            <span>{act.type}</span>
                            <span>{new Date(act.date).toLocaleDateString("pt-BR")}</span>
                          </div>
                          <p className="text-zinc-700 leading-normal">{act.description}</p>
                          {!act.done && (
                            <span className="inline-block mt-1 text-[9px] font-bold text-amber-600 uppercase tracking-wider">
                              ⚠️ Follow-up planejado
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-zinc-100 flex justify-end bg-zinc-50">
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 bg-zinc-800 text-white hover:bg-zinc-950 font-bold rounded-lg text-xs transition-all cursor-pointer"
              >
                Fechar Detalhes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
