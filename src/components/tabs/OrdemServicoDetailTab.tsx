"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useToast } from "@/components/ui/Toast";
import {
  getServiceOrderDetails,
  scheduleServiceOrder,
  updateOSStatus,
  updateOSMaterials,
  updateOSDetails,
  saveOSCompletionReport,
  addOSPhoto,
  deleteOSPhoto
} from "@/app/actions/osActions";
import { getProducts } from "@/app/actions/inventoryActions";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Modal } from "../ui/Modal";
import { StatusBadge } from "../ui/StatusBadge";
import { Timeline } from "../ui/Timeline";
import { Table, TableRow, TableCell } from "../ui/Table";
import {
  Loader2,
  Wrench,
  User,
  Calendar,
  DollarSign,
  Plus,
  Trash2,
  CheckCircle,
  FileText,
  Clock,
  MapPin,
  Laptop,
  AlertTriangle,
  Phone,
  Mail,
  Camera,
  Image,
  Upload,
  Printer
} from "lucide-react";

interface OrdemServicoDetailTabProps {
  id: string;
  initialSection?: string;
}

export default function OrdemServicoDetailTab({ id, initialSection }: OrdemServicoDetailTabProps) {
  const { users: systemUsers, hasPermission, user: currentUser } = useAuth();
  const { openTab } = useWorkspace();
  const { toast } = useToast();

  const [details, setDetails] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<"resumo" | "cliente" | "checklist" | "materials" | "relatorio" | "history">("resumo");

  useEffect(() => {
    if (["resumo", "cliente", "checklist", "materials", "relatorio", "history"].includes(initialSection || "")) {
      setSubTab(initialSection as typeof subTab);
    }
  }, [initialSection]);

  // Modals & Action loading
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isAddMaterialOpen, setIsAddMaterialOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Inventário (estoque)
  const [dbProducts, setDbProducts] = useState<any[]>([]);

  // Agendamento Form
  const [scheduleForm, setScheduleForm] = useState({
    scheduledDate: "",
    scheduledTime: "",
    techIds: [] as string[],
    priority: "MEDIA",
  });

  // OS general details form
  const [editForm, setEditForm] = useState({
    priority: "MEDIA",
    type: "PREVENTIVA",
    problemReported: "",
    technicalDiagnosis: "",
    notes: "",
  });
  const [checklist, setChecklist] = useState<{ label: string; checked: boolean }[]>([]);

  // Materiais Form
  const [materialForm, setMaterialForm] = useState({
    productId: "",
    quantity: 1,
    acquisitionType: "ESTOQUE",
  });

  // Relatório Form
  const [reportForm, setReportForm] = useState({
    technicalObservations: "",
    clientFeedback: "",
    warrantyTerms: "Garantia de 90 dias nos serviços prestados.",
    approvedByClient: false,
  });

  // Foto Form
  const [photoForm, setPhotoForm] = useState({
    step: "ANTES",
    url: "",
    caption: "",
  });

  // Company parameters from localStorage (for PDF/Print Report)
  const [companyParams, setCompanyParams] = useState<any>({
    corporateName: "Nexus Climatização",
    cnpj: "00.000.000/0000-00",
    stateRegistration: "ISENTO",
    municipalRegistration: "",
    email: "contato@nexusclimatizacao.com.br",
    phone: "(00) 0000-0000",
    address: "Rua do Cliente, 123",
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("company_params");
      if (saved) {
        try {
          setCompanyParams(JSON.parse(saved));
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, []);

  const getClientAddress = () => {
    if (!details) return "";
    if (details.address) {
      const addr = details.address;
      return [
        addr.street,
        addr.number ? `, ${addr.number}` : "",
        addr.complement ? ` - ${addr.complement}` : "",
        addr.neighborhood ? ` - ${addr.neighborhood}` : "",
        addr.city && addr.state ? ` - ${addr.city}/${addr.state}` : "",
        addr.cep ? ` - CEP ${addr.cep}` : "",
      ].filter(Boolean).join("");
    }

    // Fallback: search in client notes (parsed CNPJ address)
    if (details.client?.notes) {
      const match = details.client.notes.match(/Endereço Receita Federal:\s*(.*)/i);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return "Instalação Principal / Não informado";
  };

  async function loadDetails() {
    setLoading(true);
    try {
      const data = await getServiceOrderDetails(id);
      setDetails(data);
      if (data) {
        setScheduleForm({
          scheduledDate: data.scheduledDate ? new Date(data.scheduledDate).toISOString().slice(0, 10) : "",
          scheduledTime: data.scheduledTime || "",
          techIds: data.technicians?.map((t: any) => t.userId) || [],
          priority: data.priority || "MEDIA",
        });

        setEditForm({
          priority: data.priority || "MEDIA",
          type: data.type || "PREVENTIVA",
          problemReported: data.problemReported || "",
          technicalDiagnosis: data.technicalDiagnosis || "",
          notes: data.notes || "",
        });

        let parsedChecklist = [];
        try {
          parsedChecklist = JSON.parse(data.checklistJson || "[]");
        } catch (e) {
          console.error("Error parsing checklistJson:", e);
        }
        if (parsedChecklist.length === 0) {
          parsedChecklist = [
            { label: "Verificar pressão do gás refrigerante", checked: false },
            { label: "Limpar filtros de ar e aletas", checked: false },
            { label: "Testar isolamento elétrico do compressor", checked: false },
            { label: "Verificar vazamento de dreno de água", checked: false },
          ];
        }
        setChecklist(parsedChecklist);

        if (data.completionReport) {
          setReportForm({
            technicalObservations: data.completionReport.technicalObservations || "",
            clientFeedback: data.completionReport.clientFeedback || "",
            warrantyTerms: data.completionReport.warrantyTerms || "Garantia de 90 dias nos serviços prestados.",
            approvedByClient: data.completionReport.approvedByClient || false,
          });
        }
      }
    } catch (err) {
      console.error(err);
      toast("Erro ao carregar detalhes da OS", "error");
    } finally {
      setLoading(false);
    }
  }

  async function loadInventory() {
    try {
      const prods = await getProducts("");
      setDbProducts(prods);
      if (prods.length > 0) {
        setMaterialForm((prev) => ({ ...prev, productId: prods[0].id }));
      }
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    loadDetails();
    loadInventory();
  }, [id]);

  const handleSaveOSDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await updateOSDetails(id, editForm, currentUser?.id || "");
      if (res.success) {
        toast("Dados da OS atualizados com sucesso!", "success");
        loadDetails();
      } else {
        toast(res.error || "Erro ao salvar alterações", "error");
      }
    } catch (err) {
      toast("Erro de conexão ao salvar dados da OS", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleChecklist = async (index: number) => {
    const updated = checklist.map((item, idx) => {
      if (idx !== index) return item;
      return { ...item, checked: !item.checked };
    });
    setChecklist(updated);
    try {
      const res = await updateOSDetails(id, { checklistJson: JSON.stringify(updated) }, currentUser?.id || "");
      if (res.success) {
        toast("Checklist atualizado!", "success");
      }
    } catch (e) {
      toast("Erro de conexão ao atualizar checklist", "error");
    }
  };

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleForm.scheduledDate || scheduleForm.techIds.length === 0) {
      toast("Selecione a data e ao menos um técnico", "warning");
      return;
    }

    setActionLoading(true);
    try {
      const dateTime = new Date(`${scheduleForm.scheduledDate}T${scheduleForm.scheduledTime || "08:00"}:00`);
      const res = await scheduleServiceOrder(
        id,
        {
          scheduledDate: dateTime,
          scheduledTime: scheduleForm.scheduledTime || "08:00",
          techIds: scheduleForm.techIds,
          priority: scheduleForm.priority,
        },
        currentUser?.id || ""
      );

      if (res.success) {
        toast("Agendamento salvo com sucesso!", "success");
        setIsScheduleOpen(false);
        loadDetails();
      } else {
        toast(res.error || "Erro ao agendar OS", "error");
      }
    } catch (err) {
      toast("Erro de conexão", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!materialForm.productId || materialForm.quantity < 1) return;

    setActionLoading(true);
    try {
      const selectedProduct = dbProducts.find((p) => p.id === materialForm.productId);
      if (!selectedProduct) return;

      const currentMaterials = details.materials?.map((m: any) => ({
        productId: m.productId,
        quantity: m.quantity,
        salePrice: m.salePrice,
        usedQuantity: m.usedQuantity,
        status: m.status,
        acquisitionType: m.acquisitionType || "ESTOQUE",
      })) || [];

      // Check if product is already in the list, increment quantity
      const existingIdx = currentMaterials.findIndex((m: any) => m.productId === materialForm.productId);
      if (existingIdx !== -1) {
        currentMaterials[existingIdx].quantity += materialForm.quantity;
        currentMaterials[existingIdx].usedQuantity += materialForm.quantity;
      } else {
        currentMaterials.push({
          productId: materialForm.productId,
          quantity: materialForm.quantity,
          salePrice: selectedProduct.salePrice || 0,
          usedQuantity: materialForm.quantity,
          status: "UTILIZADO",
          acquisitionType: materialForm.acquisitionType,
        });
      }

      const res = await updateOSMaterials(id, currentMaterials, currentUser?.id || "");
      if (res.success) {
        toast("Material adicionado com sucesso!", "success");
        setIsAddMaterialOpen(false);
        // Reset form
        setMaterialForm({
          productId: dbProducts[0]?.id || "",
          quantity: 1,
          acquisitionType: "ESTOQUE",
        });
        loadDetails();
      } else {
        toast(res.error || "Erro ao adicionar material", "error");
      }
    } catch (err) {
      toast("Erro de conexão", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveMaterial = async (prodId: string) => {
    setActionLoading(true);
    try {
      const currentMaterials = details.materials
        ?.filter((m: any) => m.productId !== prodId)
        .map((m: any) => ({
          productId: m.productId,
          quantity: m.quantity,
          salePrice: m.salePrice,
          usedQuantity: m.usedQuantity,
          status: m.status,
          acquisitionType: m.acquisitionType || "ESTOQUE",
        })) || [];

      const res = await updateOSMaterials(id, currentMaterials, currentUser?.id || "");
      if (res.success) {
        toast("Material removido do fluxo", "success");
        loadDetails();
      } else {
        toast(res.error || "Erro ao remover material", "error");
      }
    } catch (err) {
      toast("Erro de conexão", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    setActionLoading(true);
    try {
      const res = await updateOSStatus(id, newStatus, currentUser?.id || "", "Etapa atualizada pela ação operacional da OS.");
      if (res.success) {
        toast("Etapa da OS atualizada com sucesso", "success");
        loadDetails();
      } else {
        toast(res.error || "Erro ao atualizar status", "error");
      }
    } catch (err) {
      toast("Erro de conexão", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoForm((prev) => ({ ...prev, url: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddPhotoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoForm.url) {
      toast("Por favor, envie ou selecione uma imagem", "error");
      return;
    }
    setActionLoading(true);
    try {
      const res = await addOSPhoto(id, {
        step: photoForm.step,
        url: photoForm.url,
        caption: photoForm.caption,
      });
      if (res.success) {
        toast("Foto adicionada com sucesso!", "success");
        setPhotoForm({ step: "ANTES", url: "", caption: "" });
        loadDetails();
      } else {
        toast(res.error || "Erro ao adicionar foto", "error");
      }
    } catch (err) {
      toast("Erro ao conectar", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    setActionLoading(true);
    try {
      const res = await deleteOSPhoto(photoId);
      if (res.success) {
        toast("Foto removida do relatório", "success");
        loadDetails();
      } else {
        toast(res.error || "Erro ao remover foto", "error");
      }
    } catch (err) {
      toast("Erro ao conectar", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await saveOSCompletionReport(id, reportForm);
      if (res.success) {
        toast(reportForm.approvedByClient ? "Relatório aprovado e enviado. A OS está pronta para faturamento." : "Relatório salvo como pendente de aprovação.", "success");
        loadDetails();
      } else {
        toast(res.error || "Erro ao salvar relatório", "error");
      }
    } catch (err) {
      toast("Erro de conexão", "error");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-zinc-400 flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs font-semibold animate-pulse">Carregando detalhes da OS...</p>
      </div>
    );
  }

  if (!details) {
    return (
      <Card className="p-12 text-center text-zinc-400">
        <AlertTriangle size={36} className="mx-auto text-danger mb-3" />
        <p className="text-sm font-semibold">Ordem de Serviço não encontrada</p>
      </Card>
    );
  }

  // Next Action computation
  const getNextAction = () => {
    switch (details.status) {
      case "CRIADA":
      case "AGUARDANDO_AGENDAMENTO":
        return {
          title: "Agendar OS com Técnico",
          desc: "Esta OS está aberta mas ainda não possui agendamento ou técnicos vinculados.",
          btn: "Agendar agora",
          action: () => setIsScheduleOpen(true)
        };
      case "AGENDADA":
        return {
          title: "Iniciar deslocamento",
          desc: "A equipe está escalada. Registre a saída para manter o acompanhamento operacional atualizado.",
          btn: "Iniciar deslocamento",
          action: () => handleUpdateStatus("DESLOCAMENTO")
        };
      case "DESLOCAMENTO":
        return {
          title: "Iniciar atendimento no local",
          desc: "A equipe está em deslocamento. Ao chegar, inicie a execução do serviço.",
          btn: "Iniciar execução",
          action: () => handleUpdateStatus("EXECUCAO")
        };
      case "EXECUCAO":
        return {
          title: "Concluir Atendimento Técnico",
          desc: "Preencha o diagnóstico, conclua o checklist e registre os materiais antes de fechar.",
          btn: "Concluir OS",
          action: () => handleUpdateStatus("CONCLUIDA")
        };
      case "PAUSADA":
      case "AGUARDANDO_PECA":
      case "AGUARDANDO_CLIENTE":
        return {
          title: "Retomar atendimento",
          desc: "A pendência foi resolvida? Retome a execução para continuar o serviço.",
          btn: "Retomar execução",
          action: () => handleUpdateStatus("EXECUCAO")
        };
      case "RETORNO":
        return {
          title: "Agendar retorno técnico",
          desc: "Escolha uma nova data, horário e equipe para o retorno ao cliente.",
          btn: "Agendar retorno",
          action: () => setIsScheduleOpen(true)
        };
      case "CONCLUIDA":
      case "REVISAO":
        return {
          title: "Finalizar relatório e obter aprovação",
          desc: "Registre o parecer técnico e a confirmação do cliente para liberar o faturamento.",
          btn: "Abrir relatório",
          action: () => setSubTab("relatorio")
        };
      case "RELATORIO_ENVIADO":
        return {
          title: "Enviar para o controle fiscal",
          desc: "O relatório foi aprovado. Libere a OS no espelho de notas fiscais.",
          btn: "Liberar faturamento",
          action: () => handleUpdateStatus("FATURAMENTO")
        };
      case "FATURAMENTO":
        return {
          title: "Registrar a nota fiscal",
          desc: "A OS está no controle fiscal aguardando número e valor definitivo da NF.",
          btn: "Abrir painel fiscal",
          action: () => openTab("faturamento", "Painel Fiscal")
        };
      default:
        return null;
    }
  };

  const nextAction = getNextAction();

  const currentStage = (() => {
    if (["CRIADA", "AGUARDANDO_AGENDAMENTO"].includes(details.status)) return 1;
    if (["AGENDADA", "RETORNO"].includes(details.status)) return 2;
    if (["DESLOCAMENTO", "EXECUCAO", "PAUSADA", "AGUARDANDO_PECA", "AGUARDANDO_CLIENTE"].includes(details.status)) return 3;
    if (["CONCLUIDA", "REVISAO"].includes(details.status)) return 4;
    if (details.status === "RELATORIO_ENVIADO") return 5;
    if (details.status === "FATURAMENTO") return 6;
    if (details.status === "FATURADA") return 7;
    return 1;
  })();

  const timelineSteps = [
    { label: "Orçamento", completed: true },
    { label: "OS Criada", completed: currentStage > 1, active: currentStage === 1 },
    { label: "Agendada", completed: currentStage > 2, active: currentStage === 2 },
    { label: "Execução", completed: currentStage > 3, active: currentStage === 3 },
    { label: "Concluída", completed: currentStage > 4, active: currentStage === 4 },
    { label: "Relatório", completed: currentStage > 5, active: currentStage === 5 },
    { label: "Faturamento", completed: currentStage > 6, active: currentStage === 6 },
    { label: "Faturada", completed: currentStage >= 7, active: currentStage === 7 }
  ];

  const secondaryActions = details.status === "AGENDADA"
    ? [{ label: "Iniciar direto", status: "EXECUCAO" }]
    : details.status === "EXECUCAO"
      ? [
          { label: "Pausar", status: "PAUSADA" },
          { label: "Aguardando peça", status: "AGUARDANDO_PECA" },
          { label: "Aguardando cliente", status: "AGUARDANDO_CLIENTE" },
          { label: "Programar retorno", status: "RETORNO" },
        ]
      : [];

  return (
    <div className="space-y-6 select-none animate-in fade-in duration-200">

      {/* Title / Summary Bar */}
      <Card className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Ordem de Serviço</span>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mt-0.5">
            OS #{details.code || details.id.slice(-4)} - {details.client?.name || details.clientName}
          </h2>
          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-zinc-500 mt-2">
            <span className="flex items-center gap-1"><User size={13} /> {details.technicians?.map((t: any) => t.user?.name || t.name || t.technician?.name).filter(Boolean).join(", ") || "Nenhum técnico"}</span>
            <span>•</span>
            <span className="flex items-center gap-1"><Calendar size={13} /> Agendado: {details.scheduledDate ? formatDate(details.scheduledDate) : "A definir"}</span>
            <span>•</span>
            <span className="flex items-center gap-1"><DollarSign size={13} /> Valor: {formatCurrency(details.totalValue)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => window.print()} className="h-8 py-1 text-[11px] font-bold flex items-center gap-1">
            <Printer size={13} /> Emitir Relatório (PDF)
          </Button>
          <StatusBadge status={details.status} />
        </div>
      </Card>

      {/* Next Action Box (Page 10) */}
      {nextAction && (
        <div className="bg-primary/5 dark:bg-primary/5 border border-primary/20 p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="text-[9px] font-bold text-primary uppercase block">Próxima ação recomendada</span>
            <h4 className="font-semibold text-sm text-zinc-850 dark:text-zinc-100 mt-1">{nextAction.title}</h4>
            <p className="text-[11px] text-zinc-500 mt-0.5">{nextAction.desc}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {secondaryActions.map((item) => (
              <Button key={item.status} variant="secondary" size="sm" disabled={actionLoading} onClick={() => handleUpdateStatus(item.status)}>
                {item.label}
              </Button>
            ))}
            <Button variant="primary" size="sm" loading={actionLoading} onClick={nextAction.action}>
              {nextAction.btn}
            </Button>
          </div>
        </div>
      )}

      {/* OS Flow Timeline */}
      <Card>
        <Timeline steps={timelineSteps} />
      </Card>

      {/* Grid: Details & Tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Stats Cards (4/12) */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="p-5 flex flex-col justify-between h-36">
            <div>
              <span className="text-[9px] font-bold text-zinc-400 block uppercase">Resumo Financeiro</span>
              <span className="text-xl font-bold text-zinc-800 dark:text-zinc-200 mt-1.5 block">{formatCurrency(details.totalValue)}</span>
              <span className="text-[10px] text-zinc-450 mt-1 block">Custo estimado: {formatCurrency(details.estimatedCost || 120)}</span>
            </div>
          </Card>

          <Card className="p-5 flex flex-col justify-between h-36">
            <div>
              <span className="text-[9px] font-bold text-zinc-400 block uppercase">Materiais Utilizados</span>
              <span className="text-xl font-bold text-zinc-800 dark:text-zinc-200 mt-1.5 block">{details.materials?.length || 0} itens</span>
              <span className="text-[10px] text-zinc-450 mt-1 block">Peças e reposição do estoque.</span>
            </div>
            <button
              onClick={() => setSubTab("materials")}
              className="text-[10px] font-bold text-primary self-start hover:underline cursor-pointer"
            >
              Gerenciar materiais
            </button>
          </Card>
        </div>

        {/* Right sub-tabs content (8/12) */}
        <div className="lg:col-span-8">
          <Card className="p-0 overflow-hidden flex flex-col h-full min-h-[380px]">
            {/* Tabs Selector */}
            <div className="border-b border-zinc-150 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 px-6 py-2 flex gap-1 overflow-x-auto scrollbar-none">
              {[
                { id: "resumo", label: "Descrição do Serviço" },
                { id: "cliente", label: "Dados do Cliente" },
                { id: "checklist", label: "Checklist Técnico" },
                { id: "materials", label: "Materiais (Estoque)" },
                { id: "relatorio", label: "Relatório & Fotos" },
                { id: "history", label: "Histórico / Auditoria" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSubTab(tab.id as any)}
                  className={`py-2 px-3 text-xs font-bold border-b-2 rounded-t-lg transition-all cursor-pointer ${
                    subTab === tab.id
                      ? "border-primary text-primary"
                      : "border-transparent text-zinc-400 hover:text-zinc-650"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
              {/* SUBTAB: Resumo / Descrição */}
              {subTab === "resumo" && (
                <form onSubmit={handleSaveOSDetails} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select
                      label="Prioridade OS"
                      options={[
                        { value: "BAIXA", label: "Baixa" },
                        { value: "MEDIA", label: "Média" },
                        { value: "ALTA", label: "Alta" },
                        { value: "URGENTE", label: "Urgente" }
                      ]}
                      value={editForm.priority}
                      onChange={(e) => setEditForm(prev => ({ ...prev, priority: e.target.value }))}
                    />

                    <Select
                      label="Tipo de Serviço"
                      options={[
                        { value: "PREVENTIVA", label: "Preventiva (PMOC)" },
                        { value: "CORRETIVA", label: "Corretiva" },
                        { value: "INSTALACAO", label: "Instalação" },
                        { value: "VISITA_TECNICA", label: "Visita Técnica" },
                        { value: "CONTRATO", label: "Contrato" },
                        { value: "GARANTIA", label: "Garantia" },
                      ]}
                      value={editForm.type}
                      onChange={(e) => setEditForm(prev => ({ ...prev, type: e.target.value }))}
                    />

                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 block uppercase">Problema Relatado</label>
                    <textarea
                      value={editForm.problemReported}
                      onChange={(e) => setEditForm(prev => ({ ...prev, problemReported: e.target.value }))}
                      className="w-full text-xs text-zinc-800 bg-zinc-50 dark:bg-zinc-800/20 border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl focus:ring-1 focus:ring-primary focus:outline-none min-h-[70px]"
                      placeholder="Descreva a falha ou a solicitação do cliente..."
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 block uppercase">Diagnóstico Técnico / Laudo de Campo</label>
                    <textarea
                      value={editForm.technicalDiagnosis}
                      onChange={(e) => setEditForm(prev => ({ ...prev, technicalDiagnosis: e.target.value }))}
                      className="w-full text-xs text-zinc-800 bg-zinc-50 dark:bg-zinc-800/20 border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl focus:ring-1 focus:ring-primary focus:outline-none min-h-[90px]"
                      placeholder="Descreva as medições, testes, constatações e laudos técnicos..."
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 block uppercase">Notas Internas de Gestão</label>
                    <textarea
                      value={editForm.notes}
                      onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                      className="w-full text-xs text-zinc-800 bg-zinc-50 dark:bg-zinc-800/20 border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl focus:ring-1 focus:ring-primary focus:outline-none min-h-[60px]"
                      placeholder="Observações de faturamento ou detalhes operacionais adicionais..."
                    />
                  </div>

                  <div className="flex justify-end pt-2 border-t">
                    <Button variant="primary" type="submit" loading={actionLoading}>
                      Salvar Alterações da OS
                    </Button>
                  </div>
                </form>
              )}

              {/* SUBTAB: Cliente */}
              {subTab === "cliente" && (
                <div className="space-y-4">
                  <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-150 uppercase tracking-wider">Informações Técnicas do Cliente</h4>
                  <div className="space-y-3.5 text-xs font-semibold text-zinc-650 dark:text-zinc-350">
                    <p className="flex items-center gap-2"><User size={14} className="text-zinc-400" /> {details.client?.name || details.clientName}</p>
                    <p className="flex items-center gap-2"><MapPin size={14} className="text-zinc-400" /> {details.addressLabel || "Instalação Principal"}</p>
                    {details.client?.phone && <p className="flex items-center gap-2"><Phone size={14} className="text-zinc-400" /> {details.client.phone}</p>}
                    {details.client?.email && <p className="flex items-center gap-2"><Mail size={14} className="text-zinc-400" /> {details.client.email}</p>}
                  </div>
                </div>
              )}

              {/* SUBTAB: Checklist */}
              {subTab === "checklist" && (
                <div className="space-y-4">
                  <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-150 uppercase tracking-wider">Verificação Operacional de Campo (PMOC)</h4>

                  <div className="space-y-2">
                    {checklist.map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleToggleChecklist(idx)}
                        className="flex items-center gap-3 p-3.5 bg-zinc-50/50 dark:bg-zinc-800/10 border border-zinc-150 dark:border-zinc-800 rounded-xl text-xs hover:bg-zinc-100/50 cursor-pointer transition-all"
                      >
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={() => {}} // Handled by container onClick
                          className="w-4 h-4 rounded text-primary border-zinc-300 focus:ring-primary cursor-pointer"
                        />
                        <span className={`font-semibold ${item.checked ? "text-zinc-450 line-through" : "text-zinc-800 dark:text-zinc-200"}`}>
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SUBTAB: Materials */}
              {subTab === "materials" && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-150 uppercase tracking-wider">Peças Aplicadas</h4>
                    {hasPermission("os.write") && details.status !== "PAGO" && (
                      <Button variant="secondary" size="sm" onClick={() => setIsAddMaterialOpen(true)}>
                        <Plus size={14} /> Adicionar Item
                      </Button>
                    )}
                  </div>

                  {!details.materials || details.materials.length === 0 ? (
                    <p className="text-xs text-zinc-400 text-center py-8">Nenhum material registrado nesta OS.</p>
                  ) : (
                    <Table headers={["Item do Estoque", "Origem", "Quantidade", "Valor Unitário", "Ações"]}>
                      {details.materials.map((m: any) => (
                        <TableRow key={m.productId}>
                          <TableCell className="font-bold text-zinc-850 dark:text-zinc-200">{m.product?.name || m.productName || "Peça"}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              m.acquisitionType === "COMPRA_FUTURA"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                            }`}>
                              {m.acquisitionType === "COMPRA_FUTURA" ? "Compra Futura" : "Em Estoque"}
                            </span>
                          </TableCell>
                          <TableCell className="font-semibold text-zinc-650 dark:text-zinc-400">{m.quantity} un</TableCell>
                          <TableCell className="font-semibold text-zinc-800 dark:text-zinc-150">{formatCurrency(m.salePrice || m.unitPrice || 0)}</TableCell>
                          <TableCell>
                            {details.status !== "PAGO" && (
                              <button
                                onClick={() => handleRemoveMaterial(m.productId)}
                                className="text-danger hover:text-red-700 transition-colors cursor-pointer"
                                title="Remover item da OS"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </Table>
                  )}
                </div>
              )}

              {/* SUBTAB: Relatório & Fotos */}
              {subTab === "relatorio" && (
                <div className="space-y-6">
                  {/* Part A: Relatório de Conclusão */}
                  <form onSubmit={handleSaveReport} className="space-y-4 border-b pb-6 border-zinc-150 dark:border-zinc-800">
                    <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-150 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText size={14} className="text-primary" /> Relatório de Conclusão de Serviço (ADM)
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block mb-1">Parecer / Observações Técnicas</label>
                        <textarea
                          rows={3}
                          value={reportForm.technicalObservations}
                          onChange={(e) => setReportForm((prev) => ({ ...prev, technicalObservations: e.target.value }))}
                          placeholder="Diagnóstico final, serviços executados, recomendações técnicas ao cliente..."
                          className="w-full text-xs p-3 bg-zinc-50/50 dark:bg-zinc-800/10 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-1 focus:ring-primary outline-none text-zinc-800 dark:text-zinc-150"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block mb-1">Feedback / Comentários do Cliente</label>
                        <textarea
                          rows={3}
                          value={reportForm.clientFeedback}
                          onChange={(e) => setReportForm((prev) => ({ ...prev, clientFeedback: e.target.value }))}
                          placeholder="Opinião do cliente, observações do assinante..."
                          className="w-full text-xs p-3 bg-zinc-55 dark:bg-zinc-800/10 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-1 focus:ring-primary outline-none text-zinc-800 dark:text-zinc-150"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                      <Input
                        label="Termos de Garantia do Serviço"
                        value={reportForm.warrantyTerms}
                        onChange={(e) => setReportForm((prev) => ({ ...prev, warrantyTerms: e.target.value }))}
                      />
                      <label className="flex items-center gap-2 text-xs font-bold text-zinc-700 dark:text-zinc-350 cursor-pointer pt-4">
                        <input
                          type="checkbox"
                          checked={reportForm.approvedByClient}
                          onChange={(e) => setReportForm((prev) => ({ ...prev, approvedByClient: e.target.checked }))}
                          className="w-4 h-4 rounded text-primary focus:ring-primary border-zinc-300"
                        />
                        Aprovado pelo Cliente (Assinado/Aceito)
                      </label>
                    </div>

                    <div className="flex justify-between items-center">
                      <Button variant="secondary" type="button" onClick={() => window.print()}>
                        <Printer size={14} className="inline mr-1" /> Imprimir / Salvar PDF do Relatório
                      </Button>
                      <Button variant="primary" type="submit" loading={actionLoading}>
                        Salvar Relatório de Conclusão
                      </Button>
                    </div>
                  </form>

                  {/* Part B: Evidências Fotográficas */}
                  <div className="space-y-4">
                    <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-150 uppercase tracking-wider flex items-center gap-1.5">
                      <Camera size={14} className="text-primary" /> Evidências Fotográficas (Fotos)
                    </h4>

                    {/* Exibir Fotos */}
                    {!details.photos || details.photos.length === 0 ? (
                      <p className="text-xs text-zinc-400 text-center py-6 bg-zinc-55 dark:bg-zinc-800/5 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
                        Nenhuma foto cadastrada neste relatório.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {details.photos.map((photo: any) => (
                          <div key={photo.id} className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900/50 relative flex flex-col justify-between">
                            <div>
                              <div className="relative aspect-video w-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden">
                                {photo.url.startsWith("data:") || photo.url.startsWith("http") || photo.url.startsWith("/") ? (
                                  <img src={photo.url} alt={photo.caption || "Evidência"} className="object-cover w-full h-full" />
                                ) : (
                                  <div className="text-center p-4">
                                    <Image size={24} className="mx-auto text-zinc-350 mb-1" />
                                    <span className="text-[10px] text-zinc-400 break-all">{photo.url}</span>
                                  </div>
                                )}
                                <span className={`absolute top-2 left-2 px-2 py-0.5 rounded text-[8px] font-bold uppercase text-white ${
                                  photo.step === "ANTES" ? "bg-amber-500" : photo.step === "DEPOIS" ? "bg-emerald-600" : "bg-blue-600"
                                }`}>
                                  {photo.step}
                                </span>
                              </div>
                              <p className="p-3 text-[11px] font-semibold text-zinc-650 dark:text-zinc-450 leading-snug">
                                {photo.caption || "Sem observações."}
                              </p>
                            </div>
                            <div className="p-2 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/30 flex justify-end">
                              <button
                                type="button"
                                onClick={() => handleDeletePhoto(photo.id)}
                                className="text-[10px] font-bold text-red-500 hover:text-red-700 flex items-center gap-1 cursor-pointer"
                              >
                                <Trash2 size={12} /> Remover Foto
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Adicionar Fotos Form */}
                    <form onSubmit={handleAddPhotoSubmit} className="bg-zinc-50/50 dark:bg-zinc-800/10 border border-zinc-200 dark:border-zinc-800 p-5 rounded-xl space-y-4">
                      <span className="text-[10px] font-bold text-blue-955 dark:text-zinc-100 uppercase tracking-wider block">
                        Adicionar Foto de Evidência
                      </span>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <Select
                          label="Etapa da OS *"
                          options={[
                            { value: "ANTES", label: "Antes do Serviço" },
                            { value: "DEPOIS", label: "Depois do Serviço" },
                            { value: "EVIDENCIA", label: "Outra Evidência / Laudo" }
                          ]}
                          value={photoForm.step}
                          onChange={(e) => setPhotoForm((prev) => ({ ...prev, step: e.target.value }))}
                        />

                        <div>
                          <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block mb-1">
                            Carregar Imagem (Local) *
                          </label>
                          <div className="flex items-center gap-2">
                            <label className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-bold text-zinc-650 dark:text-zinc-350 hover:bg-zinc-50 hover:text-zinc-800 cursor-pointer border-dashed">
                              <Upload size={14} /> Selecionar Arquivo
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handlePhotoUpload}
                                className="hidden"
                              />
                            </label>
                            {photoForm.url && (
                              <span className="text-[10px] text-success font-bold flex items-center gap-0.5">
                                <CheckCircle size={12} /> Carregada
                              </span>
                            )}
                          </div>
                        </div>

                        <Input
                          label="Legenda / Comentário da Foto"
                          placeholder="Ex: Condensadora limpa antes da manutenção"
                          value={photoForm.caption}
                          onChange={(e) => setPhotoForm((prev) => ({ ...prev, caption: e.target.value }))}
                        />
                      </div>

                      <div className="flex justify-end">
                        <Button variant="secondary" type="submit" loading={actionLoading}>
                          Cadastrar Foto na OS
                        </Button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* SUBTAB: History */}
              {subTab === "history" && (
                <div className="space-y-4">
                  <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-150 uppercase tracking-wider">Histórico de Auditoria</h4>
                  <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl divide-y divide-zinc-150 dark:divide-zinc-800 overflow-hidden text-xs">
                  {details.statusHistory?.length ? details.statusHistory.map((h: any) => (
                      <div key={h.id} className="p-3.5 hover:bg-zinc-50/20 flex justify-between items-start gap-4">
                        <div>
                          <p className="font-bold text-zinc-800 dark:text-zinc-200">
                            <span className="text-zinc-400">{h.oldStatus}</span> → <span className="font-bold text-primary">{h.newStatus}</span>
                          </p>
                          {h.changedBy?.name && <p className="text-[10px] text-zinc-500 mt-1">Responsável: {h.changedBy.name}</p>}
                          {h.justification && <p className="text-[10px] text-zinc-400 mt-1 leading-relaxed">{h.justification}</p>}
                        </div>
                        <span className="text-[10px] text-zinc-450 dark:text-zinc-500 whitespace-nowrap">{formatDateTime(h.changedAt)}</span>
                      </div>
                    )) : <p className="text-zinc-400 text-center py-8">Sem histórico de status.</p>}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

      </div>

      {/* Schedule Modal */}
      <Modal isOpen={isScheduleOpen} onClose={() => setIsScheduleOpen(false)} title="Agendar Técnico & Prioridade">
        <form onSubmit={handleSchedule} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Data de Execução *"
              type="date"
              required
              value={scheduleForm.scheduledDate}
              onChange={(e) => setScheduleForm((prev) => ({ ...prev, scheduledDate: e.target.value }))}
            />
            <Input
              label="Horário Estimado"
              type="time"
              value={scheduleForm.scheduledTime}
              onChange={(e) => setScheduleForm((prev) => ({ ...prev, scheduledTime: e.target.value }))}
            />
          </div>

          <Select
            label="Prioridade Operacional"
            options={[
              { value: "BAIXA", label: "Baixa" },
              { value: "MEDIA", label: "Média" },
              { value: "ALTA", label: "Alta" }
            ]}
            value={scheduleForm.priority}
            onChange={(e) => setScheduleForm((prev) => ({ ...prev, priority: e.target.value }))}
          />

          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block">Escalar Técnicos de Campo *</label>
            <div className="grid grid-cols-2 gap-2 border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl max-h-40 overflow-y-auto">
              {systemUsers
                .filter((u) => u.roleName === "Técnico" || u.roleName === "Gestor" || u.roleName === "Administrador")
                .map((tech) => (
                  <label key={tech.id} className="flex items-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-350 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={scheduleForm.techIds.includes(tech.id)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setScheduleForm((prev) => ({
                          ...prev,
                          techIds: checked
                            ? [...prev.techIds, tech.id]
                            : prev.techIds.filter((tid) => tid !== tech.id)
                        }));
                      }}
                      className="w-4 h-4 rounded text-primary focus:ring-primary border-zinc-300"
                    />
                    {tech.name}
                  </label>
                ))}
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <Button variant="secondary" type="button" onClick={() => setIsScheduleOpen(false)}>Cancelar</Button>
            <Button variant="primary" type="submit" loading={actionLoading}>Salvar Agendamento</Button>
          </div>
        </form>
      </Modal>

      {/* Add Material Modal */}
      <Modal isOpen={isAddMaterialOpen} onClose={() => setIsAddMaterialOpen(false)} title="Adicionar Peça / Material do Estoque">
        <form onSubmit={handleAddMaterial} className="space-y-4">
          <Select
            label="Escolha a Peça *"
            options={dbProducts.map((p) => ({
              value: p.id,
              label: `${p.name} (${p.stockQuantity || p.quantity || 0} un em estoque)`
            }))}
            value={materialForm.productId}
            onChange={(e) => setMaterialForm((prev) => ({ ...prev, productId: e.target.value }))}
          />

          <Select
            label="Origem do Material *"
            options={[
              { value: "ESTOQUE", label: "Material do Estoque (Deduzir do Saldo)" },
              { value: "COMPRA_FUTURA", label: "Compra Futura / Sob Encomenda (Não deduzir do Estoque)" }
            ]}
            value={materialForm.acquisitionType}
            onChange={(e) => setMaterialForm((prev) => ({ ...prev, acquisitionType: e.target.value }))}
          />

          <Input
            label="Quantidade Utilizada *"
            type="number"
            required
            min={1}
            value={materialForm.quantity}
            onChange={(e) => setMaterialForm((prev) => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
          />

          <div className="pt-4 flex justify-end gap-3">
            <Button variant="secondary" type="button" onClick={() => setIsAddMaterialOpen(false)}>Cancelar</Button>
            <Button variant="primary" type="submit" loading={actionLoading}>Adicionar Material</Button>
          </div>
        </form>
      </Modal>

      {/* Blueprint PDF template matching the print layout */}
      {details && (
        <>
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              body * {
                visibility: hidden;
              }
              .print-a4-report, .print-a4-report * {
                visibility: visible;
              }
              .print-a4-report {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                margin: 0;
                padding: 0;
                border: none !important;
                box-shadow: none !important;
                background: white !important;
                color: black !important;
              }
              .no-print {
                display: none !important;
              }
            }
          `}} />
          <div className="print-a4-report hidden print:block bg-white text-zinc-850 p-8 font-sans space-y-6">

            {/* Header Block */}
            <div className="border-b-2 border-zinc-900 pb-4 flex justify-between items-start">
              <div>
                <h1 className="text-lg font-bold text-zinc-900 uppercase tracking-tight">
                  {companyParams.corporateName}
                </h1>
                <p className="text-[10px] text-zinc-650 mt-1">
                  CNPJ: {companyParams.cnpj} | IE: {companyParams.stateRegistration || "ISENTO"} | IM: {companyParams.municipalRegistration || "N/A"}
                </p>
                <p className="text-[10px] text-zinc-650">
                  Endereço: {companyParams.address}
                </p>
                <p className="text-[10px] text-zinc-650">
                  E-mail: {companyParams.email} | Tel: {companyParams.phone}
                </p>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-bold text-zinc-400 block uppercase">Relatório Técnico</span>
                <span className="text-base font-bold text-zinc-900 block mt-0.5">OS #{details.code || details.id.slice(-4)}</span>
                <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase text-white ${
                  details.status === "CONCLUIDA" || details.status === "FATURADA" || details.status === "CONCLUÍDO" ? "bg-emerald-600" : "bg-blue-600"
                }`}>
                  {details.status}
                </span>
              </div>
            </div>

            {/* Document Title */}
            <div className="text-center py-2 bg-zinc-100 border border-zinc-200 rounded-lg">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-800">
                Relatório Técnico de Execução de Serviços (OS)
              </h2>
            </div>

            {/* Section A: Client Details */}
            <div className="space-y-2">
              <h3 className="text-[10px] font-bold text-zinc-900 uppercase tracking-wider border-b pb-1 border-zinc-200">
                1. Identificação do Cliente & Local de Execução
              </h3>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p><span className="text-zinc-550 font-bold">Cliente / Razão Social:</span> {details.client?.name || details.clientName}</p>
                  <p className="mt-1"><span className="text-zinc-550 font-bold">CNPJ / CPF:</span> {details.client?.cpfCnpj || "Não informado"}</p>
                  {details.contact && (
                    <p className="mt-1"><span className="text-zinc-550 font-bold">Contato:</span> {details.contact.name} ({details.contact.phone})</p>
                  )}
                </div>
                <div>
                  <p><span className="text-zinc-550 font-bold">Local de Instalação:</span> {getClientAddress()}</p>
                  {details.client?.phone && !details.contact && (
                    <p className="mt-1"><span className="text-zinc-550 font-bold">Telefone:</span> {details.client.phone}</p>
                  )}
                  {details.client?.email && (
                    <p className="mt-1"><span className="text-zinc-550 font-bold">E-mail:</span> {details.client.email}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Section B: OS Details */}
            <div className="space-y-2">
              <h3 className="text-[10px] font-bold text-zinc-900 uppercase tracking-wider border-b pb-1 border-zinc-200">
                2. Detalhes Operacionais do Chamado
              </h3>
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div>
                  <p><span className="text-zinc-550 font-bold">Tipo de Serviço:</span> {details.type}</p>
                  <p className="mt-1"><span className="text-zinc-550 font-bold">Prioridade:</span> {details.priority}</p>
                </div>
                <div>
                  <p><span className="text-zinc-550 font-bold">Data de Agendamento:</span> {details.scheduledDate ? formatDate(details.scheduledDate) : "A definir"}</p>
                  <p className="mt-1"><span className="text-zinc-550 font-bold">Horário Agendado:</span> {details.scheduledTime || "09:00"}</p>
                </div>
                <div>
                  <p><span className="text-zinc-550 font-bold">Técnico Responsável:</span> {details.technicians?.map((t: any) => t.user?.name || t.name || t.technician?.name).filter(Boolean).join(", ") || "Não atribuído"}</p>
                  {details.completedAt && (
                    <p className="mt-1"><span className="text-zinc-550 font-bold">Data de Conclusão:</span> {formatDateTime(details.completedAt)}</p>
                  )}
                </div>
              </div>
              <div className="text-xs pt-1">
                <p><span className="text-zinc-550 font-bold block mb-0.5">Descrição do Problema / Solicitação do Cliente:</span></p>
                <div className="p-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-700 italic">
                  {details.problemReported || "Não especificado."}
                </div>
              </div>
            </div>

            {/* Section C: Checklist Operacional */}
            {checklist.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-[10px] font-bold text-zinc-900 uppercase tracking-wider border-b pb-1 border-zinc-200">
                  3. Checklist de Verificação Preventiva / PMOC
                </h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                  {checklist.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 border-b border-zinc-100 pb-1">
                      <span className={`font-mono font-bold ${item.checked ? "text-emerald-600" : "text-zinc-400"}`}>
                        {item.checked ? "[✔] CONFORME" : "[ ] NÃO CONFORME"}
                      </span>
                      <span className="text-zinc-700">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Section D: Services and Materials */}
            <div className="space-y-2">
              <h3 className="text-[10px] font-bold text-zinc-900 uppercase tracking-wider border-b pb-1 border-zinc-200">
                4. Especificação de Mão de Obra & Materiais Utilizados
              </h3>

              {/* Services Table */}
              {details.items && details.items.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-zinc-450 block uppercase">Serviços Executados</span>
                  <table className="w-full text-left text-xs border border-zinc-200 rounded-lg overflow-hidden">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-200 font-bold text-zinc-750">
                        <th className="p-2">Descrição</th>
                        <th className="p-2 text-center w-16">Qtd</th>
                        <th className="p-2 text-right w-28">Preço Unit.</th>
                        <th className="p-2 text-right w-28">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {details.items.map((item: any, idx: number) => (
                        <tr key={idx} className="border-b border-zinc-150 last:border-b-0 text-zinc-650">
                          <td className="p-2 font-semibold text-zinc-800">{item.description}</td>
                          <td className="p-2 text-center">{item.quantity} {item.unit || "UN"}</td>
                          <td className="p-2 text-right">{formatCurrency(item.unitPrice)}</td>
                          <td className="p-2 text-right font-bold text-zinc-800">{formatCurrency(item.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Materials Table */}
              {details.materials && details.materials.length > 0 && (
                <div className="space-y-1 pt-1">
                  <span className="text-[9px] font-bold text-zinc-450 block uppercase">Peças e Insumos do Estoque Utilizados</span>
                  <table className="w-full text-left text-xs border border-zinc-200 rounded-lg overflow-hidden">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-200 font-bold text-zinc-750">
                        <th className="p-2">Material / Produto</th>
                        <th className="p-2 text-center w-16">Qtd</th>
                        <th className="p-2 text-center w-28">Status</th>
                        <th className="p-2 text-right w-28">Preço Unit.</th>
                        <th className="p-2 text-right w-28">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {details.materials.map((m: any, idx: number) => (
                        <tr key={idx} className="border-b border-zinc-150 last:border-b-0 text-zinc-650">
                          <td className="p-2 font-semibold text-zinc-800">{m.product?.name || m.name}</td>
                          <td className="p-2 text-center">{m.usedQuantity || m.quantity}</td>
                          <td className="p-2 text-center">
                            <span className="text-zinc-755 font-bold">{m.status}</span>
                          </td>
                          <td className="p-2 text-right">{formatCurrency(m.salePrice)}</td>
                          <td className="p-2 text-right font-bold text-zinc-800">{formatCurrency((m.usedQuantity || m.quantity) * m.salePrice)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="text-right font-bold text-xs pt-1 pr-2">
                Valor Total do Atendimento: {formatCurrency(details.totalValue)}
              </div>
            </div>

            {/* Section E: Completion Report */}
            {reportForm.technicalObservations && (
              <div className="space-y-2">
                <h3 className="text-[10px] font-bold text-zinc-900 uppercase tracking-wider border-b pb-1 border-zinc-200">
                  5. Parecer Técnico Final & Garantia
                </h3>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-zinc-550 font-bold block mb-0.5">Observações Técnicas de Execução:</span>
                    <div className="p-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-700 leading-relaxed min-h-[50px]">
                      {reportForm.technicalObservations}
                    </div>
                  </div>
                  <div>
                    <span className="text-zinc-550 font-bold block mb-0.5">Observações / Comentários do Cliente:</span>
                    <div className="p-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-700 leading-relaxed min-h-[50px]">
                      {reportForm.clientFeedback || "Nenhum comentário registrado pelo cliente."}
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-zinc-650 pt-1">
                  <span className="font-bold">Termos de Garantia:</span> {reportForm.warrantyTerms || "Garantia de 90 dias nos serviços prestados."}
                </p>
              </div>
            )}

            {/* Section F: Photo Evidence */}
            {details.photos && details.photos.length > 0 && (
              <div className="space-y-2" style={{ pageBreakBefore: "always" }}>
                <h3 className="text-[10px] font-bold text-zinc-900 uppercase tracking-wider border-b pb-1 border-zinc-200">
                  6. Registro Fotográfico de Evidências (Antes / Depois / Equipamento)
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {details.photos.map((photo: any, idx: number) => (
                    <div key={idx} className="border border-zinc-200 rounded-lg overflow-hidden bg-white p-2 flex flex-col justify-between">
                      <div className="relative aspect-video w-full bg-zinc-50 flex items-center justify-center overflow-hidden">
                        <img src={photo.url} alt={photo.caption || "Evidência"} className="object-cover w-full h-full" />
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-[8px] font-bold uppercase text-white bg-zinc-900/80">
                          {photo.step}
                        </span>
                      </div>
                      <p className="pt-2 text-[10px] font-semibold text-zinc-650 leading-snug">
                        <span className="font-bold">Legenda:</span> {photo.caption || "Sem observações detalhadas."}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Section G: Signatures */}
            <div className="pt-8 grid grid-cols-2 gap-8 text-xs text-center" style={{ pageBreakInside: "avoid" }}>
              <div className="flex flex-col items-center justify-end">
                <div className="w-48 border-b border-zinc-400 mb-1.5" />
                <span className="font-bold text-zinc-800">Assinatura do Técnico Responsável</span>
                <span className="text-[10px] text-zinc-400 mt-0.5">{details.technicians?.map((t: any) => t.user?.name || t.name || t.technician?.name).filter(Boolean).join(", ") || "Técnico"}</span>
              </div>
              <div className="flex flex-col items-center justify-end">
                {details.signatureBase64 ? (
                  <div className="max-h-16 h-12 overflow-hidden mb-1 flex items-center justify-center">
                    <img src={details.signatureBase64} alt="Assinatura Cliente" className="object-contain max-h-full" />
                  </div>
                ) : (
                  <div className="h-12 flex items-center justify-center text-[10px] text-zinc-400 italic mb-1">
                    [ Assinatura Digital Ausente ]
                  </div>
                )}
                <div className="w-48 border-b border-zinc-400 mb-1.5" />
                <span className="font-bold text-zinc-800">Assinatura do Cliente / Responsável</span>
                <span className="text-[10px] text-zinc-400 mt-0.5">{details.signatureName || details.client?.name || "Representante do Cliente"}</span>
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  );
}
