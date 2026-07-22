"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getTechnicianOS,
  makeOSCheckin,
  makeOSStartExecution,
  submitTechnicalExecution,
} from "@/app/actions/executionActions";
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
  ChevronLeft
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";

export default function ExecucaoTecnicaPage() {
  const { user, users, switchUser } = useAuth();

  const [techOrders, setTechOrders] = useState<any[]>([]);
  const [selectedOS, setSelectedOS] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [diagnosis, setDiagnosis] = useState("");
  const [checklist, setChecklist] = useState([
    { task: "Equipamento desligado e desenergizado?", checked: false },
    { task: "Inspeção visual de peças realizada?", checked: false },
    { task: "Teste de estanqueidade e vazamentos ok?", checked: false },
    { task: "Limpeza das aletas e filtros concluída?", checked: false },
    { task: "Aterramento e conexões elétricas apertadas?", checked: false },
  ]);
  const [measurements, setMeasurements] = useState({
    voltage: "",
    current: "",
    pressure: "",
    temp: "",
  });
  const [photos, setPhotos] = useState<any[]>([
    { step: "ANTES", url: "", caption: "Foto antes da limpeza", uploaded: false },
    { step: "DEPOIS", url: "", caption: "Foto após conclusão", uploaded: false },
  ]);
  const [signatureName, setSignatureName] = useState("");
  const [clientFeedback, setClientFeedback] = useState("");

  // Canvas ref for digital signature
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  async function loadTechOrders() {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getTechnicianOS(user.id);
      setTechOrders(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTechOrders();
  }, [user]);

  // Initialize Canvas stroke styling
  useEffect(() => {
    if (selectedOS && (selectedOS.status === "EXECUCAO" || selectedOS.status === "EM_EXECUCAO") && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.strokeStyle = "#1e293b";
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
      }
    }
  }, [selectedOS, selectedOS?.status]);

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
  };

  const clearCanvas = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
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

  const handleCheckin = async () => {
    if (!selectedOS || !user) return;
    setSubmitting(true);
    const res = await makeOSCheckin(selectedOS.id, user.id);
    if (res.success) {
      setSelectedOS({ ...selectedOS, status: "DESLOCAMENTO" });
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
    const res = await makeOSStartExecution(selectedOS.id, user.id);
    if (res.success) {
      setSelectedOS({ ...selectedOS, status: "EXECUCAO" });
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

  const handleChecklistToggle = (idx: number) => {
    setChecklist(
      checklist.map((item, i) => (i === idx ? { ...item, checked: !item.checked } : item))
    );
  };

  const handleFinishOS = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOS || !user) return;
    if (!diagnosis) {
      alert("Preencha o laudo técnico do atendimento.");
      return;
    }
    if (!signatureName) {
      alert("Preencha o nome do responsável pela assinatura.");
      return;
    }

    let signatureBase64 = "";
    if (canvasRef.current) {
      signatureBase64 = canvasRef.current.toDataURL();
    }

    setSubmitting(true);
    const measurementsStr = `Tensao: ${measurements.voltage}V | Corrente: ${measurements.current}A | Pressao: ${measurements.pressure} PSI | Temp: ${measurements.temp}ºC`;

    const res = await submitTechnicalExecution(selectedOS.id, {
      technicalDiagnosis: diagnosis,
      checklistJson: JSON.stringify(checklist),
      measurementsJson: measurementsStr,
      photos: photos
        .filter((p) => p.uploaded)
        .map((p) => ({ step: p.step, url: p.url, caption: p.caption })),
      signatureBase64,
      signatureName,
      clientFeedback,
      userId: user.id,
    });

    if (res.success) {
      alert("OS concluída com sucesso! Relatório técnico enviado.");
      setSelectedOS(null);
      setDiagnosis("");
      setChecklist(checklist.map((item) => ({ ...item, checked: false })));
      setMeasurements({ voltage: "", current: "", pressure: "", temp: "" });
      setPhotos(photos.map((p) => ({ ...p, uploaded: false, url: "" })));
      setSignatureName("");
      setClientFeedback("");
      await loadTechOrders();
    } else {
      alert("Erro ao finalizar OS: " + res.error);
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans flex flex-col items-center p-4">
      {/* Header Bar */}
      <div className="w-full max-w-md flex items-center justify-between py-3 border-b border-zinc-200 mb-4">
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
        <span className="text-xs font-semibold tracking-tight">Área do Técnico 🛠️</span>
      </div>

      <div className="w-full max-w-md space-y-4">

        {/* User simulated profile switch */}
        {!selectedOS && (
          <Card className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                {user?.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h4 className="font-semibold text-xs text-zinc-800">{user?.name}</h4>
                <p className="text-[10px] text-zinc-500 font-semibold">{user?.roleName}</p>
              </div>
            </div>

            <Select
              options={users
                .filter((u) => u.roleName === "Técnico" || u.roleName === "Gestor" || u.roleName === "Administrador")
                .map((u) => ({ value: u.email, label: u.name.split(" ")[0] }))
              }
              value={user?.email || ""}
              onChange={async (e) => {
                await switchUser(e.target.value);
                setSelectedOS(null);
              }}
              className="h-8 text-[11px] py-0 font-bold"
            />
          </Card>
        )}

        {loading ? (
          <div className="py-12 text-center text-zinc-400 flex flex-col items-center justify-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-xs">Carregando ordens de serviço...</p>
          </div>
        ) : !selectedOS ? (
          // List View
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-zinc-450 uppercase tracking-wider">Minhas OS de Hoje</h3>

            {techOrders.length === 0 ? (
              <Card className="py-12 text-center text-zinc-400 text-xs">
                Nenhuma OS agendada para você hoje.
              </Card>
            ) : (
              techOrders.map((os) => (
                <Card
                  key={os.id}
                  onClick={() => setSelectedOS(os)}
                  className="p-4 border-l-4 border-l-primary hover:border-l-primary-hover hover:scale-[1.01] cursor-pointer transition-all space-y-2.5"
                >
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-zinc-550">OS #{os.code || os.id.slice(-4)}</span>
                    <StatusBadge status={os.status} />
                  </div>

                  <div>
                    <h4 className="font-bold text-sm text-zinc-900">{os.client?.name || os.clientName}</h4>
                    <p className="text-[11px] text-zinc-500 mt-1 font-semibold flex items-center gap-1">
                      <MapPin size={11} className="text-zinc-400" />
                      {os.addressLabel || "Instalação Principal"}
                    </p>
                  </div>
                </Card>
              ))
            )}
          </div>
        ) : (
          // Active OS Execution View
          <div className="space-y-4">
            <Card className="p-4 space-y-3">
              <div className="flex justify-between items-center border-b border-zinc-100 pb-2 text-xs font-bold">
                <span className="text-zinc-500">OS #{selectedOS.code || selectedOS.id.slice(-4)}</span>
                <StatusBadge status={selectedOS.status} />
              </div>

              <div>
                <h4 className="font-semibold text-sm text-zinc-900">{selectedOS.client?.name || selectedOS.clientName}</h4>
                <p className="text-xs text-zinc-650 mt-1 leading-relaxed">{selectedOS.description}</p>
              </div>

              {/* Status Action Buttons (Page 17 visual) */}
              <div className="pt-2">
                {selectedOS.status === "AGENDADO" && (
                  <Button
                    variant="primary"
                    className="w-full text-sm h-11"
                    onClick={handleCheckin}
                    loading={submitting}
                  >
                    Iniciar Deslocamento
                  </Button>
                )}

                {selectedOS.status === "DESLOCAMENTO" && (
                  <Button
                    variant="success"
                    className="w-full text-sm h-11"
                    onClick={handleStartWork}
                    loading={submitting}
                  >
                    Cheguei no Local
                  </Button>
                )}

                {(selectedOS.status === "EXECUCAO" || selectedOS.status === "EM_EXECUCAO") && (
                  <form onSubmit={handleFinishOS} className="space-y-5">

                    {/* Checklist */}
                    <div className="space-y-2 border-t border-zinc-150 pt-3">
                      <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider block">Checklist Técnico</span>
                      {checklist.map((item, idx) => (
                        <label key={idx} className="flex items-start gap-3 p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={item.checked}
                            onChange={() => handleChecklistToggle(idx)}
                            className="w-4 h-4 rounded text-primary focus:ring-primary border-zinc-300 mt-0.5"
                          />
                          <span className={item.checked ? "text-zinc-400 line-through" : "text-zinc-800"}>{item.task}</span>
                        </label>
                      ))}
                    </div>

                    {/* Measurements */}
                    <div className="space-y-3 border-t border-zinc-150 pt-3">
                      <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider block">Medições do Equipamento</span>
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          label="Tensão (V)"
                          placeholder="ex: 220"
                          value={measurements.voltage}
                          onChange={(e) => setMeasurements({ ...measurements, voltage: e.target.value })}
                        />
                        <Input
                          label="Corrente (A)"
                          placeholder="ex: 12.5"
                          value={measurements.current}
                          onChange={(e) => setMeasurements({ ...measurements, current: e.target.value })}
                        />
                        <Input
                          label="Pressão Gás (PSI)"
                          placeholder="ex: 65"
                          value={measurements.pressure}
                          onChange={(e) => setMeasurements({ ...measurements, pressure: e.target.value })}
                        />
                        <Input
                          label="Temperatura (ºC)"
                          placeholder="ex: 8"
                          value={measurements.temp}
                          onChange={(e) => setMeasurements({ ...measurements, temp: e.target.value })}
                        />
                      </div>
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
  );
}
