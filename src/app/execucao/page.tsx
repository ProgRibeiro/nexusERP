"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getTechnicianOS,
  makeOSCheckin,
  makeOSStartExecution,
  submitTechnicalExecution,
} from "@/app/actions/executionActions";
import { getVisitExecutionForm, saveVisitFormDraft } from "@/app/actions/formActions";
import {
  cacheTechnicianVisits,
  deleteFieldDraft,
  enqueueFieldCommand,
  listFieldCommands,
  loadCachedTechnicianVisits,
  loadFieldDraft,
  removeFieldCommand,
  saveFieldDraft,
  updateFieldCommand,
  type FieldQueueCommand,
} from "@/lib/fieldOffline";
import { formatPhone } from "@/lib/utils";
import {
  Wrench,
  User,
  MapPin,
  Clock,
  Camera,
  Signature,
  FileCheck,
  ArrowLeft,
  Loader2,
  CheckCircle,
  AlertCircle,
  Smartphone,
  Navigation,
  FileText,
  Activity,
  PlusCircle,
  Check,
  ArrowRight,
  Sun,
  Moon,
  Trash2,
  ChevronLeft,
  Search,
  RefreshCw,
  WifiOff,
  CalendarDays
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ToastProvider } from "@/components/ui/Toast";
import ErrorReporter from "@/components/ErrorReporter";

function getCurrentLocation(): Promise<{ latitude: number; longitude: number; accuracy?: number } | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8_000, maximumAge: 30_000 },
    );
  });
}

interface DynamicQuestion {
  id: string;
  code: string;
  label: string;
  helpText?: string | null;
  type: string;
  required: boolean;
  options: string[];
  measurementDefinition?: {
    code: string;
    unit: string;
    minValue?: number | null;
    maxValue?: number | null;
    decimals: number;
  } | null;
}

interface VisitExecutionForm {
  submissionId: string;
  status: string;
  template: { id: string; code: string; name: string; description?: string | null; category: string; version: number };
  sections: Array<{ id: string; title: string; description?: string | null; questions: DynamicQuestion[] }>;
  values: Record<string, string | number | boolean | null>;
}

interface OfflineDraft {
  diagnosis: string;
  visitForm: VisitExecutionForm | null;
  formAnswers: Record<string, string | number | boolean>;
  photos: Array<{ step: "ANTES" | "DEPOIS" | "EVIDENCIA"; url: string; caption: string; uploaded: boolean }>;
  signatureName: string;
  signatureData: string;
  clientFeedback: string;
}

