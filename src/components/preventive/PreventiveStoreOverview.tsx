"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircuitBoard,
  FileImage,
  ImagePlus,
  MapPin,
  Package,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  User,
  Wrench,
} from "lucide-react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

const CATEGORY_LABELS: Record<string, string> = {
  ILUMINACAO: "Iluminação",
  ELETRICA: "Elétrica",
  CLIMATIZACAO: "Climatização",
  HIDRAULICA: "Hidráulica",
  INCENDIO: "Combate a incêndio",
  SEGURANCA: "Segurança",
  CIVIL: "Estrutura",
  REFRIGERACAO: "Refrigeração",
  DADOS_AUTOMACAO: "Dados e automação",
  MOBILIARIO: "Mobiliário",
  OUTROS: "Outros",
};

const STORE_PHOTO_LABELS: Record<string, string> = {
  FACHADA: "Fachada",
  SALAO: "Salão",
  ESTOQUE: "Estoque",
  AREA_TECNICA: "Área técnica",
  QUADRO_ELETRICO: "Quadro elétrico",
  CLIMATIZACAO: "Climatização",
  ILUMINACAO: "Iluminação",
  DEPOSITO: "Depósito",
  TELHADO: "Telhado",
  CASA_MAQUINAS: "Casa de máquinas",
  OUTROS: "Outros",
};

function isResolved(status?: string) {
  return ["CONCLUIDA", "CONCLUIDO", "RELATORIO_ENVIADO", "FATURADA", "CANCELADA"].includes(status || "");
}

function assetTone(asset: any) {
  if (["CRITICA", "CRITICO", "VENCIDO", "INATIVO"].includes(asset.criticality) || ["CRITICO", "VENCIDO", "INATIVO"].includes(asset.status)) {
    return { label: "Crítico", className: "bg-red-50 text-red-700 ring-red-600/15" };
  }
  if (["ALTA", "ATENCAO", "MANUTENCAO"].includes(asset.criticality) || ["ATENCAO", "MANUTENCAO"].includes(asset.status)) {
    return { label: "Atenção", className: "bg-amber-50 text-amber-700 ring-amber-600/15" };
  }
  return { label: "Em dia", className: "bg-emerald-50 text-emerald-700 ring-emerald-600/15" };
}

function scoreForAssets(assets: any[], openOrders = 0) {
  const total = assets.reduce((sum, asset) => sum + Math.max(1, Number(asset.quantity) || 1), 0);
  if (!total) return null;
  const critical = assets.filter((asset) => assetTone(asset).label === "Crítico").reduce((sum, asset) => sum + Math.max(1, Number(asset.quantity) || 1), 0);
  const attention = assets.filter((asset) => assetTone(asset).label === "Atenção").reduce((sum, asset) => sum + Math.max(1, Number(asset.quantity) || 1), 0);
  return Math.max(0, Math.min(100, Math.round((100 - (critical / total) * 60 - (attention / total) * 25 - Math.min(openOrders * 2, 20)) * 10) / 10));
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="rounded-md bg-zinc-100 px-2 py-1 text-[9px] font-black text-zinc-500">Não avaliada</span>;
  const tone = score >= 80 ? "bg-emerald-50 text-emerald-700" : score >= 70 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700";
  const label = score >= 90 ? "Excelente" : score >= 80 ? "Bom" : score >= 70 ? "Atenção" : score >= 50 ? "Ruim" : "Crítico";
  return <span className={`rounded-md px-2 py-1 text-[9px] font-black ${tone}`}>{label}</span>;
}

interface PreventiveStoreOverviewProps {
  store: any;
  onNewAsset: () => void;
  onViewAsset: (asset: any) => void;
  onNewOccurrence: (asset?: any) => void;
  onOpenOrder: (order: any) => void;
  storePhotoCategory: string;
  onStorePhotoCategoryChange: (category: string) => void;
  onAddStorePhotos: (files?: FileList | null) => void;
  onDeleteStorePhoto: (photoId: string) => void;
}

