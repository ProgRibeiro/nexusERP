"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */

import React, { useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  Camera,
  CheckCircle2,
  CircuitBoard,
  Clock3,
  FileImage,
  LampCeiling,
  LayoutGrid,
  Map,
  MapPin,
  Package,
  Phone,
  Plus,
  Send,
  Snowflake,
  Wrench,
  X,
} from "lucide-react";
import { createPublicStoreTicket } from "@/app/actions/storePortalActions";
import { Select } from "@/components/ui/Select";

const categoryMeta: Record<string, { label: string; icon: React.ElementType; color: string; marker: string }> = {
  CLIMATIZACAO: { label: "Climatização", icon: Snowflake, color: "border-sky-200 bg-sky-50 text-sky-700", marker: "bg-sky-500" },
  ILUMINACAO: { label: "Iluminação", icon: LampCeiling, color: "border-amber-200 bg-amber-50 text-amber-700", marker: "bg-amber-500" },
  ELETRICA: { label: "Elétrica", icon: CircuitBoard, color: "border-violet-200 bg-violet-50 text-violet-700", marker: "bg-violet-500" },
  CIVIL: { label: "Civil e acabamentos", icon: Building2, color: "border-orange-200 bg-orange-50 text-orange-700", marker: "bg-orange-500" },
  HIDRAULICA: { label: "Hidráulica", icon: Wrench, color: "border-blue-200 bg-blue-50 text-blue-700", marker: "bg-blue-500" },
  REFRIGERACAO: { label: "Refrigeração", icon: Snowflake, color: "border-cyan-200 bg-cyan-50 text-cyan-700", marker: "bg-cyan-500" },
  INCENDIO: { label: "Prevenção de incêndio", icon: AlertTriangle, color: "border-red-200 bg-red-50 text-red-700", marker: "bg-red-500" },
  SEGURANCA: { label: "Segurança", icon: AlertTriangle, color: "border-rose-200 bg-rose-50 text-rose-700", marker: "bg-rose-500" },
  DADOS_AUTOMACAO: { label: "Dados e automação", icon: CircuitBoard, color: "border-indigo-200 bg-indigo-50 text-indigo-700", marker: "bg-indigo-500" },
  MOBILIARIO: { label: "Mobiliário", icon: Package, color: "border-emerald-200 bg-emerald-50 text-emerald-700", marker: "bg-emerald-500" },
  OUTROS: { label: "Outros", icon: Package, color: "border-slate-200 bg-slate-50 text-slate-700", marker: "bg-slate-500" },
};

const closedStatuses = ["CONCLUIDA", "CONCLUIDO", "RELATORIO_ENVIADO", "FATURADA", "CANCELADA"];
const statusLabel: Record<string, string> = {
  CRIADA: "Recebido",
  AGUARDANDO_AGENDAMENTO: "Aguardando agendamento",
  AGENDADA: "Visita agendada",
  DESLOCAMENTO: "Equipe a caminho",
  EXECUCAO: "Em atendimento",
  PAUSADA: "Atendimento pausado",
  AGUARDANDO_PECA: "Aguardando peça",
  AGUARDANDO_CLIENTE: "Aguardando cliente",
  RETORNO: "Retorno programado",
  CONCLUIDA: "Concluído",
  CONCLUIDO: "Concluído",
  RELATORIO_ENVIADO: "Relatório enviado",
  FATURADA: "Finalizado",
  CANCELADA: "Cancelado",
};

const formatDate = (value?: string | null) => value
  ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value))
  : "—";

const technicalTypeLabel = (value?: string | null) =>
  value ? value.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase()) : "Item técnico";

const fileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