export default function ExecucaoTecnicaPage() {
  const { user } = useAuth();

  const [techOrders, setTechOrders] = useState<any[]>([]);
  const [selectedOS, setSelectedOS] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [pendingSync, setPendingSync] = useState(0);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("TODAS");

  // Form states
  const [diagnosis, setDiagnosis] = useState("");
  const [visitForm, setVisitForm] = useState<VisitExecutionForm | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formAnswers, setFormAnswers] = useState<Record<string, string | number | boolean>>({});
  const [photos, setPhotos] = useState<any[]>([
    { step: "ANTES", url: "", caption: "Foto antes da limpeza", uploaded: false },
    { step: "DEPOIS", url: "", caption: "Foto após conclusão", uploaded: false },
  ]);
  const [signatureName, setSignatureName] = useState("");
  const [signatureData, setSignatureData] = useState("");
  const [clientFeedback, setClientFeedback] = useState("");

  // Canvas ref for digital signature
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const filteredOrders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return techOrders.filter((order) => {
      const matchesStatus = statusFilter === "TODAS" || order.status === statusFilter;
      const haystack = [order.code, order.client?.name, order.clientName, order.addressLabel, order.problemReported, order.assetName].filter(Boolean).join(" ").toLowerCase();
      return matchesStatus && (!term || haystack.includes(term));
    });
  }, [searchTerm, statusFilter, techOrders]);

  async function loadTechOrders() {
    if (!user) return;
    setLoading(true);
    try {
      if (navigator.onLine) {
        const data = await getTechnicianOS(user.id);
        setTechOrders(data);
        await cacheTechnicianVisits(user.id, data);
      } else {
        const cached = await loadCachedTechnicianVisits<any[]>(user.id);
        setTechOrders(cached?.visits || []);
      }
    } catch (err) {
      console.error(err);
      const cached = await loadCachedTechnicianVisits<any[]>(user.id).catch(() => undefined);
      setTechOrders(cached?.visits || []);
    } finally {
      setLoading(false);
    }
  }

  async function refreshPendingSync() {
    const commands = await listFieldCommands().catch(() => []);
    setPendingSync(commands.length);
  }

  useEffect(() => {
    loadTechOrders();
    void refreshPendingSync();
  }, [user]);

  useEffect(() => {
    const syncConnection = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) void syncPendingCommands();
    };
    const timer = window.setTimeout(syncConnection, 0);
    window.addEventListener("online", syncConnection);
    window.addEventListener("offline", syncConnection);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("online", syncConnection);
      window.removeEventListener("offline", syncConnection);
    };
  }, []);

  useEffect(() => {
    if (!selectedOS) {
      setVisitForm(null);
      setFormAnswers({});
      return;
    }
    let active = true;
    const loadExecution = async () => {
      setFormLoading(true);
      const localDraft = await loadFieldDraft<OfflineDraft>(selectedOS.id).catch(() => undefined);
      if (localDraft?.data && active) {
        setDiagnosis(localDraft.data.diagnosis || "");
        setVisitForm(localDraft.data.visitForm || null);
        setFormAnswers(localDraft.data.formAnswers || {});
        setPhotos(localDraft.data.photos?.length ? localDraft.data.photos : photos);
        setSignatureName(localDraft.data.signatureName || "");
        setSignatureData(localDraft.data.signatureData || "");
        setClientFeedback(localDraft.data.clientFeedback || "");
        setDraftSavedAt(localDraft.updatedAt);
      }
      if (navigator.onLine) {
        const result = await getVisitExecutionForm(selectedOS.id);
        if (active && result.success) {
          setVisitForm(result.form);
          setFormAnswers((current) => ({ ...result.form.values, ...current } as Record<string, string | number | boolean>));
        }
      }
      if (active) setFormLoading(false);
    };
    void loadExecution();
    return () => { active = false; };
  }, [selectedOS?.id]);

  useEffect(() => {
    if (!selectedOS) return;
    const timer = window.setTimeout(() => {
      const draft: OfflineDraft = {
        diagnosis,
        visitForm,
        formAnswers,
        photos,
        signatureName,
        signatureData,
        clientFeedback,
      };
      void saveFieldDraft(selectedOS.id, draft).then(() => setDraftSavedAt(new Date().toISOString())).catch(console.error);
      if (online && visitForm?.submissionId) {
        const answers = Object.entries(formAnswers).map(([questionId, value]) => ({ questionId, value }));
        void saveVisitFormDraft(visitForm.submissionId, answers);
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [selectedOS?.id, diagnosis, visitForm, formAnswers, photos, signatureName, signatureData, clientFeedback, online]);

  // Initialize Canvas stroke styling
  useEffect(() => {
    if (selectedOS && selectedOS.status === "EM_EXECUCAO" && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.strokeStyle = "#1e293b";
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        if (signatureData) {
          const image = new window.Image();
          image.onload = () => ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          image.src = signatureData;
        }
      }
    }
  }, [selectedOS, selectedOS?.status, signatureData]);

  // Drawing event handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const coords = getEventCoords(e, canvas);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const coords = getEventCoords(e, canvas);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (canvasRef.current) setSignatureData(canvasRef.current.toDataURL("image/png"));
  };

  const clearCanvas = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureData("");
  };

  const getEventCoords = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
    canvas: HTMLCanvasElement
  ) => {
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  };

  async function executeQueuedCommand(command: FieldQueueCommand) {
    if (command.type === "CHECKIN") {
      return makeOSCheckin(command.visitId, command.userId, (command.payload || undefined) as { latitude: number; longitude: number; accuracy?: number } | undefined);
    }
    if (command.type === "START") {
      return makeOSStartExecution(command.visitId, command.userId, (command.payload || undefined) as { latitude: number; longitude: number; accuracy?: number } | undefined);
    }
    return submitTechnicalExecution(command.visitId, command.payload as Parameters<typeof submitTechnicalExecution>[1]);
  }

  async function syncPendingCommands() {
    if (!navigator.onLine || syncing) return;
    setSyncing(true);
    try {
      const commands = await listFieldCommands();
      for (const command of commands) {
        const result = await executeQueuedCommand(command);
        if (!result.success) {
          await updateFieldCommand({ ...command, attempts: command.attempts + 1 });
          break;
        }
        await removeFieldCommand(command.id);
        if (command.type === "FINISH") await deleteFieldDraft(command.visitId).catch(() => undefined);
      }
      await refreshPendingSync();
      if (user) await loadTechOrders();
    } catch (error) {
      console.error("Falha ao sincronizar fila de campo", error);
    } finally {
      setSyncing(false);
    }
  }

  const handleCheckin = async () => {
    if (!selectedOS || !user) return;
    setSubmitting(true);
    const location = await getCurrentLocation();
    if (!navigator.onLine) {
      await enqueueFieldCommand({ type: "CHECKIN", visitId: selectedOS.id, userId: user.id, payload: location });
      setSelectedOS({ ...selectedOS, status: "EM_DESLOCAMENTO", syncStatus: "PENDENTE" });
      await refreshPendingSync();
      setSubmitting(false);
      alert("Deslocamento salvo no aparelho. Será sincronizado quando a conexão voltar.");
      return;
    }
    const res = await makeOSCheckin(selectedOS.id, user.id, location || undefined);
    if (res.success) {
      setSelectedOS({ ...selectedOS, status: "EM_DESLOCAMENTO" });
      await loadTechOrders();
      alert("Deslocamento iniciado!");
    } else {
      alert("Erro no checkin: " + res.error);
    }
    setSubmitting(false);
  };

  const handleStartWork = async () => {
    if (!selectedOS || !user) return;
    setSubmitting(true);
    const location = await getCurrentLocation();
    if (!navigator.onLine) {
      await enqueueFieldCommand({ type: "START", visitId: selectedOS.id, userId: user.id, payload: location });
      setSelectedOS({ ...selectedOS, status: "EM_EXECUCAO", syncStatus: "PENDENTE" });
      await refreshPendingSync();
      setSubmitting(false);
      alert("Início do serviço salvo no aparelho. Será sincronizado quando a conexão voltar.");
      return;
    }
    const res = await makeOSStartExecution(selectedOS.id, user.id, location || undefined);
    if (res.success) {
      setSelectedOS({ ...selectedOS, status: "EM_EXECUCAO" });
      await loadTechOrders();
      alert("Serviço iniciado no local!");
    } else {
      alert("Erro ao iniciar trabalho: " + res.error);
    }
    setSubmitting(false);
  };

  const handlePhotoFileSelected = (idx: number, file: File | undefined) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPhotos(
        photos.map((p, i) => {
          if (i !== idx) return p;
          return {
            ...p,
            uploaded: true,
            url: dataUrl,
          };
        })
      );
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = (idx: number) => {
    setPhotos(
      photos.map((p, i) => (i === idx ? { ...p, uploaded: false, url: "" } : p))
    );
  };

  const updateFormAnswer = (questionId: string, value: string | number | boolean) => {
    setFormAnswers((current) => ({ ...current, [questionId]: value }));
  };

  const resetExecutionForm = () => {
    setDiagnosis("");
    setVisitForm(null);
    setFormAnswers({});
    setPhotos(photos.map((photo) => ({ ...photo, uploaded: false, url: "" })));
    setSignatureName("");
    setSignatureData("");
    setClientFeedback("");
    setDraftSavedAt(null);
  };

  const handleFinishOS = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOS || !user) return;
    if (!diagnosis) {
      alert("Preencha o laudo técnico do atendimento.");
      return;
    }
    if (!signatureName.trim()) {
      alert("Preencha o nome do responsável pela assinatura.");
      return;
    }
    if (!visitForm) {
      alert("O formulário técnico ainda não foi carregado. Conecte-se uma vez ou aguarde o carregamento.");
      return;
    }

    const questions = visitForm.sections.flatMap((section) => section.questions);
    const missingRequired = questions.find((question) => {
      if (!question.required) return false;
      const value = formAnswers[question.id];
      if (question.type === "CHECKBOX") return value !== true;
      return value == null || String(value).trim() === "";
    });
    if (missingRequired) {
      alert(`Responda o campo obrigatório: ${missingRequired.label}.`);
      return;
    }
    const undocumentedNonConformity = visitForm.sections.find((section) => {
      const hasNonConformity = section.questions.some((question) => question.type === "SELECT"
        && question.options.includes("NAO_CONFORME")
        && formAnswers[question.id] === "NAO_CONFORME");
      const observationQuestion = section.questions.find((question) => question.code === "OBSERVACOES");
      return hasNonConformity && (!observationQuestion || !String(formAnswers[observationQuestion.id] || "").trim());
    });
    if (undocumentedNonConformity) {
      alert(`Descreva a não conformidade e a ação recomendada na etapa: ${undocumentedNonConformity.title}.`);
      return;
    }

    const signatureBase64 = signatureData || canvasRef.current?.toDataURL("image/png") || "";
    if (!signatureBase64) {
      alert("Colete a assinatura do responsável antes de concluir.");
      return;
    }

    setSubmitting(true);
    const measurementQuestions = questions.filter((question) => question.type === "MEASUREMENT" && question.measurementDefinition);
    const measurements = measurementQuestions.flatMap((question) => {
      const rawValue = formAnswers[question.id];
      const value = Number(rawValue);
      if (rawValue == null || String(rawValue).trim() === "" || !Number.isFinite(value) || !question.measurementDefinition) return [];
      return [{ definitionCode: question.measurementDefinition.code, value, rawValue: String(rawValue) }];
    });
    const measurementsStr = measurements.length
      ? measurements.map((measurement) => `${measurement.definitionCode}: ${measurement.rawValue}`).join(" | ")
      : "Não informadas";
    const formAnswerPayload = questions.map((question) => {
      const rawValue = formAnswers[question.id];
      const value = ["NUMBER", "MEASUREMENT"].includes(question.type) && rawValue != null && String(rawValue).trim()
        ? Number(rawValue)
        : rawValue ?? null;
      return { questionId: question.id, value };
    });
    const checklist = visitForm.sections.flatMap((section) => {
      const observationQuestion = section.questions.find((question) => question.code === "OBSERVACOES");
      const sectionObservation = observationQuestion ? String(formAnswers[observationQuestion.id] || "").trim() : "";
      return section.questions
        .filter((question) => (question.type === "CHECKBOX" && question.required)
          || (question.type === "SELECT" && question.options.includes("NAO_CONFORME")))
        .map((question) => {
        const value = formAnswers[question.id];
        const status = question.type === "CHECKBOX"
          ? (value === true ? "CONFORME" : "PENDENTE")
          : String(value || "PENDENTE");
        return {
          id: question.code,
          label: question.label,
          group: section.title,
          status,
          checked: status !== "PENDENTE",
          observation: status === "NAO_CONFORME" ? sectionObservation : "",
        };
        });
    });
    const payload: Parameters<typeof submitTechnicalExecution>[1] = {
      technicalDiagnosis: diagnosis,
      checklistJson: JSON.stringify(checklist),
      measurementsJson: measurementsStr,
      measurements,
      formSubmissionId: visitForm.submissionId,
      formAnswers: formAnswerPayload,
      photos: photos
        .filter((p) => p.uploaded)
        .map((p) => ({ step: p.step, url: p.url, caption: p.caption })),
      signatureBase64,
      signatureName,
      clientFeedback,
      userId: user.id,
    };

    if (!navigator.onLine) {
      await enqueueFieldCommand({ type: "FINISH", visitId: selectedOS.id, userId: user.id, payload });
      await refreshPendingSync();
      setSelectedOS(null);
      resetExecutionForm();
      setSubmitting(false);
      alert("Conclusão salva no aparelho. Fotos, checklist e assinatura serão enviados na ordem correta quando a conexão voltar.");
      return;
    }

    let res: Awaited<ReturnType<typeof submitTechnicalExecution>>;
    try {
      res = await submitTechnicalExecution(selectedOS.id, payload);
    } catch {
      await enqueueFieldCommand({ type: "FINISH", visitId: selectedOS.id, userId: user.id, payload });
      await refreshPendingSync();
      setSelectedOS(null);
      resetExecutionForm();
      setSubmitting(false);
      alert("A conexão caiu durante o envio. O atendimento ficou salvo e será sincronizado automaticamente.");
      return;
    }

    if (res.success) {
      alert("Visita concluída com sucesso! Documentação enviada para revisão técnica.");
      await deleteFieldDraft(selectedOS.id).catch(() => undefined);
      setSelectedOS(null);
      resetExecutionForm();
      await loadTechOrders();
    } else {
      alert("Erro ao finalizar OS: " + res.error);
    }
    setSubmitting(false);
  };

  return (
    <ToastProvider>
      <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans flex flex-col items-center p-3 dark:bg-zinc-950 dark:text-zinc-100 sm:p-5">
      {/* Header Bar */}
      <div className="sticky top-0 z-30 mb-4 flex w-full max-w-5xl items-center justify-between border-b border-zinc-200 bg-zinc-50/95 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        {selectedOS ? (
          <button
            onClick={() => setSelectedOS(null)}
            className="flex items-center gap-1 text-xs font-bold text-zinc-650 hover:text-zinc-900 cursor-pointer"
          >
            <ChevronLeft size={16} /> Voltar à lista
          </button>
        ) : (
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs font-bold text-zinc-650 hover:text-zinc-900"
          >
            <ArrowLeft size={14} /> Painel ERP
          </Link>
        )}
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${online ? "bg-emerald-500" : "bg-amber-500"}`} />
          <span className="hidden text-xs font-semibold tracking-tight sm:inline">Campo O Prestador · {online ? "online" : "offline"}</span>
          {pendingSync > 0 && (
            <button type="button" onClick={() => void syncPendingCommands()} disabled={!online || syncing} className="rounded-lg bg-amber-100 px-2 py-1 text-[9px] font-black text-amber-800 disabled:opacity-60">
              {syncing ? "Sincronizando" : `${pendingSync} pendente(s)`}
            </button>
          )}
        </div>
      </div>

      <div className={`w-full space-y-4 ${selectedOS ? "max-w-3xl" : "max-w-5xl"}`}>

        {/* Identidade do técnico autenticado */}
        {!selectedOS && (
          <Card className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                {user?.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h4 className="text-sm font-black text-zinc-800 dark:text-zinc-100">{user?.name}</h4>
                <p className="text-[10px] text-zinc-500 font-semibold">{user?.roleName}</p>
              </div>
            </div>
            <button type="button" onClick={() => void loadTechOrders()} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-xl border border-zinc-200 px-3 text-xs font-black text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"><RefreshCw size={14} className={loading ? "animate-spin" : ""}/> Atualizar</button>
          </Card>
        )}

        {loading ? (
          <div className="py-12 text-center text-zinc-400 flex flex-col items-center justify-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-xs">Carregando ordens de serviço...</p>
          </div>
        ) : !selectedOS ? (
          // List View
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Card className="p-4"><p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Minhas visitas</p><p className="mt-1 text-2xl font-black">{techOrders.length}</p></Card>
              <Card className="p-4"><p className="text-[10px] font-black uppercase tracking-wider text-blue-600">Em andamento</p><p className="mt-1 text-2xl font-black">{techOrders.filter((order) => ["EM_DESLOCAMENTO", "NO_LOCAL", "EM_EXECUCAO"].includes(order.status)).length}</p></Card>
              <Card className="p-4"><p className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Conectividade</p><p className="mt-2 flex items-center gap-2 text-sm font-black">{online ? <Activity size={16}/> : <WifiOff size={16}/>} {online ? "Online e sincronizado" : "Offline protegido"}</p></Card>
            </div>
            <Card className="p-3"><div className="flex flex-col gap-3 md:flex-row"><label className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"/><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar OS, cliente, local ou equipamento..." className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-3 text-sm outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800"/></label><div className="flex gap-2 overflow-x-auto">{[{value:"TODAS",label:"Todas"},{value:"AGENDADA",label:"Agendadas"},{value:"EM_EXECUCAO",label:"Executando"}].map((option) => <button key={option.value} type="button" onClick={() => setStatusFilter(option.value)} className={`h-11 whitespace-nowrap rounded-xl px-4 text-xs font-black ${statusFilter === option.value ? "bg-blue-600 text-white" : "border border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"}`}>{option.label}</button>)}</div></div></Card>

            {techOrders.length === 0 ? (
              <Card className="py-12 text-center text-zinc-400 text-xs">
                Nenhuma visita atribuída para você.
              </Card>
            ) : filteredOrders.length === 0 ? (
              <Card className="py-10 text-center text-xs text-zinc-500">Nenhuma visita encontrada com esses filtros.</Card>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">{filteredOrders.map((os) => (
                <Card
                  key={os.id}
                  onClick={() => setSelectedOS(os)}
                  className="p-4 border-l-4 border-l-primary hover:border-l-primary-hover hover:scale-[1.01] cursor-pointer transition-all space-y-2.5"
                >
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-zinc-550">{os.code} · Visita {os.visitNumber}</span>
                    <StatusBadge status={os.status} />
                  </div>

                  <div>
                    <h4 className="font-bold text-sm text-zinc-900">{os.client?.name || os.clientName}</h4>
                    <p className="text-[11px] text-zinc-500 mt-1 font-semibold flex items-center gap-1">
                      <MapPin size={11} className="text-zinc-400" />
                      {os.addressLabel || "Instalação Principal"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-semibold text-zinc-500">
                      <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-1 dark:bg-zinc-800"><CalendarDays size={10}/>{os.scheduledTime || "Sem horário"}</span>
                      <span className="rounded-md bg-zinc-100 px-2 py-1">{os.estimatedDurationMinutes} min</span>
                      {os.assetName && <span className="rounded-md bg-blue-50 px-2 py-1 text-blue-700">{os.assetName}</span>}
                    </div>
                  </div>
                </Card>
              ))}</div>
            )}
          </div>
        ) : (
          // Active OS Execution View
          <div className="space-y-4">
            <Card className="p-4 space-y-3">
              <div className="flex justify-between items-center border-b border-zinc-100 pb-2 text-xs font-bold">
                <span className="text-zinc-500">{selectedOS.code} · Visita {selectedOS.visitNumber}</span>
                <StatusBadge status={selectedOS.status} />
              </div>

              <div className="grid grid-cols-3 gap-2" aria-label="Progresso da visita">
                {[{ label: "Deslocamento", active: ["EM_DESLOCAMENTO", "NO_LOCAL", "EM_EXECUCAO"].includes(selectedOS.status) }, { label: "No local", active: ["NO_LOCAL", "EM_EXECUCAO"].includes(selectedOS.status) }, { label: "Execução", active: selectedOS.status === "EM_EXECUCAO" }].map((step, index) => <div key={step.label} className={`rounded-xl border px-2 py-2 text-center text-[9px] font-black uppercase tracking-wide ${step.active ? "border-blue-600 bg-blue-600 text-white" : "border-zinc-200 bg-zinc-50 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800"}`}><span className="mr-1">{index + 1}</span>{step.label}</div>)}
              </div>

              <div>
                <h4 className="font-semibold text-sm text-zinc-900">{selectedOS.client?.name || selectedOS.clientName}</h4>
                <p className="text-xs text-zinc-650 mt-1 leading-relaxed">{selectedOS.problemReported || "Escopo não informado."}</p>
                <div className="mt-3 flex flex-wrap gap-2"><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedOS.addressText || selectedOS.addressLabel || "")}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-xl border border-zinc-200 px-3 text-[10px] font-black text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"><Navigation size={13}/> Abrir rota</a><span className="inline-flex h-9 items-center gap-2 rounded-xl bg-zinc-100 px-3 text-[10px] font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"><MapPin size={13}/>{selectedOS.addressText || selectedOS.addressLabel}</span></div>
              </div>

              {/* Status Action Buttons (Page 17 visual) */}
              <div className="pt-2">
                {["AGENDADA", "ACEITA"].includes(selectedOS.status) && (
                  <Button
                    variant="primary"
                    className="w-full text-sm h-11"
                    onClick={handleCheckin}
                    loading={submitting}
                  >
                    Iniciar Deslocamento
                  </Button>
                )}

                {["EM_DESLOCAMENTO", "NO_LOCAL"].includes(selectedOS.status) && (
                  <Button
                    variant="success"
                    className="w-full text-sm h-11"
                    onClick={handleStartWork}
                    loading={submitting}
                  >
                    Cheguei no Local
                  </Button>
                )}

                {selectedOS.status === "EM_EXECUCAO" && (
                  <form onSubmit={handleFinishOS} className="space-y-5">

                    {/* Formulário versionado da visita */}
                    <div className="space-y-4 border-t border-zinc-150 pt-3">
                      {formLoading ? (
                        <div className="flex items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 py-8 text-xs font-semibold text-zinc-500"><Loader2 className="mr-2 animate-spin" size={16} /> Preparando formulário técnico...</div>
                      ) : visitForm ? (
                        <>
                          <div className="rounded-xl bg-gradient-to-r from-slate-950 to-blue-900 p-4 text-white">
                            <div className="flex items-start justify-between gap-3"><div><span className="text-[9px] font-black uppercase tracking-[0.16em] text-blue-200">Formulário de campo · v{visitForm.template.version}</span><h5 className="mt-1 text-sm font-black">{visitForm.template.name}</h5>{visitForm.template.description && <p className="mt-1 text-[10px] leading-relaxed text-blue-100/70">{visitForm.template.description}</p>}</div><FileCheck size={19} className="shrink-0 text-blue-300" /></div>
                            <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2 text-[9px] font-semibold text-blue-100/70"><span>{online ? "Rascunho salvo no aparelho e no ERP" : "Rascunho protegido neste aparelho"}</span>{draftSavedAt && <span>{new Date(draftSavedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>}</div>
                          </div>

                          {visitForm.sections.map((section, sectionIndex) => (
                            <section key={section.id} className="space-y-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                              <div><span className="text-[9px] font-black uppercase tracking-wider text-blue-600">Etapa {sectionIndex + 1}</span><h6 className="text-xs font-black text-zinc-900 dark:text-white">{section.title}</h6>{section.description && <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">{section.description}</p>}</div>
                              <div className="space-y-2">
                                {section.questions.map((question) => {
                                  const value = formAnswers[question.id];
                                  if (question.type === "CHECKBOX") {
                                    return (
                                      <label key={question.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-xs font-semibold transition ${value === true ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-zinc-200 bg-zinc-50 text-zinc-800"}`}>
                                        <input type="checkbox" checked={value === true} onChange={(event) => updateFormAnswer(question.id, event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500" />
                                        <span>{question.label}{question.required && <b className="ml-1 text-red-500">*</b>}{question.helpText && <small className="mt-1 block font-normal leading-relaxed text-zinc-500">{question.helpText}</small>}</span>
                                      </label>
                                    );
                                  }
                                  if (question.type === "SELECT") {
                                    return <Select key={question.id} label={`${question.label}${question.required ? " *" : ""}`} value={String(value ?? "")} onChange={(event) => updateFormAnswer(question.id, event.target.value)} options={[{ value: "", label: "Selecione" }, ...question.options.map((option) => ({ value: option, label: option.replaceAll("_", " ") }))]} />;
                                  }
                                  if (question.type === "LONG_TEXT") {
                                    return <div key={question.id}><label className="mb-1 block text-xs font-bold text-zinc-500">{question.label}{question.required && <b className="ml-1 text-red-500">*</b>}</label><textarea rows={3} value={String(value ?? "")} onChange={(event) => updateFormAnswer(question.id, event.target.value)} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs outline-none focus:border-blue-500" /></div>;
                                  }
                                  const measurement = question.type === "MEASUREMENT" ? question.measurementDefinition : null;
                                  return <Input key={question.id} type={["NUMBER", "MEASUREMENT"].includes(question.type) ? "number" : "text"} step={measurement ? 1 / (10 ** measurement.decimals) : undefined} label={`${question.label}${measurement ? ` (${measurement.unit})` : ""}${question.required ? " *" : ""}`} value={String(value ?? "")} onChange={(event) => updateFormAnswer(question.id, event.target.value)} placeholder={measurement ? "Valor aferido" : question.helpText || "Informe o resultado"} />;
                                })}
                              </div>
                            </section>
                          ))}
                        </>
                      ) : (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-800">O formulário da visita ainda não está disponível neste aparelho. Conecte-se à rede uma vez para baixar o checklist.</div>
                      )}
                    </div>

                    {/* Photos upload (câmera ou galeria do dispositivo) */}
                    <div className="space-y-3 border-t border-zinc-150 pt-3">
                      <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider block">Fotos do Serviço</span>
                      <div className="grid grid-cols-2 gap-3">
                        {photos.map((p, idx) => (
                          <div
                            key={p.step}
                            className="border border-zinc-200 rounded-xl p-3 bg-zinc-50 text-center flex flex-col items-center justify-center gap-1.5 overflow-hidden"
                          >
                            {p.uploaded && p.url ? (
                              <img src={p.url} alt={p.caption} className="w-full h-16 object-cover rounded-lg" />
                            ) : (
                              <Camera size={18} className="text-zinc-400" />
                            )}
                            <span className="text-[10px] font-bold block">{p.caption}</span>
                            {p.uploaded ? (
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] text-success font-bold flex items-center gap-0.5"><Check size={10} /> Carregada</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemovePhoto(idx)}
                                  className="text-[9px] text-danger font-bold hover:underline cursor-pointer"
                                >
                                  Remover
                                </button>
                              </div>
                            ) : (
                              <label className="text-[9px] text-primary font-bold hover:underline cursor-pointer">
                                Tirar Foto / Anexar
                                <input
                                  type="file"
                                  accept="image/*"
                                  capture="environment"
                                  className="hidden"
                                  onChange={(e) => handlePhotoFileSelected(idx, e.target.files?.[0])}
                                />
                              </label>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Diagnosis / Report */}
                    <div className="space-y-2 border-t border-zinc-150 pt-3">
                      <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider block">Diagnóstico / Laudo Técnico *</span>
                      <textarea
                        required
                        rows={3}
                        placeholder="Descreva o que foi realizado, peças trocadas, carga de gás..."
                        value={diagnosis}
                        onChange={(e) => setDiagnosis(e.target.value)}
                        className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>

                    {/* Digital Signature */}
                    <div className="space-y-3 border-t border-zinc-150 pt-3">
                      <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider block">Assinatura do Cliente *</span>
                      <Input
                        label="Nome do Responsável *"
                        required
                        placeholder="Nome de quem assina"
                        value={signatureName}
                        onChange={(e) => setSignatureName(e.target.value)}
                      />
                      <div className="border border-zinc-200 bg-white rounded-xl overflow-hidden">
                        <canvas
                          ref={canvasRef}
                          width={380}
                          height={120}
                          onMouseDown={startDrawing}
                          onMouseMove={draw}
                          onMouseUp={stopDrawing}
                          onMouseLeave={stopDrawing}
                          onTouchStart={startDrawing}
                          onTouchMove={draw}
                          onTouchEnd={stopDrawing}
                          className="w-full h-32 bg-white cursor-crosshair"
                        />
                        <div className="bg-zinc-100 px-3 py-1.5 flex justify-between items-center text-[10px] border-t border-zinc-200">
                          <span className="text-zinc-400 font-semibold">Desenhe com o dedo no retângulo acima</span>
                          <button
                            type="button"
                            onClick={clearCanvas}
                            className="text-danger font-bold hover:underline cursor-pointer"
                          >
                            Limpar
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Feedback */}
                    <Input
                      label="Observações / Feedback do Cliente"
                      placeholder="Avaliação ou comentários"
                      value={clientFeedback}
                      onChange={(e) => setClientFeedback(e.target.value)}
                    />

                    {/* Finalize Button */}
                    <Button
                      variant="danger"
                      className="w-full text-sm h-11"
                      type="submit"
                      loading={submitting}
                    >
                      Finalizar OS
                    </Button>
                  </form>
                )}
              </div>
            </Card>
          </div>
        )}

      </div>
    </div>
    <ErrorReporter />
  </ToastProvider>
  );
}
