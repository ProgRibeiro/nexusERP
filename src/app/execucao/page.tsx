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
} from "lucide-react";
import Link from "next/link";

export default function ExecucaoTecnicaPage() {
  const { user, users, switchUser } = useAuth();
  const [techOrders, setTechOrders] = useState<any[]>([]);
  const [selectedOS, setSelectedOS] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Estados da execução
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

  // Canvas para Assinatura
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Carrega OSs atribuídas ao técnico ativo
  async function loadTechOrders() {
    if (!user) return;
    setLoading(true);
    const data = await getTechnicianOS(user.id);
    setTechOrders(data);
    setLoading(false);
  }

  useEffect(() => {
    loadTechOrders();
  }, [user]);

  // Canvas desenho handlers
  useEffect(() => {
    if (selectedOS && selectedOS.status === "EXECUCAO" && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.strokeStyle = "#18181b";
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
      }
    }
  }, [selectedOS, selectedOS?.status]);

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
    
    // Impedir scroll de tela em dispositivos móveis ao assinar
    if (e.cancelable) e.preventDefault();
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
      // Dispositivo Mobile
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    } else {
      // Mouse desktop
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  };

  // Checkin operacional
  const handleCheckin = async () => {
    if (!selectedOS || !user) return;
    setSubmitting(true);
    const res = await makeOSCheckin(selectedOS.id, user.id);
    if (res.success) {
      setSelectedOS({ ...selectedOS, status: "DESLOCAMENTO" });
      await loadTechOrders();
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
    } else {
      alert("Erro ao iniciar trabalho: " + res.error);
    }
    setSubmitting(false);
  };

  // Simular tirar foto
  const handleSimulatePhoto = (idx: number) => {
    setPhotos(
      photos.map((p, i) => {
        if (i !== idx) return p;
        return {
          ...p,
          uploaded: true,
          url: `/mock/photos/${p.step.toLowerCase()}_sample.jpg`, // simulado
        };
      })
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
      alert("Preencha o laudo/diagnóstico técnico do serviço.");
      return;
    }
    if (!signatureName) {
      alert("Preencha o nome do cliente que assinará a aprovação.");
      return;
    }

    // Exportar canvas assinatura para base64
    let signatureBase64 = "";
    if (canvasRef.current) {
      signatureBase64 = canvasRef.current.toDataURL();
    }

    setSubmitting(true);
    const measurementsStr = `Volts: ${measurements.voltage}V | Amps: ${measurements.current}A | Gás: ${measurements.pressure} PSI | Temp: ${measurements.temp}ºC`;

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
      alert("Serviço concluído e relatório técnico enviado com sucesso!");
      setSelectedOS(null);
      // Reset formulários
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

  const getRoleBadgeColor = (roleName: string) => {
    switch (roleName) {
      case "Técnico":
        return "bg-blue-600 text-white";
      case "Administrador":
        return "bg-red-600 text-white";
      default:
        return "bg-zinc-600 text-white";
    }
  };

  return (
    <div className="min-h-screen bg-zinc-900 flex flex-col justify-start text-zinc-100 antialiased font-sans select-none">
      {/* Container "Mobile-First" Centralizado */}
      <div className="w-full max-w-md mx-auto bg-zinc-950 min-h-screen flex flex-col shadow-2xl relative border-x border-zinc-800">
        
        {/* Header App Mobile */}
        <header className="p-4 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-2.5">
            {selectedOS ? (
              <button
                onClick={() => setSelectedOS(null)}
                className="p-1 hover:bg-zinc-800 rounded transition-all text-zinc-300 cursor-pointer"
              >
                <ArrowLeft size={20} />
              </button>
            ) : (
              <div className="bg-emerald-600 p-1.5 rounded-lg flex items-center justify-center">
                <Wrench size={16} className="text-white" />
              </div>
            )}
            <div>
              <h1 className="font-extrabold text-sm tracking-wide">
                {selectedOS ? selectedOS.code : "Execução em Campo"}
              </h1>
              <p className="text-[10px] text-zinc-400">
                {selectedOS ? "Finalizando Ordem" : "Painel do Técnico"}
              </p>
            </div>
          </div>

          {/* Seletor de Perfil Técnico rápido */}
          <div className="relative">
            <select
              value={user?.email}
              onChange={(e) => switchUser(e.target.value)}
              className="text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-300 font-bold px-2 py-1 rounded focus:outline-none"
            >
              {users
                .filter((u) => u.roleName === "Técnico" || u.roleName === "Administrador")
                .map((u) => (
                  <option key={u.email} value={u.email}>
                    {u.name.split(" ")[0]} ({u.roleName.slice(0, 4)})
                  </option>
                ))}
            </select>
          </div>
        </header>

        {/* Corpo principal */}
        <main className="flex-1 p-4 overflow-y-auto space-y-4">
          {loading ? (
            <div className="h-[50vh] flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-7 w-7 animate-spin text-emerald-500" />
              <span className="text-xs text-zinc-400">Carregando ordens...</span>
            </div>
          ) : !selectedOS ? (
            /* LISTAGEM DE ORDENS DE SERVIÇO ATRIBUÍDAS */
            <div className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <h3 className="font-bold text-xs text-zinc-400 uppercase tracking-wider">Minhas Escalas de Hoje</h3>
                <span className="text-[10px] bg-zinc-800 text-zinc-300 font-bold px-2 py-0.5 rounded-full">
                  {techOrders.length} OS
                </span>
              </div>

              {techOrders.length === 0 ? (
                <div className="border border-dashed border-zinc-800 rounded-2xl py-16 text-center text-zinc-500 text-xs px-6 flex flex-col items-center gap-3">
                  <CheckCircle size={32} className="text-zinc-700" />
                  <p className="font-semibold">Nenhum serviço escalado!</p>
                  <p className="text-[11px] text-zinc-600">Sua agenda está livre no momento.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {techOrders.map((os) => (
                    <div
                      key={os.id}
                      onClick={() => setSelectedOS(os)}
                      className="bg-zinc-900 border border-zinc-800/80 hover:border-zinc-700 rounded-xl p-4 transition-all cursor-pointer flex flex-col justify-between min-h-[140px]"
                    >
                      <div className="flex justify-between items-start gap-1">
                        <div>
                          <span className="text-[9px] bg-zinc-800 text-zinc-300 font-black px-1.5 py-0.5 rounded uppercase tracking-wider">
                            {os.type}
                          </span>
                          <h4 className="font-extrabold text-sm text-zinc-100 mt-2 truncate w-72">
                            {os.clientName}
                          </h4>
                        </div>
                        <span
                          className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${
                            os.status === "EXECUCAO"
                              ? "bg-amber-500/20 text-amber-500 animate-pulse border border-amber-500/30"
                              : os.status === "DESLOCAMENTO"
                              ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                              : "bg-zinc-800 text-zinc-400"
                          }`}
                        >
                          {os.status}
                        </span>
                      </div>

                      <div className="space-y-1 mt-3">
                        <p className="text-[10px] text-zinc-400 font-medium flex items-center gap-1">
                          <MapPin size={11} className="text-zinc-600" /> {os.addressLabel}: {os.addressText}
                        </p>
                        <p className="text-[10px] text-zinc-400 font-medium flex items-center gap-1">
                          <Clock size={11} className="text-zinc-600" /> Agendado: {os.scheduledTime ? `${os.scheduledTime}h` : "Sem hora"}
                        </p>
                      </div>

                      <div className="flex justify-end pt-2 border-t border-zinc-800/40 mt-3 text-[10px] font-bold text-emerald-500 flex items-center gap-1 group-hover:underline">
                        Abrir Ficha de Campo <ArrowRight size={12} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Botão de volta ao painel (apenas demonstrativo) */}
              <div className="pt-6 text-center">
                <Link
                  href="/"
                  className="text-xs text-zinc-500 hover:text-zinc-300 underline font-bold"
                >
                  Voltar ao Painel Administrativo
                </Link>
              </div>
            </div>
          ) : (
            /* DETALHES E PROCESSO DE EXECUÇÃO DE UMA OS */
            <div className="space-y-6">
              {/* Dados do Cliente */}
              <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl space-y-2.5 text-xs">
                <h4 className="font-extrabold text-zinc-100 flex items-center gap-1.5">
                  <User size={14} className="text-zinc-400" /> Ficha do Cliente
                </h4>
                <div className="space-y-1 font-medium text-zinc-300">
                  <p className="font-black text-sm text-zinc-100">{selectedOS.clientName}</p>
                  <p className="flex items-center gap-1.5"><MapPin size={12} className="text-zinc-500" /> {selectedOS.addressText}</p>
                </div>
              </div>

              {/* ESTÁGIO 1: Check-in / Deslocamento */}
              {selectedOS.status === "AGENDADA" && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 text-center space-y-4">
                  <div className="bg-blue-500/10 p-4 rounded-full w-14 h-14 flex items-center justify-center mx-auto text-blue-500 border border-blue-500/20">
                    <Navigation size={24} />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-sm">Iniciar Deslocamento</h4>
                    <p className="text-[11px] text-zinc-500 leading-relaxed px-4">
                      Clique abaixo ao sair da sede em direção ao local do cliente para registrar o tempo de trânsito.
                    </p>
                  </div>
                  <button
                    onClick={handleCheckin}
                    disabled={submitting}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {submitting && <Loader2 size={12} className="animate-spin" />}
                    Registrar Check-in Técnico
                  </button>
                </div>
              )}

              {selectedOS.status === "DESLOCAMENTO" && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 text-center space-y-4">
                  <div className="bg-amber-500/10 p-4 rounded-full w-14 h-14 flex items-center justify-center mx-auto text-amber-500 border border-amber-500/20 animate-pulse">
                    <Clock size={24} />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-sm text-amber-500">Técnico em Deslocamento</h4>
                    <p className="text-[11px] text-zinc-500 leading-relaxed px-4">
                      Sua viagem está sendo computada. Clique abaixo assim que chegar no local do cliente para iniciar a execução técnica.
                    </p>
                  </div>
                  <button
                    onClick={handleStartWork}
                    disabled={submitting}
                    className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 animate-bounce"
                  >
                    {submitting && <Loader2 size={12} className="animate-spin" />}
                    Confirmar Chegada & Iniciar Serviço
                  </button>
                </div>
              )}

              {/* ESTÁGIO 2: Execução do Serviço (Laudos, checklists, fotos, assinatura) */}
              {selectedOS.status === "EXECUCAO" && (
                <form onSubmit={handleFinishOS} className="space-y-6">
                  {/* Checklist */}
                  <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl space-y-3">
                    <h4 className="font-bold text-zinc-100 flex items-center gap-1.5 text-xs uppercase tracking-wider text-zinc-400">
                      <FileCheck size={14} className="text-zinc-500" /> Checklist de Validação
                    </h4>
                    <div className="space-y-2.5">
                      {checklist.map((item, idx) => (
                        <label
                          key={idx}
                          className="flex items-start gap-2.5 text-xs text-zinc-300 font-semibold cursor-pointer select-none leading-relaxed"
                        >
                          <input
                            type="checkbox"
                            checked={item.checked}
                            onChange={() => handleChecklistToggle(idx)}
                            className="mt-0.5 rounded border-zinc-700 bg-zinc-800 accent-emerald-500"
                          />
                          <span className={item.checked ? "line-through text-zinc-500" : ""}>
                            {item.task}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Medições Técnicas */}
                  <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl space-y-3">
                    <h4 className="font-bold text-zinc-100 flex items-center gap-1.5 text-xs uppercase tracking-wider text-zinc-400">
                      <Activity size={14} className="text-zinc-500" /> Parâmetros e Medições
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="text-zinc-500 block mb-1 font-bold">Tensão (Volts V)</label>
                        <input
                          type="text"
                          placeholder="Ex: 220"
                          value={measurements.voltage}
                          onChange={(e) => setMeasurements({ ...measurements, voltage: e.target.value })}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded p-1.5 text-xs text-zinc-200 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-zinc-500 block mb-1 font-bold">Corrente (Amperes A)</label>
                        <input
                          type="text"
                          placeholder="Ex: 5.4"
                          value={measurements.current}
                          onChange={(e) => setMeasurements({ ...measurements, current: e.target.value })}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded p-1.5 text-xs text-zinc-200 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-zinc-500 block mb-1 font-bold">Pressão Gás (PSI)</label>
                        <input
                          type="text"
                          placeholder="Ex: 120"
                          value={measurements.pressure}
                          onChange={(e) => setMeasurements({ ...measurements, pressure: e.target.value })}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded p-1.5 text-xs text-zinc-200 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-zinc-500 block mb-1 font-bold">Temperatura Trabalho (ºC)</label>
                        <input
                          type="text"
                          placeholder="Ex: 8.5"
                          value={measurements.temp}
                          onChange={(e) => setMeasurements({ ...measurements, temp: e.target.value })}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded p-1.5 text-xs text-zinc-200 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Evidências Fotográficas */}
                  <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl space-y-3">
                    <h4 className="font-bold text-zinc-100 flex items-center gap-1.5 text-xs uppercase tracking-wider text-zinc-400">
                      <Camera size={14} className="text-zinc-500" /> Registro de Fotos (Evidência)
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-center">
                      {photos.map((p, idx) => (
                        <div
                          key={p.step}
                          className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-zinc-700 transition-all min-h-[90px]"
                          onClick={() => handleSimulatePhoto(idx)}
                        >
                          {p.uploaded ? (
                            <>
                              <CheckCircle className="text-emerald-500" size={24} />
                              <span className="text-[10px] font-bold text-zinc-300">{p.step}: Uploaded</span>
                            </>
                          ) : (
                            <>
                              <Camera className="text-zinc-600" size={24} />
                              <span className="text-[10px] font-bold text-zinc-500">{p.caption}</span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Laudo Técnico */}
                  <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl space-y-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Laudo & Diagnóstico Técnico *</label>
                    <textarea
                      required
                      rows={3}
                      placeholder="Descreva detalhadamente o serviço prestado, as peças trocadas e o estado geral de entrega do aparelho..."
                      value={diagnosis}
                      onChange={(e) => setDiagnosis(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-zinc-200 focus:outline-none"
                    />
                  </div>

                  {/* Assinatura Digital do Cliente */}
                  <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl space-y-3">
                    <h4 className="font-bold text-zinc-100 flex items-center gap-1.5 text-xs uppercase tracking-wider text-zinc-400">
                      <Signature size={14} className="text-zinc-500" /> Assinatura do Cliente
                    </h4>

                    {/* Canvas Area */}
                    <div className="border border-zinc-800 rounded-xl overflow-hidden bg-white">
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
                        className="w-full h-[120px] block cursor-crosshair touch-none"
                      />
                    </div>

                    <div className="flex justify-between items-center pt-0.5">
                      <span className="text-[10px] text-zinc-500 italic">Assine diretamente com o dedo ou mouse</span>
                      <button
                        type="button"
                        onClick={clearCanvas}
                        className="text-[10px] text-red-500 hover:text-red-400 font-bold uppercase tracking-wider cursor-pointer"
                      >
                        Limpar Assinatura
                      </button>
                    </div>

                    <div className="space-y-2 pt-2">
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 uppercase">Nome de quem assinou *</label>
                        <input
                          type="text"
                          required
                          placeholder="Nome e Sobrenome"
                          value={signatureName}
                          onChange={(e) => setSignatureName(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-zinc-200 focus:outline-none mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 uppercase">Feedback / Avaliação do Cliente</label>
                        <input
                          type="text"
                          placeholder="Ex: Excelente atendimento, tudo ok!"
                          value={clientFeedback}
                          onChange={(e) => setClientFeedback(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-zinc-200 focus:outline-none mt-1"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Ação Concluir OS */}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs shadow-lg shadow-emerald-600/10 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {submitting && <Loader2 size={14} className="animate-spin" />}
                    Concluir Serviço e Enviar Relatório
                  </button>
                </form>
              )}

              {/* Status Concluída / Faturada (Visualização do relatório técnico pelo técnico) */}
              {(selectedOS.status === "CONCLUIDA" || selectedOS.status === "FATURAMENTO" || selectedOS.status === "FATURADA") && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 text-center space-y-4 text-xs font-semibold">
                  <div className="bg-emerald-500/10 p-4 rounded-full w-14 h-14 flex items-center justify-center mx-auto text-emerald-500 border border-emerald-500/20">
                    <CheckCircle size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-emerald-500">Ordem Concluída com Sucesso!</h4>
                    <p className="text-[11px] text-zinc-500 leading-relaxed mt-1">
                      O laudo técnico e a assinatura digital foram colhidos e salvos no prontuário do cliente.
                    </p>
                  </div>
                  <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-850 text-left font-medium space-y-2 text-zinc-400">
                    <p className="text-zinc-200 font-bold border-b border-zinc-800 pb-1">Laudo técnico entregue:</p>
                    <p className="italic">{selectedOS.technicalDiagnosis || "Serviço finalizado sem ressalvas."}</p>
                  </div>
                  <button
                    onClick={() => setSelectedOS(null)}
                    className="w-full py-2.5 bg-zinc-800 text-white font-bold rounded-xl text-xs hover:bg-zinc-705 cursor-pointer"
                  >
                    Voltar para lista de Ordens
                  </button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
