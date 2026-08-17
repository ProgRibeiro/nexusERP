"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, CalendarDays, CheckCircle2, CircleDollarSign, Loader2, Mail, Phone, Plus, Search, ShieldCheck, Users } from "lucide-react";
import { createProvider, generateProviderPayable, getProvidersWorkspace, updateProviderJob } from "@/app/actions/providerActions";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency, formatDate } from "@/lib/utils";

const badge: Record<string, string> = {
  PENDENTE: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  AGENDADO: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  EXECUCAO: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  CONCLUIDO: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  PAGO: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  LIBERADO: "border-yellow-500/30 bg-yellow-500/10 text-yellow-300",
  BLOQUEADO: "border-zinc-600 bg-zinc-800 text-zinc-400",
  CANCELADO: "border-red-500/30 bg-red-500/10 text-red-300",
};

export default function PrestadoresTab() {
  const { toast } = useToast();
  const [data, setData] = useState<any>({ suppliers: [], jobs: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("TODOS");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ name: "", cnpj: "", phone: "", email: "", notes: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await getProvidersWorkspace()); }
    catch { toast("Não foi possível carregar os prestadores.", "error"); }
    finally { setLoading(false); }
  }, [toast]);
  useEffect(() => { void load(); }, [load]);

  const jobs = useMemo(() => data.jobs.filter((job: any) => {
    const match = `${job.supplierName} ${job.clientName} ${job.osCode} ${job.description}`.toLowerCase().includes(search.toLowerCase());
    return match && (filter === "TODOS" || job.executionStatus === filter || job.paymentStatus === filter);
  }), [data.jobs, filter, search]);
  const pendingCost = data.jobs.filter((j: any) => j.paymentStatus !== "PAGO" && j.executionStatus !== "CANCELADO").reduce((sum: number, j: any) => sum + j.costValue, 0);
  const pendingJobs = data.jobs.filter((j: any) => !["CONCLUIDO", "CANCELADO"].includes(j.executionStatus)).length;
  const profit = data.jobs.reduce((sum: number, j: any) => sum + j.profit, 0);

  const setStatus = async (id: string, executionStatus: string) => {
    setBusy(id);
    const result = await updateProviderJob({ id, executionStatus });
    result.success ? toast("Execução atualizada.", "success") : toast(result.error || "Erro ao atualizar.", "error");
    await load(); setBusy("");
  };
  const payable = async (id: string) => {
    setBusy(id);
    const result = await generateProviderPayable(id);
    result.success ? toast("Conta a pagar criada no Financeiro.", "success") : toast(result.error || "Erro ao liberar pagamento.", "error");
    await load(); setBusy("");
  };

  return <div className="space-y-5 text-zinc-100">
    <section className="overflow-hidden rounded-[28px] border border-[#d4af37]/25 bg-[#111318] shadow-2xl">
      <div className="flex flex-col justify-between gap-4 border-b border-zinc-800 bg-gradient-to-r from-[#17130b] to-[#111318] p-6 md:flex-row md:items-center">
        <div><p className="text-[10px] font-black uppercase tracking-[.28em] text-[#d4af37]">Operação terceirizada</p><h1 className="mt-2 text-2xl font-black">Prestadores e fornecedores</h1><p className="mt-1 text-sm text-zinc-400">Execução, custos privados, margem e pagamentos vinculados às OS.</p></div>
        <Button onClick={() => setModal(true)}><Plus size={16}/> Novo prestador</Button>
      </div>
      <div className="grid grid-cols-2 divide-x divide-y divide-zinc-800 md:grid-cols-4 md:divide-y-0">
        {[[Users,"Prestadores",data.suppliers.length],[BriefcaseBusiness,"A executar",pendingJobs],[CircleDollarSign,"Custo pendente",formatCurrency(pendingCost)],[CheckCircle2,"Margem prevista",formatCurrency(profit)]].map(([Icon,label,value]: any) => <div className="p-5" key={label}><Icon size={18} className="text-[#d4af37]"/><p className="mt-3 text-[10px] font-bold uppercase text-zinc-500">{label}</p><p className="mt-1 text-xl font-black">{value}</p></div>)}
      </div>
    </section>

    <section className="rounded-[26px] border border-zinc-800 bg-[#111722] p-5 shadow-xl">
      <div className="mb-5 flex items-start justify-between gap-4"><div><h2 className="font-black">Prestadores cadastrados</h2><p className="mt-1 text-xs text-zinc-500">Cadastros confirmados no banco de dados e disponíveis para propostas.</p></div><span className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[9px] font-black uppercase text-emerald-300"><ShieldCheck size={12}/> Salvo no banco</span></div>
      {data.suppliers.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{data.suppliers.map((supplier:any)=><article key={supplier.id} className="rounded-2xl border border-zinc-800 bg-zinc-950/35 p-4"><div className="flex items-start justify-between gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#d4af37]/10 text-xs font-black text-[#d4af37]">{supplier.name.slice(0,2).toUpperCase()}</div><span className="rounded-full bg-white/5 px-2 py-1 text-[8px] font-bold text-zinc-500">{supplier.portalActive?"Portal ativo":"Cadastro interno"}</span></div><h3 className="mt-3 truncate text-sm font-black text-white">{supplier.name}</h3><p className="mt-1 text-[10px] text-zinc-500">CPF/CNPJ: {supplier.cnpj}</p><div className="mt-3 space-y-1.5 border-t border-zinc-800 pt-3 text-[10px] text-zinc-400"><p className="flex items-center gap-2 truncate"><Phone size={11}/>{supplier.phone}</p><p className="flex items-center gap-2 truncate"><Mail size={11}/>{supplier.email}</p></div></article>)}</div>:!loading&&<p className="rounded-xl border border-dashed border-zinc-800 py-8 text-center text-xs text-zinc-500">Nenhum prestador cadastrado.</p>}
    </section>

    <section className="rounded-[26px] border border-zinc-800 bg-[#111722] p-5 shadow-xl">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h2 className="font-black">OS dos prestadores</h2><p className="text-xs text-zinc-500">O custo abaixo é interno e nunca aparece na proposta do cliente.</p></div><div className="flex gap-2"><div className="relative"><Search className="absolute left-3 top-3 text-zinc-500" size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar prestador, cliente ou OS" className="h-10 w-72 rounded-xl border border-zinc-700 bg-zinc-900 pl-9 pr-3 text-xs outline-none focus:border-[#d4af37]"/></div><select value={filter} onChange={e=>setFilter(e.target.value)} className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-xs">{["TODOS","PENDENTE","AGENDADO","EXECUCAO","CONCLUIDO","LIBERADO","PAGO"].map(x=><option key={x}>{x}</option>)}</select></div></div>
      <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="border-y border-zinc-800 bg-zinc-950/50 text-[10px] uppercase tracking-wider text-zinc-500"><tr>{["Prestador / serviço","Cliente","OS / proposta","Execução","Custo interno","Venda / lucro","Pagamento","Ações"].map(x=><th key={x} className="px-4 py-3">{x}</th>)}</tr></thead><tbody className="divide-y divide-zinc-800">{jobs.map((job:any)=><tr key={job.id} className="hover:bg-white/[.025]"><td className="px-4 py-4"><p className="font-bold text-white">{job.supplierName}</p><p className="mt-1 max-w-[240px] text-xs text-zinc-400">{job.description}</p></td><td className="px-4 py-4 font-semibold">{job.clientName}</td><td className="px-4 py-4"><p className="text-[#e6c653]">{job.osCode}</p><p className="text-xs text-zinc-500">{job.quoteCode}</p></td><td className="px-4 py-4"><span className={`rounded-full border px-2 py-1 text-[9px] font-black ${badge[job.executionStatus]}`}>{job.executionStatus}</span>{job.scheduledDate&&<p className="mt-2 text-[10px] text-zinc-500"><CalendarDays className="mr-1 inline" size={11}/>{formatDate(job.scheduledDate)}</p>}</td><td className="px-4 py-4 font-black">{formatCurrency(job.costValue)}</td><td className="px-4 py-4"><p>{formatCurrency(job.saleValue)}</p><p className="text-xs font-bold text-emerald-400">+ {formatCurrency(job.profit)}</p></td><td className="px-4 py-4"><span className={`rounded-full border px-2 py-1 text-[9px] font-black ${badge[job.paymentStatus]}`}>{job.paymentStatus}</span></td><td className="px-4 py-4"><div className="flex flex-wrap gap-2">{job.executionStatus==="PENDENTE"&&<Button size="sm" variant="secondary" disabled={busy===job.id} onClick={()=>setStatus(job.id,"AGENDADO")}>Agendar</Button>}{["PENDENTE","AGENDADO"].includes(job.executionStatus)&&<Button size="sm" variant="secondary" disabled={busy===job.id} onClick={()=>setStatus(job.id,"EXECUCAO")}>Iniciar</Button>}{job.executionStatus==="EXECUCAO"&&<Button size="sm" disabled={busy===job.id} onClick={()=>setStatus(job.id,"CONCLUIDO")}>Concluir</Button>}{job.executionStatus==="CONCLUIDO"&&!job.payableId&&<Button size="sm" disabled={busy===job.id} onClick={()=>payable(job.id)}>Liberar pagamento</Button>}{busy===job.id&&<Loader2 className="animate-spin" size={16}/>}</div></td></tr>)}</tbody></table>{!loading&&!jobs.length&&<p className="py-14 text-center text-sm text-zinc-500">Nenhuma OS de prestador encontrada. Elas serão criadas quando uma proposta terceirizada for convertida em OS.</p>}{loading&&<div className="flex justify-center py-14"><Loader2 className="animate-spin text-[#d4af37]"/></div>}</div>
    </section>

    <Modal isOpen={modal} onClose={()=>busy!=="new"&&setModal(false)} title="Cadastrar prestador"><form className="space-y-4" onSubmit={async e=>{e.preventDefault();if(busy==="new")return;setBusy("new");try{const r=await createProvider(form);if(r.success){await load();toast(`${r.supplier?.name||"Prestador"} foi salvo no banco de dados.`,"success");setModal(false);setForm({name:"",cnpj:"",phone:"",email:"",notes:""});}else toast(r.error||"Erro ao cadastrar.","error");}catch{toast("A conexão falhou antes da confirmação. Seus dados continuam no formulário para tentar novamente.","error");}finally{setBusy("");}}}><Input label="Nome / Razão social" required disabled={busy==="new"} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/><Input label="CPF / CNPJ" required disabled={busy==="new"} inputMode="numeric" placeholder="11 dígitos para CPF ou 14 para CNPJ" value={form.cnpj} onChange={e=>setForm({...form,cnpj:e.target.value})}/><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Input label="Telefone" required disabled={busy==="new"} value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/><Input label="E-mail" type="email" required disabled={busy==="new"} value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></div><Input label="Observações internas" disabled={busy==="new"} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/><p className="flex items-start gap-2 rounded-xl border border-emerald-500/15 bg-emerald-500/[.06] p-3 text-[10px] leading-relaxed text-emerald-200"><ShieldCheck className="mt-0.5 shrink-0" size={13}/>O formulário só será fechado depois que o banco confirmar a gravação. Em caso de falha, os dados digitados são preservados.</p><div className="flex justify-end"><Button type="submit" disabled={busy==="new"}>{busy==="new"?<Loader2 className="animate-spin"/>:<Plus size={15}/>} {busy==="new"?"Salvando...":"Cadastrar e confirmar"}</Button></div></form></Modal>
  </div>;
}
