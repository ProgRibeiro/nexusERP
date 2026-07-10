"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getServiceOrderDetails, updateOSStatus } from "@/app/actions/osActions";
import { formatCurrency, formatDate, formatDateTime, formatCpfCnpj, formatPhone } from "@/lib/utils";
import {
  FileText,
  Printer,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  Loader2,
  Calendar,
  User,
  MapPin,
  Clock,
  Check,
  X,
  Camera,
  Signature,
  DollarSign,
  Briefcase,
  Sliders,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export default function RelatoriosPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const osIdParam = searchParams.get("id");

  const { user: currentUser, hasPermission } = useAuth();

  const [osDetails, setOsDetails] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  async function loadOS(id: string) {
    setLoading(true);
    const data = await getServiceOrderDetails(id);
    setOsDetails(data);
    setLoading(false);
  }

  useEffect(() => {
    if (osIdParam) {
      loadOS(osIdParam);
    } else {
      setLoading(false);
    }
  }, [osIdParam]);

  const handleApproveReport = async () => {
    if (!osDetails || !currentUser) return;
    setActionLoading(true);
    // Transicionar status para FATURAMENTO
    const res = await updateOSStatus(
      osDetails.id,
      "FATURAMENTO",
      currentUser.id,
      "Relatório técnico de conclusão aprovado e enviado para conferência e faturamento."
    );

    if (res.success) {
      alert("Relatório aprovado! A OS foi enviada para o faturamento.");
      router.push("/ordens-servico");
    } else {
      alert("Erro ao aprovar relatório: " + res.error);
    }
    setActionLoading(false);
  };

  if (loading) {
    return (
      <div className="h-[60vh] w-full flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        <p className="text-sm font-semibold text-zinc-500">Carregando relatório técnico...</p>
      </div>
    );
  }

  if (!osDetails) {
    return (
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-12 text-center max-w-lg mx-auto mt-12 space-y-4">
        <AlertTriangle size={48} className="text-amber-500 mx-auto" />
        <h3 className="font-bold text-zinc-800 text-base">Nenhum relatório selecionado</h3>
        <p className="text-zinc-500 text-xs leading-relaxed">
          Os relatórios de conclusão são gerados automaticamente a partir de Ordens de Serviço concluídas. Favor selecionar uma OS na listagem.
        </p>
        <Link
          href="/ordens-servico"
          className="inline-block px-4 py-2 bg-zinc-950 text-white rounded-lg text-xs font-bold hover:bg-zinc-800"
        >
          Voltar para Ordens de Serviço
        </Link>
      </div>
    );
  }

  // Parse do checklist
  let checklistItems = [];
  try {
    checklistItems = JSON.parse(osDetails.checklistJson || "[]");
  } catch (e) {
    checklistItems = [];
  }

  return (
    <div className="space-y-6">
      {/* Barra de Ações do Relatório */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-zinc-200 shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/ordens-servico"
            className="p-1.5 border border-zinc-200 rounded-lg text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50 transition-all"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h2 className="font-bold text-zinc-900 text-sm">Relatório de Conclusão Técnica</h2>
            <p className="text-[10px] text-zinc-400 font-medium mt-0.5">Referência: {osDetails.code}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 border border-zinc-200 hover:bg-zinc-50 rounded-lg text-xs font-bold text-zinc-600 flex items-center gap-1.5 cursor-pointer"
          >
            <Printer size={14} /> Imprimir Relatório
          </button>

          {osDetails.status === "CONCLUIDA" && hasPermission("os.write") && (
            <button
              onClick={handleApproveReport}
              disabled={actionLoading}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/10 cursor-pointer disabled:opacity-50"
            >
              {actionLoading ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={14} />}
              Aprovar & Enviar Faturamento
            </button>
          )}
        </div>
      </div>

      {/* Papel Timbrado - Relatório de Conclusão */}
      <div className="bg-zinc-100/30 p-8 rounded-2xl border border-zinc-200">
        <div className="max-w-4xl mx-auto bg-white border border-zinc-200 shadow-lg p-8 rounded-xl font-sans text-zinc-800 space-y-8 print:border-0 print:shadow-none print:p-0">
          
          {/* Cabeçalho da Empresa */}
          <div className="flex justify-between items-start border-b-2 border-zinc-800 pb-5">
            <div>
              <h2 className="text-xl font-bold text-zinc-950 uppercase tracking-wide">
                Antigravity Climatização
              </h2>
              <p className="text-xs text-zinc-500 font-medium mt-1 leading-normal">
                Antigravity Climatização & Elétrica Ltda.
                <br />
                CNPJ: 07.889.332/0001-00 • Fone: (11) 3300-4400
                <br />
                Rua do Engenho, 100 - Centro - São Paulo - SP
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-zinc-400 uppercase font-bold tracking-wider">Relatório Técnico</p>
              <p className="text-base font-black text-zinc-950 mt-1">{osDetails.code}</p>
              <p className="text-[10px] text-zinc-500 mt-1">Conclusão: {osDetails.completedAt ? formatDate(osDetails.completedAt) : "-"}</p>
            </div>
          </div>

          {/* Dados do Cliente e Endereço */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-zinc-100 pb-5 text-xs">
            <div className="space-y-1">
              <span className="text-zinc-400 font-bold uppercase tracking-wide text-[9px]">Cliente Contratante</span>
              <p className="font-bold text-zinc-900 text-sm">{osDetails.client.name}</p>
              <p className="text-zinc-600">CPF/CNPJ: {formatCpfCnpj(osDetails.client.cpfCnpj)}</p>
              <p className="text-zinc-600">Fone: {formatPhone(osDetails.client.phone)}</p>
            </div>
            <div className="space-y-1">
              <span className="text-zinc-400 font-bold uppercase tracking-wide text-[9px]">Local da Execução</span>
              <p className="text-zinc-600 leading-normal">
                {osDetails.address?.street}, nº {osDetails.address?.number} {osDetails.address?.complement && ` - ${osDetails.address?.complement}`}
                <br />
                {osDetails.address?.neighborhood} - {osDetails.address?.city} / {osDetails.address?.state} - CEP {osDetails.address?.cep}
              </p>
            </div>
          </div>

          {/* Informações da Execução e Equipe */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-zinc-100 pb-5 text-xs">
            <div>
              <span className="text-zinc-400 font-bold uppercase tracking-wide text-[9px]">Tipo do Serviço</span>
              <p className="font-bold text-zinc-800 mt-1">{osDetails.type}</p>
            </div>
            <div>
              <span className="text-zinc-400 font-bold uppercase tracking-wide text-[9px]">Equipe Técnica</span>
              <p className="font-bold text-zinc-800 mt-1">
                {osDetails.technicians.map((t: any) => t.user.name).join(", ") || "Sem técnico designado"}
              </p>
            </div>
            <div>
              <span className="text-zinc-400 font-bold uppercase tracking-wide text-[9px]">Data Agendamento</span>
              <p className="font-bold text-zinc-800 mt-1">
                {osDetails.scheduledDate ? formatDate(osDetails.scheduledDate) : "-"} às {osDetails.scheduledTime || "-"}h
              </p>
            </div>
          </div>

          {/* Diagnóstico e Laudo */}
          <div className="space-y-2 text-xs">
            <h4 className="font-bold text-zinc-950 uppercase tracking-wide border-b border-zinc-800 pb-1">
              Laudo Técnico de Encerramento
            </h4>
            <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-100 font-medium leading-relaxed text-zinc-700 whitespace-pre-line italic">
              {osDetails.technicalDiagnosis || "Nenhum laudo registrado."}
            </div>
          </div>

          {/* Checklist de Campo */}
          <div className="space-y-2 text-xs">
            <h4 className="font-bold text-zinc-950 uppercase tracking-wide border-b border-zinc-800 pb-1">
              Checklist de Testes & Execução
            </h4>
            {checklistItems.length === 0 ? (
              <p className="text-zinc-400 italic text-[11px]">Nenhum checklist preenchido para esta ordem.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 pt-1 font-medium">
                {checklistItems.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-start gap-2.5">
                    {item.checked ? (
                      <CheckCircle size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <X size={14} className="text-red-500 shrink-0 mt-0.5" />
                    )}
                    <span className={item.checked ? "text-zinc-700" : "text-zinc-400"}>
                      {item.task || item.question} {item.answer && `(Resp: ${item.answer})`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Medições Técnicas */}
          <div className="space-y-2 text-xs">
            <h4 className="font-bold text-zinc-950 uppercase tracking-wide border-b border-zinc-800 pb-1">
              Medições Técnicas Aferidas
            </h4>
            {osDetails.notes && osDetails.notes.includes("Medições") ? (
              <div className="p-3 bg-zinc-50 border border-zinc-150 rounded-lg flex flex-wrap gap-6 text-zinc-700 font-bold">
                {osDetails.notes
                  .replace("Medições técnicas: ", "")
                  .split(" | ")
                  .map((med: string, i: number) => (
                    <span key={i} className="bg-white border border-zinc-200 px-3 py-1 rounded-md shadow-sm">
                      {med}
                    </span>
                  ))}
              </div>
            ) : (
              <p className="text-zinc-400 italic text-[11px]">Nenhuma medição técnica registrada.</p>
            )}
          </div>

          {/* Materiais Utilizados */}
          <div className="space-y-2 text-xs">
            <h4 className="font-bold text-zinc-950 uppercase tracking-wide border-b border-zinc-800 pb-1">
              Materiais / Peças Aplicadas
            </h4>
            {osDetails.materials.filter((m: any) => m.status === "UTILIZADO").length === 0 ? (
              <p className="text-zinc-400 italic text-[11px]">Nenhum produto de estoque aplicado neste serviço.</p>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 text-zinc-400 font-bold uppercase text-[9px]">
                    <th className="py-2">Especificação</th>
                    <th className="py-2 w-16 text-center">Quantidade</th>
                    <th className="py-2 w-24 text-right">Preço</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 font-medium">
                  {osDetails.materials
                    .filter((m: any) => m.status === "UTILIZADO")
                    .map((m: any) => (
                      <tr key={m.id}>
                        <td className="py-2 text-zinc-800 font-semibold">{m.product.name}</td>
                        <td className="py-2 text-center">{m.usedQuantity} {m.product.unit}</td>
                        <td className="py-2 text-right">{formatCurrency(m.salePrice)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Evidências Fotográficas (Fotos antes/depois simulado) */}
          <div className="space-y-2 text-xs">
            <h4 className="font-bold text-zinc-950 uppercase tracking-wide border-b border-zinc-800 pb-1">
              Evidências Técnicas (Fotos)
            </h4>
            {osDetails.photos.length === 0 ? (
              <p className="text-zinc-400 italic text-[11px]">Nenhuma foto registrada para esta execução.</p>
            ) : (
              <div className="grid grid-cols-2 gap-4 pt-2">
                {osDetails.photos.map((ph: any) => (
                  <div key={ph.id} className="border border-zinc-200 rounded-xl overflow-hidden text-center bg-zinc-50 p-2 space-y-1">
                    <div className="bg-zinc-200 h-32 flex items-center justify-center text-zinc-400 rounded-lg border border-dashed border-zinc-300">
                      <Camera size={24} className="text-zinc-300" />
                    </div>
                    <p className="font-bold text-[10px] text-zinc-700 pt-1">{ph.step}: {ph.caption || "Evidência"}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Parecer / Recomendações e Garantia */}
          {osDetails.completionReport && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-zinc-100 text-xs">
              <div className="space-y-1">
                <span className="text-zinc-400 font-bold uppercase tracking-wide text-[9px]">Recomendações Técnicas</span>
                <p className="text-zinc-600 font-medium leading-relaxed italic">
                  {osDetails.completionReport.technicalObservations || "Nenhuma recomendação adicional."}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-zinc-400 font-bold uppercase tracking-wide text-[9px]">Termos de Garantia</span>
                <p className="text-zinc-600 font-medium leading-relaxed italic">
                  {osDetails.completionReport.warrantyTerms || "Garantia de 90 dias nos serviços prestados."}
                </p>
              </div>
            </div>
          )}

          {/* Assinatura de Aceite */}
          <div className="pt-12 grid grid-cols-2 gap-8 text-center text-xs font-semibold text-zinc-500">
            <div className="space-y-2 border-t border-zinc-300 pt-3">
              <p>Assinatura do Técnico Responsável</p>
              <p className="text-[10px] font-medium text-zinc-400">
                {osDetails.technicians.map((t: any) => t.user.name).join(", ") || "Responsável"}
              </p>
            </div>
            <div className="space-y-2 border-t border-zinc-300 pt-3 flex flex-col items-center">
              {osDetails.signatureBase64 ? (
                <div className="border border-zinc-200 rounded p-1 bg-zinc-50/50 mb-1 max-w-[200px] h-12 flex items-center justify-center overflow-hidden">
                  <img
                    src={osDetails.signatureBase64}
                    alt="Assinatura digital do cliente"
                    className="max-h-full max-w-full"
                  />
                </div>
              ) : (
                <div className="h-12 flex items-center justify-center text-red-500 italic text-[10px]">
                  Assinatura não coletada!
                </div>
              )}
              <p>Aprovação do Cliente (Aceite de Execução)</p>
              <p className="text-[10px] font-medium text-zinc-400">
                Assinado por: {osDetails.signatureName || osDetails.client.name}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
