"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { CheckCircle2, KeyRound, Loader2, Mail, ShieldCheck } from "lucide-react";
import { confirmPasswordResetAction, requestPasswordResetAction } from "@/app/actions/userActions";
import { PrestadorBrand } from "@/components/brand/PrestadorBrand";

export function PasswordRecoveryForm({ token }: { token: string }) {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setMessage("");
    if (token && password !== confirmation) return setError("As senhas não coincidem.");
    setLoading(true);
    try {
      if (token) { const result = await confirmPasswordResetAction(token, password); if (!result.success) return setError(result.error || "Não foi possível redefinir a senha."); setMessage("Senha redefinida. Todas as sessões anteriores foram revogadas."); }
      else { const result = await requestPasswordResetAction(email); setMessage(result.message); }
    } finally { setLoading(false); }
  }
  return <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#061426] px-5 py-16 text-white"><div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(21,94,239,.22),transparent_32%),radial-gradient(circle_at_90%_90%,rgba(56,189,248,.12),transparent_30%)]"/><div className="relative w-full max-w-lg rounded-[28px] border border-white/10 bg-white/[.045] p-6 shadow-[0_35px_100px_rgba(0,0,0,.45)] backdrop-blur-2xl sm:p-9"><PrestadorBrand light/><div className="mt-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#155eef]/15 text-[#60a5fa] ring-1 ring-[#155eef]/30">{token ? <KeyRound size={22}/> : <Mail size={22}/>}</div><p className="mt-5 text-[10px] font-black uppercase tracking-[0.22em] text-[#38bdf8]">Acesso protegido</p><h1 className="mt-2 text-3xl font-black">{token ? "Definir nova senha" : "Recuperar senha"}</h1><p className="mt-3 text-sm leading-6 text-slate-400">{token ? "Crie uma senha com pelo menos 12 caracteres. O link funciona uma única vez." : "Informe o e-mail cadastrado. Por segurança, a resposta não confirma se a conta existe."}</p><form onSubmit={submit} className="mt-7 space-y-4">{token ? <><input type="password" minLength={12} required value={password} onChange={(e)=>setPassword(e.target.value)} className="h-12 w-full rounded-xl border border-white/15 bg-slate-950/45 px-4 text-sm outline-none focus:border-[#38bdf8]" placeholder="Nova senha"/><input type="password" minLength={12} required value={confirmation} onChange={(e)=>setConfirmation(e.target.value)} className="h-12 w-full rounded-xl border border-white/15 bg-slate-950/45 px-4 text-sm outline-none focus:border-[#38bdf8]" placeholder="Confirmar nova senha"/></> : <input type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} className="h-12 w-full rounded-xl border border-white/15 bg-slate-950/45 px-4 text-sm outline-none focus:border-[#38bdf8]" placeholder="E-mail da conta"/>}{error&&<p className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-xs text-rose-200">{error}</p>}{message&&<p className="flex items-start gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-xs text-emerald-200"><CheckCircle2 size={15} className="mt-0.5 shrink-0"/>{message}</p>}<button disabled={loading||Boolean(message)} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#155eef] text-sm font-black shadow-lg shadow-blue-950/30 transition hover:bg-[#2563eb] disabled:opacity-60">{loading?<Loader2 size={17} className="animate-spin"/>:<ShieldCheck size={17}/>} {token?"Salvar nova senha":"Enviar instruções"}</button></form><p className="mt-6 text-center text-xs text-slate-500">{message&&token?<Link href="/login" className="font-bold text-[#60a5fa] hover:underline">Entrar com a nova senha</Link>:<>Lembrou a senha? <Link href="/login" className="font-bold text-[#60a5fa] hover:underline">Voltar ao login</Link></>}</p></div></main>;
}
