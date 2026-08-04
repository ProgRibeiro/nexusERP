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
import { Table, TableRow, TableCell } from "../ui/Table";
import ServiceVisitsPanel from "@/components/os/ServiceVisitsPanel";
import ServiceOrderAssetsPanel from "@/components/os/ServiceOrderAssetsPanel";
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
  Printer,
  ChevronRight,
  ChevronDown,
  Users,
  Package,
  ClipboardList,
  History,
  Check,
  MoreHorizontal,
  CalendarClock,
  Boxes,
} from "lucide-react";

interface OrdemServicoDetailTabProps {
  id: string;
  initialSection?: string;
}

interface PendingOSPhoto {
  id: string;
  name: string;
  url: string;
  caption: string;
}

function compressEvidenceImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Não foi possível ler ${file.name}.`));
    reader.onload = () => {
      const image = new window.Image();
      image.onerror = () => reject(new Error(`Formato de imagem inválido: ${file.name}.`));
      image.onload = () => {
        const maxDimension = 1920;
        const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) return reject(new Error("Não foi possível preparar a imagem."));
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export default function OrdemServicoDetailTab({ id, initialSection }: OrdemServicoDetailTabProps) {
  const { users: systemUsers, hasPermission, user: currentUser } = useAuth();
  const { openTab } = useWorkspace();
  const { toast } = useToast();

  const [details, setDetails] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<"resumo" | "cliente" | "visits" | "assets" | "checklist" | "materials" | "relatorio" | "history">("resumo");

  useEffect(() => {
    if (["resumo", "cliente", "visits", "assets", "checklist", "materials", "relatorio", "history"].includes(initialSection || "")) {
      setSubTab(initialSection as typeof subTab);
    }
  }, [initialSection]);

  // Modals & Action loading
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isAddMaterialOpen, setIsAddMaterialOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [pipelineExpanded, setPipelineExpanded] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [preparingPrint, setPreparingPrint] = useState(false);

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
  const [photoStep, setPhotoStep] = useState("ANTES");
  const [pendingPhotos, setPendingPhotos] = useState<PendingOSPhoto[]>([]);
  const [photoProgress, setPhotoProgress] = useState<{ mode: "preparing" | "uploading"; done: number; total: number } | null>(null);
  const [photoGalleryLimit, setPhotoGalleryLimit] = useState(12);

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

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    const availableSlots = Math.max(0, 20 - pendingPhotos.length);
    if (!availableSlots) {
      toast("O limite é de 20 fotos por lote.", "warning");
      return;
    }
    const selected = files.slice(0, availableSlots);
    const valid = selected.filter((file) => {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return false;
      return file.size > 0 && file.size <= 10 * 1024 * 1024;
    });
    if (valid.length !== selected.length) toast("Algumas imagens foram ignoradas. Use JPG, PNG ou WebP com até 10 MB.", "warning");
    setPhotoProgress({ mode: "preparing", done: 0, total: valid.length });
    try {
      const prepared: PendingOSPhoto[] = [];
      for (let index = 0; index < valid.length; index += 1) {
        const file = valid[index];
        prepared.push({
          id: `${Date.now()}-${index}-${file.name}`,
          name: file.name,
          url: await compressEvidenceImage(file),
          caption: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "),
        });
        setPhotoProgress({ mode: "preparing", done: index + 1, total: valid.length });
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
      setPendingPhotos((current) => [...current, ...prepared].slice(0, 20));
      if (files.length > availableSlots) toast(`Foram adicionadas ${availableSlots} fotos. O máximo por lote é 20.`, "info");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Erro ao preparar as imagens.", "error");
    } finally {
      setPhotoProgress(null);
    }
  };

  const handleAddPhotoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingPhotos.length) {
      toast("Selecione pelo menos uma imagem.", "error");
      return;
    }
    setPhotoProgress({ mode: "uploading", done: 0, total: pendingPhotos.length });
    try {
      const failed: PendingOSPhoto[] = [];
      let saved = 0;
      let cursor = 0;
      let completed = 0;
      const workers = Array.from({ length: Math.min(3, pendingPhotos.length) }, async () => {
        while (cursor < pendingPhotos.length) {
          const photo = pendingPhotos[cursor++];
          try {
            const res = await addOSPhoto(id, { step: photoStep, url: photo.url, caption: photo.caption });
            if (res.success) saved += 1;
            else failed.push(photo);
          } catch {
            failed.push(photo);
          } finally {
            completed += 1;
            setPhotoProgress({ mode: "uploading", done: completed, total: pendingPhotos.length });
          }
        }
      });
      await Promise.all(workers);
      setPendingPhotos(failed);
      if (saved) await loadDetails();
      if (!failed.length) toast(`${saved} foto${saved === 1 ? "" : "s"} cadastrada${saved === 1 ? "" : "s"} com sucesso!`, "success");
      else toast(`${saved} foto(s) salva(s) e ${failed.length} com erro. As fotos com erro permaneceram no lote.`, "warning");
    } catch (err) {
      toast("Erro ao conectar", "error");
    } finally {
      setPhotoProgress(null);
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

  const handlePrintReport = async () => {
    if (preparingPrint) return;
    setPreparingPrint(true);
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      const report = document.querySelector<HTMLElement>(".print-a4-report");
      const images = Array.from(report?.querySelectorAll<HTMLImageElement>("img") || []);
      const failed: HTMLImageElement[] = [];

      await Promise.all(images.map(async (image) => {
        if (!image.complete) {
          await new Promise<void>((resolve) => {
            const timeout = window.setTimeout(() => { failed.push(image); resolve(); }, 12_000);
            image.addEventListener("load", () => { window.clearTimeout(timeout); resolve(); }, { once: true });
            image.addEventListener("error", () => { window.clearTimeout(timeout); failed.push(image); resolve(); }, { once: true });
          });
        }
        if (!image.naturalWidth) {
          if (!failed.includes(image)) failed.push(image);
          return;
        }
        try {
          if (image.decode) await image.decode();
        } catch {
          if (!image.naturalWidth && !failed.includes(image)) failed.push(image);
        }
      }));

      if (failed.length) {
        toast(`${failed.length} imagem(ns) não carregaram. Verifique os arquivos antes de gerar o PDF.`, "error");
        return;
      }
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      window.print();
    } finally {
      setPreparingPrint(false);
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
          title: "Converter o retorno legado em visita",
          desc: "Abra o histórico de visitas e programe a nova ida sem apagar o atendimento anterior.",
          btn: "Abrir visitas",
          action: () => setSubTab("visits")
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
          { label: "Programar retorno", status: "VISITS" },
        ]
      : [];

  const estimatedCost = Number(details.estimatedCost || 0);
  const totalValue = Number(details.totalValue || 0);
  const estimatedMargin = totalValue - estimatedCost;
  const estimatedMarginPercent = totalValue > 0 ? (estimatedMargin / totalValue) * 100 : 0;
  const photoBusy = Boolean(photoProgress);
  const photoProgressPercent = photoProgress?.total ? Math.round((photoProgress.done / photoProgress.total) * 100) : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-5 select-none animate-in fade-in duration-200 sm:space-y-6">
      <div className="flex items-center gap-1.5 text-xs text-zinc-400">
        <button onClick={() => openTab("ordens-servico", "Ordens de Serviço")} className="hover:text-teal-700">Ordens de Serviço</button>
        <ChevronRight size={13} />
        <span className="font-mono text-zinc-500">{details.code || details.id.slice(-4)}</span>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="break-words text-xl font-semibold text-zinc-900 dark:text-white sm:text-2xl">
                {details.client?.name || details.clientName}
              </h1>
              <StatusBadge status={details.status} />
            </div>
            <p className="mt-1 font-mono text-sm text-zinc-400">OS #{details.code || details.id.slice(-4)}</p>
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-zinc-600 dark:text-zinc-300">
              <span className="flex items-center gap-1.5"><Users size={16} className="text-zinc-400" /> {details.technicians?.map((t: any) => t.user?.name || t.name || t.technician?.name).filter(Boolean).join(", ") || "Técnico não atribuído"}</span>
              <span className="flex items-center gap-1.5"><Calendar size={16} className="text-zinc-400" /> Agendado: {details.scheduledDate ? formatDate(details.scheduledDate) : "A definir"}</span>
              <span className="flex items-center gap-1.5 font-mono"><DollarSign size={16} className="text-zinc-400" /> {formatCurrency(totalValue)}</span>
            </div>
          </div>
          <Button variant="secondary" onClick={handlePrintReport} loading={preparingPrint} className="w-full shrink-0 justify-center sm:w-auto">
            <Printer size={15} /> Emitir Relatório (PDF)
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between gap-4">
          <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            {timelineSteps.map((step, index) => (
              <div key={step.label} className={`h-full flex-1 ${index ? "ml-0.5" : ""} ${index < currentStage ? "bg-emerald-500" : index === currentStage ? "bg-teal-600" : "bg-zinc-200 dark:bg-zinc-700"}`} />
            ))}
          </div>
          <span className="hidden shrink-0 font-mono text-xs text-zinc-400 sm:inline">{Math.min(currentStage + 1, timelineSteps.length)}/{timelineSteps.length}</span>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-sm"><span className="font-mono text-xs text-zinc-400">Etapa {Math.min(currentStage + 1, timelineSteps.length)} de {timelineSteps.length}</span> <span className="font-semibold text-zinc-900 dark:text-white">· {timelineSteps[currentStage]?.label || timelineSteps.at(-1)?.label}</span></p>
          <button type="button" onClick={() => setPipelineExpanded((value) => !value)} className="hidden items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-800 md:inline-flex">
            {pipelineExpanded ? "Ocultar etapas" : "Ver todas as etapas"}<ChevronDown size={14} className={`transition-transform ${pipelineExpanded ? "rotate-180" : ""}`} />
          </button>
        </div>
        {pipelineExpanded && (
          <div className="mt-4 hidden grid-cols-8 gap-1 border-t border-zinc-100 pt-4 dark:border-zinc-800 md:grid">
            {timelineSteps.map((step, index) => (
              <div key={step.label} className="flex flex-col items-center gap-1.5 text-center">
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${index < currentStage ? "bg-emerald-500 text-white" : index === currentStage ? "bg-teal-600 text-white" : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800"}`}>{index < currentStage ? <Check size={12} /> : index + 1}</span>
                <span className={`text-[11px] leading-tight ${index === currentStage ? "font-semibold text-teal-700" : "text-zinc-400"}`}>{step.label}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {nextAction && (
        <section className="relative rounded-xl border border-teal-100 bg-teal-50/70 p-5 dark:border-teal-950 dark:bg-teal-950/20">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-600 text-white"><Wrench size={20} /></span>
              <div><p className="text-[11px] font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-400">Próxima ação recomendada</p><h3 className="text-base font-semibold text-zinc-900 dark:text-white">{nextAction.title}</h3><p className="mt-0.5 text-sm text-zinc-500">{nextAction.desc}</p></div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {secondaryActions.length > 0 && (
                <div className="relative">
                  <Button variant="secondary" onClick={() => setActionsOpen((value) => !value)}>Mais ações <ChevronDown size={15} /></Button>
                  {actionsOpen && <><button aria-label="Fechar menu" className="fixed inset-0 z-10 cursor-default" onClick={() => setActionsOpen(false)} /><div className="absolute right-0 z-20 mt-1.5 w-52 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">{secondaryActions.map((item) => <button key={item.status} onClick={() => { setActionsOpen(false); if (item.status === "VISITS") setSubTab("visits"); else void handleUpdateStatus(item.status); }} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"><MoreHorizontal size={15} className="text-zinc-400" />{item.label}</button>)}</div></>}
                </div>
              )}
              <Button variant="success" loading={actionLoading} onClick={nextAction.action}><Check size={16} /> {nextAction.btn}</Button>
            </div>
          </div>
        </section>
      )}

      {/* Grid: Details & Tabs */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* Left Stats Cards (4/12) */}
        <aside className="space-y-4 lg:col-span-1">
          <Card className="p-5">
            <div>
              <span className="text-xs font-medium tracking-wide text-zinc-400 block uppercase">Resumo financeiro</span>
              <span className="mt-2 block font-mono text-2xl font-semibold text-zinc-900 dark:text-white">{formatCurrency(totalValue)}</span>
              <span className="mt-1 block text-sm text-zinc-400">Custo estimado: {formatCurrency(estimatedCost)}</span>
              <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800"><p className={`text-sm font-medium ${estimatedMargin >= 0 ? "text-emerald-600" : "text-red-600"}`}>Margem estimada: {formatCurrency(estimatedMargin)} <span>({estimatedMarginPercent.toFixed(0)}%)</span></p></div>
            </div>
          </Card>

          <Card className="p-5">
            <div>
              <span className="text-xs font-medium tracking-wide text-zinc-400 block uppercase">Materiais utilizados</span>
              <span className="mt-2 block text-2xl font-semibold text-zinc-900 dark:text-white">{details.materials?.length || 0} itens</span>
              <span className="mt-1 block text-sm text-zinc-400">Peças e reposição do estoque.</span>
            </div>
            <button
              onClick={() => setSubTab("materials")}
              className="mt-3 text-sm font-medium text-teal-700 hover:text-teal-800"
            >
              Gerenciar materiais →
            </button>
          </Card>
        </aside>

        {/* Right sub-tabs content (8/12) */}
        <div className="lg:col-span-2">
          <Card className="p-0 overflow-hidden flex flex-col h-full min-h-[380px]">
            {/* Tabs Selector */}
            <div className="border-b border-zinc-150 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 px-6 py-2 flex gap-1 overflow-x-auto scrollbar-none">
              {[
                { id: "resumo", label: "Descrição do Serviço", icon: FileText },
                { id: "visits", label: `Visitas (${details.visits?.length || 0})`, icon: CalendarClock },
                { id: "assets", label: `Ativos (${details.serviceOrderAssets?.length || 0})`, icon: Boxes },
                { id: "cliente", label: "Dados do Cliente", icon: Users },
                { id: "checklist", label: "Checklist Técnico", icon: ClipboardList },
                { id: "materials", label: "Materiais (Estoque)", icon: Package },
                { id: "relatorio", label: "Relatório & Fotos", icon: Camera },
                { id: "history", label: "Histórico / Auditoria", icon: History },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setSubTab(tab.id as any)}
                    className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 pb-2.5 pt-1.5 text-sm font-medium transition-colors ${
                      subTab === tab.id
                        ? "border-teal-600 text-teal-700"
                        : "border-transparent text-zinc-400 hover:text-zinc-600"
                    }`}
                  >
                    <Icon size={15} /> {tab.label}
                  </button>
                );
              })}
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

              {/* SUBTAB: Visitas de serviço */}
              {subTab === "visits" && (
                <ServiceVisitsPanel
                  serviceOrderId={id}
                  visits={details.visits || []}
                  technicians={systemUsers.filter((systemUser) => ["Técnico", "Gestor", "Administrador"].includes(systemUser.roleName))}
                  onChanged={loadDetails}
                />
              )}

              {/* SUBTAB: Ativos envolvidos */}
              {subTab === "assets" && (
                <ServiceOrderAssetsPanel
                  serviceOrderId={id}
                  onChanged={loadDetails}
                />
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
                      <Button variant="secondary" type="button" onClick={handlePrintReport} loading={preparingPrint}>
                        <Printer size={14} className="inline mr-1" /> Imprimir / Salvar PDF do Relatório
                      </Button>
                      <Button variant="primary" type="submit" loading={actionLoading}>
                        Salvar Relatório de Conclusão
                      </Button>
                    </div>
                  </form>

                  {/* Part B: Evidências Fotográficas */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-150 uppercase tracking-wider flex items-center gap-1.5">
                        <Camera size={14} className="text-primary" /> Evidências Fotográficas (Fotos)
                      </h4>
                      <span className="text-[10px] font-semibold text-zinc-400">{details.photos?.length || 0} foto(s)</span>
                    </div>

                    {/* Exibir Fotos */}
                    {!details.photos || details.photos.length === 0 ? (
                      <p className="text-xs text-zinc-400 text-center py-6 bg-zinc-55 dark:bg-zinc-800/5 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
                        Nenhuma foto cadastrada neste relatório.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {details.photos.slice(0, photoGalleryLimit).map((photo: any) => (
                          <div key={photo.id} className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900/50 relative flex flex-col justify-between">
                            <div>
                              <div className="relative aspect-video w-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden">
                                {photo.url.startsWith("data:") || photo.url.startsWith("http") || photo.url.startsWith("/") ? (
                                  <img src={photo.url} alt={photo.caption || "Evidência"} loading="lazy" decoding="async" className="object-cover w-full h-full" />
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
                    {details.photos?.length > photoGalleryLimit && (
                      <div className="flex justify-center">
                        <Button variant="secondary" size="sm" onClick={() => setPhotoGalleryLimit((current) => current + 12)}>
                          Mostrar mais {Math.min(12, details.photos.length - photoGalleryLimit)} fotos
                        </Button>
                      </div>
                    )}

                    {/* Adicionar Fotos Form */}
                    <form onSubmit={handleAddPhotoSubmit} className="bg-zinc-50/50 dark:bg-zinc-800/10 border border-zinc-200 dark:border-zinc-800 p-5 rounded-xl space-y-4">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-[10px] font-bold text-blue-955 dark:text-zinc-100 uppercase tracking-wider">Adicionar fotos em lote</span>
                        <span className="text-[10px] font-semibold text-zinc-400">{pendingPhotos.length}/20 selecionadas</span>
                      </div>

                      <div className="grid grid-cols-1 gap-4 items-end sm:grid-cols-2">
                        <Select
                          label="Etapa da OS *"
                          options={[
                            { value: "ANTES", label: "Antes do Serviço" },
                            { value: "DEPOIS", label: "Depois do Serviço" },
                            { value: "EVIDENCIA", label: "Outra Evidência / Laudo" }
                          ]}
                          value={photoStep}
                          disabled={photoBusy}
                          onChange={(e) => setPhotoStep(e.target.value)}
                        />

                        <div>
                          <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block mb-1">
                            Selecionar imagens *
                          </label>
                          <div className="flex items-center gap-2">
                            <label className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-bold text-zinc-650 dark:text-zinc-350 hover:bg-zinc-50 hover:text-zinc-800 cursor-pointer border-dashed">
                              <Upload size={14} /> Selecionar várias fotos
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                multiple
                                disabled={photoBusy}
                                onChange={handlePhotoUpload}
                                className="hidden"
                              />
                            </label>
                            {pendingPhotos.length > 0 && (
                              <span className="text-[10px] text-success font-bold flex items-center gap-0.5">
                                <CheckCircle size={12} /> Prontas
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {photoProgress && (
                        <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 dark:border-blue-950 dark:bg-blue-950/20" role="status" aria-live="polite">
                          <div className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold text-blue-800 dark:text-blue-300">
                            <span>{photoProgress.mode === "preparing" ? "Otimizando imagens" : "Salvando fotos na OS"}</span>
                            <span>{photoProgress.done}/{photoProgress.total} · {photoProgressPercent}%</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-blue-100 dark:bg-blue-950">
                            <div className="h-full rounded-full bg-blue-600 transition-[width] duration-300 ease-out" style={{ width: `${photoProgressPercent}%` }} />
                          </div>
                        </div>
                      )}

                      {pendingPhotos.length > 0 && (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {pendingPhotos.map((photo) => (
                            <div key={photo.id} className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                              <div className="relative aspect-video bg-zinc-100 dark:bg-zinc-800">
                                <img src={photo.url} alt={photo.name} className="h-full w-full object-cover" />
                                <button type="button" disabled={photoBusy} onClick={() => setPendingPhotos((current) => current.filter((item) => item.id !== photo.id))} className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40" title="Remover do lote"><Trash2 size={13} /></button>
                              </div>
                              <div className="space-y-2 p-3">
                                <p className="truncate text-[10px] font-semibold text-zinc-400" title={photo.name}>{photo.name}</p>
                                <Input
                                  aria-label={`Legenda de ${photo.name}`}
                                  placeholder="Legenda da foto"
                                  value={photo.caption}
                                  disabled={photoBusy}
                                  onChange={(event) => setPendingPhotos((current) => current.map((item) => item.id === photo.id ? { ...item, caption: event.target.value } : item))}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-col-reverse gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800 sm:flex-row sm:justify-between">
                        <Button variant="secondary" type="button" disabled={!pendingPhotos.length || photoBusy} onClick={() => setPendingPhotos([])}>Limpar lote</Button>
                        <Button variant="primary" type="submit" loading={photoProgress?.mode === "uploading"} disabled={!pendingPhotos.length || photoBusy}>
                          <Upload size={14} /> Cadastrar {pendingPhotos.length || ""} foto{pendingPhotos.length === 1 ? "" : "s"}
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
              .print-photo-card {
                break-inside: avoid-page !important;
                page-break-inside: avoid !important;
              }
              .print-photo-image-wrap {
                aspect-ratio: auto !important;
                height: auto !important;
                min-height: 35mm;
                overflow: hidden !important;
              }
              .print-photo-image {
                display: block !important;
                width: 100% !important;
                height: auto !important;
                max-height: 112mm !important;
                object-fit: contain !important;
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
                        <th className="p-2 text-center w-24">Quantidade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {details.items.map((item: any, idx: number) => (
                        <tr key={idx} className="border-b border-zinc-150 last:border-b-0 text-zinc-650">
                          <td className="p-2 font-semibold text-zinc-800">{item.description}</td>
                          <td className="p-2 text-center">{item.quantity} {item.unit || "UN"}</td>
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
                        <th className="p-2 text-center w-24">Quantidade</th>
                        <th className="p-2 text-center w-28">Status</th>
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

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
                    <div key={idx} className="print-photo-card border border-zinc-200 rounded-lg overflow-hidden bg-white p-2 flex flex-col justify-between">
                      <div className="print-photo-image-wrap relative aspect-video w-full bg-zinc-50 flex items-center justify-center overflow-hidden">
                        <img src={photo.url} alt={photo.caption || "Evidência"} loading="eager" decoding="sync" className="print-photo-image object-cover w-full h-full" />
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
                    <img src={details.signatureBase64} alt="Assinatura Cliente" loading="eager" decoding="sync" className="object-contain max-h-full" />
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
