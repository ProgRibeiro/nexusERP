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
  applyOSChecklistTemplate,
  saveOSCompletionReport,
  addOSPhotos,
  deleteOSPhoto,
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
  getServiceChecklistTemplate,
  SERVICE_MODALITIES,
} from "@/lib/serviceChecklistTemplates";
import {
  Loader2,
  Wrench,
  User,
  Calendar,
  DollarSign,
  CircleDollarSign,
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
  ShieldCheck,
  Store,
  RefreshCw,
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
  originalBytes: number;
  optimizedBytes: number;
  width: number;
  height: number;
}

async function compressEvidenceImage(
  file: File,
): Promise<{ dataUrl: string; bytes: number; width: number; height: number }> {
  let source: CanvasImageSource;
  let sourceWidth = 0;
  let sourceHeight = 0;
  let cleanup = () => {};

  if ("createImageBitmap" in window) {
    const bitmap = await createImageBitmap(file);
    source = bitmap;
    sourceWidth = bitmap.width;
    sourceHeight = bitmap.height;
    cleanup = () => bitmap.close();
  } else {
    const objectUrl = URL.createObjectURL(file);
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new window.Image();
      element.onload = () => resolve(element);
      element.onerror = () =>
        reject(new Error(`Formato de imagem inválido: ${file.name}.`));
      element.src = objectUrl;
    });
    source = image;
    sourceWidth = image.naturalWidth;
    sourceHeight = image.naturalHeight;
    cleanup = () => URL.revokeObjectURL(objectUrl);
  }

  try {
    const maxDimension = 1600;
    const scale = Math.min(
      1,
      maxDimension / Math.max(sourceWidth, sourceHeight),
    );
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Não foi possível preparar a imagem.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(source, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(new Error("Não foi possível otimizar a imagem.")),
        "image/jpeg",
        0.78,
      ),
    );
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () =>
        reject(new Error(`Não foi possível preparar ${file.name}.`));
      reader.readAsDataURL(blob);
    });
    return { dataUrl, bytes: blob.size, width, height };
  } finally {
    cleanup();
  }
}