export function PreventiveStoreOverview({ store, onNewAsset, onViewAsset, onNewOccurrence, onOpenOrder, storePhotoCategory, onStorePhotoCategoryChange, onAddStorePhotos, onDeleteStorePhoto }: PreventiveStoreOverviewProps) {
  const allAssets = useMemo(() => (store?.storeProjects || []).flatMap((project: any) =>
    project.assets.filter((asset: any) => !asset.parentAssetId).map((asset: any) => ({ ...asset, environmentName: project.name })),
  ), [store]);
  const openOrders = useMemo(() => (store?.serviceOrders || []).filter((order: any) => !isResolved(order.status)), [store]);
  const score = scoreForAssets(allAssets, openOrders.length);
  const [assetSearch, setAssetSearch] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState("");

  const selectedAsset = allAssets.find((asset: any) => asset.id === selectedAssetId) || allAssets[0] || null;
  const filteredAssets = allAssets.filter((asset: any) => {
    const query = assetSearch.trim().toLowerCase();
    if (!query) return true;
    return [asset.tag, asset.name, asset.model, asset.brand, asset.serialNumber, asset.environmentName, CATEGORY_LABELS[asset.category]]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });
  const categoryScores = Object.entries(CATEGORY_LABELS).map(([category, label]) => {
    const categoryAssets = allAssets.filter((asset: any) => asset.category === category);
    return { category: label, score: scoreForAssets(categoryAssets) || 0, hasData: categoryAssets.length > 0 };
  }).filter((item) => item.hasData).slice(0, 8);
  const radarData = categoryScores.length >= 3 ? categoryScores : [
    ...categoryScores,
    ...[{ category: "Sem dados 1", score: 0 }, { category: "Sem dados 2", score: 0 }, { category: "Sem dados 3", score: 0 }].slice(0, 3 - categoryScores.length),
  ];
  const assetUnits = allAssets.reduce((sum: number, asset: any) => sum + Math.max(1, Number(asset.quantity) || 1), 0);
  const healthyUnits = allAssets.filter((asset: any) => assetTone(asset).label === "Em dia").reduce((sum: number, asset: any) => sum + Math.max(1, Number(asset.quantity) || 1), 0);
  const criticalUnits = allAssets.filter((asset: any) => assetTone(asset).label === "Crítico").reduce((sum: number, asset: any) => sum + Math.max(1, Number(asset.quantity) || 1), 0);
  const contact = store?.selectedContract?.contact;
  const address = store?.selectedContract?.address;
  const selectedSpecifications = useMemo(() => {
    if (!selectedAsset?.specificationsJson) return {} as Record<string, string>;
    try { return JSON.parse(selectedAsset.specificationsJson) as Record<string, string>; } catch { return {} as Record<string, string>; }
  }, [selectedAsset]);
  const selectedBreakers = selectedAsset?.components?.filter((component: any) => component.assetType === "DISJUNTOR") || [];

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-[#E4E7EC] bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-black text-[#101828] dark:text-white">{address?.label || store.fancyName || store.name}</h2>
              <span className="rounded-md bg-emerald-50 px-2 py-1 text-[9px] font-black text-emerald-700">Ativa</span>
            </div>
            <div className="mt-3 grid gap-x-8 gap-y-2 text-[11px] text-[#667085] sm:grid-cols-2">
              <span><b className="text-[#344054] dark:text-zinc-300">CNPJ:</b> {store.cpfCnpj || "Não informado"}</span>
              <span><b className="text-[#344054] dark:text-zinc-300">Código:</b> {store.selectedContract?.code || "—"}</span>
              <span className="flex items-start gap-1.5"><MapPin size={13} className="mt-0.5 shrink-0 text-[#155EEF]" />{address ? `${address.street}, ${address.number} · ${address.city}/${address.state}` : "Endereço da unidade não definido"}</span>
              <span className="flex items-center gap-1.5"><User size={13} className="text-[#155EEF]" />{contact?.name || "Responsável não definido"}</span>
              <span className="flex items-center gap-1.5"><Phone size={13} className="text-[#155EEF]" />{contact?.phone || store.phone || "Telefone não informado"}</span>
              <span><b className="text-[#344054] dark:text-zinc-300">Ambientes:</b> {store.storeProjects.length}</span>
            </div>
          </div>
          <div className="border-t border-[#E4E7EC] pt-4 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">
            <span className="text-[9px] font-black uppercase tracking-wider text-[#667085]">Pontuação da Loja</span>
            <div className="mt-2 flex items-end gap-2"><strong className="text-3xl font-black text-[#101828] dark:text-white">{score === null ? "—" : score.toFixed(1).replace(".", ",")}</strong><span className="pb-1 text-xs text-[#667085]">/100</span><ScoreBadge score={score} /></div>
            <div className="mt-4 flex h-8 items-end gap-1" aria-label="Evolução visual da saúde da unidade">
              {[45, 52, 48, 63, 56, 70, 66, score || 20].map((height, index) => <span key={index} className="flex-1 rounded-t bg-[#155EEF]/20 last:bg-[#155EEF]" style={{ height: `${Math.max(18, height)}%` }} />)}
            </div>
            <p className="mt-2 text-[10px] font-semibold text-emerald-600">Atualizada pelos ativos e pendências cadastrados</p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_330px]">
        <section className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-col gap-3 border-b border-[#E4E7EC] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div><h3 className="text-sm font-black text-[#101828] dark:text-white">Equipamentos e patrimônios</h3><p className="mt-0.5 text-[10px] text-[#667085]">{assetUnits} item(ns) em {store.storeProjects.length} ambiente(s)</p></div>
            <div className="flex gap-2">
              <div className="relative min-w-0 sm:w-60"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={13} /><input value={assetSearch} onChange={(event) => setAssetSearch(event.target.value)} placeholder="Buscar patrimônio ou modelo" className="h-9 w-full rounded-lg border border-[#E4E7EC] bg-white pl-9 pr-3 text-[11px] outline-none focus:border-[#155EEF] dark:border-zinc-700 dark:bg-zinc-800" /></div>
              <Button size="sm" onClick={onNewAsset}><Plus size={13} /> Equipamento</Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-[10px]">
              <thead className="bg-[#F9FAFB] text-[9px] font-black uppercase tracking-wide text-[#667085] dark:bg-zinc-800">
                <tr><th className="px-4 py-3">Patrimônio</th><th className="px-3 py-3">Equipamento</th><th className="px-3 py-3">Categoria</th><th className="px-3 py-3">Local</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Próxima preventiva</th><th className="px-3 py-3 text-right">Pontuação</th><th className="px-3 py-3" /></tr>
              </thead>
              <tbody className="divide-y divide-[#E4E7EC] dark:divide-zinc-800">
                {filteredAssets.slice(0, 12).map((asset: any) => {
                  const tone = assetTone(asset);
                  const assetScore = scoreForAssets([asset]) || 0;
                  const nextOrder = openOrders.find((order: any) => order.storeAsset?.id === asset.id && order.scheduledDate);
                  return <tr key={asset.id} className={`cursor-pointer transition hover:bg-blue-50/40 dark:hover:bg-blue-950/10 ${selectedAsset?.id === asset.id ? "bg-blue-50/60 dark:bg-blue-950/20" : ""}`} onClick={() => setSelectedAssetId(asset.id)}>
                    <td className="px-4 py-3 font-mono font-black text-[#155EEF]">{asset.tag || `PAT-${asset.id.slice(0, 6).toUpperCase()}`}</td>
                    <td className="px-3 py-3"><div className="flex items-center gap-2.5">{asset.photos?.[0] ? <img src={asset.photos[0].dataUrl} alt="" className="h-8 w-8 rounded-lg object-cover" /> : <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-400"><Package size={15} /></span>}<span><b className="block text-[11px] text-[#101828] dark:text-white">{asset.name}</b><span className="text-[#667085]">{[asset.brand, asset.model].filter(Boolean).join(" · ") || "Modelo não informado"}</span></span></div></td>
                    <td className="px-3 py-3 text-[#475467] dark:text-zinc-300">{CATEGORY_LABELS[asset.category] || asset.category}</td>
                    <td className="px-3 py-3 text-[#475467] dark:text-zinc-300">{asset.location || asset.environmentName}</td>
                    <td className="px-3 py-3"><span className={`rounded-md px-2 py-1 font-black ring-1 ring-inset ${tone.className}`}>{tone.label}</span></td>
                    <td className="px-3 py-3 text-[#475467] dark:text-zinc-300">{nextOrder ? formatDate(nextOrder.scheduledDate) : "Não programada"}</td>
                    <td className={`px-3 py-3 text-right font-black ${assetScore >= 80 ? "text-emerald-600" : assetScore >= 70 ? "text-amber-600" : "text-red-600"}`}>{assetScore}</td>
                    <td className="px-3 py-3"><button type="button" onClick={(event) => { event.stopPropagation(); onViewAsset(asset); }} aria-label={`Abrir ficha de ${asset.name}`} className="rounded-lg p-1.5 text-[#667085] hover:bg-white hover:text-[#155EEF]"><ChevronRight size={14} /></button></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
          {!filteredAssets.length && <div className="p-10 text-center text-xs text-[#667085]">Nenhum equipamento encontrado. Cadastre o primeiro item técnico desta unidade.</div>}
        </section>

        <div className="space-y-4">
          <section className="rounded-xl border border-[#E4E7EC] bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-xs font-black text-[#101828] dark:text-white">Pontuação por critério</h3>
            {categoryScores.length ? <div className="mt-2 h-64"><ResponsiveContainer width="100%" height="100%"><RadarChart data={radarData} outerRadius="68%"><PolarGrid stroke="#D0D5DD" /><PolarAngleAxis dataKey="category" tick={{ fontSize: 8, fill: "#667085" }} /><PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 8, fill: "#98A2B3" }} /><Radar dataKey="score" stroke="#155EEF" fill="#155EEF" fillOpacity={0.18} strokeWidth={2} /></RadarChart></ResponsiveContainer></div> : <div className="flex h-64 flex-col items-center justify-center text-center"><ShieldCheck size={30} className="text-zinc-300" /><p className="mt-3 text-xs font-bold text-zinc-500">Cadastre equipamentos para gerar a pontuação técnica.</p></div>}
          </section>
          <section className="rounded-xl border border-[#E4E7EC] bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between"><h3 className="text-xs font-black text-[#101828] dark:text-white">Ocorrências recentes</h3><button type="button" onClick={() => onNewOccurrence()} className="text-[9px] font-black text-[#155EEF]">+ Nova</button></div>
            <div className="mt-3 space-y-3">
              {(store.serviceOrders || []).slice(0, 5).map((order: any) => <button key={order.id} type="button" onClick={() => onOpenOrder(order)} className="flex w-full items-start gap-2.5 text-left">
                <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${isResolved(order.status) ? "bg-emerald-50 text-emerald-600" : ["ALTA", "URGENTE"].includes(order.priority) ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"}`}>{isResolved(order.status) ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}</span>
                <span className="min-w-0 flex-1"><b className="block truncate text-[10px] text-[#344054] dark:text-zinc-200">{order.problemReported || order.code}</b><span className="mt-0.5 block truncate text-[9px] text-[#667085]">{order.storeProject?.name || order.storeAsset?.name || "Unidade"} · {formatDate(order.createdAt)}</span></span>
                <span className={`rounded-md px-1.5 py-1 text-[8px] font-black ${isResolved(order.status) ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{isResolved(order.status) ? "Concluída" : "Em aberto"}</span>
              </button>)}
              {!store.serviceOrders?.length && <p className="py-6 text-center text-[10px] text-[#667085]">Nenhuma ocorrência registrada.</p>}
            </div>
          </section>
        </div>
      </div>

      <section className="rounded-xl border border-[#E4E7EC] bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h3 className="text-xs font-black text-[#101828] dark:text-white">Fotos da Loja</h3><p className="mt-1 text-[10px] text-[#667085]">Fachada, salão, estoque, áreas técnicas, iluminação, climatização e quadros permanecem no prontuário desta unidade.</p></div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select value={storePhotoCategory} onChange={(event) => onStorePhotoCategoryChange(event.target.value)} className="h-9 rounded-lg border border-[#E4E7EC] bg-white px-3 text-[10px] font-bold text-[#344054] outline-none focus:border-[#155EEF] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">{Object.entries(STORE_PHOTO_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#155EEF] px-3 text-[10px] font-black text-white hover:bg-blue-700"><ImagePlus size={13} /> Adicionar fotos<input type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" onChange={(event) => void onAddStorePhotos(event.target.files)} /></label>
          </div>
        </div>
        {store.storePhotos?.length ? <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">{store.storePhotos.slice(0, 12).map((photo: any) => <div key={photo.id} className="group relative overflow-hidden rounded-xl border border-[#E4E7EC] bg-[#F2F4F7]"><img src={photo.url} alt={`${STORE_PHOTO_LABELS[photo.category] || "Foto"} da loja`} className="aspect-[4/3] h-full w-full object-cover" /><span className="absolute bottom-2 left-2 rounded-md bg-zinc-950/75 px-2 py-1 text-[8px] font-black uppercase text-white">{STORE_PHOTO_LABELS[photo.category] || photo.category}</span><button type="button" onClick={() => void onDeleteStorePhoto(photo.id)} aria-label="Excluir foto da loja" className="absolute right-2 top-2 rounded-full bg-zinc-950/70 p-1.5 text-white opacity-0 transition group-hover:opacity-100"><Trash2 size={11} /></button></div>)}</div> : <div className="mt-4 flex h-32 flex-col items-center justify-center rounded-xl border border-dashed border-[#D0D5DD] text-center"><FileImage size={26} className="text-zinc-300" /><p className="mt-2 text-[10px] font-bold text-[#667085]">Adicione as primeiras fotos reais desta loja.</p></div>}
      </section>

      {selectedAsset?.category === "ELETRICA" && (
        <section className="rounded-xl border border-[#E4E7EC] bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><span className="text-[9px] font-black uppercase tracking-wider text-[#155EEF]">Análise do quadro</span><h3 className="mt-1 text-sm font-black text-[#101828] dark:text-white">{selectedAsset.name}</h3><p className="mt-1 text-[10px] text-[#667085]">Dados técnicos, circuitos e evidências fotográficas vinculados ao patrimônio.</p></div><Button size="sm" variant="secondary" onClick={() => onViewAsset(selectedAsset)}><CircuitBoard size={13} /> Abrir análise completa</Button></div>
          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1.4fr]">
            <dl className="grid grid-cols-2 gap-2 text-[10px]">{[["Tensão", selectedSpecifications.tensao], ["Fases", selectedSpecifications.fases], ["Corrente nominal", selectedSpecifications.correnteNominal], ["Capacidade de ruptura", selectedSpecifications.capacidadeRuptura], ["Local", selectedAsset.location], ["Status", assetTone(selectedAsset).label]].map(([label, value]) => <div key={label} className="rounded-lg bg-[#F9FAFB] p-3 dark:bg-zinc-800"><dt className="text-[8px] font-black uppercase text-[#98A2B3]">{label}</dt><dd className="mt-1 font-black text-[#344054] dark:text-zinc-200">{value || "Não informado"}</dd></div>)}</dl>
            <div className="rounded-xl border border-[#E4E7EC] p-3 dark:border-zinc-700"><div className="flex items-center justify-between"><h4 className="text-[10px] font-black text-[#344054] dark:text-zinc-200">Circuitos e disjuntores</h4><span className="text-[9px] font-bold text-[#667085]">{selectedBreakers.length} cadastrado(s)</span></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{selectedBreakers.slice(0, 8).map((breaker: any, index: number) => <button key={breaker.id} type="button" onClick={() => onViewAsset(breaker)} className="flex items-center gap-2 rounded-lg border border-[#E4E7EC] p-2 text-left hover:border-[#155EEF]"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-zinc-900 text-[9px] font-black text-white">DJ{String(index + 1).padStart(2, "0")}</span><span className="min-w-0"><b className="block truncate text-[10px] text-[#344054] dark:text-zinc-200">{breaker.name}</b><span className="block truncate text-[8px] text-[#667085]">{[breaker.brand, breaker.model, breaker.tag].filter(Boolean).join(" · ") || "Dados técnicos pendentes"}</span></span></button>)}{!selectedBreakers.length && <p className="col-span-2 py-5 text-center text-[10px] text-[#667085]">Cadastre os disjuntores como componentes deste quadro.</p>}</div></div>
          </div>
        </section>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_1.35fr_1fr]">
        <section className="rounded-xl border border-[#E4E7EC] bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between"><h3 className="text-xs font-black text-[#101828] dark:text-white">Detalhes do equipamento</h3>{selectedAsset && <button onClick={() => onViewAsset(selectedAsset)} className="text-[9px] font-black text-[#155EEF]">Ver ficha completa</button>}</div>
          {selectedAsset ? <div className="mt-4 flex gap-4">{selectedAsset.photos?.[0] ? <img src={selectedAsset.photos[0].dataUrl} alt={selectedAsset.name} className="h-28 w-28 rounded-xl object-cover" /> : <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-xl bg-[#F2F4F7]"><Package size={34} className="text-zinc-300" /></div>}<div className="min-w-0 text-[10px]"><div className="flex flex-wrap items-center gap-2"><b className="text-sm text-[#101828] dark:text-white">{selectedAsset.name}</b><span className={`rounded-md px-2 py-1 text-[8px] font-black ring-1 ring-inset ${assetTone(selectedAsset).className}`}>{assetTone(selectedAsset).label}</span></div><dl className="mt-3 grid grid-cols-[70px_1fr] gap-y-1.5 text-[#667085]"><dt>Patrimônio</dt><dd className="font-bold text-[#344054] dark:text-zinc-300">{selectedAsset.tag || `PAT-${selectedAsset.id.slice(0, 6).toUpperCase()}`}</dd><dt>Modelo</dt><dd>{selectedAsset.model || "Não informado"}</dd><dt>Categoria</dt><dd>{CATEGORY_LABELS[selectedAsset.category] || selectedAsset.category}</dd><dt>Local</dt><dd>{selectedAsset.location || selectedAsset.environmentName}</dd><dt>Quantidade</dt><dd>{selectedAsset.quantity} {selectedAsset.unit}</dd></dl></div></div> : <p className="py-10 text-center text-[10px] text-[#667085]">Selecione um equipamento.</p>}
        </section>

        <section className="rounded-xl border border-[#E4E7EC] bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between"><h3 className="text-xs font-black text-[#101828] dark:text-white">Fotos do equipamento</h3>{selectedAsset && <button onClick={() => onViewAsset(selectedAsset)} className="inline-flex items-center gap-1 text-[9px] font-black text-[#155EEF]"><ImagePlus size={12} /> Adicionar fotos</button>}</div>
          {selectedAsset?.photos?.length ? <div className="mt-4 grid grid-cols-3 gap-2">{selectedAsset.photos.slice(0, 3).map((photo: any) => <img key={photo.id} src={photo.dataUrl} alt={photo.caption || selectedAsset.name} className="aspect-[4/3] w-full rounded-lg object-cover" />)}</div> : <div className="mt-4 flex h-28 flex-col items-center justify-center rounded-xl border border-dashed border-[#D0D5DD] text-center"><FileImage size={24} className="text-zinc-300" /><p className="mt-2 text-[10px] font-bold text-[#667085]">Nenhuma foto cadastrada</p></div>}
        </section>

        <section className="rounded-xl border border-[#E4E7EC] bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-xs font-black text-[#101828] dark:text-white">Modelo / referência</h3>
          {selectedAsset ? <div className="mt-4"><div className="flex gap-3">{selectedAsset.photos?.[1] ? <img src={selectedAsset.photos[1].dataUrl} alt="Foto de referência" className="h-24 w-24 rounded-xl object-cover" /> : <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-[#F2F4F7]"><Wrench size={28} className="text-zinc-300" /></div>}<dl className="grid min-w-0 grid-cols-[68px_1fr] gap-y-1 text-[9px] text-[#667085]"><dt>Fabricante</dt><dd className="truncate font-bold text-[#344054] dark:text-zinc-300">{selectedAsset.brand || "—"}</dd><dt>Modelo</dt><dd className="truncate">{selectedAsset.model || "—"}</dd><dt>Referência</dt><dd className="truncate">{selectedAsset.manufacturerCode || "—"}</dd><dt>Série</dt><dd className="truncate">{selectedAsset.serialNumber || "—"}</dd><dt>Atualizado</dt><dd>{formatDate(selectedAsset.updatedAt)}</dd></dl></div></div> : <p className="py-10 text-center text-[10px] text-[#667085]">Selecione um equipamento.</p>}
        </section>
      </div>

      <section className="grid gap-3 rounded-xl border border-[#E4E7EC] bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-3">
        <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><CheckCircle2 size={18} /></span><span><b className="block text-lg text-[#101828] dark:text-white">{healthyUnits}</b><small className="text-[9px] font-bold uppercase text-[#667085]">Equipamentos normais</small></span></div>
        <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><CalendarClock size={18} /></span><span><b className="block text-lg text-[#101828] dark:text-white">{Math.max(0, assetUnits - healthyUnits - criticalUnits)}</b><small className="text-[9px] font-bold uppercase text-[#667085]">Em atenção</small></span></div>
        <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600"><AlertTriangle size={18} /></span><span><b className="block text-lg text-[#101828] dark:text-white">{criticalUnits}</b><small className="text-[9px] font-bold uppercase text-[#667085]">Críticos</small></span></div>
      </section>
    </div>
  );
}
