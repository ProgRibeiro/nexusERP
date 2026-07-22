"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useToast } from "@/components/ui/Toast";
import {
  getCrmPipeline,
  createLead,
  moveLead,
  addCrmActivity,
  convertLeadToQuote,
  PipelineStageDTO,
  LeadDTO
} from "@/app/actions/crmActions";
import { formatCurrency, formatPhone, formatDateTime } from "@/lib/utils";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Modal } from "../ui/Modal";
import { Drawer } from "../ui/Drawer";
import { Plus, Flame, Loader2, User, ArrowLeft, ArrowRight, GripVertical } from "lucide-react";

interface CrmTabProps {
  newRecord?: boolean;
  requestId?: string;
}

export default function CrmTab({ newRecord = false, requestId }: CrmTabProps) {
  const pathname = usePathname();
  const { user: currentUser, users: systemUsers, hasPermission } = useAuth();
  const { openTab } = useWorkspace();
  const { toast } = useToast();

  const [pipeline, setPipeline] = useState<PipelineStageDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(newRecord);
  const [selectedLead, setSelectedLead] = useState<LeadDTO | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [movingLeadId, setMovingLeadId] = useState<string | null>(null);
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);

  useEffect(() => {
    if (newRecord) setIsAddOpen(true);
  }, [newRecord, requestId]);

  // Lead Form
  const [leadForm, setLeadForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    value: "",
    source: "Google Search",
    ownerId: "",
    notes: "",
  });

  // Activity Form
  const [activityForm, setActivityForm] = useState({
    type: "LIGACAO",
    description: "",
    date: new Date().toISOString().slice(0, 16),
    done: true,
  });

  async function loadPipeline() {
    setLoading(true);
    try {
      const data = await getCrmPipeline();
      setPipeline(data);
    } catch (err) {
      console.error(err);
      toast("Erro ao carregar funil de vendas", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (pathname !== "/crm") return;
    // Ao abrir uma aba, o componente pode montar antes do router concluir a
    // troca de URL. Aguardar a rota evita que o navegador aborte a Server Action.
    const timer = window.setTimeout(() => void loadPipeline(), 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadForm.name || !leadForm.phone) {
      toast("Nome e telefone são obrigatórios", "warning");
      return;
    }

    setActionLoading(true);
    try {
      const res = await createLead({
        name: leadForm.name,
        email: leadForm.email,
        phone: leadForm.phone,
        company: leadForm.company || undefined,
        value: parseFloat(leadForm.value) || 0,
        source: leadForm.source,
        ownerId: leadForm.ownerId || currentUser?.id || undefined,
        notes: leadForm.notes || undefined,
      });

      if (res.success) {
        toast("Lead cadastrado no funil!", "success");
        setIsAddOpen(false);
        setLeadForm({
          name: "",
          email: "",
          phone: "",
          company: "",
          value: "",
          source: "Google Search",
          ownerId: "",
          notes: "",
        });
        loadPipeline();
      } else {
        toast(res.error || "Erro ao criar lead", "error");
      }
    } catch (err) {
      toast("Erro de conexão", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleMoveLead = async (leadId: string, targetStageId: string) => {
    const sourceStage = pipeline.find((stage) => stage.leads.some((lead) => lead.id === leadId));
    const targetStage = pipeline.find((stage) => stage.id === targetStageId);
    if (!sourceStage || !targetStage || sourceStage.id === targetStage.id) return;

    const isBackward = targetStage.order < sourceStage.order;
    if (isBackward && !window.confirm(`Voltar esta oportunidade de "${sourceStage.name}" para "${targetStage.name}"?`)) {
      return;
    }

    setMovingLeadId(leadId);
    try {
      const res = await moveLead(leadId, targetStageId);
      if (res.success) {
        toast(isBackward ? `Oportunidade retornada para ${targetStage.name}` : `Oportunidade movida para ${targetStage.name}`, "success");
        const updatedPipeline = await getCrmPipeline();
        setPipeline(updatedPipeline);
        if (selectedLead?.id === leadId) {
          const updatedLead = updatedPipeline.flatMap((stage) => stage.leads).find((lead) => lead.id === leadId);
          if (updatedLead) setSelectedLead(updatedLead);
        }
      } else {
        toast(res.error || "Erro ao mover lead", "error");
      }
    } catch (err) {
      toast("Erro de conexão", "error");
    } finally {
      setMovingLeadId(null);
      setDraggedLeadId(null);
      setDragOverStageId(null);
    }
  };

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead || !activityForm.description) return;

    setActionLoading(true);
    try {
      const res = await addCrmActivity({
        leadId: selectedLead.id,
        userId: currentUser?.id || "",
        type: activityForm.type,
        description: activityForm.description,
        date: new Date(activityForm.date),
        done: activityForm.done,
      });

      if (res.success) {
        toast("Interação registrada com sucesso!", "success");
        setActivityForm({
          type: "LIGACAO",
          description: "",
          date: new Date().toISOString().slice(0, 16),
          done: true,
        });

        // Refresh details
        const updatedPipeline = await getCrmPipeline();
        setPipeline(updatedPipeline);

        // Update selected lead details
        for (const stage of updatedPipeline) {
          const match = stage.leads.find((l) => l.id === selectedLead.id);
          if (match) {
            setSelectedLead(match);
            break;
          }
        }
      } else {
        toast(res.error || "Erro ao registrar atividade", "error");
      }
    } catch (err) {
      toast("Erro de conexão", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleConvertToQuote = async (leadId: string) => {
    setActionLoading(true);
    try {
      const res = await convertLeadToQuote(leadId);
      if (res.success) {
        toast("Lead qualificado e convertido em Orçamento!", "success");
        setIsDetailOpen(false);
        loadPipeline();
        // Redirect to new quote
        openTab("orcamentos", "Orçamentos");
      } else {
        toast(res.error || "Erro ao converter lead", "error");
      }
    } catch (err) {
      toast("Erro de conexão", "error");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 select-none animate-in fade-in duration-200">

      {/* Action header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-bold text-sm">
          <Flame size={18} className="text-indigo-500" />
          <span>Pipeline de Negócios e Vendas</span>
        </div>
        {hasPermission("crm.write") && (
          <Button variant="primary" onClick={() => setIsAddOpen(true)}>
            <Plus size={16} /> Novo Lead / Oportunidade
          </Button>
        )}
      </div>

      {/* Kanban Board Grid */}
      {loading ? (
        <div className="py-24 text-center text-zinc-400 flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs font-semibold animate-pulse">Carregando funil comercial...</p>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory">
          {pipeline.map((stage, stageIndex) => (
            <div
              key={stage.id}
              onDragOver={(event) => {
                if (!hasPermission("crm.write")) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDragOverStageId(stage.id);
              }}
              onDragLeave={() => setDragOverStageId((current) => current === stage.id ? null : current)}
              onDrop={(event) => {
                event.preventDefault();
                const leadId = event.dataTransfer.getData("text/lead-id") || draggedLeadId;
                if (leadId) void handleMoveLead(leadId, stage.id);
              }}
              className={`bg-zinc-100/50 dark:bg-zinc-900/40 p-4 rounded-xl border min-w-[280px] w-[280px] shrink-0 snap-start flex flex-col min-h-[460px] transition-all ${dragOverStageId === stage.id ? "border-primary ring-2 ring-primary/20 bg-primary/5" : "border-zinc-200 dark:border-zinc-800/80"}`}
            >
              {/* Stage Title */}
              <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-850 pb-2 mb-3">
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{stage.name}</span>
                <span className="text-[10px] font-semibold text-zinc-400 bg-zinc-200 dark:bg-zinc-800 px-2 py-0.5 rounded-full">{stage.leads.length}</span>
              </div>

              {/* Lead Cards List */}
              <div className="flex-1 flex flex-col gap-3 max-h-[500px] overflow-y-auto scrollbar-none">
                {stage.leads.length === 0 ? (
                  <div className="flex-1 border-2 border-dashed border-zinc-200/60 dark:border-zinc-800/60 rounded-xl flex items-center justify-center p-8 text-center text-[10px] text-zinc-400">
                    Nenhum lead nesta etapa.
                  </div>
                ) : (
                  stage.leads.map((lead) => (
                    <div
                      key={lead.id}
                      draggable={hasPermission("crm.write")}
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/lead-id", lead.id);
                        event.dataTransfer.effectAllowed = "move";
                        setDraggedLeadId(lead.id);
                      }}
                      onDragEnd={() => {
                        setDraggedLeadId(null);
                        setDragOverStageId(null);
                      }}
                      onClick={() => {
                        setSelectedLead(lead);
                        setIsDetailOpen(true);
                      }}
                      className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 p-4 rounded-lg shadow-premium hover:border-primary/50 cursor-pointer transition-all flex flex-col gap-2 relative group ${draggedLeadId === lead.id ? "opacity-50 scale-95" : ""}`}
                    >
                      <div className="flex items-start gap-2 pr-12">
                        {hasPermission("crm.write") && <GripVertical size={13} className="mt-0.5 shrink-0 text-zinc-300" />}
                        <h4 className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">{lead.name}</h4>
                      </div>
                      <p className="text-[10px] text-zinc-450 dark:text-zinc-500 font-medium truncate">{lead.company || "Pessoa Física"}</p>

                      <div className="flex items-center justify-between pt-1 mt-1 border-t border-zinc-100 dark:border-zinc-800/60 text-[10px] font-medium text-zinc-500">
                        <span className="text-zinc-800 dark:text-zinc-250 font-bold">{formatCurrency(lead.value)}</span>
                        {lead.ownerName && <span className="flex items-center gap-1"><User size={10} /> {lead.ownerName.split(" ")[0]}</span>}
                      </div>

                      {hasPermission("crm.write") && (
                        <div className="absolute right-3 top-3 flex items-center gap-1">
                          {stageIndex > 0 && (
                            <button
                              type="button"
                              disabled={movingLeadId === lead.id}
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleMoveLead(lead.id, pipeline[stageIndex - 1].id);
                              }}
                              className="p-1.5 bg-zinc-50 hover:bg-amber-50 border border-zinc-200 rounded-md text-zinc-500 hover:text-amber-700 disabled:opacity-40 cursor-pointer"
                              title={`Voltar para ${pipeline[stageIndex - 1].name}`}
                              aria-label={`Voltar ${lead.name} para ${pipeline[stageIndex - 1].name}`}
                            >
                              <ArrowLeft size={11} />
                            </button>
                          )}
                          {stageIndex < pipeline.length - 1 && (
                            <button
                              type="button"
                              disabled={movingLeadId === lead.id}
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleMoveLead(lead.id, pipeline[stageIndex + 1].id);
                              }}
                              className="p-1.5 bg-zinc-50 hover:bg-primary/10 border border-zinc-200 rounded-md text-zinc-500 hover:text-primary disabled:opacity-40 cursor-pointer"
                              title={`Avançar para ${pipeline[stageIndex + 1].name}`}
                              aria-label={`Avançar ${lead.name} para ${pipeline[stageIndex + 1].name}`}
                            >
                              <ArrowRight size={11} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Lead Modal */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Cadastrar Nova Oportunidade">
        <form onSubmit={handleCreateLead} className="space-y-4">
          <Input
            label="Nome do Lead / Contato *"
            required
            value={leadForm.name}
            onChange={(e) => setLeadForm((prev) => ({ ...prev, name: e.target.value }))}
          />
          <Input
            label="Empresa / Cliente corporativo"
            value={leadForm.company}
            onChange={(e) => setLeadForm((prev) => ({ ...prev, company: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="E-mail"
              type="email"
              value={leadForm.email}
              onChange={(e) => setLeadForm((prev) => ({ ...prev, email: e.target.value }))}
            />
            <Input
              label="Telefone / WhatsApp *"
              required
              value={leadForm.phone}
              onChange={(e) => setLeadForm((prev) => ({ ...prev, phone: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Valor Estimado do Contrato (R$)"
              type="number"
              value={leadForm.value}
              onChange={(e) => setLeadForm((prev) => ({ ...prev, value: e.target.value }))}
            />
            <Select
              label="Origem da Oportunidade"
              options={[
                { value: "Google Search", label: "Pesquisa Google" },
                { value: "Indicação", label: "Indicação de Parceiro" },
                { value: "Instagram", label: "Instagram Ads" },
                { value: "Ligação Ativa", label: "Prospecção Interna" }
              ]}
              value={leadForm.source}
              onChange={(e) => setLeadForm((prev) => ({ ...prev, source: e.target.value }))}
            />
          </div>

          <Select
            label="Responsável Comercial"
            options={systemUsers.map((u) => ({ value: u.id, label: `${u.name} (${u.roleName})` }))}
            value={leadForm.ownerId}
            onChange={(e) => setLeadForm((prev) => ({ ...prev, ownerId: e.target.value }))}
          />

          <Input
            label="Observações Iniciais"
            value={leadForm.notes}
            onChange={(e) => setLeadForm((prev) => ({ ...prev, notes: e.target.value }))}
          />

          <div className="pt-4 flex justify-end gap-3">
            <Button variant="secondary" type="button" onClick={() => setIsAddOpen(false)}>Cancelar</Button>
            <Button variant="primary" type="submit" loading={actionLoading}>Salvar Lead</Button>
          </div>
        </form>
      </Modal>

      {/* Lead Detail Drawer (Page 18) */}
      <Drawer
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title={selectedLead ? `Lead: ${selectedLead.name}` : "Detalhe da Oportunidade"}
      >
        {selectedLead && (
          <div className="space-y-6">
            {/* Lead metrics */}
            <div className="bg-zinc-50 dark:bg-zinc-800/40 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-2.5 text-xs font-semibold">
              <p>Empresa: <span className="text-zinc-800 dark:text-zinc-200">{selectedLead.company || "N/A"}</span></p>
              <p>Valor Proposta: <span className="text-zinc-900 dark:text-zinc-150 font-bold">{formatCurrency(selectedLead.value)}</span></p>
              <p>WhatsApp: <span className="text-zinc-800 dark:text-zinc-200">{formatPhone(selectedLead.phone)}</span></p>
              <p>E-mail: <span className="text-zinc-800 dark:text-zinc-250 truncate">{selectedLead.email || "Não informado"}</span></p>
              {selectedLead.notes && <p className="pt-2 border-t border-zinc-150 dark:border-zinc-800/60 font-semibold text-zinc-500">Notas: <span className="text-zinc-700 dark:text-zinc-400 font-medium block mt-1">{selectedLead.notes}</span></p>}
            </div>

            {hasPermission("crm.write") && (() => {
              const currentStage = pipeline.find((stage) => stage.leads.some((lead) => lead.id === selectedLead.id));
              return (
                <Select
                  label="Etapa atual do funil"
                  value={currentStage?.id || ""}
                  disabled={movingLeadId === selectedLead.id}
                  options={pipeline.map((stage) => ({ value: stage.id, label: stage.name }))}
                  onChange={(event) => void handleMoveLead(selectedLead.id, event.target.value)}
                />
              );
            })()}

            {/* Quick conversion actions */}
            {hasPermission("crm.write") && (
              <div className="space-y-3.5 border-y border-zinc-150 dark:border-zinc-800 py-4">
                <h5 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Ações de Conversão</h5>
                <div className="flex gap-2">
                  <Button
                    variant="success"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleConvertToQuote(selectedLead.id)}
                    loading={actionLoading}
                  >
                    Gerar Orçamento / Proposta
                  </Button>
                </div>
              </div>
            )}

            {/* Activity Logger Form */}
            <form onSubmit={handleAddActivity} className="space-y-3 pt-1">
              <h5 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Registrar Interação</h5>

              <div className="grid grid-cols-2 gap-3">
                <Select
                  options={[
                    { value: "LIGACAO", label: "Ligação" },
                    { value: "WHATSAPP", label: "Mensagem WhatsApp" },
                    { value: "EMAIL", label: "E-mail Enviado" },
                    { value: "VISITA", label: "Visita Técnica / Comercial" }
                  ]}
                  value={activityForm.type}
                  onChange={(e) => setActivityForm((prev) => ({ ...prev, type: e.target.value }))}
                />

                <Input
                  type="datetime-local"
                  value={activityForm.date}
                  onChange={(e) => setActivityForm((prev) => ({ ...prev, date: e.target.value }))}
                />
              </div>

              <Input
                placeholder="Descreva o que foi conversado..."
                value={activityForm.description}
                onChange={(e) => setActivityForm((prev) => ({ ...prev, description: e.target.value }))}
              />

              <Button variant="secondary" size="sm" type="submit" loading={actionLoading} className="w-full">
                Gravar Atividade
              </Button>
            </form>

            {/* Activity History Logs */}
            <div className="space-y-3 pt-2">
              <h5 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Histórico de Interações</h5>

              {selectedLead.activities?.length === 0 ? (
                <p className="text-xs text-zinc-400 text-center py-6">Nenhuma atividade registrada.</p>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {selectedLead.activities?.map((act: any) => (
                    <div key={act.id} className="p-3 bg-zinc-50 dark:bg-zinc-800/10 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs space-y-1">
                      <div className="flex justify-between items-center text-[10px] font-bold text-zinc-450 uppercase">
                        <span>{act.type}</span>
                        <span>{formatDateTime(act.scheduledDate)}</span>
                      </div>
                      <p className="text-zinc-700 dark:text-zinc-350 font-semibold leading-relaxed">{act.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

    </div>
  );
}
