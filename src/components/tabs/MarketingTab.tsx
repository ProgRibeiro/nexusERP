"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  BarChart3, BriefcaseBusiness, CalendarDays, Camera, Check, ChevronLeft, ChevronRight, Clock3,
  Eye, Filter, Lightbulb, Megaphone, MoreHorizontal,
  Pencil, Plus, Search, Send, Sparkles, Target, ThumbsUp, Trash2, Users, Video,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { deleteMarketingPost, getMarketingPosts, importLegacyMarketingPosts, saveMarketingPost } from "@/app/actions/marketingActions";

type Status = "IDEIA" | "PRODUCAO" | "REVISAO" | "AGENDADO" | "PUBLICADO";
type Channel = "Instagram" | "Facebook" | "LinkedIn" | "TikTok";
type Post = {
  id: string; title: string; caption: string; date: string; time: string;
  status: Status; channels: Channel[]; format: string; owner: string; campaign: string;
};

const statusMeta: Record<Status, { label: string; style: string; dot: string }> = {
  IDEIA: { label: "Ideia", style: "bg-violet-500/10 text-violet-300 border-violet-500/20", dot: "bg-violet-400" },
  PRODUCAO: { label: "Em produção", style: "bg-blue-500/10 text-blue-300 border-blue-500/20", dot: "bg-blue-400" },
  REVISAO: { label: "Em revisão", style: "bg-orange-500/10 text-orange-300 border-orange-500/20", dot: "bg-orange-400" },
  AGENDADO: { label: "Agendado", style: "bg-cyan-500/10 text-cyan-300 border-cyan-500/20", dot: "bg-cyan-400" },
  PUBLICADO: { label: "Publicado", style: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20", dot: "bg-emerald-400" },
};

const channelIcon = { Instagram: Camera, Facebook: ThumbsUp, LinkedIn: BriefcaseBusiness, TikTok: Video };
const toKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const today = toKey(new Date());
const offset = (days: number) => { const d = new Date(); d.setDate(d.getDate()+days); return toKey(d); };

const seed: Post[] = [
  { id:"p1", title:"3 sinais de que seu ar-condicionado precisa de manutenção", caption:"Seu equipamento está dando sinais? Salve este checklist e evite imprevistos.", date:today, time:"09:00", status:"AGENDADO", channels:["Instagram","Facebook"], format:"Carrossel", owner:"Marina", campaign:"Conteúdo educativo" },
  { id:"p2", title:"Bastidores: atendimento em campo", caption:"Hoje acompanhamos nossa equipe técnica em mais uma missão concluída.", date:today, time:"14:30", status:"PRODUCAO", channels:["Instagram","TikTok"], format:"Reels", owner:"Carlos", campaign:"Autoridade da marca" },
  { id:"p3", title:"Case de sucesso — Rede Primavera", caption:"Como reduzimos em 32% as paradas não programadas do cliente.", date:offset(1), time:"11:00", status:"REVISAO", channels:["LinkedIn","Instagram"], format:"Case", owner:"Marina", campaign:"Prova social" },
  { id:"p4", title:"Dica rápida de economia de energia", caption:"Uma regulagem simples pode fazer diferença na conta no fim do mês.", date:offset(2), time:"18:00", status:"IDEIA", channels:["Instagram"], format:"Story", owner:"Rafael", campaign:"Conteúdo educativo" },
  { id:"p5", title:"Contrato preventivo: tranquilidade o ano inteiro", caption:"Cuidar antes custa menos. Conheça nossos planos preventivos.", date:offset(-1), time:"10:00", status:"PUBLICADO", channels:["LinkedIn","Facebook"], format:"Imagem", owner:"Marina", campaign:"Geração de leads" },
];

const emptyForm: Omit<Post,"id"> = { title:"", caption:"", date:today, time:"09:00", status:"IDEIA", channels:["Instagram"], format:"Carrossel", owner:"Marina", campaign:"Conteúdo educativo" };

export default function MarketingTab() {
  const { toast } = useToast();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState(today);
  const [view, setView] = useState<"agenda"|"fluxo"|"ideias">("agenda");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status|"TODOS">("TODOS");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<string|null>(null);
  const [form, setForm] = useState(emptyForm);

  async function loadPosts() {
    setLoading(true);
    try {
      let serverPosts = await getMarketingPosts() as Post[];
      if (!serverPosts.length) {
        const legacyRaw = localStorage.getItem("nx_marketing_posts_v1");
        const legacy = legacyRaw ? JSON.parse(legacyRaw) as Post[] : seed;
        if (legacy.length) {
          const imported = await importLegacyMarketingPosts(legacy);
          if (imported.success) {
            serverPosts = await getMarketingPosts() as Post[];
            localStorage.removeItem("nx_marketing_posts_v1");
          }
        }
      }
      setPosts(serverPosts);
    } catch { toast("Não foi possível carregar o calendário compartilhado.", "error"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void loadPosts(); }, []);

  const days = useMemo(() => Array.from({length:7},(_,i)=>{ const d=new Date(); d.setDate(d.getDate()+i-2); return d; }), []);
  const filtered = useMemo(() => posts.filter(p => (status==="TODOS"||p.status===status) && (!query || `${p.title} ${p.campaign} ${p.owner}`.toLowerCase().includes(query.toLowerCase()))), [posts,query,status]);
  const dayPosts = filtered.filter(p=>p.date===selectedDate).sort((a,b)=>a.time.localeCompare(b.time));
  const published = posts.filter(p=>p.status==="PUBLICADO").length;
  const planned = posts.filter(p=>p.date>=today && p.status!=="PUBLICADO").length;
  const needsReview = posts.filter(p=>p.status==="REVISAO").length;

  function openNew() { setEditing(null); setForm({...emptyForm,date:selectedDate}); setModal(true); }
  function openEdit(post: Post) { setEditing(post.id); setForm({...post}); setModal(true); }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.date || form.channels.length===0) { toast("Preencha o título, a data e pelo menos um canal.","warning"); return; }
    setSaving(true);
    const result = await saveMarketingPost({ ...form, id: editing || undefined });
    setSaving(false);
    if (!result.success) { toast(result.error, "error"); return; }
    setPosts(current => editing ? current.map(p => p.id === editing ? result.post as Post : p) : [...current, result.post as Post]);
    setModal(false); toast(editing?"Conteúdo atualizado no banco.":"Conteúdo salvo no calendário da equipe.");
  }
  async function remove(id:string) { setSaving(true); const result=await deleteMarketingPost(id); setSaving(false); if(!result.success){toast(result.error,"error");return;} setPosts(current=>current.filter(p=>p.id!==id)); setModal(false); toast("Conteúdo removido do calendário compartilhado.","info"); }
  function toggleChannel(channel:Channel) { setForm(f=>({...f,channels:f.channels.includes(channel)?f.channels.filter(c=>c!==channel):[...f.channels,channel]})); }
  function changeDate(direction:number) { const d=new Date(`${selectedDate}T12:00:00`); d.setDate(d.getDate()+direction); setSelectedDate(toKey(d)); }

  return (
    <div className="min-h-full space-y-5 pb-8 text-white animate-in fade-in duration-200">
      <header className="overflow-hidden rounded-3xl border border-[#d4af37]/15 bg-[radial-gradient(circle_at_90%_-30%,rgba(212,175,55,.22),transparent_24rem),#101115] shadow-[0_18px_44px_rgba(0,0,0,.3)]">
        <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between lg:p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#d4af37] text-[#0b0c0e]"><Megaphone size={23}/></div>
            <div><div className="mb-1 flex items-center gap-2"><span className="text-[9px] font-black uppercase tracking-[.2em] text-[#d4af37]">Operação de conteúdo</span><span className="h-1 w-1 rounded-full bg-emerald-400"/><span className="text-[9px] font-bold text-emerald-400">Equipe ativa</span></div><h1 className="text-xl font-black tracking-tight sm:text-2xl">Central de Marketing</h1><p className="mt-1 text-xs text-zinc-400">Planeje, produza, aprove e acompanhe cada publicação.</p></div>
          </div>
          <button onClick={openNew} disabled={loading} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#d4af37] px-5 text-xs font-black text-[#111216] shadow-lg transition hover:bg-[#e5c35e] disabled:opacity-50"><Plus size={17}/> {loading?"Carregando agenda...":"Novo conteúdo"}</button>
        </div>
        <div className="grid grid-cols-2 border-t border-white/[.07] lg:grid-cols-4">
          {[[CalendarDays,"Planejados",planned,"esta semana"],[Eye,"Publicados",published,"no calendário"],[Clock3,"Para revisar",needsReview,"aguardando aprovação"],[Target,"Meta semanal","71%","5 de 7 posts"]].map(([Icon,label,value,note],i)=>{const I=Icon as typeof CalendarDays;return <div key={label as string} className={`p-4 lg:px-6 ${i%2 ? "border-l border-white/[.07]":""} ${i>1?"border-t lg:border-t-0":""} lg:border-l lg:first:border-l-0`}><div className="flex items-center gap-2 text-zinc-500"><I size={14}/><span className="text-[9px] font-black uppercase tracking-wider">{label as string}</span></div><div className="mt-2 flex items-end gap-2"><strong className="text-2xl font-black">{value as React.ReactNode}</strong><span className="mb-1 text-[9px] text-zinc-500">{note as string}</span></div></div>})}
        </div>
      </header>

      <section className="rounded-2xl border border-white/[.08] bg-[#131418] p-3 shadow-xl">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex rounded-xl bg-black/25 p-1">
            {([['agenda',CalendarDays,'Agenda diária'],['fluxo,',BarChart3,'Fluxo de produção'],['ideias',Lightbulb,'Banco de ideias']] as const).map(([key,Icon,label])=>{const realKey=key.replace(',','') as typeof view;return <button key={key} onClick={()=>setView(realKey)} className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-[10px] font-black transition sm:flex-none ${view===realKey?'bg-white/10 text-[#f0cd62] shadow-sm':'text-zinc-500 hover:text-zinc-300'}`}><Icon size={14}/>{label}</button>})}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 focus-within:border-[#d4af37]/50"><Search size={14} className="text-zinc-500"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar conteúdo..." className="w-full bg-transparent text-xs outline-none placeholder:text-zinc-600 sm:w-48"/></label>
            <label className="flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3"><Filter size={14} className="text-zinc-500"/><select value={status} onChange={e=>setStatus(e.target.value as Status|"TODOS")} className="bg-[#131418] text-xs outline-none"><option value="TODOS">Todos os status</option>{Object.entries(statusMeta).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></label>
          </div>
        </div>
      </section>

      {view==="agenda" && <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
        <section className="overflow-hidden rounded-2xl border border-white/[.08] bg-[#131418] shadow-xl">
          <div className="flex items-center justify-between border-b border-white/[.07] p-4"><button onClick={()=>changeDate(-1)} className="rounded-lg p-2 text-zinc-400 hover:bg-white/5"><ChevronLeft size={17}/></button><div className="text-center"><p className="text-xs font-black capitalize">{new Date(`${selectedDate}T12:00`).toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'})}</p><button onClick={()=>setSelectedDate(today)} className="mt-1 text-[9px] font-black uppercase tracking-wider text-[#d4af37]">Voltar para hoje</button></div><button onClick={()=>changeDate(1)} className="rounded-lg p-2 text-zinc-400 hover:bg-white/5"><ChevronRight size={17}/></button></div>
          <div className="grid grid-cols-7 border-b border-white/[.07] p-2 sm:p-3">{days.map(d=>{const key=toKey(d),active=key===selectedDate;return <button key={key} onClick={()=>setSelectedDate(key)} className={`mx-0.5 rounded-xl py-2 text-center transition sm:py-3 ${active?'bg-[#d4af37] text-[#111216]':'hover:bg-white/5'}`}><span className={`block text-[8px] font-black uppercase ${active?'text-black/60':'text-zinc-600'}`}>{d.toLocaleDateString('pt-BR',{weekday:'short'}).replace('.','')}</span><strong className="mt-1 block text-sm">{d.getDate()}</strong><span className={`mx-auto mt-1 block h-1 w-1 rounded-full ${posts.some(p=>p.date===key)?active?'bg-black/60':'bg-[#d4af37]':'bg-transparent'}`}/></button>})}</div>
          <div className="min-h-[420px] p-4 sm:p-5">{dayPosts.length===0?<div className="flex h-80 flex-col items-center justify-center text-center"><div className="mb-4 rounded-2xl border border-dashed border-white/10 bg-white/[.025] p-5"><CalendarDays size={28} className="text-zinc-600"/></div><p className="text-sm font-bold text-zinc-300">Nenhuma publicação neste dia</p><p className="mt-1 max-w-xs text-xs text-zinc-600">Aproveite o espaço na agenda ou mova uma ideia para esta data.</p><button onClick={openNew} className="mt-4 text-xs font-black text-[#d4af37]">+ Criar conteúdo</button></div>:<div className="space-y-3">{dayPosts.map(post=><article key={post.id} className="group grid gap-3 rounded-2xl border border-white/[.08] bg-white/[.025] p-4 transition hover:border-[#d4af37]/25 hover:bg-white/[.04] sm:grid-cols-[64px_1fr_auto] sm:items-center"><div className="flex items-center gap-2 sm:block"><span className="text-sm font-black">{post.time}</span><span className="text-[9px] text-zinc-600 sm:mt-1 sm:block">{post.format}</span></div><div className="min-w-0"><div className="mb-2 flex flex-wrap items-center gap-2"><span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[8px] font-black uppercase ${statusMeta[post.status].style}`}><span className={`h-1.5 w-1.5 rounded-full ${statusMeta[post.status].dot}`}/>{statusMeta[post.status].label}</span><span className="text-[9px] font-bold text-zinc-600">{post.campaign}</span></div><h3 className="truncate text-xs font-black text-zinc-100 sm:text-sm">{post.title}</h3><div className="mt-2 flex items-center gap-3"><div className="flex gap-1">{post.channels.map(c=>{const I=channelIcon[c];return <span key={c} title={c} className="rounded-md bg-white/5 p-1 text-zinc-400"><I size={11}/></span>})}</div><span className="flex items-center gap-1 text-[9px] text-zinc-600"><Users size={10}/>{post.owner}</span></div></div><button onClick={()=>openEdit(post)} className="self-start rounded-lg p-2 text-zinc-500 opacity-100 transition hover:bg-white/10 hover:text-white sm:opacity-0 sm:group-hover:opacity-100" aria-label="Editar conteúdo"><MoreHorizontal size={17}/></button></article>)}</div>}</div>
        </section>
        <aside className="space-y-5"><div className="rounded-2xl border border-white/[.08] bg-[#131418] p-5"><div className="flex items-center gap-2"><Sparkles size={16} className="text-[#d4af37]"/><h2 className="text-xs font-black">Checklist do dia</h2></div><div className="mt-4 space-y-3">{["Revisar legendas e ortografia","Validar links e marcações","Conferir dimensão dos criativos","Responder comentários pendentes"].map((item,i)=><label key={item} className="flex cursor-pointer items-start gap-3 text-[10px] text-zinc-400"><input type="checkbox" defaultChecked={i===0} className="mt-0.5 accent-[#d4af37]"/><span>{item}</span></label>)}</div></div><div className="rounded-2xl border border-[#d4af37]/15 bg-[linear-gradient(145deg,rgba(212,175,55,.12),rgba(212,175,55,.025))] p-5"><Lightbulb size={19} className="text-[#d4af37]"/><h2 className="mt-3 text-sm font-black">Próxima oportunidade</h2><p className="mt-2 text-[10px] leading-relaxed text-zinc-400">Posts educativos geram mais salvamentos. Transforme uma dúvida frequente de clientes em carrossel.</p><button onClick={()=>{setView('ideias');setStatus('TODOS')}} className="mt-4 text-[10px] font-black text-[#f0cd62]">Ver banco de ideias →</button></div></aside>
      </div>}

      {view==="fluxo" && <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">{(Object.keys(statusMeta) as Status[]).map(s=><div key={s} className="min-h-[420px] rounded-2xl border border-white/[.08] bg-[#131418] p-3"><div className="mb-3 flex items-center justify-between px-1"><span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider"><span className={`h-2 w-2 rounded-full ${statusMeta[s].dot}`}/>{statusMeta[s].label}</span><span className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] text-zinc-500">{filtered.filter(p=>p.status===s).length}</span></div><div className="space-y-2">{filtered.filter(p=>p.status===s).map(post=><button key={post.id} onClick={()=>openEdit(post)} className="w-full rounded-xl border border-white/[.07] bg-white/[.03] p-3 text-left transition hover:border-[#d4af37]/25"><p className="text-[11px] font-bold leading-relaxed">{post.title}</p><div className="mt-3 flex items-center justify-between text-[8px] text-zinc-600"><span>{new Date(`${post.date}T12:00`).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})} · {post.time}</span><span>{post.owner}</span></div></button>)}</div></div>)}</section>}

      {view==="ideias" && <section className="rounded-2xl border border-white/[.08] bg-[#131418] p-5"><div className="flex items-center justify-between"><div><h2 className="text-sm font-black">Banco de ideias</h2><p className="mt-1 text-[10px] text-zinc-500">Rascunhos e pautas para alimentar o calendário.</p></div><button onClick={openNew} className="rounded-xl border border-[#d4af37]/25 px-3 py-2 text-[10px] font-black text-[#d4af37]">+ Adicionar ideia</button></div><div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filtered.filter(p=>p.status==='IDEIA').map(post=><button key={post.id} onClick={()=>openEdit(post)} className="rounded-2xl border border-white/[.08] bg-white/[.025] p-4 text-left transition hover:-translate-y-0.5 hover:border-[#d4af37]/30"><div className="flex items-start justify-between"><span className="rounded-lg bg-violet-500/10 p-2 text-violet-300"><Lightbulb size={15}/></span><Pencil size={13} className="text-zinc-600"/></div><h3 className="mt-4 text-xs font-black leading-relaxed">{post.title}</h3><p className="mt-2 line-clamp-2 text-[10px] leading-relaxed text-zinc-500">{post.caption||'Legenda ainda não criada.'}</p><div className="mt-4 flex items-center justify-between border-t border-white/[.06] pt-3 text-[8px] text-zinc-600"><span>{post.format}</span><span>{post.owner}</span></div></button>)}</div></section>}

      <Modal isOpen={modal} onClose={()=>!saving&&setModal(false)} title={editing?"Editar conteúdo":"Novo conteúdo"} size="lg"><form onSubmit={save} className="space-y-5 p-5 text-zinc-100"><div className="grid gap-4 sm:grid-cols-2"><label className="sm:col-span-2"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-zinc-500">Título da pauta *</span><input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Ex.: 5 cuidados antes do verão" className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-xs outline-none focus:border-[#d4af37]/50"/></label><label className="sm:col-span-2"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-zinc-500">Legenda / briefing</span><textarea value={form.caption} onChange={e=>setForm({...form,caption:e.target.value})} rows={4} placeholder="Mensagem principal, CTA, referências e hashtags..." className="w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-xs leading-relaxed outline-none focus:border-[#d4af37]/50"/></label>{[["Data","date","date"],["Horário","time","time"]].map(([label,key,type])=><label key={key}><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-zinc-500">{label}</span><input type={type} value={form[key as 'date'|'time']} onChange={e=>setForm({...form,[key]:e.target.value})} className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-xs outline-none"/></label>)}<label><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-zinc-500">Status</span><select value={form.status} onChange={e=>setForm({...form,status:e.target.value as Status})} className="w-full rounded-xl border border-white/10 bg-[#16171b] px-3 py-3 text-xs">{Object.entries(statusMeta).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></label><label><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-zinc-500">Formato</span><select value={form.format} onChange={e=>setForm({...form,format:e.target.value})} className="w-full rounded-xl border border-white/10 bg-[#16171b] px-3 py-3 text-xs">{["Carrossel","Reels","Story","Imagem","Vídeo","Case","Artigo"].map(x=><option key={x}>{x}</option>)}</select></label><label><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-zinc-500">Responsável</span><input value={form.owner} onChange={e=>setForm({...form,owner:e.target.value})} className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-xs outline-none"/></label><label><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-zinc-500">Campanha</span><input value={form.campaign} onChange={e=>setForm({...form,campaign:e.target.value})} className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-xs outline-none"/></label></div><div><span className="mb-2 block text-[10px] font-black uppercase tracking-wider text-zinc-500">Canais *</span><div className="flex flex-wrap gap-2">{(["Instagram","Facebook","LinkedIn","TikTok"] as Channel[]).map(c=>{const I=channelIcon[c],active=form.channels.includes(c);return <button type="button" key={c} onClick={()=>toggleChannel(c)} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-bold ${active?'border-[#d4af37]/40 bg-[#d4af37]/10 text-[#f0cd62]':'border-white/10 text-zinc-500'}`}><I size={13}/>{c}{active&&<Check size={11}/>}</button>})}</div></div><div className="flex items-center justify-between border-t border-white/[.07] pt-4">{editing?<button disabled={saving} type="button" onClick={()=>remove(editing)} className="flex items-center gap-2 text-[10px] font-bold text-red-400 disabled:opacity-50"><Trash2 size={14}/> Excluir</button>:<span/>}<div className="flex gap-2"><button disabled={saving} type="button" onClick={()=>setModal(false)} className="rounded-xl px-4 py-2.5 text-[10px] font-bold text-zinc-400 disabled:opacity-50">Cancelar</button><button disabled={saving} className="flex items-center gap-2 rounded-xl bg-[#d4af37] px-5 py-2.5 text-[10px] font-black text-[#111216] disabled:opacity-50"><Send size={13}/>{saving?'Salvando no banco...':editing?'Salvar alterações':'Adicionar à agenda'}</button></div></div></form></Modal>
    </div>
  );
}