export default function OrdemServicoDetailTab({
  id,
  initialSection,
}: OrdemServicoDetailTabProps) {
  const { users: systemUsers, hasPermission, user: currentUser } = useAuth();
  const { openTab } = useWorkspace();
  const { toast } = useToast();

  const [details, setDetails] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<
    | "resumo"
    | "cliente"
    | "visits"
    | "assets"
    | "checklist"
    | "materials"
    | "relatorio"
    | "history"
  >("resumo");

  useEffect(() => {
    if (
      [
        "resumo",
        "cliente",
        "visits",
        "assets",
        "checklist",
        "materials",
        "relatorio",
        "history",
      ].includes(initialSection || "")
    ) {
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
    serviceCategory: "GERAL",
    problemReported: "",
    technicalDiagnosis: "",
    notes: "",
  });
  const [checklist, setChecklist] = useState<
    { label: string; checked: boolean; modality?: string }[]
  >([]);

  // Materiais Form
  const [materialForm, setMaterialForm] = useState({
    productId: "",
    quantity: 1,
    acquisitionType: "ESTOQUE",
  });

  // Relatório Form
  const [reportForm, setReportForm] = useState({
    executedServices: "",
    technicalObservations: "",
    pendingActions: "",
    operationalResult: "OPERACIONAL",
    clientRepresentative: "",
    clientFeedback: "",
    warrantyTerms: "Garantia de 90 dias nos serviços prestados.",
    approvedByClient: false,
  });

  // Foto Form
  const [photoStep, setPhotoStep] = useState("ANTES");
  const [pendingPhotos, setPendingPhotos] = useState<PendingOSPhoto[]>([]);
  const [photoProgress, setPhotoProgress] = useState<{
    mode: "preparing" | "uploading";
    done: number;
    total: number;
  } | null>(null);
  const [photoGalleryLimit, setPhotoGalleryLimit] = useState(12);
  const [failedPhotoIds, setFailedPhotoIds] = useState<Set<string>>(new Set());
  const [photoReloadTokens, setPhotoReloadTokens] = useState<
    Record<string, number>
  >({});

  const retryPhoto = (photoId: string) => {
    setFailedPhotoIds((current) => {
      const next = new Set(current);
      next.delete(photoId);
      return next;
    });
    setPhotoReloadTokens((current) => ({
      ...current,
      [photoId]: (current[photoId] || 0) + 1,
    }));
  };

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
      ]
        .filter(Boolean)
        .join("");
    }

    // Fallback: search in client notes (parsed CNPJ address)
    if (details.client?.notes) {
      const match = details.client.notes.match(
        /Endereço Receita Federal:\s*(.*)/i,
      );
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
          scheduledDate: data.scheduledDate
            ? new Date(data.scheduledDate).toISOString().slice(0, 10)
            : "",
          scheduledTime: data.scheduledTime || "",
          techIds: data.technicians?.map((t: any) => t.userId) || [],
          priority: data.priority || "MEDIA",
        });

        setEditForm({
          priority: data.priority || "MEDIA",
          type: data.type || "PREVENTIVA",
          serviceCategory: data.serviceCategory || "GERAL",
          problemReported: data.problemReported || "",
          technicalDiagnosis: data.technicalDiagnosis || "",
          notes: data.notes || "",
        });

        let parsedChecklist = [];
        try {
          const rawChecklist = JSON.parse(data.checklistJson || "[]");
          parsedChecklist = Array.isArray(rawChecklist)
            ? rawChecklist
                .map((item: any) => ({
                  ...item,
                  label: String(
                    item.label || item.task || item.name || "",
                  ).trim(),
                  checked: Boolean(item.checked),
                }))
                .filter((item: any) => item.label)
            : [];
        } catch (e) {
          console.error("Error parsing checklistJson:", e);
        }
        if (parsedChecklist.length === 0) {
          parsedChecklist = getServiceChecklistTemplate(
            data.serviceCategory || "GERAL",
          );
        }
        setChecklist(parsedChecklist);

        if (data.completionReport) {
          setReportForm({
            executedServices: data.completionReport.executedServices || "",
            technicalObservations:
              data.completionReport.technicalObservations || "",
            pendingActions: data.completionReport.pendingActions || "",
            operationalResult:
              data.completionReport.operationalResult || "OPERACIONAL",
            clientRepresentative:
              data.completionReport.clientRepresentative ||
              data.signatureName ||
              "",
            clientFeedback: data.completionReport.clientFeedback || "",
            warrantyTerms:
              data.completionReport.warrantyTerms ||
              "Garantia de 90 dias nos serviços prestados.",
            approvedByClient: data.completionReport.approvedByClient || false,
          });
        } else {
          setReportForm({
            executedServices: "",
            technicalObservations: "",
            pendingActions: "",
            operationalResult: "OPERACIONAL",
            clientRepresentative: data.signatureName || "",
            clientFeedback: "",
            warrantyTerms: "Garantia de 90 dias nos serviços prestados.",
            approvedByClient: false,
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
      const res = await updateOSDetails(
        id,
        { checklistJson: JSON.stringify(updated) },
        currentUser?.id || "",
      );
      if (res.success) {
        toast("Checklist atualizado!", "success");
      }
    } catch (e) {
      toast("Erro de conexão ao atualizar checklist", "error");
    }
  };

  const handleApplyChecklistModality = async (
    serviceCategory: string,
    force = false,
  ) => {
    if (
      !force &&
      serviceCategory === editForm.serviceCategory &&
      checklist.length > 0
    )
      return;
    const hasCompletedItems = checklist.some((item) => item.checked);
    if (
      hasCompletedItems &&
      !window.confirm(
        "A OS possui verificações concluídas. Trocar a modalidade substituirá o roteiro atual e preservará apenas itens iguais já marcados. Deseja continuar?",
      )
    )
      return;
    setActionLoading(true);
    try {
      const result = await applyOSChecklistTemplate(id, serviceCategory, true);
      if (!result.success) {
        toast(
          result.error || "Não foi possível aplicar o modelo de checklist.",
          "error",
        );
        return;
      }
      setChecklist(result.checklist);
      setEditForm((current) => ({ ...current, serviceCategory }));
      setDetails((current: any) =>
        current
          ? {
              ...current,
              serviceCategory,
              checklistJson: JSON.stringify(result.checklist),
            }
          : current,
      );
      toast(
        `Checklist de ${SERVICE_MODALITIES.find((item) => item.value === serviceCategory)?.label || "serviço"} aplicado.`,
        "success",
      );
    } finally {
      setActionLoading(false);
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
      const dateTime = new Date(
        `${scheduleForm.scheduledDate}T${scheduleForm.scheduledTime || "08:00"}:00`,
      );
      const res = await scheduleServiceOrder(
        id,
        {
          scheduledDate: dateTime,
          scheduledTime: scheduleForm.scheduledTime || "08:00",
          techIds: scheduleForm.techIds,
          priority: scheduleForm.priority,
        },
        currentUser?.id || "",
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
      const selectedProduct = dbProducts.find(
        (p) => p.id === materialForm.productId,
      );
      if (!selectedProduct) return;

      const currentMaterials =
        details.materials?.map((m: any) => ({
          productId: m.productId,
          quantity: m.quantity,
          salePrice: m.salePrice,
          usedQuantity: m.usedQuantity,
          status: m.status,
          acquisitionType: m.acquisitionType || "ESTOQUE",
        })) || [];

      // Check if product is already in the list, increment quantity
      const existingIdx = currentMaterials.findIndex(
        (m: any) => m.productId === materialForm.productId,
      );
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

      const res = await updateOSMaterials(
        id,
        currentMaterials,
        currentUser?.id || "",
      );
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
      const currentMaterials =
        details.materials
          ?.filter((m: any) => m.productId !== prodId)
          .map((m: any) => ({
            productId: m.productId,
            quantity: m.quantity,
            salePrice: m.salePrice,
            usedQuantity: m.usedQuantity,
            status: m.status,
            acquisitionType: m.acquisitionType || "ESTOQUE",
          })) || [];

      const res = await updateOSMaterials(
        id,
        currentMaterials,
        currentUser?.id || "",
      );
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
      const res = await updateOSStatus(
        id,
        newStatus,
        currentUser?.id || "",
        "Etapa atualizada pela ação operacional da OS.",
      );
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

  const preparePhotoFiles = async (files: File[]) => {
    if (!files.length) return;
    const availableSlots = Math.max(0, 20 - pendingPhotos.length);
    if (!availableSlots) {
      toast("O limite é de 20 fotos por lote.", "warning");
      return;
    }
    const selected = files.slice(0, availableSlots);
    const valid = selected.filter((file) => {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
        return false;
      return file.size > 0 && file.size <= 10 * 1024 * 1024;
    });
    if (valid.length !== selected.length)
      toast(
        "Algumas imagens foram ignoradas. Use JPG, PNG ou WebP com até 10 MB.",
        "warning",
      );
    setPhotoProgress({ mode: "preparing", done: 0, total: valid.length });
    try {
      const prepared = new Array<PendingOSPhoto>(valid.length);
      let cursor = 0;
      let completed = 0;
      const workers = Array.from(
        { length: Math.min(3, valid.length) },
        async () => {
          while (cursor < valid.length) {
            const index = cursor++;
            const file = valid[index];
            const optimized = await compressEvidenceImage(file);
            prepared[index] = {
              id: `${Date.now()}-${index}-${file.name}`,
              name: file.name,
              url: optimized.dataUrl,
              caption: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "),
              originalBytes: file.size,
              optimizedBytes: optimized.bytes,
              width: optimized.width,
              height: optimized.height,
            };
            completed += 1;
            setPhotoProgress({
              mode: "preparing",
              done: completed,
              total: valid.length,
            });
            await new Promise<void>((resolve) =>
              requestAnimationFrame(() => resolve()),
            );
          }
        },
      );
      await Promise.all(workers);
      setPendingPhotos((current) =>
        [...current, ...prepared.filter(Boolean)].slice(0, 20),
      );
      if (files.length > availableSlots)
        toast(
          `Foram adicionadas ${availableSlots} fotos. O máximo por lote é 20.`,
          "info",
        );
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Erro ao preparar as imagens.",
        "error",
      );
    } finally {
      setPhotoProgress(null);
    }
  };

  const handlePhotoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    await preparePhotoFiles(files);
  };

  const handlePhotoDrop = async (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    if (photoBusy) return;
    await preparePhotoFiles(Array.from(event.dataTransfer.files || []));
  };

  const handleAddPhotoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingPhotos.length) {
      toast("Selecione pelo menos uma imagem.", "error");
      return;
    }
    setPhotoProgress({
      mode: "uploading",
      done: 0,
      total: pendingPhotos.length,
    });
    try {
      const response = await addOSPhotos(
        id,
        pendingPhotos.map((photo) => ({
          step: photoStep,
          url: photo.url,
          caption: photo.caption,
        })),
      );
      const failedIndexes = new Set(response.failed.map((item) => item.index));
      const failed = pendingPhotos.filter((_, index) =>
        failedIndexes.has(index),
      );
      const saved = response.saved;
      setPhotoProgress({
        mode: "uploading",
        done: pendingPhotos.length,
        total: pendingPhotos.length,
      });
      setPendingPhotos(failed);
      if (saved) await loadDetails();
      if (!failed.length)
        toast(
          `${saved} foto${saved === 1 ? "" : "s"} cadastrada${saved === 1 ? "" : "s"} com sucesso!`,
          "success",
        );
      else
        toast(
          `${saved} foto(s) salva(s) e ${failed.length} com erro. As fotos com erro permaneceram no lote.`,
          "warning",
        );
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

  const saveReport = async (sendToBilling: boolean) => {
    setActionLoading(true);
    try {
      const res = await saveOSCompletionReport(id, {
        ...reportForm,
        sendToBilling,
      });
      if (res.success) {
        toast(
          sendToBilling
            ? "Relatório salvo e OS enviada ao faturamento."
            : reportForm.approvedByClient
              ? "Relatório aprovado e enviado. A OS está pronta para faturamento."
              : "Relatório salvo como pendente de aprovação.",
          "success",
        );
        await loadDetails();
        if (sendToBilling) openTab("faturamento", "Painel Fiscal");
      } else {
        toast(res.error || "Erro ao salvar relatório", "error");
      }
    } catch (err) {
      toast("Erro de conexão", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveReport = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveReport(false);
  };

  const handlePrintReport = async () => {
    if (preparingPrint) return;
    setPreparingPrint(true);
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      const report = document.querySelector<HTMLElement>(".print-a4-report");
      const images = Array.from(
        report?.querySelectorAll<HTMLImageElement>("img") || [],
      );
      const failed: HTMLImageElement[] = [];

      await Promise.all(
        images.map(async (image) => {
          if (!image.complete) {
            await new Promise<void>((resolve) => {
              const timeout = window.setTimeout(() => {
                failed.push(image);
                resolve();
              }, 12_000);
              image.addEventListener(
                "load",
                () => {
                  window.clearTimeout(timeout);
                  resolve();
                },
                { once: true },
              );
              image.addEventListener(
                "error",
                () => {
                  window.clearTimeout(timeout);
                  failed.push(image);
                  resolve();
                },
                { once: true },
              );
            });
          }
          if (!image.naturalWidth) {
            if (!failed.includes(image)) failed.push(image);
            return;
          }
          try {
            if (image.decode) await image.decode();
          } catch {
            if (!image.naturalWidth && !failed.includes(image))
              failed.push(image);
          }
        }),
      );

      if (failed.length) {
        toast(
          `${failed.length} imagem(ns) não carregaram. Verifique os arquivos antes de gerar o PDF.`,
          "error",
        );
        return;
      }
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      window.print();
    } finally {
      setPreparingPrint(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-zinc-400 flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs font-semibold animate-pulse">
          Carregando detalhes da OS...
        </p>
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
          action: () => setIsScheduleOpen(true),
        };
      case "AGENDADA":
        return {
          title: "Iniciar deslocamento",
          desc: "A equipe está escalada. Registre a saída para manter o acompanhamento operacional atualizado.",
          btn: "Iniciar deslocamento",
          action: () => handleUpdateStatus("DESLOCAMENTO"),
        };
      case "DESLOCAMENTO":
        return {
          title: "Iniciar atendimento no local",
          desc: "A equipe está em deslocamento. Ao chegar, inicie a execução do serviço.",
          btn: "Iniciar execução",
          action: () => handleUpdateStatus("EXECUCAO"),
        };
      case "EXECUCAO":
        return {
          title: "Concluir Atendimento Técnico",
          desc: "Preencha o diagnóstico, conclua o checklist e registre os materiais antes de fechar.",
          btn: "Concluir OS",
          action: () => handleUpdateStatus("CONCLUIDA"),
        };
      case "PAUSADA":
      case "AGUARDANDO_PECA":
      case "AGUARDANDO_CLIENTE":
        return {
          title: "Retomar atendimento",
          desc: "A pendência foi resolvida? Retome a execução para continuar o serviço.",
          btn: "Retomar execução",
          action: () => handleUpdateStatus("EXECUCAO"),
        };
      case "RETORNO":
        return {
          title: "Converter o retorno legado em visita",
          desc: "Abra o histórico de visitas e programe a nova ida sem apagar o atendimento anterior.",
          btn: "Abrir visitas",
          action: () => setSubTab("visits"),
        };
      case "CONCLUIDA":
      case "REVISAO":
        return {
          title: "Finalizar relatório e obter aprovação",
          desc: "Registre o parecer técnico e a confirmação do cliente para liberar o faturamento.",
          btn: "Abrir relatório",
          action: () => setSubTab("relatorio"),
        };
      case "RELATORIO_ENVIADO":
        return {
          title: "Enviar para o controle fiscal",
          desc: "O relatório foi aprovado. Libere a OS no espelho de notas fiscais.",
          btn: "Liberar faturamento",
          action: () => handleUpdateStatus("FATURAMENTO"),
        };
      case "FATURAMENTO":
        return {
          title: "Registrar a nota fiscal",
          desc: "A OS está no controle fiscal aguardando número e valor definitivo da NF.",
          btn: "Abrir painel fiscal",
          action: () => openTab("faturamento", "Painel Fiscal"),
        };
      default:
        return null;
    }
  };

  const nextAction = getNextAction();

  const currentStage = (() => {
    if (["CRIADA", "AGUARDANDO_AGENDAMENTO"].includes(details.status)) return 1;
    if (["AGENDADA", "RETORNO"].includes(details.status)) return 2;
    if (
      [
        "DESLOCAMENTO",
        "EXECUCAO",
        "PAUSADA",
        "AGUARDANDO_PECA",
        "AGUARDANDO_CLIENTE",
      ].includes(details.status)
    )
      return 3;
    if (["CONCLUIDA", "REVISAO"].includes(details.status)) return 4;
    if (details.status === "RELATORIO_ENVIADO") return 5;
    if (details.status === "FATURAMENTO") return 6;
    if (details.status === "FATURADA") return 7;
    return 1;
  })();

  const timelineSteps = [
    { label: "Orçamento", completed: true },
    {
      label: "OS Criada",
      completed: currentStage > 1,
      active: currentStage === 1,
    },
    {
      label: "Agendada",
      completed: currentStage > 2,
      active: currentStage === 2,
    },
    {
      label: "Execução",
      completed: currentStage > 3,
      active: currentStage === 3,
    },
    {
      label: "Concluída",
      completed: currentStage > 4,
      active: currentStage === 4,
    },
    {
      label: "Relatório",
      completed: currentStage > 5,
      active: currentStage === 5,
    },
    {
      label: "Faturamento",
      completed: currentStage > 6,
      active: currentStage === 6,
    },
    {
      label: "Faturada",
      completed: currentStage >= 7,
      active: currentStage === 7,
    },
  ];

  const secondaryActions =
    details.status === "AGENDADA"
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
  const estimatedMarginPercent =
    totalValue > 0 ? (estimatedMargin / totalValue) * 100 : 0;
  const photoBusy = Boolean(photoProgress);
  const photoProgressPercent = photoProgress?.total
    ? Math.round((photoProgress.done / photoProgress.total) * 100)
    : 0;
  const pendingOriginalBytes = pendingPhotos.reduce(
    (sum, photo) => sum + photo.originalBytes,
    0,
  );
  const pendingOptimizedBytes = pendingPhotos.reduce(
    (sum, photo) => sum + photo.optimizedBytes,
    0,
  );
  const pendingReduction = pendingOriginalBytes
    ? Math.max(
        0,
        Math.round((1 - pendingOptimizedBytes / pendingOriginalBytes) * 100),
      )
    : 0;
  const completedChecklistItems = checklist.filter(
    (item) => item.checked,
  ).length;
  const reportPhotos = details.photos || [];
  const reportPhotoCounts = {
    ANTES: reportPhotos.filter((photo: any) => photo.step === "ANTES").length,
    DEPOIS: reportPhotos.filter((photo: any) => photo.step === "DEPOIS").length,
    EVIDENCIA: reportPhotos.filter(
      (photo: any) => !["ANTES", "DEPOIS"].includes(photo.step),
    ).length,
  };
  const reportReadinessItems = [
    {
      label: "Execução",
      ready: Boolean(
        reportForm.executedServices.trim() || details.items?.length,
      ),
    },
    {
      label: "Parecer",
      ready: Boolean(reportForm.technicalObservations.trim()),
    },
    { label: "Evidências", ready: reportPhotos.length > 0 },
    { label: "Aceite", ready: reportForm.approvedByClient },
  ];
  const reportReadiness = Math.round(
    (reportReadinessItems.filter((item) => item.ready).length /
      reportReadinessItems.length) *
      100,
  );
  const operationalResultLabels: Record<string, string> = {
    OPERACIONAL: "Operacional",
    OPERACIONAL_COM_RESSALVAS: "Operacional com ressalvas",
    PENDENTE: "Serviço pendente",
    NAO_TESTADO: "Não foi possível testar",
  };

  const fillExecutedServicesFromOS = () => {
    const descriptions = (details.items || [])
      .map((item: any) => item.description?.trim())
      .filter(Boolean)
      .map((description: string) => `• ${description}`)
      .join("\n");
    if (!descriptions) {
      toast(
        "A OS ainda não possui serviços cadastrados para preencher o resumo.",
        "warning",
      );
      return;
    }
    setReportForm((current) => ({
      ...current,
      executedServices: descriptions,
    }));
    toast("Resumo preenchido com os serviços cadastrados na OS.", "success");
  };

  return (
    <div className="os-detail-tab mx-auto w-full max-w-[1600px] space-y-5 select-none animate-in fade-in duration-200 sm:space-y-6">
      <div className="flex items-center gap-1.5 text-xs text-zinc-400">
        <button
          onClick={() => openTab("ordens-servico", "Ordens de Serviço")}
          className="hover:text-teal-700"
        >
          Ordens de Serviço
        </button>
        <ChevronRight size={13} />
        <span className="font-mono text-zinc-500">
          {details.code || details.id.slice(-4)}
        </span>
      </div>

      <section className="relative overflow-hidden rounded-[26px] border border-amber-900/25 bg-gradient-to-br from-[#17130d] via-[#3a2d16] to-[#7a5f1d] p-5 text-white shadow-[0_22px_55px_rgba(88,66,18,.24)] sm:p-7">
        <div className="absolute -right-24 -top-28 h-72 w-72 rounded-full bg-blue-400/20 blur-3xl" />
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="relative min-w-0">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[.22em] text-blue-200">
              Central de execução técnica
            </p>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="break-words text-2xl font-black tracking-tight text-white sm:text-3xl">
                {details.client?.name || details.clientName}
              </h1>
              <StatusBadge status={details.status} />
            </div>
            <p className="mt-1 font-mono text-sm font-bold text-blue-200">
              OS #{details.code || details.id.slice(-4)}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-blue-50/90">
              <span className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 ring-1 ring-white/10">
                <Users size={15} className="text-blue-200" />{" "}
                {details.technicians
                  ?.map(
                    (t: any) => t.user?.name || t.name || t.technician?.name,
                  )
                  .filter(Boolean)
                  .join(", ") || "Técnico não atribuído"}
              </span>
              <span className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 ring-1 ring-white/10">
                <Calendar size={15} className="text-blue-200" />{" "}
                {details.scheduledDate
                  ? formatDate(details.scheduledDate)
                  : "Agendamento a definir"}
              </span>
              <span className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 font-mono ring-1 ring-white/10">
                <DollarSign size={15} className="text-blue-200" />{" "}
                {formatCurrency(totalValue)}
              </span>
            </div>
          </div>
          <div className="relative flex w-full shrink-0 flex-wrap gap-2 lg:w-auto">
            <Button
              variant="secondary"
              onClick={() => setSubTab("relatorio")}
              className="flex-1 border-white/15 bg-white/10 text-white hover:bg-white/20 hover:text-white sm:flex-none"
            >
              <Camera size={15} /> Relatório & fotos
            </Button>
            <Button
              variant="secondary"
              onClick={handlePrintReport}
              loading={preparingPrint}
              className="flex-1 border-white/15 bg-white text-blue-800 hover:bg-blue-50 sm:flex-none"
            >
              <Printer size={15} /> Emitir PDF
            </Button>
          </div>
        </div>
      </section>

      {details.contract && (
        <section className="overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-sm dark:border-indigo-950 dark:bg-zinc-900">
          <div className="flex flex-col gap-4 bg-gradient-to-r from-indigo-50 to-blue-50/60 p-5 dark:from-indigo-950/30 dark:to-blue-950/20 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
                <ShieldCheck size={20} />
              </span>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[.18em] text-indigo-600 dark:text-indigo-300">
                  Atendimento coberto por contrato
                </p>
                <h2 className="mt-1 text-base font-black text-zinc-950 dark:text-white">
                  {details.contract.address?.label ||
                    details.client?.fancyName ||
                    details.client?.name}
                </h2>
                <p className="mt-1 text-[10px] font-semibold text-zinc-500">
                  {details.contract.code} ·{" "}
                  {details.operationKind === "VISITA_PREVENTIVA"
                    ? `Visita preventiva ${details.referenceMonth || ""}`
                    : "Chamado da loja"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => openTab("preventivas", "Central de Preventivas")}
              >
                <Store size={14} /> Central da loja
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  window.open(
                    `/relatorios/loja/${details.contract.id}`,
                    "_blank",
                    "noopener,noreferrer",
                  )
                }
              >
                <FileText size={14} /> Dossiê completo
              </Button>
            </div>
          </div>
          <div className="grid gap-3 border-t border-indigo-100 p-4 dark:border-indigo-950 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-zinc-800/50">
              <p className="text-[9px] font-black uppercase text-zinc-400">
                Loja / execução
              </p>
              <p className="mt-1 text-xs font-bold text-zinc-700 dark:text-zinc-200">
                {details.contract.address
                  ? `${details.contract.address.street}, ${details.contract.address.number} · ${details.contract.address.city}/${details.contract.address.state}`
                  : "Endereço ainda não definido"}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-zinc-800/50">
              <p className="text-[9px] font-black uppercase text-zinc-400">
                Escopo contratado
              </p>
              <p className="mt-1 text-xs font-bold text-zinc-700 dark:text-zinc-200">
                {details.contract.items.length} item(ns) ·{" "}
                {details.contract.billingPeriod.toLowerCase()}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-zinc-800/50">
              <p className="text-[9px] font-black uppercase text-zinc-400">
                Histórico da loja
              </p>
              <p className="mt-1 text-xs font-bold text-zinc-700 dark:text-zinc-200">
                {details.contract.serviceOrders.length} atendimento(s)
                recente(s)
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between gap-4">
          <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            {timelineSteps.map((step, index) => (
              <div
                key={step.label}
                className={`h-full flex-1 ${index ? "ml-0.5" : ""} ${index < currentStage ? "bg-emerald-500" : index === currentStage ? "bg-teal-600" : "bg-zinc-200 dark:bg-zinc-700"}`}
              />
            ))}
          </div>
          <span className="hidden shrink-0 font-mono text-xs text-zinc-400 sm:inline">
            {Math.min(currentStage + 1, timelineSteps.length)}/
            {timelineSteps.length}
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-sm">
            <span className="font-mono text-xs text-zinc-400">
              Etapa {Math.min(currentStage + 1, timelineSteps.length)} de{" "}
              {timelineSteps.length}
            </span>{" "}
            <span className="font-semibold text-zinc-900 dark:text-white">
              ·{" "}
              {timelineSteps[currentStage]?.label ||
                timelineSteps.at(-1)?.label}
            </span>
          </p>
          <button
            type="button"
            onClick={() => setPipelineExpanded((value) => !value)}
            className="hidden items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-800 md:inline-flex"
          >
            {pipelineExpanded ? "Ocultar etapas" : "Ver todas as etapas"}
            <ChevronDown
              size={14}
              className={`transition-transform ${pipelineExpanded ? "rotate-180" : ""}`}
            />
          </button>
        </div>
        {pipelineExpanded && (
          <div className="mt-4 hidden grid-cols-8 gap-1 border-t border-zinc-100 pt-4 dark:border-zinc-800 md:grid">
            {timelineSteps.map((step, index) => (
              <div
                key={step.label}
                className="flex flex-col items-center gap-1.5 text-center"
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${index < currentStage ? "bg-emerald-500 text-white" : index === currentStage ? "bg-teal-600 text-white" : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800"}`}
                >
                  {index < currentStage ? <Check size={12} /> : index + 1}
                </span>
                <span
                  className={`text-[11px] leading-tight ${index === currentStage ? "font-semibold text-teal-700" : "text-zinc-400"}`}
                >
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {nextAction && (
        <section className="relative rounded-xl border border-teal-100 bg-teal-50/70 p-5 dark:border-teal-950 dark:bg-teal-950/20">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-600 text-white">
                <Wrench size={20} />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-400">
                  Próxima ação recomendada
                </p>
                <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
                  {nextAction.title}
                </h3>
                <p className="mt-0.5 text-sm text-zinc-500">
                  {nextAction.desc}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {secondaryActions.length > 0 && (
                <div className="relative">
                  <Button
                    variant="secondary"
                    onClick={() => setActionsOpen((value) => !value)}
                  >
                    Mais ações <ChevronDown size={15} />
                  </Button>
                  {actionsOpen && (
                    <>
                      <button
                        aria-label="Fechar menu"
                        className="fixed inset-0 z-10 cursor-default"
                        onClick={() => setActionsOpen(false)}
                      />
                      <div className="absolute right-0 z-20 mt-1.5 w-52 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                        {secondaryActions.map((item) => (
                          <button
                            key={item.status}
                            onClick={() => {
                              setActionsOpen(false);
                              if (item.status === "VISITS") setSubTab("visits");
                              else void handleUpdateStatus(item.status);
                            }}
                            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                          >
                            <MoreHorizontal
                              size={15}
                              className="text-zinc-400"
                            />
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
              <Button
                variant="success"
                loading={actionLoading}
                onClick={nextAction.action}
              >
                <Check size={16} /> {nextAction.btn}
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Visão executiva e atalhos operacionais */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          {
            label: "Valor da OS",
            value: formatCurrency(totalValue),
            detail: `Margem ${estimatedMarginPercent.toFixed(0)}%`,
            icon: DollarSign,
            tab: "resumo",
            color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30",
          },
          {
            label: "Visitas",
            value: String(details.visits?.length || 0),
            detail: details.scheduledDate
              ? `Próxima ${formatDate(details.scheduledDate)}`
              : "Sem agendamento",
            icon: CalendarClock,
            tab: "visits",
            color: "bg-blue-50 text-blue-600 dark:bg-blue-950/30",
          },
          {
            label: "Checklist",
            value: `${completedChecklistItems}/${checklist.length}`,
            detail: checklist.length
              ? `${Math.round((completedChecklistItems / checklist.length) * 100)}% verificado`
              : "Roteiro não iniciado",
            icon: ClipboardList,
            tab: "checklist",
            color: "bg-violet-50 text-violet-600 dark:bg-violet-950/30",
          },
          {
            label: "Materiais",
            value: String(details.materials?.length || 0),
            detail: "peças vinculadas",
            icon: Package,
            tab: "materials",
            color: "bg-amber-50 text-amber-600 dark:bg-amber-950/30",
          },
          {
            label: "Ativos",
            value: String(details.serviceOrderAssets?.length || 0),
            detail: "equipamentos atendidos",
            icon: Boxes,
            tab: "assets",
            color: "bg-cyan-50 text-cyan-600 dark:bg-cyan-950/30",
          },
          {
            label: "Evidências",
            value: String(details.photos?.length || 0),
            detail: `Relatório ${reportReadiness}%`,
            icon: Camera,
            tab: "relatorio",
            color: "bg-rose-50 text-rose-600 dark:bg-rose-950/30",
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              type="button"
              key={item.label}
              onClick={() => setSubTab(item.tab as typeof subTab)}
              className={`rounded-2xl border bg-white p-4 text-left shadow-[0_8px_24px_rgba(15,23,42,.05)] transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-[0_12px_28px_rgba(37,99,235,.09)] dark:bg-zinc-900 ${subTab === item.tab ? "border-blue-300 ring-4 ring-blue-500/5" : "border-slate-200 dark:border-zinc-800"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${item.color}`}
                >
                  <Icon size={17} />
                </span>
                <span className="text-[8px] font-black uppercase tracking-wider text-zinc-400">
                  {item.label}
                </span>
              </div>
              <p className="mt-3 truncate text-lg font-black text-zinc-950 dark:text-white">
                {item.value}
              </p>
              <p className="mt-1 truncate text-[9px] font-semibold text-zinc-400">
                {item.detail}
              </p>
            </button>
          );
        })}
      </section>

      {/* Workspace de largura total */}
      <div>
        <Card className="flex min-h-[620px] flex-col overflow-hidden p-0">
          {/* Tabs Selector */}
          <div className="grid grid-cols-2 gap-2 border-b border-zinc-150 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-800/30 sm:grid-cols-4 xl:grid-cols-8">
            {[
              { id: "resumo", label: "Descrição do Serviço", icon: FileText },
              {
                id: "visits",
                label: `Visitas (${details.visits?.length || 0})`,
                icon: CalendarClock,
              },
              {
                id: "assets",
                label: `Ativos (${details.serviceOrderAssets?.length || 0})`,
                icon: Boxes,
              },
              { id: "cliente", label: "Dados do Cliente", icon: Users },
              {
                id: "checklist",
                label: "Checklist Técnico",
                icon: ClipboardList,
              },
              { id: "materials", label: "Materiais (Estoque)", icon: Package },
              { id: "relatorio", label: "Relatório & Fotos", icon: Camera },
              { id: "history", label: "Histórico / Auditoria", icon: History },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSubTab(tab.id as any)}
                  className={`flex min-h-12 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-center text-xs font-bold transition-all ${
                    subTab === tab.id
                      ? "bg-blue-600 text-white shadow-[0_7px_16px_rgba(37,99,235,.18)]"
                      : "border border-transparent text-zinc-500 hover:border-slate-200 hover:bg-white hover:text-blue-700 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
                  }`}
                >
                  <Icon size={15} /> {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex-1 p-5 sm:p-7 xl:p-8">
            {/* SUBTAB: Resumo / Descrição */}
            {subTab === "resumo" && (
              <form onSubmit={handleSaveOSDetails} className="space-y-6">
                <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 dark:border-zinc-800 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[.18em] text-blue-600">
                      Planejamento e diagnóstico
                    </p>
                    <h3 className="mt-1 text-xl font-black tracking-tight text-zinc-950 dark:text-white">
                      Escopo técnico da ordem de serviço
                    </h3>
                    <p className="mt-1 text-xs font-medium text-zinc-500">
                      Centralize a solicitação, o diagnóstico de campo e as
                      decisões internas do atendimento.
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1.5 font-mono text-[10px] font-black text-zinc-500 dark:bg-zinc-800">
                    {details.code}
                  </span>
                </div>

                <section className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50/80 to-indigo-50/60 p-5 dark:border-blue-950 dark:from-blue-950/20 dark:to-indigo-950/20">
                  <p className="mb-4 flex items-center gap-2 text-xs font-black text-blue-950 dark:text-blue-200">
                    <Wrench size={15} /> Classificação operacional
                  </p>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <Select
                      label="Prioridade OS"
                      options={[
                        { value: "BAIXA", label: "Baixa" },
                        { value: "MEDIA", label: "Média" },
                        { value: "ALTA", label: "Alta" },
                        { value: "URGENTE", label: "Urgente" },
                      ]}
                      value={editForm.priority}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          priority: e.target.value,
                        }))
                      }
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
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          type: e.target.value,
                        }))
                      }
                    />
                    <Select
                      label="Modalidade técnica"
                      options={SERVICE_MODALITIES.map((item) => ({
                        value: item.value,
                        label: item.label,
                      }))}
                      value={editForm.serviceCategory}
                      disabled={actionLoading}
                      onChange={(e) =>
                        void handleApplyChecklistModality(e.target.value)
                      }
                    />
                  </div>
                </section>

                <div className="grid gap-4 xl:grid-cols-2">
                  <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-zinc-500">
                      1. Solicitação / problema relatado
                    </label>
                    <textarea
                      value={editForm.problemReported}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          problemReported: e.target.value,
                        }))
                      }
                      className="min-h-[180px] w-full resize-y rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-sm leading-relaxed text-zinc-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-100"
                      placeholder="Descreva a falha ou a solicitação do cliente..."
                    />
                  </section>

                  <section className="rounded-2xl border border-teal-100 bg-teal-50/20 p-5 dark:border-teal-950 dark:bg-teal-950/10">
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-teal-700 dark:text-teal-400">
                      2. Diagnóstico técnico / laudo de campo
                    </label>
                    <textarea
                      value={editForm.technicalDiagnosis}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          technicalDiagnosis: e.target.value,
                        }))
                      }
                      className="min-h-[180px] w-full resize-y rounded-xl border border-teal-200 bg-white p-4 text-sm leading-relaxed text-zinc-800 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 dark:border-teal-900 dark:bg-zinc-900 dark:text-zinc-100"
                      placeholder="Descreva as medições, testes, constatações e laudos técnicos..."
                    />
                  </section>
                </div>

                <section className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5 dark:border-amber-900/50 dark:bg-amber-950/10">
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-400">
                    3. Notas internas de gestão
                  </label>
                  <textarea
                    value={editForm.notes}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
                    className="min-h-[110px] w-full resize-y rounded-xl border border-amber-200 bg-white p-4 text-sm leading-relaxed text-zinc-800 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 dark:border-amber-900 dark:bg-zinc-900 dark:text-zinc-100"
                    placeholder="Observações de faturamento ou detalhes operacionais adicionais..."
                  />
                </section>

                <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[10px] font-semibold text-zinc-400">
                    As alterações ficam registradas no histórico da OS.
                  </p>
                  <Button
                    variant="primary"
                    type="submit"
                    loading={actionLoading}
                    size="lg"
                  >
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
                technicians={systemUsers.filter((systemUser) =>
                  ["Técnico", "Gestor", "Administrador"].includes(
                    systemUser.roleName,
                  ),
                )}
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
                <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-150 uppercase tracking-wider">
                  Informações Técnicas do Cliente
                </h4>
                <div className="space-y-3.5 text-xs font-semibold text-zinc-650 dark:text-zinc-350">
                  <p className="flex items-center gap-2">
                    <User size={14} className="text-zinc-400" />{" "}
                    {details.client?.name || details.clientName}
                  </p>
                  <p className="flex items-center gap-2">
                    <MapPin size={14} className="text-zinc-400" />{" "}
                    {details.addressLabel || "Instalação Principal"}
                  </p>
                  {details.client?.phone && (
                    <p className="flex items-center gap-2">
                      <Phone size={14} className="text-zinc-400" />{" "}
                      {details.client.phone}
                    </p>
                  )}
                  {details.client?.email && (
                    <p className="flex items-center gap-2">
                      <Mail size={14} className="text-zinc-400" />{" "}
                      {details.client.email}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* SUBTAB: Checklist */}
            {subTab === "checklist" && (
              <div className="space-y-5">
                <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-white">
                  <div className="grid gap-4 p-5 sm:grid-cols-[1fr_220px] sm:items-center">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-300">
                        Roteiro técnico inteligente
                      </p>
                      <h4 className="mt-1 text-lg font-semibold">
                        Checklist por modalidade
                      </h4>
                      <p className="mt-1 text-xs leading-relaxed text-slate-300">
                        Escolha a disciplina do atendimento. O sistema gera as
                        verificações específicas e mantém o roteiro vinculado à
                        OS.
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.06] p-3">
                      <p className="text-[10px] font-bold uppercase text-slate-400">
                        Progresso do roteiro
                      </p>
                      <p className="mt-1 text-xl font-semibold">
                        {completedChecklistItems}/{checklist.length}
                      </p>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-teal-400 transition-all"
                          style={{
                            width: `${checklist.length ? (completedChecklistItems / checklist.length) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
                  <Select
                    label="Modalidade do serviço"
                    options={SERVICE_MODALITIES.map((item) => ({
                      value: item.value,
                      label: item.label,
                    }))}
                    value={editForm.serviceCategory}
                    disabled={actionLoading}
                    onChange={(e) =>
                      void handleApplyChecklistModality(e.target.value)
                    }
                  />
                  <div className="mt-3 flex flex-col gap-2 border-t border-zinc-200 pt-3 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
                    <p className="text-xs leading-relaxed text-zinc-500">
                      {
                        SERVICE_MODALITIES.find(
                          (item) => item.value === editForm.serviceCategory,
                        )?.description
                      }
                    </p>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={actionLoading}
                      onClick={() =>
                        void handleApplyChecklistModality(
                          editForm.serviceCategory,
                          true,
                        )
                      }
                    >
                      <ClipboardList size={13} /> Recarregar modelo
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  {checklist.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleToggleChecklist(idx)}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-xs transition-all ${item.checked ? "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/20" : "border-zinc-200 bg-white hover:border-teal-300 hover:bg-teal-50/30 dark:border-zinc-800 dark:bg-zinc-900"}`}
                    >
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => {}} // Handled by container onClick
                        className="w-4 h-4 rounded text-primary border-zinc-300 focus:ring-primary cursor-pointer"
                      />
                      <span
                        className={`font-semibold leading-relaxed ${item.checked ? "text-emerald-800 dark:text-emerald-300" : "text-zinc-800 dark:text-zinc-200"}`}
                      >
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
                  <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-150 uppercase tracking-wider">
                    Peças Aplicadas
                  </h4>
                  {hasPermission("os.write") && details.status !== "PAGO" && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsAddMaterialOpen(true)}
                    >
                      <Plus size={14} /> Adicionar Item
                    </Button>
                  )}
                </div>

                {!details.materials || details.materials.length === 0 ? (
                  <p className="text-xs text-zinc-400 text-center py-8">
                    Nenhum material registrado nesta OS.
                  </p>
                ) : (
                  <Table
                    headers={[
                      "Item do Estoque",
                      "Origem",
                      "Quantidade",
                      "Valor Unitário",
                      "Ações",
                    ]}
                  >
                    {details.materials.map((m: any) => (
                      <TableRow key={m.productId}>
                        <TableCell className="font-bold text-zinc-850 dark:text-zinc-200">
                          {m.product?.name || m.productName || "Peça"}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              m.acquisitionType === "COMPRA_FUTURA"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                            }`}
                          >
                            {m.acquisitionType === "COMPRA_FUTURA"
                              ? "Compra Futura"
                              : "Em Estoque"}
                          </span>
                        </TableCell>
                        <TableCell className="font-semibold text-zinc-650 dark:text-zinc-400">
                          {m.quantity} un
                        </TableCell>
                        <TableCell className="font-semibold text-zinc-800 dark:text-zinc-150">
                          {formatCurrency(m.salePrice || m.unitPrice || 0)}
                        </TableCell>
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
                <form
                  onSubmit={handleSaveReport}
                  className="space-y-5 border-b border-zinc-150 pb-6 dark:border-zinc-800"
                >
                  <div className="overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 text-white shadow-sm">
                    <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_190px] lg:items-center">
                      <div>
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-teal-300">
                          <FileText size={14} /> Relatório operacional
                        </div>
                        <h4 className="mt-2 text-xl font-semibold">
                          Conclusão técnica da OS
                        </h4>
                        <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-300">
                          Registre o que foi realizado, a condição final e as
                          evidências. O documento do cliente não exibe preços,
                          custos ou margens.
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {reportReadinessItems.map((item) => (
                            <span
                              key={item.label}
                              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${item.ready ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200" : "border-white/10 bg-white/5 text-slate-400"}`}
                            >
                              {item.ready ? (
                                <CheckCircle size={11} />
                              ) : (
                                <Clock size={11} />
                              )}
                              {item.label}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 text-center">
                        <p className="text-3xl font-semibold tabular-nums">
                          {reportReadiness}%
                        </p>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Prontidão do relatório
                        </p>
                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-teal-400 transition-all"
                            style={{ width: `${reportReadiness}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                          1. Serviços efetivamente executados *
                        </label>
                        <button
                          type="button"
                          onClick={fillExecutedServicesFromOS}
                          className="text-[10px] font-bold text-teal-700 hover:text-teal-800"
                        >
                          Preencher pela OS
                        </button>
                      </div>
                      <textarea
                        rows={6}
                        value={reportForm.executedServices}
                        onChange={(e) =>
                          setReportForm((prev) => ({
                            ...prev,
                            executedServices: e.target.value,
                          }))
                        }
                        placeholder="Descreva objetivamente cada atividade concluída..."
                        className="w-full resize-y rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 text-xs leading-relaxed text-zinc-800 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-100"
                      />
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                      <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                        2. Parecer técnico / condição encontrada *
                      </label>
                      <textarea
                        rows={6}
                        value={reportForm.technicalObservations}
                        onChange={(e) =>
                          setReportForm((prev) => ({
                            ...prev,
                            technicalObservations: e.target.value,
                          }))
                        }
                        placeholder="Diagnóstico final, testes realizados e condição técnica entregue..."
                        className="w-full resize-y rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 text-xs leading-relaxed text-zinc-800 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-100"
                      />
                    </div>
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 dark:border-amber-900/50 dark:bg-amber-950/10">
                      <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400">
                        3. Pendências e recomendações
                      </label>
                      <textarea
                        rows={4}
                        value={reportForm.pendingActions}
                        onChange={(e) =>
                          setReportForm((prev) => ({
                            ...prev,
                            pendingActions: e.target.value,
                          }))
                        }
                        placeholder="Itens pendentes, retorno necessário, peças recomendadas ou 'Sem pendências'..."
                        className="w-full resize-y rounded-xl border border-amber-200 bg-white p-3 text-xs leading-relaxed text-zinc-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 dark:border-amber-900 dark:bg-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                      <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                        4. Comentário do cliente
                      </label>
                      <textarea
                        rows={4}
                        value={reportForm.clientFeedback}
                        onChange={(e) =>
                          setReportForm((prev) => ({
                            ...prev,
                            clientFeedback: e.target.value,
                          }))
                        }
                        placeholder="Comentário ou ressalva informada pelo responsável da loja..."
                        className="w-full resize-y rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 text-xs leading-relaxed text-zinc-800 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-100"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <Select
                      label="Condição final do atendimento *"
                      options={[
                        { value: "OPERACIONAL", label: "Operacional" },
                        {
                          value: "OPERACIONAL_COM_RESSALVAS",
                          label: "Operacional com ressalvas",
                        },
                        { value: "PENDENTE", label: "Serviço pendente" },
                        {
                          value: "NAO_TESTADO",
                          label: "Não foi possível testar",
                        },
                      ]}
                      value={reportForm.operationalResult}
                      onChange={(e) =>
                        setReportForm((prev) => ({
                          ...prev,
                          operationalResult: e.target.value,
                        }))
                      }
                    />
                    <Input
                      label="Responsável do cliente"
                      placeholder="Nome de quem conferiu o serviço"
                      value={reportForm.clientRepresentative}
                      onChange={(e) =>
                        setReportForm((prev) => ({
                          ...prev,
                          clientRepresentative: e.target.value,
                        }))
                      }
                    />
                    <Input
                      label="Garantia do serviço"
                      value={reportForm.warrantyTerms}
                      onChange={(e) =>
                        setReportForm((prev) => ({
                          ...prev,
                          warrantyTerms: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
                      <p className="text-[10px] font-bold uppercase text-zinc-400">
                        Checklist
                      </p>
                      <p className="mt-1 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                        {completedChecklistItems}/{checklist.length} verificados
                      </p>
                    </div>
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
                      <p className="text-[10px] font-bold uppercase text-zinc-400">
                        Fotos
                      </p>
                      <p className="mt-1 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                        {reportPhotoCounts.ANTES} antes ·{" "}
                        {reportPhotoCounts.DEPOIS} depois ·{" "}
                        {reportPhotoCounts.EVIDENCIA} outras
                      </p>
                    </div>
                    <label
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${reportForm.approvedByClient ? "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/20" : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"}`}
                    >
                      <input
                        type="checkbox"
                        checked={reportForm.approvedByClient}
                        onChange={(e) =>
                          setReportForm((prev) => ({
                            ...prev,
                            approvedByClient: e.target.checked,
                          }))
                        }
                        className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>
                        <span className="block text-[10px] font-bold uppercase text-zinc-400">
                          Aceite do cliente
                        </span>
                        <span className="mt-1 block text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                          {reportForm.approvedByClient
                            ? "Aprovado"
                            : "Aguardando aceite"}
                        </span>
                      </span>
                    </label>
                  </div>

                  <div className="flex flex-col-reverse gap-2 border-t border-zinc-200 pt-5 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={handlePrintReport}
                      loading={preparingPrint}
                    >
                      <Printer size={14} /> Visualizar / salvar PDF
                    </Button>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        variant="primary"
                        type="submit"
                        loading={actionLoading}
                      >
                        Salvar relatório
                      </Button>
                      {["CONCLUIDA", "REVISAO", "RELATORIO_ENVIADO"].includes(
                        details.status,
                      ) && (
                        <Button
                          variant="success"
                          type="button"
                          loading={actionLoading}
                          disabled={!reportForm.approvedByClient}
                          onClick={() => void saveReport(true)}
                        >
                          <CircleDollarSign size={14} /> Salvar e enviar ao
                          faturamento
                        </Button>
                      )}
                    </div>
                  </div>
                </form>

                {/* Part B: Evidências Fotográficas */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-150 uppercase tracking-wider flex items-center gap-1.5">
                      <Camera size={14} className="text-primary" /> Evidências
                      Fotográficas (Fotos)
                    </h4>
                    <span className="text-[10px] font-semibold text-zinc-400">
                      {details.photos?.length || 0} foto(s)
                    </span>
                  </div>

                  {/* Exibir Fotos */}
                  {!details.photos || details.photos.length === 0 ? (
                    <p className="text-xs text-zinc-400 text-center py-6 bg-zinc-55 dark:bg-zinc-800/5 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
                      Nenhuma foto cadastrada neste relatório.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {details.photos
                        .slice(0, photoGalleryLimit)
                        .map((photo: any, index: number) => (
                          <div
                            key={photo.id}
                            className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900/50 relative flex flex-col justify-between"
                          >
                            <div>
                              <div className="relative aspect-video w-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden">
                                {failedPhotoIds.has(photo.id) ? (
                                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center">
                                    <AlertTriangle
                                      size={24}
                                      className="text-amber-500"
                                    />
                                    <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-200">
                                      Não foi possível abrir esta foto
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => retryPhoto(photo.id)}
                                      className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-blue-600 shadow-sm hover:border-blue-300 hover:bg-blue-50 dark:border-zinc-700 dark:bg-zinc-900"
                                    >
                                      <RefreshCw size={11} /> Tentar novamente
                                    </button>
                                  </div>
                                ) : photo.url.startsWith("data:") ||
                                  photo.url.startsWith("http") ||
                                  photo.url.startsWith("/") ? (
                                  <img
                                    src={`${photo.url}${photoReloadTokens[photo.id] ? `${photo.url.includes("?") ? "&" : "?"}retry=${photoReloadTokens[photo.id]}` : ""}`}
                                    alt={photo.caption || "Evidência"}
                                    loading={index < 3 ? "eager" : "lazy"}
                                    fetchPriority={index < 3 ? "high" : "low"}
                                    decoding="async"
                                    onLoad={() =>
                                      setFailedPhotoIds((current) => {
                                        if (!current.has(photo.id))
                                          return current;
                                        const next = new Set(current);
                                        next.delete(photo.id);
                                        return next;
                                      })
                                    }
                                    onError={() =>
                                      setFailedPhotoIds((current) =>
                                        new Set(current).add(photo.id),
                                      )
                                    }
                                    className="object-cover w-full h-full"
                                  />
                                ) : (
                                  <div className="text-center p-4">
                                    <Image
                                      size={24}
                                      className="mx-auto text-zinc-350 mb-1"
                                    />
                                    <span className="text-[10px] text-zinc-400 break-all">
                                      {photo.url}
                                    </span>
                                  </div>
                                )}
                                <span
                                  className={`absolute top-2 left-2 px-2 py-0.5 rounded text-[8px] font-bold uppercase text-white ${
                                    photo.step === "ANTES"
                                      ? "bg-amber-500"
                                      : photo.step === "DEPOIS"
                                        ? "bg-emerald-600"
                                        : "bg-blue-600"
                                  }`}
                                >
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
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          setPhotoGalleryLimit((current) => current + 12)
                        }
                      >
                        Mostrar mais{" "}
                        {Math.min(
                          12,
                          details.photos.length - photoGalleryLimit,
                        )}{" "}
                        fotos
                      </Button>
                    </div>
                  )}

                  {/* Adicionar Fotos Form */}
                  <form
                    onSubmit={handleAddPhotoSubmit}
                    className="space-y-4 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/60 to-white p-5 dark:border-blue-950 dark:from-blue-950/20 dark:to-zinc-900"
                  >
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-[.16em] text-blue-700 dark:text-blue-300">
                          Carregamento rápido em lote
                        </span>
                        <p className="mt-1 text-[10px] font-semibold text-zinc-400">
                          Otimização paralela e um único envio para o servidor.
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1.5 text-[10px] font-black text-blue-700 shadow-sm dark:bg-zinc-900 dark:text-blue-300">
                        {pendingPhotos.length}/20 fotos
                      </span>
                    </div>

                    <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-[220px_1fr]">
                      <Select
                        label="Etapa da OS *"
                        options={[
                          { value: "ANTES", label: "Antes do Serviço" },
                          { value: "DEPOIS", label: "Depois do Serviço" },
                          {
                            value: "EVIDENCIA",
                            label: "Outra Evidência / Laudo",
                          },
                        ]}
                        value={photoStep}
                        disabled={photoBusy}
                        onChange={(e) => setPhotoStep(e.target.value)}
                      />

                      <div className="flex">
                        <label
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => void handlePhotoDrop(event)}
                          className="flex min-h-[88px] flex-1 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-blue-200 bg-white px-4 py-3 text-center transition hover:border-blue-500 hover:bg-blue-50 dark:border-blue-900 dark:bg-zinc-900 dark:hover:bg-blue-950/30"
                        >
                          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg">
                            <Upload size={17} />
                          </span>
                          <span className="mt-2 text-xs font-black text-zinc-800 dark:text-white">
                            Selecionar ou arrastar fotos
                          </span>
                          <span className="mt-0.5 text-[9px] font-semibold text-zinc-400">
                            JPG, PNG ou WebP · até 20 por lote
                          </span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            multiple
                            disabled={photoBusy}
                            onChange={handlePhotoUpload}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>

                    {pendingPhotos.length > 0 && (
                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-xl border border-blue-100 bg-white p-3 dark:border-blue-900 dark:bg-zinc-900">
                          <p className="text-[8px] font-black uppercase text-zinc-400">
                            Tamanho original
                          </p>
                          <p className="mt-1 text-xs font-black text-zinc-800 dark:text-white">
                            {(pendingOriginalBytes / 1024 / 1024).toFixed(1)} MB
                          </p>
                        </div>
                        <div className="rounded-xl border border-emerald-100 bg-white p-3 dark:border-emerald-900 dark:bg-zinc-900">
                          <p className="text-[8px] font-black uppercase text-zinc-400">
                            Lote otimizado
                          </p>
                          <p className="mt-1 text-xs font-black text-emerald-600">
                            {(pendingOptimizedBytes / 1024 / 1024).toFixed(1)}{" "}
                            MB
                          </p>
                        </div>
                        <div className="rounded-xl border border-violet-100 bg-white p-3 dark:border-violet-900 dark:bg-zinc-900">
                          <p className="text-[8px] font-black uppercase text-zinc-400">
                            Redução
                          </p>
                          <p className="mt-1 text-xs font-black text-violet-600">
                            {pendingReduction}% menor
                          </p>
                        </div>
                      </div>
                    )}

                    {photoProgress && (
                      <div
                        className="rounded-xl border border-blue-100 bg-blue-50 p-3 dark:border-blue-950 dark:bg-blue-950/20"
                        role="status"
                        aria-live="polite"
                      >
                        <div className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold text-blue-800 dark:text-blue-300">
                          <span>
                            {photoProgress.mode === "preparing"
                              ? "Otimizando imagens"
                              : "Salvando fotos na OS"}
                          </span>
                          <span>
                            {photoProgress.done}/{photoProgress.total} ·{" "}
                            {photoProgressPercent}%
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-blue-100 dark:bg-blue-950">
                          <div
                            className="h-full rounded-full bg-blue-600 transition-[width] duration-300 ease-out"
                            style={{ width: `${photoProgressPercent}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {pendingPhotos.length > 0 && (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {pendingPhotos.map((photo) => (
                          <div
                            key={photo.id}
                            className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                          >
                            <div className="relative aspect-video bg-zinc-100 dark:bg-zinc-800">
                              <img
                                src={photo.url}
                                alt={photo.name}
                                className="h-full w-full object-cover"
                              />
                              <button
                                type="button"
                                disabled={photoBusy}
                                onClick={() =>
                                  setPendingPhotos((current) =>
                                    current.filter(
                                      (item) => item.id !== photo.id,
                                    ),
                                  )
                                }
                                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                                title="Remover do lote"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                            <div className="space-y-2 p-3">
                              <div className="flex items-center justify-between gap-2">
                                <p
                                  className="truncate text-[10px] font-semibold text-zinc-400"
                                  title={photo.name}
                                >
                                  {photo.name}
                                </p>
                                <span className="shrink-0 text-[9px] font-black text-emerald-600">
                                  {Math.max(
                                    1,
                                    Math.round(photo.optimizedBytes / 1024),
                                  )}{" "}
                                  KB
                                </span>
                              </div>
                              <Input
                                aria-label={`Legenda de ${photo.name}`}
                                placeholder="Legenda da foto"
                                value={photo.caption}
                                disabled={photoBusy}
                                onChange={(event) =>
                                  setPendingPhotos((current) =>
                                    current.map((item) =>
                                      item.id === photo.id
                                        ? {
                                            ...item,
                                            caption: event.target.value,
                                          }
                                        : item,
                                    ),
                                  )
                                }
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-col-reverse gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800 sm:flex-row sm:justify-between">
                      <Button
                        variant="secondary"
                        type="button"
                        disabled={!pendingPhotos.length || photoBusy}
                        onClick={() => setPendingPhotos([])}
                      >
                        Limpar lote
                      </Button>
                      <Button
                        variant="primary"
                        type="submit"
                        loading={photoProgress?.mode === "uploading"}
                        disabled={!pendingPhotos.length || photoBusy}
                      >
                        <Upload size={14} /> Cadastrar{" "}
                        {pendingPhotos.length || ""} foto
                        {pendingPhotos.length === 1 ? "" : "s"}
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* SUBTAB: History */}
            {subTab === "history" && (
              <div className="space-y-4">
                <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-150 uppercase tracking-wider">
                  Histórico de Auditoria
                </h4>
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl divide-y divide-zinc-150 dark:divide-zinc-800 overflow-hidden text-xs">
                  {details.statusHistory?.length ? (
                    details.statusHistory.map((h: any) => (
                      <div
                        key={h.id}
                        className="p-3.5 hover:bg-zinc-50/20 flex justify-between items-start gap-4"
                      >
                        <div>
                          <p className="font-bold text-zinc-800 dark:text-zinc-200">
                            <span className="text-zinc-400">{h.oldStatus}</span>{" "}
                            →{" "}
                            <span className="font-bold text-primary">
                              {h.newStatus}
                            </span>
                          </p>
                          {h.changedBy?.name && (
                            <p className="text-[10px] text-zinc-500 mt-1">
                              Responsável: {h.changedBy.name}
                            </p>
                          )}
                          {h.justification && (
                            <p className="text-[10px] text-zinc-400 mt-1 leading-relaxed">
                              {h.justification}
                            </p>
                          )}
                        </div>
                        <span className="text-[10px] text-zinc-450 dark:text-zinc-500 whitespace-nowrap">
                          {formatDateTime(h.changedAt)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-zinc-400 text-center py-8">
                      Sem histórico de status.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Schedule Modal */}
      <Modal
        isOpen={isScheduleOpen}
        onClose={() => setIsScheduleOpen(false)}
        title="Agendar Técnico & Prioridade"
      >
        <form onSubmit={handleSchedule} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Data de Execução *"
              type="date"
              required
              value={scheduleForm.scheduledDate}
              onChange={(e) =>
                setScheduleForm((prev) => ({
                  ...prev,
                  scheduledDate: e.target.value,
                }))
              }
            />
            <Input
              label="Horário Estimado"
              type="time"
              value={scheduleForm.scheduledTime}
              onChange={(e) =>
                setScheduleForm((prev) => ({
                  ...prev,
                  scheduledTime: e.target.value,
                }))
              }
            />
          </div>

          <Select
            label="Prioridade Operacional"
            options={[
              { value: "BAIXA", label: "Baixa" },
              { value: "MEDIA", label: "Média" },
              { value: "ALTA", label: "Alta" },
            ]}
            value={scheduleForm.priority}
            onChange={(e) =>
              setScheduleForm((prev) => ({ ...prev, priority: e.target.value }))
            }
          />

          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block">
              Escalar Técnicos de Campo *
            </label>
            <div className="grid grid-cols-2 gap-2 border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl max-h-40 overflow-y-auto">
              {systemUsers
                .filter(
                  (u) =>
                    u.roleName === "Técnico" ||
                    u.roleName === "Gestor" ||
                    u.roleName === "Administrador",
                )
                .map((tech) => (
                  <label
                    key={tech.id}
                    className="flex items-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-350 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={scheduleForm.techIds.includes(tech.id)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setScheduleForm((prev) => ({
                          ...prev,
                          techIds: checked
                            ? [...prev.techIds, tech.id]
                            : prev.techIds.filter((tid) => tid !== tech.id),
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
            <Button
              variant="secondary"
              type="button"
              onClick={() => setIsScheduleOpen(false)}
            >
              Cancelar
            </Button>
            <Button variant="primary" type="submit" loading={actionLoading}>
              Salvar Agendamento
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Material Modal */}
      <Modal
        isOpen={isAddMaterialOpen}
        onClose={() => setIsAddMaterialOpen(false)}
        title="Adicionar Peça / Material do Estoque"
      >
        <form onSubmit={handleAddMaterial} className="space-y-4">
          <Select
            label="Escolha a Peça *"
            options={dbProducts.map((p) => ({
              value: p.id,
              label: `${p.name} (${p.stockQuantity || p.quantity || 0} un em estoque)`,
            }))}
            value={materialForm.productId}
            onChange={(e) =>
              setMaterialForm((prev) => ({
                ...prev,
                productId: e.target.value,
              }))
            }
          />

          <Select
            label="Origem do Material *"
            options={[
              {
                value: "ESTOQUE",
                label: "Material do Estoque (Deduzir do Saldo)",
              },
              {
                value: "COMPRA_FUTURA",
                label: "Compra Futura / Sob Encomenda (Não deduzir do Estoque)",
              },
            ]}
            value={materialForm.acquisitionType}
            onChange={(e) =>
              setMaterialForm((prev) => ({
                ...prev,
                acquisitionType: e.target.value,
              }))
            }
          />

          <Input
            label="Quantidade Utilizada *"
            type="number"
            required
            min={1}
            value={materialForm.quantity}
            onChange={(e) =>
              setMaterialForm((prev) => ({
                ...prev,
                quantity: parseInt(e.target.value) || 1,
              }))
            }
          />

          <div className="pt-4 flex justify-end gap-3">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setIsAddMaterialOpen(false)}
            >
              Cancelar
            </Button>
            <Button variant="primary" type="submit" loading={actionLoading}>
              Adicionar Material
            </Button>
          </div>
        </form>
      </Modal>

      {/* Blueprint PDF template matching the print layout */}
      {details && (
        <>
          <style
            dangerouslySetInnerHTML={{
              __html: `
            @media print {
              @page { size: A4 portrait; margin: 10mm; }
              html, body { print-color-adjust: exact !important; -webkit-print-color-adjust: exact !important; }
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
          `,
            }}
          />
          <div className="print-a4-report hidden print:block bg-white text-zinc-850 font-sans space-y-5">
            {/* Header Block */}
            <div className="rounded-xl bg-slate-950 p-5 text-white flex justify-between items-start">
              <div className="max-w-[68%]">
                <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-teal-300">
                  Relatório operacional de campo
                </p>
                <h1 className="mt-1 text-lg font-bold uppercase tracking-tight">
                  {companyParams.corporateName}
                </h1>
                <p className="text-[9px] text-slate-300 mt-1">
                  CNPJ: {companyParams.cnpj} | IE:{" "}
                  {companyParams.stateRegistration || "ISENTO"} | IM:{" "}
                  {companyParams.municipalRegistration || "N/A"}
                </p>
                <p className="text-[9px] text-slate-300">
                  {companyParams.email} | {companyParams.phone}
                </p>
              </div>
              <div className="text-right">
                <span className="block text-[9px] font-bold uppercase text-slate-400">
                  Ordem de serviço
                </span>
                <span className="mt-0.5 block text-lg font-bold">
                  #{details.code || details.id.slice(-4)}
                </span>
                <span className="mt-2 inline-block rounded-full bg-teal-400/15 px-2.5 py-1 text-[8px] font-bold uppercase text-teal-200">
                  {operationalResultLabels[reportForm.operationalResult] ||
                    "Operacional"}
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
                  <p>
                    <span className="text-zinc-550 font-bold">
                      Cliente / Razão Social:
                    </span>{" "}
                    {details.client?.name || details.clientName}
                  </p>
                  <p className="mt-1">
                    <span className="text-zinc-550 font-bold">CNPJ / CPF:</span>{" "}
                    {details.client?.cpfCnpj || "Não informado"}
                  </p>
                  {details.contact && (
                    <p className="mt-1">
                      <span className="text-zinc-550 font-bold">Contato:</span>{" "}
                      {details.contact.name} ({details.contact.phone})
                    </p>
                  )}
                </div>
                <div>
                  <p>
                    <span className="text-zinc-550 font-bold">
                      Local de Instalação:
                    </span>{" "}
                    {getClientAddress()}
                  </p>
                  {details.client?.phone && !details.contact && (
                    <p className="mt-1">
                      <span className="text-zinc-550 font-bold">Telefone:</span>{" "}
                      {details.client.phone}
                    </p>
                  )}
                  {details.client?.email && (
                    <p className="mt-1">
                      <span className="text-zinc-550 font-bold">E-mail:</span>{" "}
                      {details.client.email}
                    </p>
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
                  <p>
                    <span className="text-zinc-550 font-bold">
                      Tipo de Serviço:
                    </span>{" "}
                    {details.type}
                  </p>
                  <p className="mt-1">
                    <span className="text-zinc-550 font-bold">Prioridade:</span>{" "}
                    {details.priority}
                  </p>
                </div>
                <div>
                  <p>
                    <span className="text-zinc-550 font-bold">
                      Data de Agendamento:
                    </span>{" "}
                    {details.scheduledDate
                      ? formatDate(details.scheduledDate)
                      : "A definir"}
                  </p>
                  <p className="mt-1">
                    <span className="text-zinc-550 font-bold">
                      Horário Agendado:
                    </span>{" "}
                    {details.scheduledTime || "09:00"}
                  </p>
                </div>
                <div>
                  <p>
                    <span className="text-zinc-550 font-bold">
                      Técnico Responsável:
                    </span>{" "}
                    {details.technicians
                      ?.map(
                        (t: any) =>
                          t.user?.name || t.name || t.technician?.name,
                      )
                      .filter(Boolean)
                      .join(", ") || "Não atribuído"}
                  </p>
                  {details.completedAt && (
                    <p className="mt-1">
                      <span className="text-zinc-550 font-bold">
                        Data de Conclusão:
                      </span>{" "}
                      {formatDateTime(details.completedAt)}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-xs pt-1">
                <p>
                  <span className="text-zinc-550 font-bold block mb-0.5">
                    Descrição do Problema / Solicitação do Cliente:
                  </span>
                </p>
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
                    <div
                      key={idx}
                      className="flex items-center gap-2 border-b border-zinc-100 pb-1"
                    >
                      <span
                        className={`font-mono font-bold ${item.checked ? "text-emerald-600" : "text-zinc-400"}`}
                      >
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
                  <span className="text-[9px] font-bold text-zinc-450 block uppercase">
                    Serviços Executados
                  </span>
                  <table className="w-full text-left text-xs border border-zinc-200 rounded-lg overflow-hidden">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-200 font-bold text-zinc-750">
                        <th className="p-2">Descrição</th>
                        <th className="p-2 text-center w-24">Quantidade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {details.items.map((item: any, idx: number) => (
                        <tr
                          key={idx}
                          className="border-b border-zinc-150 last:border-b-0 text-zinc-650"
                        >
                          <td className="p-2 font-semibold text-zinc-800">
                            {item.description}
                          </td>
                          <td className="p-2 text-center">
                            {item.quantity} {item.unit || "UN"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Materials Table */}
              {details.materials && details.materials.length > 0 && (
                <div className="space-y-1 pt-1">
                  <span className="text-[9px] font-bold text-zinc-450 block uppercase">
                    Peças e Insumos do Estoque Utilizados
                  </span>
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
                        <tr
                          key={idx}
                          className="border-b border-zinc-150 last:border-b-0 text-zinc-650"
                        >
                          <td className="p-2 font-semibold text-zinc-800">
                            {m.product?.name || m.name}
                          </td>
                          <td className="p-2 text-center">
                            {m.usedQuantity || m.quantity}
                          </td>
                          <td className="p-2 text-center">
                            <span className="text-zinc-755 font-bold">
                              {m.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Section E: Completion Report */}
            {(reportForm.executedServices ||
              reportForm.technicalObservations ||
              reportForm.pendingActions) && (
              <div className="space-y-2">
                <h3 className="text-[10px] font-bold text-zinc-900 uppercase tracking-wider border-b pb-1 border-zinc-200">
                  5. Resultado do Atendimento & Parecer Técnico
                </h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-zinc-550 font-bold block mb-0.5">
                      Serviços efetivamente executados:
                    </span>
                    <div className="p-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-700 leading-relaxed min-h-[50px]">
                      <span className="whitespace-pre-line">
                        {reportForm.executedServices ||
                          details.items
                            ?.map((item: any) => item.description)
                            .join("; ") ||
                          "Não informado."}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-zinc-550 font-bold block mb-0.5">
                      Parecer técnico e condição final:
                    </span>
                    <div className="p-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-700 leading-relaxed min-h-[50px]">
                      <span className="font-bold">
                        {operationalResultLabels[
                          reportForm.operationalResult
                        ] || "Operacional"}
                        .
                      </span>{" "}
                      {reportForm.technicalObservations ||
                        "Sem observações adicionais."}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-zinc-550 font-bold block mb-0.5">
                      Pendências e recomendações:
                    </span>
                    <div className="min-h-[38px] rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-zinc-700">
                      {reportForm.pendingActions ||
                        "Sem pendências registradas."}
                    </div>
                  </div>
                  <div>
                    <span className="text-zinc-550 font-bold block mb-0.5">
                      Comentário do cliente:
                    </span>
                    <div className="min-h-[38px] rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 text-zinc-700">
                      {reportForm.clientFeedback ||
                        "Nenhum comentário registrado."}
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-zinc-650 pt-1">
                  <span className="font-bold">Garantia:</span>{" "}
                  {reportForm.warrantyTerms ||
                    "Garantia de 90 dias nos serviços prestados."}{" "}
                  <span className="mx-2">•</span>{" "}
                  <span className="font-bold">Responsável pelo aceite:</span>{" "}
                  {reportForm.clientRepresentative ||
                    details.signatureName ||
                    "Não informado"}
                </p>
              </div>
            )}

            {/* Section F: Photo Evidence */}
            {details.photos && details.photos.length > 0 && (
              <div className="space-y-2" style={{ pageBreakBefore: "always" }}>
                <h3 className="text-[10px] font-bold text-zinc-900 uppercase tracking-wider border-b pb-1 border-zinc-200">
                  6. Registro Fotográfico de Evidências (Antes / Depois /
                  Equipamento)
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {details.photos.map((photo: any, idx: number) => (
                    <div
                      key={idx}
                      className="print-photo-card border border-zinc-200 rounded-lg overflow-hidden bg-white p-2 flex flex-col justify-between"
                    >
                      <div className="print-photo-image-wrap relative aspect-video w-full bg-zinc-50 flex items-center justify-center overflow-hidden">
                        <img
                          src={photo.url}
                          alt={photo.caption || "Evidência"}
                          loading="eager"
                          decoding="sync"
                          className="print-photo-image object-cover w-full h-full"
                        />
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-[8px] font-bold uppercase text-white bg-zinc-900/80">
                          {photo.step}
                        </span>
                      </div>
                      <p className="pt-2 text-[10px] font-semibold text-zinc-650 leading-snug">
                        <span className="font-bold">Legenda:</span>{" "}
                        {photo.caption || "Sem observações detalhadas."}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Section G: Signatures */}
            <div
              className="pt-8 grid grid-cols-2 gap-8 text-xs text-center"
              style={{ pageBreakInside: "avoid" }}
            >
              <div className="flex flex-col items-center justify-end">
                <div className="w-48 border-b border-zinc-400 mb-1.5" />
                <span className="font-bold text-zinc-800">
                  Assinatura do Técnico Responsável
                </span>
                <span className="text-[10px] text-zinc-400 mt-0.5">
                  {details.technicians
                    ?.map(
                      (t: any) => t.user?.name || t.name || t.technician?.name,
                    )
                    .filter(Boolean)
                    .join(", ") || "Técnico"}
                </span>
              </div>
              <div className="flex flex-col items-center justify-end">
                {details.signatureBase64 ? (
                  <div className="max-h-16 h-12 overflow-hidden mb-1 flex items-center justify-center">
                    <img
                      src={details.signatureBase64}
                      alt="Assinatura Cliente"
                      loading="eager"
                      decoding="sync"
                      className="object-contain max-h-full"
                    />
                  </div>
                ) : (
                  <div className="h-12 flex items-center justify-center text-[10px] text-zinc-400 italic mb-1">
                    [ Assinatura Digital Ausente ]
                  </div>
                )}
                <div className="w-48 border-b border-zinc-400 mb-1.5" />
                <span className="font-bold text-zinc-800">
                  Assinatura do Cliente / Responsável
                </span>
                <span className="text-[10px] text-zinc-400 mt-0.5">
                  {details.signatureName ||
                    details.client?.name ||
                    "Representante do Cliente"}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
