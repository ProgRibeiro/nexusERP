"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2, LockKeyhole, Mail, ShieldAlert } from "lucide-react";
import { loginProviderPortal, registerProviderPortal } from "@/app/actions/providerPortalActions";

export function ProviderAuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [show, setShow] = useState(false); const [loading,setLoading]=useState(false); const [error,setError]=useState("");
  const [form,setForm]=useState({name:"",document:"",phone:"",email:"",password:""});
  const submit=async(e:React.FormEvent)=>{e.preventDefault();setLoading(true);setError("");const result=mode==="login"?await loginProviderPortal(form.email,form.password):await registerProviderPortal(form);setLoading(false);if(result.success){router.push("/portal/prestador/painel");router.refresh();}else setError(result.error||"Não foi possível continuar.");};
  const field="h-12 w-full rounded-xl border border-white/10 bg-white/[.045] px-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-[#d4af37]/70 focus:ring-4 focus:ring-[#d4af37]/10";
  return <form onSubmit={submit} className="mt-7 space-y-4">{mode==="register"&&<><input className={field} required placeholder="Nome ou razão social" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/><div className="grid gap-4 sm:grid-cols-2"><input className={field} required placeholder="CPF ou CNPJ" value={form.document} onChange={e=>setForm({...form,document:e.target.value})}/><input className={field} required placeholder="Telefone / WhatsApp" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></div></>}
    <div className="relative"><Mail className="absolute left-4 top-4 text-zinc-600" size={16}/><input className={`${field} pl-11`} type="email" required autoComplete="email" placeholder="seu@email.com" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></div><div className="relative"><LockKeyhole className="absolute left-4 top-4 text-zinc-600" size={16}/><input className={`${field} pl-11 pr-11`} type={show?"text":"password"} minLength={8} required autoComplete={mode==="login"?"current-password":"new-password"} placeholder={mode==="login"?"Sua senha":"Crie uma senha com 8 caracteres"} value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/><button type="button" aria-label="Mostrar senha" onClick={()=>setShow(!show)} className="absolute right-4 top-4 text-zinc-500">{show?<EyeOff size={17}/>:<Eye size={17}/>}</button></div>
    {error&&<div className="flex gap-2 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-xs text-red-300"><ShieldAlert size={15}/>{error}</div>}<button disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#d4af37] text-sm font-black text-black transition hover:bg-[#ebc94a] disabled:opacity-60">{loading&&<Loader2 className="animate-spin" size={16}/>} {mode==="login"?"Entrar no portal":"Criar meu acesso"}</button><p className="text-center text-xs text-zinc-500">{mode==="login"?"Ainda não possui acesso? ":"Já possui cadastro? "}<Link className="font-bold text-[#d4af37]" href={mode==="login"?"/portal/prestador/cadastro":"/portal/prestador/login"}>{mode==="login"?"Cadastre-se":"Entrar"}</Link></p></form>;
}