export default function PublicStorePortal({ initialData }: { initialData: any }) {
  const [data, setData] = useState(initialData);
  const [view, setView] = useState<"inicio" | "patrimonio" | "planta" | "chamados">("inicio");
  const [selectedProjectId, setSelectedProjectId] = useState(initialData.projects[0]?.id || "");
  const [selectedAsset, setSelectedAsset] = useState<any | null>(null);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [form, setForm] = useState({
    requesterName: "",
    requesterEmail: "",
    requesterPhone: "",
    title: "",
    description: "",
    priority: "MEDIA",
    projectId: initialData.projects[0]?.id || "",
    assetId: "",
  });
  const [photos, setPhotos] = useState<Array<{ dataUrl: string; fileName: string }>>([]);

  const project = data.projects.find((item: any) => item.id === selectedProjectId) || data.projects[0] || null;
  const allAssets = useMemo(() => data.projects.flatMap((item: any) => item.assets), [data.projects]);
  const selectableAssets = useMemo(() => {
    const selected = data.projects.find((item: any) => item.id === form.projectId);
    return selected?.assets.flatMap((asset: any) => [asset, ...(asset.components || [])]) || [];
  }, [data.projects, form.projectId]);
  const openTickets = data.tickets.filter((ticket: any) => !closedStatuses.includes(ticket.status));
  const componentCount = allAssets.reduce((sum: number, asset: any) => sum + (asset.components?.length || 0), 0);
  const address = data.store.address;
  const addressText = address ? `${address.street}, ${address.number}${address.complement ? ` · ${address.complement}` : ""} · ${address.city}/${address.state}` : "Endereço não informado";

  const handlePhotos = async (files?: FileList | null) => {
    if (!files) return;
    const selected = Array.from(files).slice(0, 5 - photos.length);
    const invalid = selected.find((file) => !file.type.startsWith("image/") || file.size > 3 * 1024 * 1024);
    if (invalid) {
      setFeedback({ type: "error", text: "Use imagens de até 3 MB cada." });
      return;
    }
    const converted = await Promise.all(selected.map(async (file) => ({ dataUrl: await fileToDataUrl(file), fileName: file.name })));
    setPhotos((current) => [...current, ...converted].slice(0, 5));
  };

  const submitTicket = (event: React.FormEvent) => {
    event.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const result = await createPublicStoreTicket({ token: data.portal.token, ...form, photos });
      if (!result.success) {
        setFeedback({ type: "error", text: result.error || "Não foi possível abrir o chamado." });
        return;
      }
      const now = new Date().toISOString();
      setData((current: any) => ({
        ...current,
        tickets: [{
          id: result.serviceOrderId,
          code: result.code,
          status: "AGUARDANDO_AGENDAMENTO",
          priority: form.priority,
          problemReported: `${form.title}\n\n${form.description}`,
          requestSource: "CLIENTE_PORTAL",
          createdAt: now,
          updatedAt: now,
          scheduledDate: null,
          completedAt: null,
          storeProject: data.projects.find((item: any) => item.id === form.projectId) || null,
          storeAsset: selectableAssets.find((item: any) => item.id === form.assetId) || null,
          photoCount: photos.length,
          isOpen: true,
        }, ...current.tickets],
      }));
      setFeedback({ type: "success", text: `Chamado ${result.code} aberto. Nossa equipe já recebeu a solicitação.` });
      setPhotos([]);
      setForm((current) => ({ ...current, title: "", description: "", assetId: "" }));
    });
  };

  return (
    <main className="min-h-screen bg-[#f4f7fb] text-slate-900">
      <header className="relative overflow-hidden bg-[#071331] text-white">
        <div className="absolute -right-20 -top-28 h-80 w-80 rounded-full bg-blue-500/25 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-28 w-80 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-5 py-6 sm:px-8 lg:px-10 lg:py-8">
          <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-sm font-black shadow-lg shadow-blue-950">NX</span>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-300">Portal da loja</p>
                  <p className="text-xs text-slate-400">Controle técnico e chamados</p>
                </div>
              </div>
              <h1 className="mt-7 text-3xl font-black tracking-tight sm:text-4xl">{data.store.label}</h1>
              <p className="mt-2 text-sm text-slate-400">{data.store.groupName} · {data.store.contractCode}</p>
              <div className="mt-5 flex flex-col gap-2 text-sm text-slate-300 sm:flex-row sm:flex-wrap sm:gap-x-6">
                <span className="flex items-center gap-2"><MapPin size={16} className="text-blue-300" />{addressText}</span>
                {data.store.contact?.phone && <span className="flex items-center gap-2"><Phone size={16} className="text-blue-300" />{data.store.contact.name} · {data.store.contact.phone}</span>}
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="min-w-28 rounded-2xl border border-white/10 bg-white/[0.07] px-5 py-4"><b className="block text-2xl">{allAssets.length}</b><span className="text-[10px] font-black uppercase tracking-wide text-slate-400">Equipamentos</span></div>
              <div className="min-w-28 rounded-2xl border border-white/10 bg-white/[0.07] px-5 py-4"><b className="block text-2xl">{componentCount}</b><span className="text-[10px] font-black uppercase tracking-wide text-slate-400">Componentes</span></div>
              <div className="min-w-28 rounded-2xl border border-white/10 bg-white/[0.07] px-5 py-4"><b className="block text-2xl text-amber-300">{openTickets.length}</b><span className="text-[10px] font-black uppercase tracking-wide text-slate-400">Chamados</span></div>
            </div>
          </div>
        </div>
      </header>

      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 overflow-x-auto px-4 py-3 sm:px-8 lg:px-10">
          <nav className="flex min-w-max gap-1">
            {[
              { id: "inicio", label: "Visão geral", icon: LayoutGrid },
              { id: "patrimonio", label: "Patrimônio", icon: Package },
              { id: "planta", label: "Mapa técnico", icon: Map },
              { id: "chamados", label: "Meus chamados", icon: Wrench },
            ].map((item) => <button key={item.id} onClick={() => setView(item.id as typeof view)} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition sm:px-4 sm:text-sm ${view === item.id ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-50"}`}><item.icon size={16} />{item.label}</button>)}
          </nav>
          {data.portal.allowTicketCreation && <button onClick={() => { setFeedback(null); setTicketOpen(true); }} className="flex min-w-max items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-black text-white shadow-md shadow-blue-200 transition hover:bg-blue-700"><Plus size={16} /> Abrir chamado</button>}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8 lg:px-10 lg:py-9">
        {view === "inicio" && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <div className="flex items-center justify-between gap-3">
                <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">Sua unidade</p><h2 className="mt-2 text-xl font-black">Ambientes e patrimônio</h2></div>
                <button onClick={() => setView("patrimonio")} className="text-xs font-bold text-blue-600">Ver tudo →</button>
              </div>
              {data.projects.length ? <div className="mt-6 grid gap-4 sm:grid-cols-2">{data.projects.map((item: any) => <button key={item.id} onClick={() => { setSelectedProjectId(item.id); setView("patrimonio"); }} className="group rounded-2xl border border-slate-200 p-5 text-left transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-100/50"><div className="flex items-start justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white"><Building2 size={18} /></span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500">{item.assets.length} itens</span></div><h3 className="mt-4 font-black">{item.name}</h3><p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.description || "Área técnica cadastrada para esta loja."}</p><p className="mt-4 text-xs font-bold text-blue-600 group-hover:translate-x-1">Abrir ambiente →</p></button>)}</div> : <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">O mapeamento técnico desta loja ainda está sendo preparado.</div>}
            </section>
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600">Acompanhamento</p><h2 className="mt-2 text-xl font-black">Chamados recentes</h2></div><CalendarClock className="text-slate-300" /></div>
              <div className="mt-6 space-y-3">{data.tickets.slice(0, 5).map((ticket: any) => <TicketRow key={ticket.id} ticket={ticket} />)}{!data.tickets.length && <div className="rounded-2xl bg-emerald-50 p-6 text-center"><CheckCircle2 className="mx-auto text-emerald-500" /><p className="mt-3 text-sm font-black text-emerald-900">Tudo em ordem</p><p className="mt-1 text-xs text-emerald-700">Nenhum chamado registrado nesta loja.</p></div>}</div>
            </section>
          </div>
        )}

        {view === "patrimonio" && (
          <section>
            <WorkspaceHeader title="Patrimônio técnico" subtitle="Modelos, fotos, identificação e componentes instalados por ambiente." projects={data.projects} selected={project?.id || ""} onSelect={setSelectedProjectId} />
            {project?.assets.length ? <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{project.assets.map((asset: any) => <AssetCard key={asset.id} asset={asset} onOpen={() => setSelectedAsset(asset)} />)}</div> : <EmptyState icon={Package} title="Nenhum patrimônio cadastrado" text="A equipe técnica ainda não adicionou equipamentos a este ambiente." />}
          </section>
        )}

        {view === "planta" && (
          <section>
            <WorkspaceHeader title="Mapa técnico 2D" subtitle="Localização visual dos equipamentos, lâmpadas, quadros e componentes da loja." projects={data.projects} selected={project?.id || ""} onSelect={setSelectedProjectId} />
            {project ? <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]"><TechnicalMap project={project} onOpen={setSelectedAsset} /><div className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="text-sm font-black">Legenda do ambiente</h3><div className="mt-4 space-y-3">{Object.entries(categoryMeta).map(([key, meta]) => { const count = project.assets.filter((asset: any) => asset.category === key).reduce((sum: number, asset: any) => sum + asset.quantity, 0); if (!count) return null; return <div key={key} className="flex items-center justify-between text-xs"><span className="flex items-center gap-2 font-semibold text-slate-600"><span className={`h-2.5 w-2.5 rounded-full ${meta.marker}`} />{meta.label}</span><b>{count}</b></div>; })}</div><p className="mt-6 rounded-xl bg-blue-50 p-3 text-[11px] leading-5 text-blue-800">Toque em um ponto para abrir a ficha, ver fotos, modelo e os componentes associados.</p></div></div> : <EmptyState icon={Map} title="Mapa em preparação" text="Nenhum ambiente técnico foi cadastrado para esta loja." />}
          </section>
        )}

        {view === "chamados" && (
          <section>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">Atendimento</p><h2 className="mt-2 text-2xl font-black">Chamados desta loja</h2><p className="mt-1 text-sm text-slate-500">Acompanhe protocolo, prioridade e andamento de cada solicitação.</p></div>{data.portal.allowTicketCreation && <button onClick={() => setTicketOpen(true)} className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white"><Plus size={17} /> Abrir novo chamado</button>}</div>
            <div className="mt-6 space-y-3">{data.tickets.map((ticket: any) => <TicketRow key={ticket.id} ticket={ticket} expanded />)}{!data.tickets.length && <EmptyState icon={CheckCircle2} title="Nenhum chamado registrado" text="Quando você abrir uma solicitação, o acompanhamento aparecerá aqui." />}</div>
          </section>
        )}
      </div>

      {selectedAsset && <AssetDetail asset={selectedAsset} onClose={() => setSelectedAsset(null)} />}

      {ticketOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) setTicketOpen(false); }}>
          <form onSubmit={submitTicket} className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white px-5 py-5 sm:px-7"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">Solicitação para {data.store.label}</p><h2 className="mt-1 text-xl font-black">Abrir chamado técnico</h2></div><button type="button" onClick={() => setTicketOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={20} /></button></div>
            <div className="space-y-6 p-5 sm:p-7">
              {feedback && <div className={`rounded-xl border p-4 text-sm font-bold ${feedback.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>{feedback.text}</div>}
              <div className="grid gap-4 sm:grid-cols-2"><Field label="Seu nome *"><input required value={form.requesterName} onChange={(e) => setForm((c) => ({ ...c, requesterName: e.target.value }))} /></Field><Field label="Telefone / WhatsApp"><input value={form.requesterPhone} onChange={(e) => setForm((c) => ({ ...c, requesterPhone: e.target.value }))} /></Field><Field label="E-mail"><input type="email" value={form.requesterEmail} onChange={(e) => setForm((c) => ({ ...c, requesterEmail: e.target.value }))} /></Field><Field label="Prioridade"><Select value={form.priority} onChange={(e) => setForm((c) => ({ ...c, priority: e.target.value }))} options={[{ value: "BAIXA", label: "Baixa" }, { value: "MEDIA", label: "Média" }, { value: "ALTA", label: "Alta" }, { value: "URGENTE", label: "Urgente" }]} /></Field></div>
              <div className="grid gap-4 sm:grid-cols-2"><Field label="Ambiente / setor"><Select value={form.projectId} onChange={(e) => setForm((c) => ({ ...c, projectId: e.target.value, assetId: "" }))} searchPlaceholder="Digite o ambiente" options={[{ value: "", label: "Não sei informar" }, ...data.projects.map((item: any) => ({ value: item.id, label: item.name }))]} /></Field><Field label="Equipamento relacionado"><Select value={form.assetId} onChange={(e) => setForm((c) => ({ ...c, assetId: e.target.value }))} searchPlaceholder="Digite o equipamento" options={[{ value: "", label: "Chamado geral da loja" }, ...selectableAssets.map((item: any) => ({ value: item.id, label: `${item.name}${item.tag ? ` · ${item.tag}` : ""}` }))]} /></Field></div>
              <Field label="Assunto *"><input required value={form.title} onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))} placeholder="Ex: Ar-condicionado não está gelando" /></Field>
              <Field label="O que está acontecendo? *"><textarea required rows={5} value={form.description} onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))} placeholder="Descreva o problema, onde está e quando começou." /></Field>
              <div><p className="text-xs font-bold text-slate-600">Fotos do problema</p><label className="mt-2 flex cursor-pointer items-center justify-center gap-3 rounded-2xl border border-dashed border-blue-300 bg-blue-50 p-5 text-sm font-bold text-blue-700 hover:border-blue-500"><Camera size={20} /> Tirar ou selecionar fotos<input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(event) => void handlePhotos(event.target.files)} /></label>{photos.length > 0 && <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">{photos.map((photo, index) => <div key={`${photo.fileName}-${index}`} className="group relative aspect-square overflow-hidden rounded-xl"><img src={photo.dataUrl} alt={photo.fileName} className="h-full w-full object-cover" /><button type="button" onClick={() => setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index))} className="absolute right-1 top-1 rounded-full bg-slate-950/70 p-1 text-white"><X size={12} /></button></div>)}</div>}</div>
            </div>
            <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:px-7"><button type="button" onClick={() => setTicketOpen(false)} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600">Fechar</button><button disabled={isPending || feedback?.type === "success"} className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50">{isPending ? <Clock3 className="animate-spin" size={17} /> : <Send size={17} />}{isPending ? "Enviando..." : "Enviar chamado"}</button></div>
          </form>
        </div>
      )}
    </main>
  );
}

function WorkspaceHeader({ title, subtitle, projects, selected, onSelect }: any) {
  return <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">Mapa da loja</p><h2 className="mt-2 text-2xl font-black">{title}</h2><p className="mt-1 text-sm text-slate-500">{subtitle}</p></div>{projects.length > 1 && <div className="w-full sm:w-64"><Select value={selected} onChange={(event) => onSelect(event.target.value)} searchPlaceholder="Digite o ambiente" options={projects.map((item: any) => ({ value: item.id, label: item.name }))} /></div>}</div>;
}

function AssetCard({ asset, onOpen }: any) {
  const meta = categoryMeta[asset.category] || categoryMeta.OUTROS;
  const Icon = meta.icon;
  const photo = asset.photos?.[0]?.dataUrl;
  return <button onClick={onOpen} className="group overflow-hidden rounded-3xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-xl hover:shadow-blue-100/50"><div className="relative aspect-[16/9] overflow-hidden bg-slate-100">{photo ? <img src={photo} alt={asset.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-50 to-slate-200"><Icon size={42} className="text-slate-300" /></div>}<span className={`absolute left-3 top-3 rounded-full border px-2.5 py-1 text-[10px] font-black ${meta.color}`}>{meta.label}</span>{asset.photos?.length > 0 && <span className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-slate-950/70 px-2 py-1 text-[10px] font-bold text-white"><FileImage size={12} />{asset.photos.length}</span>}</div><div className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="mb-1 text-[9px] font-black uppercase tracking-wide text-blue-600">{technicalTypeLabel(asset.assetType)}</p><h3 className="font-black text-slate-950">{asset.name}{asset.quantity > 1 && <span className="ml-1 text-blue-600">× {asset.quantity}</span>}</h3><p className="mt-1 text-xs text-slate-500">{[asset.brand, asset.model, asset.manufacturerCode].filter(Boolean).join(" · ") || "Modelo ainda não informado"}</p></div><span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-black text-emerald-700">{asset.status}</span></div><div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4"><span className="text-[11px] font-semibold text-slate-500">{asset.location || "Localização na planta"}</span><span className="text-xs font-black text-blue-600">Abrir ficha →</span></div></div></button>;
}

function TechnicalMap({ project, onOpen }: any) {
  return <div className="relative aspect-[16/10] min-h-[420px] overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 shadow-inner">{project.floorPlanData ? <img src={project.floorPlanData} alt={`Planta ${project.name}`} className="h-full w-full object-contain" /> : <div className="absolute inset-0 opacity-70" style={{ backgroundImage: "linear-gradient(#cbd5e1 1px, transparent 1px), linear-gradient(90deg, #cbd5e1 1px, transparent 1px)", backgroundSize: "32px 32px" }}><div className="absolute inset-[7%] rounded-2xl border-2 border-slate-400 bg-white/60"><div className="absolute left-1/3 h-full border-l-2 border-slate-300" /><div className="absolute left-2/3 h-full border-l-2 border-slate-300" /><div className="absolute top-1/2 w-full border-t-2 border-slate-300" /></div></div>}{project.assets.map((asset: any) => { const meta = categoryMeta[asset.category] || categoryMeta.OUTROS; const Icon = meta.icon; return <button key={asset.id} type="button" onClick={() => onOpen(asset)} style={{ left: `${asset.positionX}%`, top: `${asset.positionY}%` }} className={`group absolute z-10 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-white text-white shadow-lg transition hover:z-20 hover:scale-125 ${meta.marker}`}><Icon size={15} /><span className="absolute left-8 top-0 hidden min-w-max rounded-lg bg-slate-950 px-2.5 py-1.5 text-[10px] font-bold text-white group-hover:block">{asset.name}</span></button>; })}</div>;
}

function AssetDetail({ asset, onClose }: any) {
  const meta = categoryMeta[asset.category] || categoryMeta.OUTROS;
  const Icon = meta.icon;
  let specifications = "";
  let technicalEntries: Array<[string, string]> = [];
  try {
    const parsed = JSON.parse(asset.specificationsJson || "{}");
    specifications = parsed.description || "";
    technicalEntries = Object.entries(parsed).filter(([key, value]) => key !== "description" && Boolean(value)) as Array<[string, string]>;
  } catch {}
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/65 p-0 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"><div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white px-5 py-5 sm:px-7"><div className="flex items-center gap-3"><span className={`rounded-xl border p-2.5 ${meta.color}`}><Icon size={20} /></span><div><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Ficha técnica · {meta.label} · {technicalTypeLabel(asset.assetType)}</p><h2 className="text-xl font-black">{asset.name}</h2></div></div><button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={20} /></button></div><div className="grid gap-7 p-5 sm:p-7 lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,.95fr)]"><div>{asset.photos?.length ? <div className="grid grid-cols-2 gap-3">{asset.photos.map((photo: any, index: number) => <img key={photo.id} src={photo.dataUrl} alt={photo.caption || `${asset.name} ${index + 1}`} className={`w-full rounded-2xl object-cover ${index === 0 ? "col-span-2 aspect-[16/9]" : "aspect-square"}`} />)}</div> : <div className="flex aspect-[16/10] items-center justify-center rounded-2xl bg-slate-100"><Icon size={60} className="text-slate-300" /></div>}<dl className="mt-5 grid grid-cols-2 gap-3">{[["Marca", asset.brand], ["Modelo", asset.model], ["Código fabricante", asset.manufacturerCode], ["TAG", asset.tag], ["Série", asset.serialNumber], ["Local", asset.location], ["Quantidade", `${asset.quantity} ${asset.unit || "UN"}`], ["Criticidade", asset.criticality], ["Especificações", specifications], ["Situação", asset.status]].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-slate-50 p-3"><dt className="text-[9px] font-black uppercase tracking-wide text-slate-400">{label}</dt><dd className="mt-1 text-xs font-bold text-slate-800">{value || "Não informado"}</dd></div>)}</dl>{technicalEntries.length > 0 && <dl className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-blue-50 p-4">{technicalEntries.map(([key, value]) => <div key={key}><dt className="text-[9px] font-black uppercase text-blue-500">{key.replace(/([A-Z])/g, " $1")}</dt><dd className="mt-1 text-xs font-bold text-blue-950">{value}</dd></div>)}</dl>}</div><div><h3 className="text-sm font-black">Visão técnica 2D</h3><p className="mt-1 text-xs leading-5 text-slate-500">Representação dos componentes cadastrados e vinculados a este equipamento.</p><div className={`mt-4 min-h-72 rounded-2xl border-2 p-4 ${asset.category === "ELETRICA" ? "border-slate-700 bg-slate-900" : "border-sky-200 bg-gradient-to-b from-sky-50 to-white"}`}>{asset.category === "CLIMATIZACAO" && <div className="mx-auto mt-3 max-w-sm rounded-2xl border border-sky-200 bg-white p-5 shadow-lg"><div className="h-2 rounded-full bg-sky-100"><div className="h-full w-2/3 rounded-full bg-sky-400" /></div><div className="mt-8 flex items-center justify-between"><Snowflake className="text-sky-500" /><div className="flex gap-1">{[1,2,3,4,5,6].map((item) => <span key={item} className="h-1 w-7 rounded bg-slate-200" />)}</div></div></div>}<div className={`grid gap-3 ${asset.category === "ELETRICA" ? "grid-cols-2" : "mt-5"}`}>{asset.components?.map((component: any, index: number) => <div key={component.id} className={`rounded-xl border p-3 ${asset.category === "ELETRICA" ? "border-slate-600 bg-slate-800 text-white" : "border-slate-200 bg-white"}`}><div className="flex items-start gap-3">{component.photos?.[0] ? <img src={component.photos[0].dataUrl} alt={component.name} className="h-11 w-11 rounded-lg object-cover" /> : <span className={`flex h-11 w-11 items-center justify-center rounded-lg ${asset.category === "ELETRICA" ? "bg-violet-500/20 text-violet-300" : "bg-slate-100 text-slate-400"}`}><CircuitBoard size={17} /></span>}<div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-wide opacity-50">{technicalTypeLabel(component.assetType)} · {index + 1}</p><p className="truncate text-xs font-black">{component.name}</p><p className="truncate text-[10px] opacity-60">{[component.brand, component.model, component.manufacturerCode].filter(Boolean).join(" · ") || component.tag || "Sem modelo"}</p></div></div></div>)}</div>{!asset.components?.length && <div className={`flex min-h-44 items-center justify-center text-center text-xs ${asset.category === "ELETRICA" ? "text-slate-400" : "text-slate-500"}`}>Os componentes internos ainda não foram mapeados.</div>}</div><p className="mt-3 rounded-xl bg-amber-50 p-3 text-[10px] leading-5 text-amber-800">A visão 2D é construída com os itens e fotos cadastrados pela equipe. Um modelo 3D fiel requer imagens em vários ângulos ou um escaneamento específico.</p></div></div></div></div>;
}

function TicketRow({ ticket, expanded = false }: any) {
  const title = ticket.problemReported?.split("\n")[0] || "Chamado técnico";
  const isClosed = closedStatuses.includes(ticket.status);
  return <div className={`rounded-2xl border p-4 ${isClosed ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200 bg-white"}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-[10px] font-black text-blue-600">{ticket.code}</span><span className={`rounded-full px-2 py-1 text-[9px] font-black ${isClosed ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{statusLabel[ticket.status] || ticket.status}</span></div><p className="mt-2 line-clamp-2 text-sm font-black text-slate-900">{title}</p>{expanded && <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500"><span>Aberto em {formatDate(ticket.createdAt)}</span><span>Prioridade {ticket.priority?.toLowerCase()}</span>{ticket.storeAsset && <span>Item: {ticket.storeAsset.name}</span>}{ticket.storeProject && <span>Ambiente: {ticket.storeProject.name}</span>}<span>{ticket.photoCount || 0} foto(s)</span></div>}</div>{isClosed ? <CheckCircle2 size={18} className="shrink-0 text-emerald-500" /> : <Clock3 size={18} className="shrink-0 text-amber-500" />}</div></div>;
}

function EmptyState({ icon: Icon, title, text }: any) {
  return <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center"><Icon className="mx-auto text-slate-300" size={38} /><h3 className="mt-4 font-black">{title}</h3><p className="mt-2 text-sm text-slate-500">{text}</p></div>;
}

function Field({ label, children }: { label: string; children: React.ReactElement<any> }) {
  return <label className="block"><span className="mb-2 block text-xs font-bold text-slate-600">{label}</span>{React.cloneElement(children, { className: "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" })}</label>;
}
